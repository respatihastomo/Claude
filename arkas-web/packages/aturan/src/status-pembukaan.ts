import { AturanError } from './uang';

/**
 * Siklus pembukaan sumber dana di satu Mitra SIPLah (Tabel 8.2, SK-08, Kode 14):
 * MENUNGGU -> TERKIRIM -> DIBUKA, dengan GAGAL bila pengiriman/konfirmasi gagal, dan DITUTUP setelah penutupan terkirim.
 * `target` = keadaan yang sedang dikirim ke Mitra: BUKA (buka/ubah) atau TUTUP.
 */
export type StatusPembukaan = 'MENUNGGU' | 'TERKIRIM' | 'DIBUKA' | 'GAGAL' | 'DITUTUP';
export type TargetPembukaan = 'BUKA' | 'TUTUP';
export interface Pembukaan { status: StatusPembukaan; versi: number; target: TargetPembukaan }
export type AksiPembukaan =
  | { aksi: 'KIRIM_BERHASIL' }
  | { aksi: 'KIRIM_GAGAL_AKHIR'; alasan: string }
  | { aksi: 'KONFIRMASI'; status: 'DIBUKA' | 'GAGAL'; versi: number }
  | { aksi: 'VERSI_BARU' }
  | { aksi: 'KIRIM_ULANG' }
  | { aksi: 'TUTUP' };

const galat = (p: Pembukaan, aksi: string) =>
  new AturanError('STATUS_PEMBUKAAN_TIDAK_SESUAI', `Pembukaan berstatus ${p.status} tidak dapat menerima ${aksi}`, { status: p.status, aksi });

export function transisiPembukaan(p: Pembukaan, a: AksiPembukaan): Pembukaan {
  switch (a.aksi) {
    case 'KIRIM_BERHASIL':
      if (p.status !== 'MENUNGGU') throw galat(p, a.aksi);
      // penutupan tidak menunggu konfirmasi: Mitra wajib berhenti menerima belanja begitu menerima pesan
      return { ...p, status: p.target === 'TUTUP' ? 'DITUTUP' : 'TERKIRIM' };
    case 'KIRIM_GAGAL_AKHIR':
      if (p.status !== 'MENUNGGU') throw galat(p, a.aksi);
      return { ...p, status: 'GAGAL' };
    case 'KONFIRMASI':
      if (p.target === 'TUTUP') throw new AturanError('SUMBER_DANA_DITUTUP', 'Sumber dana sudah ditutup; konfirmasi pembukaan tidak berlaku', { status: p.status });
      if (a.versi !== p.versi) {
        throw new AturanError('VERSI_USANG', `Konfirmasi untuk versi ${a.versi}, versi pembukaan terbaru ${p.versi}`, { versiTerbaru: p.versi, versiDikonfirmasi: a.versi });
      }
      if (p.status === a.status) return p; // konfirmasi ganda untuk versi yang sama aman (idempoten)
      if (p.status !== 'TERKIRIM') throw galat(p, `${a.aksi} ${a.status}`);
      return { ...p, status: a.status };
    case 'VERSI_BARU':
      if (p.target === 'TUTUP') throw galat(p, a.aksi);
      return { ...p, versi: p.versi + 1, status: 'MENUNGGU' };
    case 'KIRIM_ULANG':
      if (p.status !== 'GAGAL') throw galat(p, a.aksi);
      return { ...p, status: 'MENUNGGU' };
    case 'TUTUP':
      if (p.target === 'TUTUP') return p;
      return { ...p, versi: p.versi + 1, target: 'TUTUP', status: 'MENUNGGU' };
  }
}

/** Mitra hanya boleh menerima belanja untuk sumber dana yang sudah DIKONFIRMASI DIBUKA (fitur 21). */
export const bolehBelanja = (p: Pembukaan | null | undefined): boolean => !!p && p.target === 'BUKA' && p.status === 'DIBUKA';
