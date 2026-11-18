import { AturanError } from './uang';

/**
 * Aturan peran & cakupan (4.1) dan penambahan pengguna berjenjang (SK-12, UC-20).
 * Fungsi murni: svc-identitas memberi data referensi (wilayah sekolah, ditjen direktorat) dari proyeksi lokalnya.
 */
export const PERAN_SEKOLAH = ['OPERATOR', 'BENDAHARA', 'KEPSEK', 'KOMITE'] as const;
export const PERAN_DINAS = ['VERIFIKATOR_DINAS', 'ADMIN_DINAS'] as const;
export const PERAN_DIREKTORAT = ['ADMIN_DIREKTORAT', 'TIM_KERJA'] as const;
export const PERAN_NASIONAL = ['SUPER_ADMIN', 'PEMANTAU', 'AUDITOR'] as const;
export type PeranDiberikan =
  | (typeof PERAN_SEKOLAH)[number] | (typeof PERAN_DINAS)[number] | (typeof PERAN_DIREKTORAT)[number]
  | (typeof PERAN_NASIONAL)[number] | 'ADMIN_DITJEN';

export interface Cakupan {
  peran: PeranDiberikan;
  npsn?: string | null;
  wilayahKode?: string | null;
  direktoratKode?: string | null;
  ditjenKode?: string | null;
  /** ISO date-time; wajib untuk AUDITOR */
  berlakuSampai?: string | null;
}

export interface RujukanCakupan {
  wilayahSekolah(npsn: string): string | undefined;
  ditjenDirektorat(kode: string): string | undefined;
  wilayahAda(kode: string): boolean;
  ditjenAda(kode: string): boolean;
}

/** Peran yang boleh DIBERIKAN oleh setiap peran pengelola (matriks berjenjang). */
export const MATRIKS_PEMBERIAN: Partial<Record<PeranDiberikan, PeranDiberikan[]>> = {
  SUPER_ADMIN: ['SUPER_ADMIN', 'ADMIN_DITJEN', 'ADMIN_DINAS', 'PEMANTAU', 'AUDITOR'],
  ADMIN_DITJEN: ['ADMIN_DIREKTORAT'],
  ADMIN_DIREKTORAT: ['TIM_KERJA'],
  ADMIN_DINAS: ['ADMIN_DINAS', 'VERIFIKATOR_DINAS', 'OPERATOR'],
  OPERATOR: ['BENDAHARA', 'KEPSEK', 'KOMITE'],
};

const termasuk = <T extends string>(daftar: readonly T[], x: string): x is T => (daftar as readonly string[]).includes(x);

/** Bentuk cakupan sesuai jenis peran: sekolah -> npsn, dinas -> wilayah, direktorat -> direktorat, ditjen -> ditjen, nasional -> kosong. */
export function validasiBentukCakupan(c: Cakupan, sekarang: Date = new Date(), opsi: { abaikanMasaBerlaku?: boolean } = {}): void {
  const ada = { npsn: !!c.npsn, wilayah: !!c.wilayahKode, direktorat: !!c.direktoratKode, ditjen: !!c.ditjenKode };
  const harus = (kunci: keyof typeof ada | null) => {
    for (const k of Object.keys(ada) as Array<keyof typeof ada>) {
      if ((k === kunci) !== ada[k]) {
        throw new AturanError('CAKUPAN_TIDAK_SESUAI', `Peran ${c.peran} ${kunci ? `wajib dan hanya memakai cakupan ${kunci}` : 'tidak memakai cakupan'}`, { peran: c.peran });
      }
    }
  };
  if (termasuk(PERAN_SEKOLAH, c.peran)) harus('npsn');
  else if (termasuk(PERAN_DINAS, c.peran)) harus('wilayah');
  else if (termasuk(PERAN_DIREKTORAT, c.peran)) harus('direktorat');
  else if (c.peran === 'ADMIN_DITJEN') harus('ditjen');
  else if (termasuk(PERAN_NASIONAL, c.peran)) harus(null);
  else throw new AturanError('PERAN_TIDAK_DIKENAL', `Peran ${String(c.peran)} tidak dapat diberikan`);

  if (c.npsn && !/^\d{8}$/.test(c.npsn)) throw new AturanError('CAKUPAN_TIDAK_SESUAI', 'NPSN harus 8 digit');
  if (c.wilayahKode && !/^\d{2}(\d{2}){0,2}$/.test(c.wilayahKode)) throw new AturanError('CAKUPAN_TIDAK_SESUAI', 'Kode wilayah 2/4/6 digit');
  if (opsi.abaikanMasaBerlaku) return;
  if (c.peran === 'AUDITOR') {
    if (!c.berlakuSampai) throw new AturanError('MASA_BERLAKU_WAJIB', 'Peran Auditor wajib berbatas waktu sesuai surat tugas');
  }
  if (c.berlakuSampai && !(new Date(c.berlakuSampai) > sekarang)) throw new AturanError('MASA_BERLAKU_TIDAK_VALID', 'Masa berlaku harus di masa depan');
}

