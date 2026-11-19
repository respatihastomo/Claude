import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { CloudEvent, consumeIdempotent } from '@arkas/common-ms';
import { KertasKerjaDisahkanData, ReferensiDiubahData } from '@arkas/kontrak';
import { POOL_WORKER, SKEMA } from '../infra/tokens';

/** Kontrak konsumen (Pact-style): hanya field yang dipakai svc-pemantauan. */
const Item = z.object({ itemId: z.string(), barisId: z.string().uuid().nullable(), kodeRekening: z.string(), uraian: z.string(), jumlah: z.number() });
export const TrxMitraDiterima = z.object({
  transaksiMitraId: z.string().uuid(), mitraKode: z.string(), transactionId: z.string(), npsn: z.string().regex(/^\d{8}$/), tahun: z.number().int(),
  sumberDanaKode: z.string(), tanggal: z.string(), items: z.array(Item).min(1),
});
export const TrxMitraDibatalkan = z.object({ transaksiMitraId: z.string().uuid(), npsn: z.string(), tahun: z.number().int(), sumberDanaKode: z.string(), status: z.enum(['DIBATALKAN', 'RETUR']) });
export const TrxDisetujui = z.object({
  transaksiId: z.string().uuid(), npsn: z.string(), tahun: z.number().int(), sumberDanaKode: z.string(), jenis: z.string(), tanggal: z.string(), nilaiBruto: z.number(),
  sumberMitra: z.object({ transaksiMitraId: z.string() }).nullable().optional(),
});
export const PeriodeDitutup = z.object({ npsn: z.string(), tahun: z.number().int(), sumberDanaKode: z.string(), bulan: z.number().int().min(1).max(12), ditutupAt: z.string() });
export const PembukaanDikonfirmasi = z.object({ sumberDanaKode: z.string(), mitraKode: z.string(), versi: z.number().int(), status: z.enum(['DIBUKA', 'GAGAL']), at: z.string() });

const antre = (tx: PoolClient, npsn: string, tahun: number, sd: string) => tx.query(
  `INSERT INTO pemantauan.hpp_antrean (npsn, tahun, sumber_dana_kode) VALUES ($1,$2,$3)
   ON CONFLICT (npsn, tahun, sumber_dana_kode) DO UPDATE SET diminta_at = now()`, [npsn, tahun, sd]);

/**
 * Konsumen svc-pemantauan (idempoten). Rencana & belanja Mitra mengantrekan hitung ulang HPP buku itu (SK-11);
 * realisasi & periode mengisi dasbor serapan/kepatuhan (UC-30); referensi memberi jenjang & wilayah untuk agregat.
 */
