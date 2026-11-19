import { z } from 'zod';
import { Rupiah, SumberDanaKode, Tahun } from './umum';

export const StatusKertasKerja = z.enum(['DRAF', 'DIAJUKAN', 'DISAHKAN', 'DIGANTI']);
export type StatusKertasKerja = z.infer<typeof StatusKertasKerja>;

/** POST /api/v1/sekolah/{npsn}/kertas-kerja — UC-03 mengaktifkan kertas kerja. */
export const AktifkanKertasKerjaInput = z.object({ tahun: Tahun, sumberDanaKode: SumberDanaKode });
export type AktifkanKertasKerjaInput = z.infer<typeof AktifkanKertasKerjaInput>;

/** Kode 18 — skema baris kertas kerja bersama (web & svc-perencanaan). */
export const BarisKertasKerjaInput = z.object({
  komponenKode: z.string().regex(/^\d{2}$/, 'Kode komponen 2 digit'),
  kodeRekening: z.string().regex(/^\d(\.\d{1,4}){3,6}$/, 'Format kode rekening tidak valid'),
  uraian: z.string().trim().min(3).max(500),
  volume: z.coerce.number().positive().max(1_000_000),
  satuan: z.string().trim().min(1).max(30),
  hargaSatuan: Rupiah,
  /** alokasi jadwal kas bulan 1..12; bila tidak dikirim dibagi rata */
  jadwal: z.array(z.coerce.number().min(0)).length(12).optional(),
});
export type BarisKertasKerjaInput = z.infer<typeof BarisKertasKerjaInput>;

export const CatatanInput = z.object({ catatan: z.string().trim().min(3).max(1000), barisId: z.string().uuid().optional() });
export type CatatanInput = z.infer<typeof CatatanInput>;

export interface BarisKertasKerjaDto {
  id: string; komponenKode: string; kegiatan: string; kodeRekening: string; uraian: string; volume: number; satuan: string;
  hargaSatuan: number; total: number; jadwal: number[]; asalBarisId: string | null; realisasi: number;
}
export interface RingkasKomponenDto { kode: string; nama: string; total: number; persen: number; maksPersen: number | null; minPersen: number | null; ok: boolean }
export interface ValidasiDto {
  valid: boolean; pagu: number; totalAnggaran: number; sisaPagu: number;
  galat: Array<{ kode: string; pesan: string; barisId?: string; komponenKode?: string }>; komponen: RingkasKomponenDto[];
}
export interface KertasKerjaDto {
  id: string; npsn: string; namaSekolah: string | null; tahun: number; sumberDanaKode: string; versi: number; status: StatusKertasKerja;
  asalKertasKerjaId: string | null; rowVersion: number; dibuatOleh: string; diajukanOleh: string | null; diajukanAt: string | null;
  disahkanOleh: string | null; disahkanAt: string | null; catatanKembali: string | null;
}
export interface DetailKertasKerjaDto extends KertasKerjaDto {
  baris: BarisKertasKerjaDto[];
  validasi: ValidasiDto;
  catatan: Array<{ id: string; barisId: string | null; peran: string; catatan: string; at: string }>;
  riwayat: Array<{ aksi: string; peran: string; catatan: string | null; at: string }>;
}
export interface PaguDto { npsn: string; tahun: number; sumberDanaKode: string; nilai: number; ditetapkanAt: string }
export interface KomponenDto { kode: string; nama: string; maksPersen: number | null; minPersen: number | null }
