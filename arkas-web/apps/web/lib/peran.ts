export const LABEL_PERAN: Record<string, string> = {
  OPERATOR: 'Operator Sekolah', BENDAHARA: 'Bendahara', KEPSEK: 'Kepala Sekolah', KOMITE: 'Komite Sekolah',
  VERIFIKATOR_DINAS: 'Verifikator Dinas', ADMIN_DINAS: 'Admin Dinas', ADMIN_DIREKTORAT: 'Admin Direktorat', TIM_KERJA: 'Tim Kerja',
  ADMIN_DITJEN: 'Admin Ditjen', SUPER_ADMIN: 'Balai SDSP', PEMANTAU: 'Pemantau Pusat', AUDITOR: 'Auditor',
};
export function cakupanTeks(p: { npsn: string | null; namaSekolah?: string | null; wilayahKode: string | null; direktoratKode: string | null; ditjenKode: string | null }): string {
  if (p.npsn) return p.namaSekolah ? `${p.namaSekolah} (${p.npsn})` : `NPSN ${p.npsn}`;
  if (p.wilayahKode) return `Wilayah ${p.wilayahKode}`;
  if (p.direktoratKode) return `Direktorat ${p.direktoratKode}`;
  if (p.ditjenKode) return `Ditjen ${p.ditjenKode}`;
  return 'Nasional';
}
