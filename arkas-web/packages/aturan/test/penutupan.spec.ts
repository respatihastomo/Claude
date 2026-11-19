import { describe, expect, it } from 'vitest';
import { akhirBulan, bulanBerikut, cekKesiapanTutup, validasiRekonsiliasi } from '../src';

describe('akhirBulan & bulanBerikut', () => {
  it('menangani bulan pendek dan kabisat', () => {
    expect(akhirBulan(2026, 2)).toBe('2026-02-28');
    expect(akhirBulan(2028, 2)).toBe('2028-02-29');
    expect(akhirBulan(2026, 11)).toBe('2026-11-30');
    expect(akhirBulan(2026, 12)).toBe('2026-12-31');
  });
  it('Desember tidak punya bulan berikut di tahun anggaran yang sama', () => {
    expect(bulanBerikut(11)).toBe(12);
    expect(bulanBerikut(12)).toBeNull();
  });
});

describe('cekKesiapanTutup', () => {
  const dasar = { tahun: 2026, bulan: 11, hariIni: '2026-11-30', menunggu: 0, periodeSebelumTerbuka: 0, pajakBelumDisetor: 0 };
  it('siap bila semua syarat terpenuhi', () => {
    expect(cekKesiapanTutup(dasar)).toMatchObject({ siap: true, peringatan: [] });
  });
  it('belum akhir bulan menghalangi, kecuali mode dev', () => {
    const r = cekKesiapanTutup({ ...dasar, hariIni: '2026-11-18' });
    expect(r.siap).toBe(false);
    expect(r.syarat.find((s) => !s.ok)!.kode).toBe('BELUM_AKHIR_BULAN');
    const dev = cekKesiapanTutup({ ...dasar, hariIni: '2026-11-18', izinkanSebelumAkhirBulan: true });
    expect(dev.siap).toBe(true);
    expect(dev.syarat[0].pesan).toMatch(/mode dev/);
  });
  it('transaksi menunggu dan periode sebelumnya terbuka menghalangi; pajak belum disetor hanya peringatan', () => {
    const r = cekKesiapanTutup({ ...dasar, menunggu: 2, periodeSebelumTerbuka: 1, pajakBelumDisetor: 28000 });
    expect(r.siap).toBe(false);
    expect(r.syarat.filter((s) => !s.ok).map((s) => s.kode)).toEqual(['MASIH_ADA_TRANSAKSI_MENUNGGU', 'PERIODE_SEBELUMNYA_BELUM_DITUTUP']);
    expect(r.peringatan).toEqual([expect.objectContaining({ kode: 'PAJAK_BELUM_DISETOR' })]);
    expect(r.peringatan[0].pesan).toContain('28.000');
  });
});

describe('validasiRekonsiliasi', () => {
  const dasar = { saldoBukuBank: 45_663_000, saldoRekeningKoran: 45_663_000, saldoBukuTunai: 2_000_000, kasFisik: 2_000_000 };
  it('tanpa selisih', () => {
    expect(validasiRekonsiliasi(dasar)).toEqual({ selisihBank: 0, selisihKas: 0 });
  });
  it('selisih bank wajib dijelaskan', () => {
    expect(() => validasiRekonsiliasi({ ...dasar, saldoRekeningKoran: 45_660_500 })).toThrowError(expect.objectContaining({ kode: 'SELISIH_BANK_WAJIB_DIJELASKAN' }));
    expect(validasiRekonsiliasi({ ...dasar, saldoRekeningKoran: 45_660_500, penjelasanBank: 'Biaya administrasi bank Rp 2.500' })).toEqual({ selisihBank: -2500, selisihKas: 0 });
  });
  it('selisih kas wajib dijelaskan; kas fisik tidak boleh negatif', () => {
    expect(() => validasiRekonsiliasi({ ...dasar, kasFisik: 1_999_000, penjelasanKas: 'pendek' })).toThrowError(expect.objectContaining({ kode: 'SELISIH_KAS_WAJIB_DIJELASKAN' }));
    expect(validasiRekonsiliasi({ ...dasar, kasFisik: 1_999_000.5, penjelasanKas: 'Uang receh tercecer saat hitung' }).selisihKas).toBe(-999.5);
    expect(() => validasiRekonsiliasi({ ...dasar, kasFisik: -1 })).toThrowError(expect.objectContaining({ kode: 'KAS_FISIK_NEGATIF' }));
  });
});