/** Wilayah turunan: kode wilayah hierarkis (2 = provinsi, 4 = kab/kota, 6 = kecamatan). */
export const dalamWilayah = (induk: string, anak: string) => anak.startsWith(induk);

/**
 * SK-12: apakah `pemberi` (peran aktif & cakupannya) boleh memberi/mencabut `target` untuk pengguna lain.
 * Melempar AturanError dengan kode yang jelas bila tidak boleh.
 */
export function periksaPemberianPeran(
  pemberi: Cakupan & { penggunaId: string }, target: Cakupan & { penggunaId: string }, ref: RujukanCakupan, sekarang = new Date(),
  opsi: { pencabutan?: boolean } = {},
): void {
  if (pemberi.penggunaId === target.penggunaId) throw new AturanError('PEMISAHAN_TUGAS', 'Tidak dapat memberi atau mencabut peran untuk diri sendiri');
  // Mencabut peran yang masa berlakunya sudah lewat tetap diizinkan.
  validasiBentukCakupan(target, sekarang, { abaikanMasaBerlaku: opsi.pencabutan });
  const boleh = MATRIKS_PEMBERIAN[pemberi.peran] ?? [];
  if (!boleh.includes(target.peran)) {
    throw new AturanError('PERAN_DI_LUAR_KEWENANGAN', `Peran ${pemberi.peran} tidak dapat memberikan peran ${target.peran}`, { boleh });
  }
  const tolak = (pesan: string) => { throw new AturanError('DI_LUAR_CAKUPAN', pesan); };

  switch (pemberi.peran) {
    case 'SUPER_ADMIN':
      if (target.wilayahKode && !ref.wilayahAda(target.wilayahKode)) tolak(`Wilayah ${target.wilayahKode} tidak dikenal`);
      if (target.ditjenKode && !ref.ditjenAda(target.ditjenKode)) tolak(`Ditjen ${target.ditjenKode} tidak dikenal`);
      return;
    case 'ADMIN_DITJEN': {
      const d = ref.ditjenDirektorat(target.direktoratKode!);
      if (!d) tolak(`Direktorat ${target.direktoratKode} tidak dikenal`);
      if (d !== pemberi.ditjenKode) tolak('Direktorat bukan di bawah koordinasi Ditjen Anda');
      return;
    }
    case 'ADMIN_DIREKTORAT':
      if (target.direktoratKode !== pemberi.direktoratKode) tolak('Tim Kerja hanya untuk direktorat Anda sendiri');
      return;
    case 'ADMIN_DINAS': {
      const w = target.npsn ? ref.wilayahSekolah(target.npsn) : target.wilayahKode!;
      if (!w) tolak(`Sekolah ${target.npsn} tidak dikenal`);
      if (target.wilayahKode && !ref.wilayahAda(target.wilayahKode)) tolak(`Wilayah ${target.wilayahKode} tidak dikenal`);
      if (!dalamWilayah(pemberi.wilayahKode!, w!)) tolak(`Wilayah ${w} di luar kewenangan Dinas ${pemberi.wilayahKode}`);
      return;
    }
    case 'OPERATOR':
      if (target.npsn !== pemberi.npsn) tolak('Operator hanya mengelola pengguna sekolahnya sendiri');
      return;
    default:
      tolak('Peran ini tidak mengelola pengguna');
  }
}

/** Peran aktif masih berlaku pada `sekarang`? */
export function peranBerlaku(p: { berlakuSampai?: string | null; dicabut?: boolean }, sekarang = new Date()): boolean {
  return !p.dicabut && (!p.berlakuSampai || new Date(p.berlakuSampai) > sekarang);
}
