import { z } from 'zod';
import { Npsn, Rupiah, Tahun, Tanggal } from './umum';

const KodeSd = z.string().regex(/^[A-Z0-9_]{3,20}$/, 'Kode sumber dana: 3–20 huruf kapital/angka/garis bawah');
/** UC-23: draf sumber dana Bantuan Pemerintah (Admin Direktorat Teknis). */
export const SumberDanaBantuanInput = z.object({
  kode: KodeSd,
  nama: z.string().trim().min(5).max(150),
  direktoratKode: z.string().regex(/^[A-Z0-9_]{2,20}$/),
  tahun: Tahun,
  jenjang: z.array(z.string().regex(/^[A-Z]{2,6}$/)).min(1).max(10),
  pengajuanMulai: Tanggal.nullable().default(null),
  pengajuanSelesai: Tanggal.nullable().default(null),
});
export type SumberDanaBantuanInput = z.infer<typeof SumberDanaBantuanInput>;
export const KomponenBantuanInput = z.object({ kode: z.string().regex(/^\d{2}$/), nama: z.string().trim().min(3).max(200), maksPersen: z.number().gt(0).max(100).nullable().default(null) });
export const PenerimaInput = z.object({ npsn: Npsn, nilai: Rupiah });
export const KeputusanDokumenInput = z.object({ setuju: z.boolean(), catatan: z.string().trim().max(1000).optional() });
export const CatatanBalaiInput = z.object({ catatan: z.string().trim().min(3).max(1000) });
export const PksBankInput = z.object({ bankKode: z.string().min(2).max(10), nomor: z.string().trim().min(3).max(100), tanggal: Tanggal });
export const PenyaluranInput = z.object({ npsn: Npsn, tahap: z.number().int().min(1).max(4), tanggal: Tanggal, nilai: Rupiah, bankKode: z.string().min(2).max(10), nomorReferensi: z.string().trim().min(3).max(60) });
export type PenyaluranInput = z.infer<typeof PenyaluranInput>;
export const KeputusanPengajuanInput = z.object({ keputusan: z.enum(['SETUJUI', 'TOLAK', 'KEMBALIKAN']), catatan: z.string().trim().max(1000).optional() });

/** svc-bantuan -> svc-referensi (aktifkan referensi), svc-perencanaan (pagu per penerima), svc-integrasi (pembukaan & sekolah berhak). */
export const SumberDanaDisahkanData = z.object({
  kode: z.string(), nama: z.string(), kategori: z.literal('BANPER'), direktoratKode: z.string(), tahun: z.number().int(), jenjang: z.array(z.string()),
  komponen: z.array(z.object({ kode: z.string(), nama: z.string(), maksPersen: z.number().nullable() })),
  penerima: z.array(z.object({ npsn: z.string().regex(/^\d{8}$/), nilai: z.number() })).min(1),
  disahkanAt: z.string(),
});
export type SumberDanaDisahkanData = z.infer<typeof SumberDanaDisahkanData>;
/** svc-bantuan -> svc-penatausahaan (draf penerimaan di BKU sekolah). */
export interface PenyaluranDicatatData { penyaluranId: string; sumberDanaKode: string; npsn: string; tahun: number; tahap: number; tanggal: string; nilai: number; bankKode: string; nomorReferensi: string }
/** svc-bantuan -> svc-perencanaan (kertas kerja bantuan boleh disusun), notifikasi. */
export interface PengajuanSekolahDiputuskanData { pengajuanId: string; sumberDanaKode: string; npsn: string; status: 'DISETUJUI' | 'DITOLAK' | 'DIKEMBALIKAN'; catatan: string | null; at: string }
