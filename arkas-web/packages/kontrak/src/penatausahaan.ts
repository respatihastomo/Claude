import { z } from 'zod';
import { Rupiah, SumberDanaKode, Tahun, Tanggal } from './umum';

export const JenisTransaksi = z.enum(['PENERIMAAN', 'TARIK_TUNAI', 'SETOR_TUNAI', 'BELANJA']);
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
  nilaiBruto: number; totalPajak: number; nilaiNetto: number; status: StatusTransaksi;
  dibuatOleh: string; dibuatAt: string; diputuskanOleh: string | null; diputuskanAt: string | null; alasanTolak: string | null;
  versi: number; items: ItemTransaksiDto[]; pajak: RincianPajakDto[];
}
export interface BarisBkuDto {
  transaksiId: string; tanggal: string; noBukti: string | null; uraian: string; buku: 'TUNAI' | 'BANK';
  kodeRekening: string | null; penerimaan: number; pengeluaran: number; status: StatusTransaksi; saldo: number | null;
}
export interface RingkasanBukuDto {
  npsn: string; tahun: number; sumberDanaKode: string;
  periodeBerjalan: { bulan: number; status: 'BUKA' | 'DITUTUP' } | null;
  saldo: { tunai: number; bank: number; total: number };
  saldoTersedia: { tunai: number; bank: number };
  pagu: number; realisasi: number; menungguPersetujuan: number;
}
export interface BarisRkasDto {
  barisId: string; kodeRekening: string; kegiatan: string; uraian: string; satuan: string | null; hargaSatuan: number;
  anggaran: number; realisasi: number; sisa: number; pajak: Array<z.infer<typeof JenisPajak>>;
}
