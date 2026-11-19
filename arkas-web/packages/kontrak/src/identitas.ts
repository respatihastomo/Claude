import { z } from 'zod';

export const PeranDiberikanSkema = z.enum([
  'OPERATOR', 'BENDAHARA', 'KEPSEK', 'KOMITE', 'VERIFIKATOR_DINAS', 'ADMIN_DINAS', 'ADMIN_DIREKTORAT', 'TIM_KERJA',
  'ADMIN_DITJEN', 'SUPER_ADMIN', 'PEMANTAU', 'AUDITOR',
]);

export const CakupanInput = z.object({
  peran: PeranDiberikanSkema,
  npsn: z.string().regex(/^\d{8}$/).optional(),
  wilayahKode: z.string().regex(/^\d{2}(\d{2}){0,2}$/).optional(),
  direktoratKode: z.string().min(2).max(20).optional(),
  ditjenKode: z.string().min(2).max(20).optional(),
  berlakuSampai: z.string().datetime({ offset: true }).optional(),
});
export type CakupanInput = z.infer<typeof CakupanInput>;

/** POST /api/v1/admin/pengguna — buat pengguna (atau pakai yang ada, berdasarkan email) dan beri satu peran. */
export const TambahPenggunaInput = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  nama: z.string().trim().min(3).max(150),
  peran: CakupanInput,
});
export type TambahPenggunaInput = z.infer<typeof TambahPenggunaInput>;

export const CabutPeranInput = z.object({ alasan: z.string().trim().min(3).max(500) });
export const PilihPeranInput = z.object({ peranPenggunaId: z.string().uuid() });
/** HANYA dev: masuk sebagai pengguna contoh (AUTH_DEV_ENABLED=true). */
export const MasukDevInput = z.object({ email: z.string().trim().toLowerCase().email() });

export interface PeranPenggunaDto {
  id: string; peran: z.infer<typeof PeranDiberikanSkema>; npsn: string | null; namaSekolah: string | null; wilayahKode: string | null;
  direktoratKode: string | null; ditjenKode: string | null; berlakuSampai: string | null; diberikanAt: string; dicabutAt: string | null; berlaku: boolean;
}
export interface PenggunaDto { id: string; email: string; nama: string; status: 'AKTIF' | 'NONAKTIF'; peran: PeranPenggunaDto[] }
export interface MeDto extends PenggunaDto { peranAktif: PeranPenggunaDto | null; sesiKedaluwarsaAt: string }
