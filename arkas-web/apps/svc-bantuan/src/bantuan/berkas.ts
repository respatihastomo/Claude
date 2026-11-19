import { createHash, randomUUID } from 'node:crypto';
import { AturanError } from '@arkas/aturan';

export const MAKS_BERKAS = 10 * 1024 * 1024;
export const JENIS_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** Validasi isi berdasarkan tanda tangan berkas (magic bytes), bukan nama/ekstensi (OWASP ASVS 12.2). */
export function periksaBerkas(isi: Buffer | undefined, jenis: 'PDF' | 'XLSX') {
  if (!isi?.length) throw new AturanError('BERKAS_KOSONG', 'Berkas wajib diunggah');
  if (isi.length > MAKS_BERKAS) throw new AturanError('BERKAS_TERLALU_BESAR', 'Ukuran berkas maksimal 10 MB');
  const ok = jenis === 'PDF' ? isi.subarray(0, 5).toString('latin1') === '%PDF-' : isi.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (!ok) throw new AturanError('JENIS_BERKAS_SALAH', jenis === 'PDF' ? 'Berkas harus PDF' : 'Berkas harus Excel (.xlsx)');
  return { sha256: sha256(isi), ukuran: isi.length };
}
export const kunciBerkas = (awalan: string, ekstensi: 'pdf' | 'xlsx') => `${awalan.toLowerCase().replace(/[^a-z0-9/_-]/g, '-')}/${randomUUID()}.${ekstensi}`;
/** Nama berkas aman untuk ditampilkan & Content-Disposition. */
export const namaAman = (s: string | undefined, cadangan: string) => (s ?? '').replace(/[^\w .()-]/g, '_').slice(0, 150) || cadangan;
