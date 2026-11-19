import { Inject, Injectable } from '@nestjs/common';
import { AturanError } from '@arkas/aturan';
import { DbContextService, GalatHttp, RequestContext } from '@arkas/common-ms';
import { CatatTransaksiMitraInput, ItemTransaksiMitra, TransaksiDto, TransaksiMitraMasukDto } from '@arkas/kontrak';
import { PenatausahaanService } from './penatausahaan.service';

interface Baris {
  id: string; mitra_kode: string; transaction_id: string; npsn: string; tahun: number; sumber_dana_kode: string; tanggal: string; nama_toko: string;
  penjual_punya_npwp: boolean; total: string; items: ItemTransaksiMitra[]; status: TransaksiMitraMasukDto['status']; status_mitra: TransaksiMitraMasukDto['statusMitra'];
  alasan_batal: string | null; transaksi_id: string | null; status_transaksi: TransaksiMitraMasukDto['statusTransaksi']; diterima_at: Date;
}
const dto = (b: Baris): TransaksiMitraMasukDto => ({
  id: b.id, mitraKode: b.mitra_kode, transactionId: b.transaction_id, tahun: b.tahun, sumberDanaKode: b.sumber_dana_kode, tanggal: b.tanggal, namaToko: b.nama_toko,
  penjualPunyaNpwp: b.penjual_punya_npwp, total: Number(b.total), items: b.items, status: b.status, statusMitra: b.status_mitra, alasanBatal: b.alasan_batal,
  transaksiId: b.transaksi_id, statusTransaksi: b.status_transaksi, diterimaAt: b.diterima_at.toISOString(),
});
const PILIH = `SELECT m.*, m.tanggal::text AS tanggal, t.status AS status_transaksi FROM tatausaha.transaksi_mitra_masuk m
  LEFT JOIN tatausaha.transaksi t ON t.id = m.transaksi_id`;

/** UC-12 Memetakan transaksi Mitra SIPLah ke BKU. */
@Injectable()
export class TransaksiMitraService {
  constructor(@Inject(DbContextService) private readonly db: DbContextService, @Inject(PenatausahaanService) private readonly bku: PenatausahaanService) {}

  daftar(ctx: RequestContext, npsn: string, f: { tahun: number; sumberDanaKode: string }) {
    return this.db.run(ctx, async (tx) => (await tx.query<Baris>(
      `${PILIH} WHERE m.npsn = $1 AND m.tahun = $2 AND m.sumber_dana_kode = $3 ORDER BY (m.status = 'MENUNGGU') DESC, m.diterima_at DESC`,
      [npsn, f.tahun, f.sumberDanaKode])).rows.map(dto));
  }

  /**
   * Catat ke BKU sebagai BELANJA NON_TUNAI (nilai, toko, NPWP dari Mitra; pajak dihitung ulang aturan ARKAS) — tetap DICATAT
   * menunggu persetujuan Kepala Sekolah. Kunci idempotensi tetap per transaksi Mitra, jadi aman diulang bila langkah kedua gagal.
   */
  async catat(ctx: RequestContext, id: string, i: CatatTransaksiMitraInput): Promise<{ masuk: TransaksiMitraMasukDto; transaksi: TransaksiDto }> {
    const m = await this.db.run(ctx, async (tx) => (await tx.query<Baris>(`${PILIH} WHERE m.id = $1`, [id])).rows[0]);
    if (!m) throw new GalatHttp(404, 'TRANSAKSI_MITRA_TIDAK_DITEMUKAN', 'Transaksi Mitra tidak ditemukan');
    if (m.status_mitra !== 'DITERIMA') throw new AturanError('TRANSAKSI_MITRA_DIBATALKAN', `Pesanan sudah ${m.status_mitra === 'RETUR' ? 'diretur' : 'dibatalkan'} di Mitra`);
    if (m.status === 'DICATAT') throw new GalatHttp(409, 'SUDAH_DICATAT', 'Transaksi Mitra ini sudah dicatat ke BKU');
    const peta = new Map(i.pemetaan.map((p) => [p.itemId, p.barisId]));
    const kurang = m.items.filter((it) => !(peta.get(it.itemId) ?? it.barisId)).map((it) => it.itemId);
    if (kurang.length) throw new AturanError('ITEM_BELUM_DIPETAKAN', 'Setiap item harus dipetakan ke baris RKAS', { itemId: kurang });

    const { transaksi } = await this.bku.catat(ctx, m.npsn, {
      jenis: 'BELANJA', tahun: m.tahun, sumberDanaKode: m.sumber_dana_kode, tanggal: i.tanggal ?? m.tanggal,
      uraian: `Belanja SIPLah di ${m.nama_toko} (${m.transaction_id})`.slice(0, 500), caraBayar: 'NON_TUNAI', noBukti: m.transaction_id.slice(0, 40),
      namaToko: m.nama_toko, penjualPunyaNpwp: m.penjual_punya_npwp,
      items: m.items.map((it) => ({ barisId: (peta.get(it.itemId) ?? it.barisId)!, uraian: it.uraian, volume: it.volume, satuan: it.satuan ?? undefined, hargaSatuan: it.hargaSatuan })),
    }, `siplah:${m.id}`);
    const masuk = await this.db.run(ctx, async (tx) => {
      await tx.query(`UPDATE tatausaha.transaksi_mitra_masuk SET status = 'DICATAT', transaksi_id = $2, dicatat_oleh = $3, dicatat_at = now() WHERE id = $1 AND status = 'MENUNGGU'`,
        [id, transaksi.id, ctx.penggunaId]);
      return dto((await tx.query<Baris>(`${PILIH} WHERE m.id = $1`, [id])).rows[0]);
    });
    return { masuk, transaksi };
  }

  penyaluran(ctx: RequestContext, npsn: string) {
    return this.db.run(ctx, async (tx) => (await tx.query(
      `SELECT id, tahun, sumber_dana_kode AS "sumberDanaKode", tahap, tanggal::text, nilai::float8, bank_kode AS "bankKode", nomor_referensi AS "nomorReferensi", transaksi_id AS "transaksiId"
       FROM tatausaha.penyaluran_masuk WHERE npsn = $1 ORDER BY tanggal DESC, tahap`, [npsn])).rows);
  }
}
