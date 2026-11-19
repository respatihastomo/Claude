import { describe, expect, it } from 'vitest';
import { normalisasiNtpn, PajakTerutang, validasiSetorPajak } from '../src';

const p = (id: string, x: Partial<PajakTerutang> = {}): PajakTerutang => ({
  id, jenis: 'PPN', nilai: 110000, status: 'DIPUNGUT', statusBelanja: 'DISETUJUI', tanggalBelanja: '2026-11-03', ...x,
});

describe('normalisasiNtpn', () => {
  it('membuang spasi/strip dan menjadikan huruf besar', () => {
    expect(normalisasiNtpn('0a1b 2c3d-4e5f 6a7b')).toBe('0A1B2C3D4E5F6A7B');
  });
  it('menolak panjang atau karakter salah', () => {
    expect(() => normalisasiNtpn('123')).toThrowError(expect.objectContaining({ kode: 'NTPN_TIDAK_VALID' }));
    expect(() => normalisasiNtpn('12345678901234_6')).toThrowError(expect.objectContaining({ kode: 'NTPN_TIDAK_VALID' }));
  });
});

describe('validasiSetorPajak', () => {
  const data = [p('a'), p('b', { nilai: 55000.5, tanggalBelanja: '2026-11-10' }), p('c', { jenis: 'PPH23' }), p('d', { status: 'DISETOR' }), p('e', { statusBelanja: 'DICATAT' })];

  it('menjumlahkan pajak sejenis', () => {
    expect(validasiSetorPajak(data, ['a', 'b'], '2026-11-12')).toEqual({ jenis: 'PPN', nilai: 165000.5 });
  });
  it.each([
    [[], 'PAJAK_KOSONG'],
    [['a', 'a'], 'PAJAK_GANDA'],
    [['x'], 'PAJAK_TIDAK_DITEMUKAN'],
    [['a', 'c'], 'JENIS_PAJAK_CAMPUR'],
    [['d'], 'PAJAK_SUDAH_DISETOR'],
    [['e'], 'PAJAK_BELUM_SAH'],
  ])('menolak %j -> %s', (ids, kode) => {
    expect(() => validasiSetorPajak(data, ids as string[], '2026-11-12')).toThrowError(expect.objectContaining({ kode }));
  });
  it('tanggal setor tidak boleh sebelum belanja terakhir', () => {
    expect(() => validasiSetorPajak(data, ['a', 'b'], '2026-11-05')).toThrowError(expect.objectContaining({ kode: 'TANGGAL_SETOR_TIDAK_VALID' }));
  });
  it('nilai nol ditolak', () => {
    expect(() => validasiSetorPajak([p('z', { nilai: 0 })], ['z'], '2026-11-12')).toThrowError(expect.objectContaining({ kode: 'NILAI_SETOR_NOL' }));
  });
});
