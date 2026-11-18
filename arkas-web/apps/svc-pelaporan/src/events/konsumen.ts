import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { z } from 'zod';
import { CloudEvent, consumeIdempotent } from '@arkas/common-ms';
import { POOL_WORKER, SKEMA } from '../infra/tokens';

const Mutasi = z.object({ saldoAwal: z.number(), penerimaan: z.number(), pengeluaran: z.number(), saldoAkhir: z.number() });
/** Kontrak konsumen (Pact-style): hanya field yang dipakai svc-pelaporan yang divalidasi. */
export const PeriodeDitutupKonsumen = z.object({
  periodeId: z.string().uuid(), npsn: z.string().regex(/^\d{8}$/), tahun: z.number().int(), sumberDanaKode: z.string(), bulan: z.number().int().min(1).max(12),
  diajukanOleh: z.string().uuid(), ditutupOleh: z.string().uuid(), ditutupAt: z.string(),
  ringkasan: z.object({ tunai: Mutasi, bank: Mutasi, pajak: z.object({ saldoAwal: z.number(), dipungut: z.number(), disetor: z.number(), saldoAkhir: z.number() }), jumlahTransaksi: z.number().int() }),
  rekonsiliasi: z.object({ saldoRekeningKoran: z.number(), selisihBank: z.number(), penjelasanBank: z.string().nullable(), kasFisik: z.number(), selisihKas: z.number(), penjelasanKas: z.string().nullable() }),
});
export const TransaksiDisetujuiKonsumen = z.object({
  transaksiId: z.string().uuid(), npsn: z.string().regex(/^\d{8}$/), tahun: z.number().int(), sumberDanaKode: z.string(),
  jenis: z.enum(['PENERIMAAN', 'TARIK_TUNAI', 'SETOR_TUNAI', 'BELANJA', 'SETOR_PAJAK']), tanggal: z.string(),
  nilaiBruto: z.number(), totalPajak: z.number(), disetujuiAt: z.string(),
  uraian: z.string().default('(tanpa uraian)'), noBukti: z.string().nullable().optional(), caraBayar: z.enum(['TUNAI', 'NON_TUNAI']).nullable().optional(),
  namaToko: z.string().nullable().optional(), ntpn: z.string().nullable().optional(),
  items: z.array(z.object({ barisId: z.string(), kodeRekening: z.string(), jumlah: z.number(), uraian: z.string().optional() })),
  pajak: z.array(z.object({ jenis: z.string(), nilai: z.number() })),
});

/** Konsumen idempoten: PeriodeDitutup -> proyeksi + antrean laporan; TransaksiDisetujui -> proyeksi baris BKU. */
@Injectable()
export class KonsumenPelaporan {
  private readonly log = new Logger(KonsumenPelaporan.name);
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool) {}

  async periodeDitutup(event: CloudEvent): Promise<void> {
    const d = PeriodeDitutupKonsumen.parse(event.data);
    const baru = await consumeIdempotent(this.pool, SKEMA, { ...event, data: d }, async (tx) => {
      await tx.query(
        `INSERT INTO pelaporan.bku_periode_ringkas (periode_id, npsn, tahun, sumber_dana_kode, bulan, ringkasan, rekonsiliasi, diajukan_oleh, ditutup_oleh, ditutup_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (periode_id) DO NOTHING`,
        [d.periodeId, d.npsn, d.tahun, d.sumberDanaKode, d.bulan, JSON.stringify(d.ringkasan), JSON.stringify(d.rekonsiliasi), d.diajukanOleh, d.ditutupOleh, d.ditutupAt],
      );
      await tx.query(
        `INSERT INTO pelaporan.laporan (jenis, periode_id, npsn, tahun, sumber_dana_kode, bulan) VALUES ('BKU_BULANAN',$1,$2,$3,$4,$5)
         ON CONFLICT (jenis, periode_id) DO NOTHING`,
        [d.periodeId, d.npsn, d.tahun, d.sumberDanaKode, d.bulan],
      );
    });
    this.log.log(`PeriodeDitutup ${d.npsn} ${d.bulan}/${d.tahun}: ${baru ? 'laporan diantrekan' : 'duplikat'}`);
  }

  async transaksiDisetujui(event: CloudEvent): Promise<void> {
    const d = TransaksiDisetujuiKonsumen.parse(event.data);
    await consumeIdempotent(this.pool, SKEMA, { ...event, data: d }, async (tx) => {
      await tx.query(
        `INSERT INTO pelaporan.bku_transaksi_lokal (transaksi_id, npsn, tahun, sumber_dana_kode, jenis, tanggal, no_bukti, uraian, cara_bayar, nama_toko, ntpn,
           nilai_bruto, total_pajak, items, pajak, disetujui_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (transaksi_id) DO NOTHING`,
        [d.transaksiId, d.npsn, d.tahun, d.sumberDanaKode, d.jenis, d.tanggal, d.noBukti ?? null, d.uraian, d.caraBayar ?? null, d.namaToko ?? null,
          d.ntpn ?? null, d.nilaiBruto, d.totalPajak, JSON.stringify(d.items), JSON.stringify(d.pajak), d.disetujuiAt],
      );
    });
  }
}
