import { z } from 'zod';

export const ENTITAS_REFERENSI = ['WILAYAH', 'JENJANG', 'SEKOLAH', 'DIREKTORAT', 'SUMBER_DANA', 'KODE_REKENING', 'KOMPONEN', 'TARIF_PAJAK'] as const;
export type EntitasReferensi = (typeof ENTITAS_REFERENSI)[number];

const Aktif = { aktif: z.boolean().default(true) };
/** Skema tulis Balai SDSP per entitas (UC-19). Kunci diambil dari isi. */
export const InputReferensi = {
  WILAYAH: z.object({ kode: z.string().regex(/^\d{2}(\d{2}){0,2}$/), nama: z.string().trim().min(2).max(150), indukKode: z.string().regex(/^\d{2}(\d{2})?$/).nullable().default(null), ...Aktif }),
  JENJANG: z.object({ kode: z.string().regex(/^[A-Z]{2,6}$/), nama: z.string().trim().min(2).max(60), ...Aktif }),
  SEKOLAH: z.object({ npsn: z.string().regex(/^\d{8}$/), nama: z.string().trim().min(3).max(200), jenjangKode: z.string(), wilayahKode: z.string(), statusSekolah: z.enum(['NEGERI', 'SWASTA']), ...Aktif }),
  DIREKTORAT: z.object({ kode: z.string().regex(/^[A-Z0-9_]{2,20}$/), nama: z.string().trim().min(3).max(150), ditjenKode: z.string().regex(/^[A-Z0-9_]{2,20}$/), ditjenNama: z.string().trim().min(3).max(150), ...Aktif }),
  SUMBER_DANA: z.object({ kode: z.string().regex(/^[A-Z0-9_]{2,20}$/), nama: z.string().trim().min(3).max(150), kategori: z.enum(['BOSP', 'BANPER']), direktoratKode: z.string().nullable().default(null), ...Aktif }),
  KODE_REKENING: z.object({ kode: z.string().regex(/^\d(\.\d{1,4}){3,6}$/), nama: z.string().trim().min(3).max(250), ...Aktif }),
  KOMPONEN: z.object({
    sumberDanaKode: z.string(), kode: z.string().regex(/^\d{2}$/), nama: z.string().trim().min(3).max(200),
    maksPersen: z.number().gt(0).max(100).nullable().default(null), minPersen: z.number().min(0).max(100).nullable().default(null), ...Aktif,
  }),
  TARIF_PAJAK: z.object({
    kodeRekening: z.string(), jenis: z.enum(['PPN', 'PPH21', 'PPH23', 'SSPD']), wilayahKode: z.string().regex(/^(\d{2}(\d{2}){0,2})?$/).default(''),
    tarif: z.number().gt(0).lt(1), tarifTanpaNpwp: z.number().gt(0).lt(1).nullable().default(null), dasarHukum: z.string().max(300).nullable().default(null), ...Aktif,
  }),
} satisfies Record<EntitasReferensi, z.ZodTypeAny>;

/** PUT /api/v1/dinas/konfigurasi-pajak — Admin Dinas menetapkan pajak daerah (SSPD) untuk wilayahnya (UC-32). */
export const PajakDaerahInput = z.object({
  kodeRekening: z.string(),
  wilayahKode: z.string().regex(/^\d{2}(\d{2}){0,2}$/),
  /** null = tidak dipungut di wilayah ini (menutup tarif nasional) */
  tarif: z.number().gt(0).lt(1).nullable(),
  dasarHukum: z.string().trim().min(3).max(300),
});
export type PajakDaerahInput = z.infer<typeof PajakDaerahInput>;

export interface TarifPajakDto {
  kodeRekening: string; namaRekening: string; jenis: string; wilayahKode: string; tarif: number; tarifTanpaNpwp: number | null;
  dasarHukum: string | null; aktif: boolean; versi: number; diubahAt: string;
}
export interface SekolahDto { npsn: string; nama: string; jenjangKode: string; wilayahKode: string; namaWilayah: string; statusSekolah: 'NEGERI' | 'SWASTA'; aktif: boolean }
export interface SumberDanaDto { kode: string; nama: string; kategori: 'BOSP' | 'BANPER'; direktoratKode: string | null; aktif: boolean }
