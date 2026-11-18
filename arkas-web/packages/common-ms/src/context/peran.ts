export const PERAN = [
  'OPERATOR', 'BENDAHARA', 'KEPSEK', 'KOMITE', 'VERIFIKATOR_DINAS', 'ADMIN_DINAS', 'SUPER_ADMIN',
  'ADMIN_DITJEN', 'ADMIN_DIREKTORAT', 'TIM_KERJA', 'PEMANTAU', 'AUDITOR', 'SISTEM',
] as const;
export type Peran = (typeof PERAN)[number];
/** Peran yang cakupannya satu NPSN. */
export const PERAN_SEKOLAH: readonly Peran[] = ['OPERATOR', 'BENDAHARA', 'KEPSEK', 'KOMITE'];
