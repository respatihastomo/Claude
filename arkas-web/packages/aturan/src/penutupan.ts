import { AturanError, keRupiah, keSen } from './uang';

/** Tanggal terakhir bulan (YYYY-MM-DD). */
export function akhirBulan(tahun: number, bulan: number): string {
  const hari = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
  return `${tahun}-${String(bulan).padStart(2, '0')}-${String(hari).padStart(2, '0')}`;
}

/** Bulan berikutnya dalam tahun anggaran yang sama; null setelah Desember (tahun baru dibuka oleh RKAS tahun berikutnya). */
export function bulanBerikut(bulan: number): number | null {
  return bulan < 12 ? bulan + 1 : null;
}

export interface SyaratTutup { kode: string; ok: boolean; pesan: string }

export interface InputKesiapan {
  tahun: number;
  bulan: number;
  hariIni: string;
  /** transaksi DICATAT di periode ini */
  menunggu: number;
  /** jumlah periode sebelumnya yang belum DITUTUP */
  periodeSebelumTerbuka: number;
  /** pajak dipungut di bulan ini yang belum disetor (peringatan, tidak menghalangi) */
  pajakBelumDisetor: number;
  /** khusus lingkungan dev/demo */
  izinkanSebelumAkhirBulan?: boolean;
}

/**
 * Daftar periksa penutupan buku kas (Tampilan 3a2 > Penutupan Buku Kas).
 * Syarat wajib menghalangi pengajuan; `peringatan` hanya diinformasikan.
 */
export function cekKesiapanTutup(i: InputKesiapan): { siap: boolean; syarat: SyaratTutup[]; peringatan: SyaratTutup[] } {
  const akhir = akhirBulan(i.tahun, i.bulan);
  const syarat: SyaratTutup[] = [
    {
      kode: 'BELUM_AKHIR_BULAN', ok: !!i.izinkanSebelumAkhirBulan || i.hariIni >= akhir,
      pesan: i.hariIni >= akhir ? 'Bulan sudah berakhir' : `Buku baru dapat ditutup mulai ${akhir}${i.izinkanSebelumAkhirBulan ? ' (diabaikan: mode dev)' : ''}`,
    },
    { kode: 'MASIH_ADA_TRANSAKSI_MENUNGGU', ok: i.menunggu === 0, pesan: i.menunggu === 0 ? 'Semua transaksi sudah diputuskan' : `${i.menunggu} transaksi menunggu persetujuan` },
    {
      kode: 'PERIODE_SEBELUMNYA_BELUM_DITUTUP', ok: i.periodeSebelumTerbuka === 0,
      pesan: i.periodeSebelumTerbuka === 0 ? 'Periode sebelumnya sudah ditutup' : `${i.periodeSebelumTerbuka} periode sebelumnya belum ditutup`,
    },
  ];
  const peringatan: SyaratTutup[] = i.pajakBelumDisetor > 0
    ? [{ kode: 'PAJAK_BELUM_DISETOR', ok: false, pesan: `Pajak dipungut bulan ini belum disetor: Rp ${keRupiah(keSen(i.pajakBelumDisetor)).toLocaleString('id-ID')}` }]
    : [];
  return { siap: syarat.every((s) => s.ok), syarat, peringatan };
}

export interface InputRekonsiliasi {
  saldoBukuBank: number;
  saldoRekeningKoran: number;
  penjelasanBank?: string | null;
  saldoBukuTunai: number;
  kasFisik: number;
  penjelasanKas?: string | null;
}

/** Rekonsiliasi rekening koran & pemeriksaan kas: selisih wajib dijelaskan (minimal 10 karakter). */
export function validasiRekonsiliasi(r: InputRekonsiliasi): { selisihBank: number; selisihKas: number } {
  if (r.kasFisik < 0) throw new AturanError('KAS_FISIK_NEGATIF', 'Hasil hitung kas fisik tidak boleh negatif');
  const selisihBank = keRupiah(keSen(r.saldoRekeningKoran) - keSen(r.saldoBukuBank));
  const selisihKas = keRupiah(keSen(r.kasFisik) - keSen(r.saldoBukuTunai));
  const jelas = (s?: string | null) => (s ?? '').trim().length >= 10;
  if (selisihBank !== 0 && !jelas(r.penjelasanBank)) {
    throw new AturanError('SELISIH_BANK_WAJIB_DIJELASKAN', 'Saldo rekening koran berbeda dengan buku bank; jelaskan selisihnya (min. 10 karakter)', { selisihBank });
  }
  if (selisihKas !== 0 && !jelas(r.penjelasanKas)) {
    throw new AturanError('SELISIH_KAS_WAJIB_DIJELASKAN', 'Kas fisik berbeda dengan buku tunai; jelaskan selisihnya (min. 10 karakter)', { selisihKas });
  }
  return { selisihBank, selisihKas };
}
