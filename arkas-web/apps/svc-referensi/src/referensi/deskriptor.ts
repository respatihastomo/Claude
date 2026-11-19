import type { EntitasReferensi } from '@arkas/kontrak';

/** Pemetaan entitas API (camelCase) ke tabel db_ref (snake_case). `kunci` = kolom primary key. */
export interface Deskriptor { tabel: string; kunci: string[]; kolom: Record<string, string>; urut: string }
export const DESKRIPTOR: Record<EntitasReferensi, Deskriptor> = {
  WILAYAH: { tabel: 'wilayah', kunci: ['kode'], kolom: { kode: 'kode', nama: 'nama', indukKode: 'induk_kode', aktif: 'aktif' }, urut: 'kode' },
  JENJANG: { tabel: 'jenjang', kunci: ['kode'], kolom: { kode: 'kode', nama: 'nama', aktif: 'aktif' }, urut: 'kode' },
  SEKOLAH: { tabel: 'satuan_pendidikan', kunci: ['npsn'], kolom: { npsn: 'npsn', nama: 'nama', jenjangKode: 'jenjang_kode', wilayahKode: 'wilayah_kode', statusSekolah: 'status_sekolah', aktif: 'aktif' }, urut: 'npsn' },
  DIREKTORAT: { tabel: 'direktorat', kunci: ['kode'], kolom: { kode: 'kode', nama: 'nama', ditjenKode: 'ditjen_kode', ditjenNama: 'ditjen_nama', aktif: 'aktif' }, urut: 'kode' },
  SUMBER_DANA: { tabel: 'sumber_dana', kunci: ['kode'], kolom: { kode: 'kode', nama: 'nama', kategori: 'kategori', direktoratKode: 'direktorat_kode', aktif: 'aktif' }, urut: 'kode' },
  KODE_REKENING: { tabel: 'kode_rekening', kunci: ['kode'], kolom: { kode: 'kode', nama: 'nama', aktif: 'aktif' }, urut: 'kode' },
  KOMPONEN: { tabel: 'komponen', kunci: ['sumber_dana_kode', 'kode'], kolom: { sumberDanaKode: 'sumber_dana_kode', kode: 'kode', nama: 'nama', maksPersen: 'maks_persen', minPersen: 'min_persen', aktif: 'aktif' }, urut: 'sumber_dana_kode, kode' },
  TARIF_PAJAK: { tabel: 'tarif_pajak', kunci: ['kode_rekening', 'jenis', 'wilayah_kode'], kolom: { kodeRekening: 'kode_rekening', jenis: 'jenis', wilayahKode: 'wilayah_kode', tarif: 'tarif', tarifTanpaNpwp: 'tarif_tanpa_npwp', dasarHukum: 'dasar_hukum', aktif: 'aktif' }, urut: 'kode_rekening, jenis, wilayah_kode' },
};
export const SLUG: Record<string, EntitasReferensi> = {
  wilayah: 'WILAYAH', jenjang: 'JENJANG', sekolah: 'SEKOLAH', direktorat: 'DIREKTORAT', 'sumber-dana': 'SUMBER_DANA',
  'kode-rekening': 'KODE_REKENING', komponen: 'KOMPONEN', 'tarif-pajak': 'TARIF_PAJAK',
};
