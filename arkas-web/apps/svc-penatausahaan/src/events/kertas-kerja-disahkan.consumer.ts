import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { CloudEvent, consumeIdempotent } from '@arkas/common-ms';
import { KertasKerjaDisahkanData } from '@arkas/kontrak';
import { POOL_WORKER, SKEMA } from '../infra/tokens';
import { hariIniJakarta } from '../infra/waktu';

/**
 * Konsumen KertasKerjaDisahkan (arkas.perencanaan.kk-disahkan), 8.3:
 *  1. memperbarui proyeksi lokal tatausaha.rkas_baris_sah (versi lama dinonaktifkan; rantai asal_baris_id -> akar_baris_id),
 *  2. membuka periode bulan berjalan buku sekolah tersebut.
 * Idempoten (inbox_processed) dan tahan urutan acak: event berversi lebih lama dari proyeksi diabaikan.
 */
@Injectable()
export class KertasKerjaDisahkanConsumer {
  private readonly log = new Logger(KertasKerjaDisahkanConsumer.name);

  constructor(@Inject(POOL_WORKER) private readonly pool: Pool) {}

  async tangani(event: CloudEvent): Promise<boolean> {
    const data = KertasKerjaDisahkanData.parse(event.data);
    const diproses = await consumeIdempotent(this.pool, SKEMA, { ...event, data }, (tx, d) => this.terapkan(tx, d));
    this.log.log(`${event.type} ${event.id} npsn=${data.npsn} v${data.versi}: ${diproses ? 'diproses' : 'duplikat, dilewati'}`);
    return diproses;
  }

  private async terapkan(tx: PoolClient, d: KertasKerjaDisahkanData): Promise<void> {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`tatausaha:${d.npsn}:${d.tahun}:${d.sumberDanaKode}`]);
    const versiAda = await tx.query<{ v: number | null }>(
      `SELECT max(versi) AS v FROM tatausaha.rkas_baris_sah WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3 AND aktif`,
      [d.npsn, d.tahun, d.sumberDanaKode],
    );
    const v = versiAda.rows[0].v;
    if (v !== null && v > d.versi) {
      this.log.warn(`KertasKerjaDisahkan v${d.versi} lebih lama dari proyeksi v${v}; diabaikan`);
      return;
    }

    await tx.query(`SELECT tatausaha.pastikan_partisi($1::smallint)`, [d.tahun]);

    for (const b of d.baris) {
      let akar = b.id;
      if (b.asalBarisId) {
        const asal = await tx.query<{ akar_baris_id: string }>(`SELECT akar_baris_id FROM tatausaha.rkas_baris_sah WHERE baris_id = $1`, [b.asalBarisId]);
        akar = asal.rows[0]?.akar_baris_id ?? b.asalBarisId;
      }
      await tx.query(
        `INSERT INTO tatausaha.rkas_baris_sah (baris_id, akar_baris_id, asal_baris_id, kertas_kerja_id, versi, npsn, tahun, sumber_dana_kode,
           kode_rekening, kegiatan, uraian, volume, satuan, harga_satuan, total, aktif, diperbarui_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,now())
         ON CONFLICT (baris_id) DO UPDATE SET versi = EXCLUDED.versi, kertas_kerja_id = EXCLUDED.kertas_kerja_id,
           kode_rekening = EXCLUDED.kode_rekening, kegiatan = EXCLUDED.kegiatan, uraian = EXCLUDED.uraian, volume = EXCLUDED.volume,
           satuan = EXCLUDED.satuan, harga_satuan = EXCLUDED.harga_satuan, total = EXCLUDED.total, aktif = true, diperbarui_at = now()`,
        [b.id, akar, b.asalBarisId ?? null, d.kertasKerjaId, d.versi, d.npsn, d.tahun, d.sumberDanaKode, b.kodeRekening, b.kegiatan,
          b.uraian, b.volume, b.satuan ?? null, b.hargaSatuan, b.total],
      );
    }
    await tx.query(
      `UPDATE tatausaha.rkas_baris_sah SET aktif = false, diperbarui_at = now()
       WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3 AND aktif AND NOT (baris_id = ANY($4::uuid[]))`,
      [d.npsn, d.tahun, d.sumberDanaKode, d.baris.map((b) => b.id)],
    );

    const hariIni = hariIniJakarta();
    const tahunIni = Number(hariIni.slice(0, 4));
    const bulan = d.tahun === tahunIni ? Number(hariIni.slice(5, 7)) : d.tahun < tahunIni ? 12 : 1;
    await tx.query(
      `INSERT INTO tatausaha.periode (npsn, tahun, sumber_dana_kode, bulan) VALUES ($1,$2,$3,$4)
       ON CONFLICT (npsn, tahun, sumber_dana_kode, bulan) DO NOTHING`,
      [d.npsn, d.tahun, d.sumberDanaKode, bulan],
    );
  }
}
