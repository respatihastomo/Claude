import { AturanError, keRupiah, keSen } from './uang';
import type { JenisPajak } from './hitung-pajak';

/** NTPN (Nomor Transaksi Penerimaan Negara): 16 karakter huruf besar/angka. */
export function normalisasiNtpn(ntpn: string): string {
  const n = ntpn.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[0-9A-Z]{16}$/.test(n)) throw new AturanError('NTPN_TIDAK_VALID', 'NTPN harus 16 karakter huruf/angka');
  return n;
}

export interface PajakTerutang {
  id: string;
  jenis: JenisPajak;
  nilai: number;
  status: 'DIPUNGUT' | 'DISETOR';
  /** status transaksi belanja asal */
  statusBelanja: 'DICATAT' | 'DISETUJUI' | 'DITOLAK';
  /** tanggal belanja asal (YYYY-MM-DD) */
  tanggalBelanja: string;
}

/**
 * Validasi satu setoran pajak (UC-14):
 *  - minimal satu baris pajak, tanpa duplikat;
 *  - satu jenis pajak per setoran (satu kode billing / NTPN per jenis);
 *  - setiap baris DIPUNGUT dan belanjanya DISETUJUI;
 *  - tanggal setor tidak sebelum tanggal belanja terakhir yang disetor.
 * @returns jenis dan total nilai setoran.
 */
export function validasiSetorPajak(pajak: PajakTerutang[], idDiminta: string[], tanggalSetor: string): { jenis: JenisPajak; nilai: number } {
  if (idDiminta.length === 0) throw new AturanError('PAJAK_KOSONG', 'Pilih minimal satu pajak untuk disetor');
  if (new Set(idDiminta).size !== idDiminta.length) throw new AturanError('PAJAK_GANDA', 'Pajak yang sama dipilih lebih dari sekali');
  const peta = new Map(pajak.map((p) => [p.id, p]));
  const hilang = idDiminta.filter((id) => !peta.has(id));
  if (hilang.length) throw new AturanError('PAJAK_TIDAK_DITEMUKAN', 'Pajak tidak ditemukan di buku ini', { pajakId: hilang });
  const dipilih = idDiminta.map((id) => peta.get(id)!);

  const jenis = new Set(dipilih.map((p) => p.jenis));
  if (jenis.size > 1) throw new AturanError('JENIS_PAJAK_CAMPUR', 'Satu setoran hanya untuk satu jenis pajak', { jenis: [...jenis] });
  const sudah = dipilih.filter((p) => p.status !== 'DIPUNGUT').map((p) => p.id);
  if (sudah.length) throw new AturanError('PAJAK_SUDAH_DISETOR', 'Sebagian pajak sudah disetor', { pajakId: sudah });
  const belum = dipilih.filter((p) => p.statusBelanja !== 'DISETUJUI').map((p) => p.id);
  if (belum.length) throw new AturanError('PAJAK_BELUM_SAH', 'Pajak hanya dapat disetor setelah belanjanya disetujui', { pajakId: belum });
  const terakhir = dipilih.map((p) => p.tanggalBelanja).sort().at(-1)!;
  if (tanggalSetor < terakhir) throw new AturanError('TANGGAL_SETOR_TIDAK_VALID', `Tanggal setor tidak boleh sebelum tanggal belanja (${terakhir})`);

  const nilai = keRupiah(dipilih.reduce((s, p) => s + keSen(p.nilai), 0));
  if (nilai <= 0) throw new AturanError('NILAI_SETOR_NOL', 'Nilai setoran harus lebih dari nol');
  return { jenis: [...jenis][0], nilai };
}