@Injectable()
export class KonsumenPemantauan {
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool) {}

  private olah<T>(event: CloudEvent, skema: z.ZodType<T>, f: (tx: PoolClient, d: T) => Promise<void>) {
    const d = skema.parse(event.data);
    return consumeIdempotent(this.pool, SKEMA, { ...event, data: d }, (tx) => f(tx, d));
  }

  referensiDiubah(e: CloudEvent) {
    return this.olah(e, ReferensiDiubahData, async (tx, r) => {
      const d = r.data as Record<string, string | null>;
      if (r.entitas === 'SEKOLAH') {
        await tx.query(
          `INSERT INTO pemantauan.ref_sekolah_lokal (npsn, nama, jenjang_kode, wilayah_kode, aktif, versi) VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (npsn) DO UPDATE SET nama = EXCLUDED.nama, jenjang_kode = EXCLUDED.jenjang_kode, wilayah_kode = EXCLUDED.wilayah_kode, aktif = EXCLUDED.aktif, versi = EXCLUDED.versi
           WHERE pemantauan.ref_sekolah_lokal.versi < EXCLUDED.versi`, [d.npsn, d.nama, d.jenjangKode, d.wilayahKode, r.aktif, r.versi]);
      } else if (r.entitas === 'WILAYAH') {
        await tx.query(
          `INSERT INTO pemantauan.ref_wilayah_lokal (kode, nama, induk_kode, versi) VALUES ($1,$2,$3,$4)
           ON CONFLICT (kode) DO UPDATE SET nama = EXCLUDED.nama, induk_kode = EXCLUDED.induk_kode, versi = EXCLUDED.versi WHERE pemantauan.ref_wilayah_lokal.versi < EXCLUDED.versi`,
          [d.kode, d.nama, d.indukKode ?? null, r.versi]);
      }
    });
  }

  kertasKerjaDisahkan(e: CloudEvent) {
    return this.olah(e, KertasKerjaDisahkanData, async (tx, d) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pemantauan:${d.npsn}:${d.tahun}:${d.sumberDanaKode}`]);
      const v = (await tx.query<{ v: number | null }>('SELECT max(versi) v FROM pemantauan.rencana_sah_lokal WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3 AND aktif',
        [d.npsn, d.tahun, d.sumberDanaKode])).rows[0].v;
      if (v !== null && v > d.versi) return;
      for (const b of d.baris) {
        let akar = b.id;
        if (b.asalBarisId) akar = (await tx.query<{ a: string }>('SELECT akar_baris_id a FROM pemantauan.rencana_sah_lokal WHERE baris_id = $1', [b.asalBarisId])).rows[0]?.a ?? b.asalBarisId;
        await tx.query(
          `INSERT INTO pemantauan.rencana_sah_lokal (baris_id, akar_baris_id, npsn, tahun, sumber_dana_kode, versi, kode_rekening, kegiatan, uraian, total, aktif)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
           ON CONFLICT (baris_id) DO UPDATE SET versi = EXCLUDED.versi, kode_rekening = EXCLUDED.kode_rekening, kegiatan = EXCLUDED.kegiatan, uraian = EXCLUDED.uraian, total = EXCLUDED.total, aktif = true`,
          [b.id, akar, d.npsn, d.tahun, d.sumberDanaKode, d.versi, b.kodeRekening, b.kegiatan, b.uraian, b.total]);
      }
      await tx.query(`UPDATE pemantauan.rencana_sah_lokal SET aktif = false WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3 AND aktif AND NOT (baris_id = ANY($4::uuid[]))`,
        [d.npsn, d.tahun, d.sumberDanaKode, d.baris.map((b) => b.id)]);
      await antre(tx, d.npsn, d.tahun, d.sumberDanaKode);
    });
  }

  transaksiMitraDiterima(e: CloudEvent) {
    return this.olah(e, TrxMitraDiterima, async (tx, d) => {
      for (const i of d.items) {
        const akar = i.barisId ? (await tx.query<{ a: string }>('SELECT akar_baris_id a FROM pemantauan.rencana_sah_lokal WHERE baris_id = $1', [i.barisId])).rows[0]?.a ?? i.barisId : null;
        await tx.query(
          `INSERT INTO pemantauan.belanja_mitra_lokal (transaksi_mitra_id, item_id, npsn, tahun, sumber_dana_kode, mitra_kode, transaction_id, tanggal, baris_id, akar_baris_id, kode_rekening, uraian, jumlah)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`,
          [d.transaksiMitraId, i.itemId, d.npsn, d.tahun, d.sumberDanaKode, d.mitraKode, d.transactionId, d.tanggal, i.barisId, akar, i.kodeRekening, i.uraian, i.jumlah]);
      }
      await antre(tx, d.npsn, d.tahun, d.sumberDanaKode);
    });
  }

  transaksiMitraDibatalkan(e: CloudEvent) {
    return this.olah(e, TrxMitraDibatalkan, async (tx, d) => {
      const r = await tx.query(`UPDATE pemantauan.belanja_mitra_lokal SET status = $2 WHERE transaksi_mitra_id = $1`, [d.transaksiMitraId, d.status]);
      if (!r.rowCount) throw new Error(`transaksi Mitra ${d.transaksiMitraId} belum diterima`); // coba ulang (urutan acak)
      await antre(tx, d.npsn, d.tahun, d.sumberDanaKode);
    });
  }

  transaksiDisetujui(e: CloudEvent) {
    return this.olah(e, TrxDisetujui, async (tx, d) => {
      if (d.jenis !== 'BELANJA') return;
      await tx.query(
        `INSERT INTO pemantauan.realisasi_lokal (transaksi_id, npsn, tahun, sumber_dana_kode, tanggal, nilai, dari_mitra) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [d.transaksiId, d.npsn, d.tahun, d.sumberDanaKode, d.tanggal, d.nilaiBruto, !!d.sumberMitra]);
    });
  }

  periodeDitutup(e: CloudEvent) {
    return this.olah(e, PeriodeDitutup, async (tx, d) => {
      await tx.query(`INSERT INTO pemantauan.periode_lokal (npsn, tahun, sumber_dana_kode, bulan, ditutup_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [d.npsn, d.tahun, d.sumberDanaKode, d.bulan, d.ditutupAt]);
    });
  }

  pembukaanDikonfirmasi(e: CloudEvent) {
    return this.olah(e, PembukaanDikonfirmasi, async (tx, d) => {
      await tx.query(
        `INSERT INTO pemantauan.pembukaan_lokal (sumber_dana_kode, mitra_kode, versi, status, at) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (sumber_dana_kode, mitra_kode) DO UPDATE SET versi = EXCLUDED.versi, status = EXCLUDED.status, at = EXCLUDED.at
         WHERE pemantauan.pembukaan_lokal.versi <= EXCLUDED.versi`, [d.sumberDanaKode, d.mitraKode, d.versi, d.status, d.at]);
    });
  }
}
