import { AturanError } from './uang';

/** Tabel 8.2 — sumber dana Bantuan Pemerintah: DRAF -> DIAJUKAN -> DISAHKAN; DIAJUKAN -> DIKEMBALIKAN -> DIAJUKAN. */
export type StatusSumberDanaBantuan = 'DRAF' | 'DIAJUKAN' | 'DIKEMBALIKAN' | 'DISAHKAN';
export type AksiSumberDanaBantuan = 'AJUKAN' | 'KEMBALIKAN' | 'SAHKAN';
const SD: Record<StatusSumberDanaBantuan, Partial<Record<AksiSumberDanaBantuan, StatusSumberDanaBantuan>>> = {
  DRAF: { AJUKAN: 'DIAJUKAN' }, DIKEMBALIKAN: { AJUKAN: 'DIAJUKAN' }, DIAJUKAN: { KEMBALIKAN: 'DIKEMBALIKAN', SAHKAN: 'DISAHKAN' }, DISAHKAN: {},
};
export function transisiSumberDanaBantuan(s: StatusSumberDanaBantuan, a: AksiSumberDanaBantuan): StatusSumberDanaBantuan {
  const ke = SD[s][a];
  if (!ke) throw new AturanError('STATUS_TIDAK_SESUAI', `Sumber dana berstatus ${s} tidak dapat di-${a.toLowerCase()}`, { status: s, aksi: a });
  return ke;
}
export const bolehUbahSumberDana = (s: StatusSumberDanaBantuan) => s === 'DRAF' || s === 'DIKEMBALIKAN';

/** Kelengkapan sebelum diajukan ke Balai SDSP (fitur 17). */
export interface Kelengkapan { juknisDisetujui: boolean; panduanDisahkan: boolean; jumlahKomponen: number; jumlahPenerima: number }
export function cekKelengkapan(k: Kelengkapan): string[] {
  const kurang: string[] = [];
  if (!k.juknisDisetujui) kurang.push('Juknis belum disetujui Ditjen');
  if (!k.panduanDisahkan) kurang.push('Panduan pelaksanaan belum disahkan direktorat');
  if (k.jumlahKomponen < 1) kurang.push('Komponen bantuan belum ditetapkan');
  if (k.jumlahPenerima < 1) kurang.push('Data penerima belum diisi');
  return kurang;
}

/** Dokumen juknis (Ditjen) & panduan (Direktorat): DIUNGGAH -> DISETUJUI/DISAHKAN | DITOLAK. Panduan menunggu juknis disetujui. */
export function putuskanDokumen(jenis: 'JUKNIS' | 'PANDUAN', status: string, setuju: boolean, juknisDisetujui: boolean): 'DISETUJUI' | 'DISAHKAN' | 'DITOLAK' {
  if (status !== 'DIUNGGAH') throw new AturanError('STATUS_TIDAK_SESUAI', `Dokumen berstatus ${status} sudah diputuskan`, { status });
  if (jenis === 'PANDUAN' && setuju && !juknisDisetujui) throw new AturanError('JUKNIS_BELUM_DISETUJUI', 'Panduan pelaksanaan disahkan setelah juknis disetujui Ditjen');
  return !setuju ? 'DITOLAK' : jenis === 'JUKNIS' ? 'DISETUJUI' : 'DISAHKAN';
}

/** Pengajuan sekolah (PKS, RAB, SPTJM): DRAF -> DIAJUKAN -> DISETUJUI | DITOLAK | DIKEMBALIKAN -> DIAJUKAN. */
export type StatusPengajuanSekolah = 'DRAF' | 'DIAJUKAN' | 'DIKEMBALIKAN' | 'DISETUJUI' | 'DITOLAK';
export type AksiPengajuanSekolah = 'AJUKAN' | 'SETUJUI' | 'TOLAK' | 'KEMBALIKAN';
const PS: Record<StatusPengajuanSekolah, Partial<Record<AksiPengajuanSekolah, StatusPengajuanSekolah>>> = {
  DRAF: { AJUKAN: 'DIAJUKAN' }, DIKEMBALIKAN: { AJUKAN: 'DIAJUKAN' },
  DIAJUKAN: { SETUJUI: 'DISETUJUI', TOLAK: 'DITOLAK', KEMBALIKAN: 'DIKEMBALIKAN' }, DISETUJUI: {}, DITOLAK: {},
};
export function transisiPengajuanSekolah(s: StatusPengajuanSekolah, a: AksiPengajuanSekolah): StatusPengajuanSekolah {
  const ke = PS[s][a];
  if (!ke) throw new AturanError('STATUS_TIDAK_SESUAI', `Pengajuan berstatus ${s} tidak dapat di-${a.toLowerCase()}`, { status: s, aksi: a });
  return ke;
}
/** Fitur 15: pengajuan hanya dalam masa pengajuan (tanggal Jakarta, inklusif). */
export function dalamMasaPengajuan(hariIni: string, mulai: string | null, selesai: string | null): boolean {
  return !!mulai && !!selesai && hariIni >= mulai && hariIni <= selesai;
}
