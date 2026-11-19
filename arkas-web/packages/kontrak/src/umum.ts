import { z } from 'zod';

export const Npsn = z.string().regex(/^\d{8}$/, 'NPSN harus 8 digit');
export const Tahun = z.coerce.number().int().min(2020).max(2100);
export const SumberDanaKode = z.string().min(2).max(20).regex(/^[A-Z0-9_]+$/, 'Kode sumber dana huruf besar/angka');
export const Tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD');
/** Rupiah, maksimal 2 desimal, positif. */
export const Rupiah = z.coerce
  .number()
  .positive('Nilai harus lebih dari nol')
  .max(9_999_999_999_999)
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Maksimal 2 desimal');

export const PERAN = [
  'OPERATOR', 'BENDAHARA', 'KEPSEK', 'KOMITE', 'VERIFIKATOR_DINAS', 'ADMIN_DINAS', 'SUPER_ADMIN',
  'ADMIN_DITJEN', 'ADMIN_DIREKTORAT', 'TIM_KERJA', 'PEMANTAU', 'AUDITOR', 'SISTEM',
] as const;
export type Peran = (typeof PERAN)[number];

/** RFC 9457 problem details dengan kode galat aplikasi. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  kode: string;
  instance?: string;
  galat?: Array<{ path: string; pesan: string }>;
  [k: string]: unknown;
}
