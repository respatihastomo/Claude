import { AturanError } from './uang';

/** Siklus status transaksi (Tabel 8.2): DICATAT -> DISETUJUI | DITOLAK. Pembatalan setelah disetujui memakai transaksi KOREKSI (irisan berikutnya). */
export type StatusTransaksi = 'DICATAT' | 'DISETUJUI' | 'DITOLAK';
export type AksiTransaksi = 'SETUJUI' | 'TOLAK';

const TRANSISI: Record<StatusTransaksi, Partial<Record<AksiTransaksi, StatusTransaksi>>> = {
  DICATAT: { SETUJUI: 'DISETUJUI', TOLAK: 'DITOLAK' },
  DISETUJUI: {},
  DITOLAK: {},
};

export function transisiTransaksi(status: StatusTransaksi, aksi: AksiTransaksi): StatusTransaksi {
  const ke = TRANSISI[status][aksi];
  if (!ke) throw new AturanError('STATUS_TIDAK_SESUAI', `Transaksi berstatus ${status} tidak dapat di-${aksi.toLowerCase()}`, { status, aksi });
  return ke;
}

/** Pemisahan tugas: penyetuju tidak boleh pembuat transaksi. */
export function cekPemisahanTugas(dibuatOleh: string, penyetuju: string): void {
  if (dibuatOleh === penyetuju) throw new AturanError('PEMISAHAN_TUGAS', 'Penyetuju transaksi tidak boleh sama dengan pembuatnya');
}
