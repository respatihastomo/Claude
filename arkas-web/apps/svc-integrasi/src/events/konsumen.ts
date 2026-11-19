import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { CloudEvent, consumeIdempotent } from '@arkas/common-ms';
import { KertasKerjaDisahkanData, ReferensiDiubahData, SumberDanaDisahkanData } from '@arkas/kontrak';
import { POOL_WORKER, SKEMA } from '../infra/tokens';
import { bukaSumberDana, tutupSumberDana } from '../pembukaan';

/**
 * Konsumen svc-integrasi (idempoten lewat inbox_processed):
 * - ReferensiDiubah SUMBER_DANA -> proyeksi + pembukaan di semua Mitra aktif (aktif) / penutupan (nonaktif);
 *   ReferensiDiubah SEKOLAH -> proyeksi sekolah (jenjang untuk daftar sekolah berhak).
 * - KertasKerjaDisahkan -> proyeksi rkas_anggaran_mitra (melayani /mitra/v1/.../anggaran) + sekolah berhak (BOSP).
 */
@Injectable()
export class KonsumenIntegrasi {
  private readonly log = new Logger(KonsumenIntegrasi.name);
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool) {}

  async referensiDiubah(event: CloudEvent): Promise<void> {
    const r = ReferensiDiubahData.parse(event.data);
    if (r.entitas !== 'SUMBER_DANA' && r.entitas !== 'SEKOLAH') return;
    await consumeIdempotent(this.pool, SKEMA, { ...event, data: r }, async (tx) => {
      const d = r.data as Record<string, string>;
      if (r.entitas === 'SEKOLAH') {
        await tx.query(
          `INSERT INTO integrasi.ref_sekolah_lokal (npsn, nama, jenjang_kode, wilayah_kode, aktif, versi) VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (npsn) DO UPDATE SET nama = EXCLUDED.nama, jenjang_kode = EXCLUDED.jenjang_kode, wilayah_kode = EXCLUDED.wilayah_kode,
             aktif = EXCLUDED.aktif, versi = EXCLUDED.versi WHERE integrasi.ref_sekolah_lokal.versi < EXCLUDED.versi`,
          [d.npsn, d.nama, d.jenjangKode, d.wilayahKode, r.aktif, r.versi]);
        return;
      }
      const lama = (await tx.query<{ nama: string; kategori: string; aktif: boolean; versi: string }>(
        'SELECT nama, kategori, aktif, versi FROM integrasi.sumber_dana_lokal WHERE kode = $1 FOR UPDATE', [d.kode])).rows[0];
      if (lama && Number(lama.versi) >= r.versi) return; // event lama/duplikat (terbit ulang)
      await tx.query(
        `INSERT INTO integrasi.sumber_dana_lokal (kode, nama, kategori, aktif, versi) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (kode) DO UPDATE SET nama = EXCLUDED.nama, kategori = EXCLUDED.kategori, aktif = EXCLUDED.aktif, versi = EXCLUDED.versi`,
        [d.kode, d.nama, d.kategori, r.aktif, r.versi]);
      if (r.aktif) {
        const berubah = !!lama && lama.aktif && (lama.nama !== d.nama || lama.kategori !== d.kategori);
        const n = await bukaSumberDana(tx, d.kode, 'SISTEM:ReferensiDiubah', { naikkanVersi: berubah });
        this.log.log(`sumber dana ${d.kode}: ${n} pembukaan baru${berubah ? ', versi dinaikkan' : ''}`);
      } else if (lama?.aktif) {
        const n = await tutupSumberDana(tx, d.kode, 'SISTEM:ReferensiDiubah', 'Sumber dana dinonaktifkan Balai SDSP');
        this.log.log(`sumber dana ${d.kode} dinonaktifkan: ${n} pembukaan ditutup`);
      }
    });
  }

  async kertasKerjaDisahkan(event: CloudEvent): Promise<void> {
    const d = KertasKerjaDisahkanData.parse(event.data);
    await consumeIdempotent(this.pool, SKEMA, { ...event, data: d }, (tx) => this.terapkanRkas(tx, d));
  }

  private async terapkanRkas(tx: PoolClient, d: KertasKerjaDisahkanData) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`integrasi:${d.npsn}:${d.tahun}:${d.sumberDanaKode}`]);
    const v = (await tx.query<{ v: number | null }>(
      'SELECT max(versi) v FROM integrasi.rkas_anggaran_mitra WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3 AND aktif', [d.npsn, d.tahun, d.sumberDanaKode])).rows[0].v;
    if (v !== null && v > d.versi) return;
    for (const b of d.baris) {
      let akar = b.id;
      if (b.asalBarisId) akar = (await tx.query<{ akar_baris_id: string }>('SELECT akar_baris_id FROM integrasi.rkas_anggaran_mitra WHERE baris_id = $1', [b.asalBarisId])).rows[0]?.akar_baris_id ?? b.asalBarisId;
      await tx.query(
        `INSERT INTO integrasi.rkas_anggaran_mitra (baris_id, akar_baris_id, kertas_kerja_id, npsn, tahun, sumber_dana_kode, versi, kode_rekening, kegiatan, uraian, volume, satuan, harga_satuan, total, aktif)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)
         ON CONFLICT (baris_id) DO UPDATE SET versi = EXCLUDED.versi, kertas_kerja_id = EXCLUDED.kertas_kerja_id, kode_rekening = EXCLUDED.kode_rekening,
           kegiatan = EXCLUDED.kegiatan, uraian = EXCLUDED.uraian, volume = EXCLUDED.volume, satuan = EXCLUDED.satuan, harga_satuan = EXCLUDED.harga_satuan,
           total = EXCLUDED.total, aktif = true`,
        [b.id, akar, d.kertasKerjaId, d.npsn, d.tahun, d.sumberDanaKode, d.versi, b.kodeRekening, b.kegiatan, b.uraian, b.volume, b.satuan ?? null, b.hargaSatuan, b.total]);
    }
    await tx.query(
      `UPDATE integrasi.rkas_anggaran_mitra SET aktif = false WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3 AND aktif AND NOT (baris_id = ANY($4::uuid[]))`,
      [d.npsn, d.tahun, d.sumberDanaKode, d.baris.map((b) => b.id)]);
    const nilai = d.baris.reduce((a, b) => a + b.total, 0);
    await tx.query(
      `INSERT INTO integrasi.sekolah_berhak_lokal (sumber_dana_kode, tahun, npsn, nilai, asal) VALUES ($1,$2,$3,$4,'RKAS')
       ON CONFLICT (sumber_dana_kode, tahun, npsn) DO UPDATE SET nilai = EXCLUDED.nilai, diubah_at = now() WHERE integrasi.sekolah_berhak_lokal.asal = 'RKAS'`,
      [d.sumberDanaKode, d.tahun, d.npsn, nilai]);
    this.log.log(`RKAS ${d.npsn} ${d.sumberDanaKode} ${d.tahun} v${d.versi}: ${d.baris.length} baris diproyeksikan untuk Mitra`);
  }

  /** SumberDanaDisahkan (Bantuan Pemerintah): sekolah berhak = penerima sah (12.3). Pembukaan di Mitra dipicu ReferensiDiubah dari svc-referensi. */
  async sumberDanaDisahkan(event: CloudEvent): Promise<void> {
    const d = SumberDanaDisahkanData.parse(event.data);
    await consumeIdempotent(this.pool, SKEMA, { ...event, data: d }, async (tx) => {
      await tx.query(`DELETE FROM integrasi.sekolah_berhak_lokal WHERE sumber_dana_kode = $1 AND tahun = $2 AND asal = 'PENERIMA'`, [d.kode, d.tahun]);
      for (const p of d.penerima) {
        await tx.query(`INSERT INTO integrasi.sekolah_berhak_lokal (sumber_dana_kode, tahun, npsn, nilai, asal) VALUES ($1,$2,$3,$4,'PENERIMA')
          ON CONFLICT (sumber_dana_kode, tahun, npsn) DO UPDATE SET nilai = EXCLUDED.nilai, asal = 'PENERIMA', diubah_at = now()`, [d.kode, d.tahun, p.npsn, p.nilai]);
      }
      this.log.log(`SumberDanaDisahkan ${d.kode}: ${d.penerima.length} sekolah berhak`);
    });
  }
}
