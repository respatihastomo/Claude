import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { z } from 'zod';
import { CloudEvent, consumeIdempotent } from '@arkas/common-ms';
import { POOL_WORKER, SKEMA } from '../infra/tokens';

/** Kontrak konsumen (hanya field yang dipakai). */
const Item = z.object({ itemId: z.string(), barisId: z.string().uuid().nullable(), kodeRekening: z.string(), uraian: z.string(), volume: z.number(), satuan: z.string().nullable(), hargaSatuan: z.number(), jumlah: z.number() });
export const TransaksiMitraDiterimaKonsumen = z.object({
  transaksiMitraId: z.string().uuid(), mitraKode: z.string(), transactionId: z.string(), npsn: z.string().regex(/^\d{8}$/), tahun: z.number().int(),
  sumberDanaKode: z.string(), tanggal: z.string(), namaToko: z.string(), penjualPunyaNpwp: z.boolean(), total: z.number(), items: z.array(Item).min(1), diterimaAt: z.string(),
});
export const TransaksiMitraDibatalkanKonsumen = z.object({ transaksiMitraId: z.string().uuid(), status: z.enum(['DIBATALKAN', 'RETUR']), alasan: z.string() });

/**
 * SK-04: TransaksiMitraDiterima -> antrean pemetaan BKU (UC-12). Kompensasi TransaksiMitraDibatalkan:
 * yang belum dicatat langsung DIBATALKAN; yang sudah dicatat ditandai agar Kepala Sekolah menolak / dibuat koreksi.
 */
@Injectable()
export class TransaksiMitraConsumer {
  private readonly log = new Logger(TransaksiMitraConsumer.name);
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool) {}

  async diterima(event: CloudEvent): Promise<void> {
    const d = TransaksiMitraDiterimaKonsumen.parse(event.data);
    await consumeIdempotent(this.pool, SKEMA, { ...event, data: d }, async (tx) => {
      await tx.query(
        `INSERT INTO tatausaha.transaksi_mitra_masuk (id, mitra_kode, transaction_id, npsn, tahun, sumber_dana_kode, tanggal, nama_toko, penjual_punya_npwp, total, items, diterima_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
        [d.transaksiMitraId, d.mitraKode, d.transactionId, d.npsn, d.tahun, d.sumberDanaKode, d.tanggal, d.namaToko, d.penjualPunyaNpwp, d.total, JSON.stringify(d.items), d.diterimaAt]);
    });
    this.log.log(`TransaksiMitraDiterima ${d.mitraKode}/${d.transactionId} -> antrean pemetaan ${d.npsn}`);
  }

  async dibatalkan(event: CloudEvent): Promise<void> {
    const d = TransaksiMitraDibatalkanKonsumen.parse(event.data);
    await consumeIdempotent(this.pool, SKEMA, { ...event, data: d }, async (tx) => {
      const r = await tx.query(
        `UPDATE tatausaha.transaksi_mitra_masuk SET status_mitra = $2, alasan_batal = $3, status = CASE WHEN status = 'MENUNGGU' THEN 'DIBATALKAN' ELSE status END
         WHERE id = $1`, [d.transaksiMitraId, d.status, d.alasan]);
      // urutan acak: pembatalan tiba sebelum penerimaan -> lempar agar dicoba ulang (at-least-once)
      if (!r.rowCount) throw new Error(`transaksi Mitra ${d.transaksiMitraId} belum diterima`);
    });
  }
}
