import { z } from 'zod';
import { Rupiah, SumberDanaKode, Tahun, Tanggal } from './umum';

export const JenisTransaksi = z.enum(['PENERIMAAN', 'TARIK_TUNAI', 'SETOR_TUNAI', 'BELANJA', 'SETOR_PAJAK']);
export type JenisTransaksi = z.infer<typeof JenisTransaksi>;
export const CaraBayar = z.enum(['TUNAI', 'NON_TUNAI']);
export type CaraBayar = z.infer<typeof CaraBayar>;
export const StatusTransaksi = z.enum(['DICATAT', 'DISETUJUI', 'DITOLAK']);
export type StatusTransaksi = z.infer<typeof StatusTransaksi>;
export const JenisPajak = z.enum(['PPN', 'PPH21', 'PPH23', 'SSPD']);

const Dasar = z.object({
  tahun: Tahun,
  sumberDanaKode: SumberDanaKode,
  tanggal: Tanggal,
  uraian: z.string().trim().min(3).max(500),
  noBukti: z.string().trim().min(1).max(40).optional(),
});

export const ItemBelanjaInput = z.object({
  barisId: z.string().uuid(),
  uraian: z.string().trim().min(1).max(300),
  volume: z.coerce.number().positive().max(1_000_000),
  satuan: z.string().trim().max(30).optional(),
  hargaSatuan: Rupiah,
});
export type ItemBelanjaInput = z.infer<typeof ItemBelanjaInput>;

export const BelanjaInput = Dasar.extend({
  jenis: z.literal('BELANJA'),
  caraBayar: CaraBayar,
  noBukti: z.string().trim().min(1).max(40),
  namaToko: z.string().trim().min(1).max(150),
  penjualPunyaNpwp: z.boolean(),
  items: z.array(ItemBelanjaInput).min(1).max(50),
});

export const MutasiKasInput = Dasar.extend({
  jenis: z.enum(['PENERIMAAN', 'TARIK_TUNAI', 'SETOR_TUNAI']),
  nilai: Rupiah,
});

/** POST /api/v1/sekolah/{npsn}/bku — wajib header Idempotency-Key. */
export const BuatTransaksiInput = z.discriminatedUnion('jenis', [
  BelanjaInput,
  MutasiKasInput.extend({ jenis: z.literal('PENERIMAAN') }),
  MutasiKasInput.extend({ jenis: z.literal('TARIK_TUNAI') }),
  MutasiKasInput.extend({ jenis: z.literal('SETOR_TUNAI') }),
]);
export type BuatTransaksiInput = z.infer<typeof BuatTransaksiInput>;

/** POST /api/v1/sekolah/{npsn}/bku/simulasi-pajak — pratinjau Langkah 3 wizard. */
export const SimulasiPajakInput = z.object({
  tahun: Tahun,
  sumberDanaKode: SumberDanaKode,
  penjualPunyaNpwp: z.boolean(),
  items: z.array(z.object({ barisId: z.string().uuid(), volume: z.coerce.number().positive(), hargaSatuan: Rupiah })).min(1).max(50),
});
export type SimulasiPajakInput = z.infer<typeof SimulasiPajakInput>;

export const KeputusanInput = z.object({ alasan: z.string().trim().max(500).optional() });
export const TolakInput = z.object({ alasan: z.string().trim().min(3).max(500) });

export const FilterBuku = z.object({
  tahun: Tahun,
  sumberDanaKode: SumberDanaKode,
  bulan: z.coerce.number().int().min(1).max(12).optional(),
});
export type FilterBuku = z.infer<typeof FilterBuku>;

// ---------- Bentuk respons ----------
export interface RincianPajakDto { jenis: z.infer<typeof JenisPajak>; tarif: number; dpp: number; nilai: number; status?: 'DIPUNGUT' | 'DISETOR' }
export interface ItemTransaksiDto { id: string; barisId: string; kodeRekening: string; uraian: string; volume: number; satuan: string | null; hargaSatuan: number; jumlah: number }
export interface TransaksiDto {
  id: string; npsn: string; tahun: number; sumberDanaKode: string; jenis: JenisTransaksi; tanggal: string;
  caraBayar: CaraBayar | null; noBukti: string | null; uraian: string; namaToko: string | null; penjualPunyaNpwp: boolean | null;
  nilaiBruto: number; totalPajak: number; nilaiNetto: number; status: StatusTransaksi; ntpn: string | null;
  dibuatOleh: string; dibuatAt: string; diputuskanOleh: string | null; diputuskanAt: string | null; alasanTolak: string | null;
  versi: number; items: ItemTransaksiDto[]; pajak: RincianPajakDto[];
}
/** Transaksi yang ditolak Kepala Sekolah pada periode yang masih buka — untuk ditindaklanjuti Bendahara. */
export interface TransaksiDitolakDto {
  id: string; jenis: JenisTransaksi; tanggal: string; noBukti: string | null; uraian: string; namaToko: string | null;
  nilaiBruto: number; alasanTolak: string | null; diputuskanAt: string | null;
}
export interface BarisBkuDto {
  transaksiId: string; tanggal: string; noBukti: string | null; uraian: string; buku: 'TUNAI' | 'BANK';
  kodeRekening: string | null; penerimaan: number; pengeluaran: number; status: StatusTransaksi; saldo: number | null;
}
export interface RingkasanBukuDto {
  npsn: string; tahun: number; sumberDanaKode: string;
  periodeBerjalan: { bulan: number; status: 'BUKA' | 'DIAJUKAN' | 'DITUTUP' } | null;
  saldo: { tunai: number; bank: number; total: number };
  saldoTersedia: { tunai: number; bank: number };
  pagu: number; realisasi: number; menungguPersetujuan: number;
  /** pajak dipungut dari belanja DISETUJUI yang belum disetor */
  pajakTerutang: number;
}
export interface BarisRkasDto {
  barisId: string; kodeRekening: string; kegiatan: string; uraian: string; satuan: string | null; hargaSatuan: number;
  anggaran: number; realisasi: number; sisa: number; pajak: Array<z.infer<typeof JenisPajak>>;
}

// ---------- Irisan 2: setor pajak (UC-14) & BKP Pajak ----------

/** POST /api/v1/sekolah/{npsn}/pajak/setor — wajib Idempotency-Key. Satu setoran = satu jenis pajak = satu NTPN. */
export const SetorPajakInput = z.object({
  tahun: Tahun,
  sumberDanaKode: SumberDanaKode,
  pajakIds: z.array(z.string().uuid()).min(1).max(200),
  ntpn: z.string().trim().transform((v) => v.replace(/[\s-]/g, '').toUpperCase()).pipe(z.string().regex(/^[0-9A-Z]{16}$/, 'NTPN harus 16 karakter huruf/angka')),
  tanggalSetor: Tanggal,
  caraBayar: CaraBayar,
});
export type SetorPajakInput = z.infer<typeof SetorPajakInput>;

export const FilterPajak = FilterBuku.extend({ status: z.enum(['DIPUNGUT', 'DISETOR']).optional() });
export type FilterPajak = z.infer<typeof FilterPajak>;

export interface PajakDto {
  id: string; jenis: z.infer<typeof JenisPajak>; tarif: number; dpp: number; nilai: number; status: 'DIPUNGUT' | 'DISETOR';
  transaksiId: string; tanggalBelanja: string; noBukti: string | null; namaToko: string | null; uraianBelanja: string;
  bukuPungut: 'TUNAI' | 'BANK'; statusBelanja: StatusTransaksi;
  ntpn: string | null; tanggalSetor: string | null; setorTransaksiId: string | null; statusSetor: StatusTransaksi | null;
}

/** Baris Buku Kas Pembantu Pajak: pungut = penerimaan, setor = pengeluaran. Saldo bergerak hanya oleh baris DISETUJUI. */
export interface BarisBkpPajakDto {
  transaksiId: string; tanggal: string; noBukti: string | null; uraian: string; jenis: z.infer<typeof JenisPajak>;
  ntpn: string | null; penerimaan: number; pengeluaran: number; status: StatusTransaksi; saldo: number | null;
}

// ---------- Irisan 3: penutupan buku kas (UC-15) ----------

export const StatusPeriode = z.enum(['BUKA', 'DIAJUKAN', 'DITUTUP']);
export type StatusPeriode = z.infer<typeof StatusPeriode>;

/** POST /api/v1/periode/{id}/ajukan-tutup — wajib If-Match (ETag periode). */
export const AjukanTutupInput = z.object({
  saldoRekeningKoran: z.coerce.number().min(0).max(9_999_999_999_999),
  penjelasanBank: z.string().trim().max(1000).optional(),
  kasFisik: z.coerce.number().min(0).max(9_999_999_999_999),
  penjelasanKas: z.string().trim().max(1000).optional(),
});
export type AjukanTutupInput = z.infer<typeof AjukanTutupInput>;

export interface MutasiBukuBulan { saldoAwal: number; penerimaan: number; pengeluaran: number; saldoAkhir: number }
/** Ringkasan BKU satu bulan — snapshot saat diajukan; dipakai berita acara & dikirim di PeriodeDitutup. */
export interface RingkasanBulanDto {
  tunai: MutasiBukuBulan; bank: MutasiBukuBulan; pajak: { saldoAwal: number; dipungut: number; disetor: number; saldoAkhir: number };
  jumlahTransaksi: number;
}
export interface RekonsiliasiDto {
  saldoBukuBank: number; saldoRekeningKoran: number; selisihBank: number; penjelasanBank: string | null;
  saldoBukuTunai: number; kasFisik: number; selisihKas: number; penjelasanKas: string | null; dibuatOleh: string; diperbaruiAt: string;
}
export interface PeriodeDto {
  id: string; npsn: string; tahun: number; sumberDanaKode: string; bulan: number; status: StatusPeriode; versi: number;
  diajukanOleh: string | null; diajukanAt: string | null; ditutupOleh: string | null; ditutupAt: string | null; alasanKembali: string | null;
}
export interface DetailPeriodeDto extends PeriodeDto {
  akhirBulan: string;
  ringkasan: RingkasanBulanDto;
  kesiapan: { siap: boolean; syarat: Array<{ kode: string; ok: boolean; pesan: string }>; peringatan: Array<{ kode: string; ok: boolean; pesan: string }> };
  rekonsiliasi: RekonsiliasiDto | null;
}
