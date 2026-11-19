import { describe, expect, it } from 'vitest';
import { periksaKonsistensi, susunBaris, TransaksiLokal } from '../src/laporan/bku';
import { esc, htmlLaporanBku } from '../src/laporan/templat';

const t = (x: Partial<TransaksiLokal> & Pick<TransaksiLokal, 'jenis' | 'nilaiBruto'>): TransaksiLokal => ({
  transaksiId: x.transaksiId ?? Math.random().toString(36), tanggal: '2026-11-05', noBukti: null, uraian: 'u', caraBayar: null, ntpn: null,
  disetujuiAt: '2026-11-05T01:00:00Z', items: [], pajak: [], ...x,
});
const data = [
  t({ transaksiId: 'a', jenis: 'PENERIMAAN', nilaiBruto: 10_000_000, uraian: 'BOSP' }),
  t({ transaksiId: 'b', jenis: 'TARIK_TUNAI', nilaiBruto: 1_000_000, disetujuiAt: '2026-11-05T02:00:00Z' }),
  t({ transaksiId: 'c', jenis: 'BELANJA', nilaiBruto: 555_000, caraBayar: 'TUNAI', noBukti: 'N-1', tanggal: '2026-11-06',
    items: [{ kodeRekening: '5.1', jumlah: 555_000, uraian: 'Kertas' }], pajak: [{ jenis: 'PPN', nilai: 55_000 }] }),
  t({ transaksiId: 'd', jenis: 'SETOR_PAJAK', nilaiBruto: 55_000, caraBayar: 'TUNAI', ntpn: 'A1B2C3D4E5F6A7B8', tanggal: '2026-11-07' }),
];
const ringkasan = {
  tunai: { saldoAwal: 0, penerimaan: 1_055_000, pengeluaran: 610_000, saldoAkhir: 445_000 },
  bank: { saldoAwal: 0, penerimaan: 10_000_000, pengeluaran: 1_000_000, saldoAkhir: 9_000_000 },
  pajak: { saldoAwal: 0, dipungut: 55_000, disetor: 55_000, saldoAkhir: 0 }, jumlahTransaksi: 4,
};

describe('susunBaris', () => {
  it('mengikuti aturan v_mutasi dan menghitung saldo berjalan', () => {
    const b = susunBaris(data, 0);
    expect(b.map((x) => [x.buku, x.penerimaan, x.pengeluaran, x.saldo])).toEqual([
      ['BANK', 10_000_000, 0, 10_000_000], ['BANK', 0, 1_000_000, 9_000_000], ['TUNAI', 1_000_000, 0, 10_000_000],
      ['TUNAI', 0, 555_000, 9_445_000], ['TUNAI', 55_000, 0, 9_500_000], ['TUNAI', 0, 55_000, 9_445_000],
    ]);
    expect(b[3]).toMatchObject({ uraian: 'Kertas', kodeRekening: '5.1' });
    expect(b[4].uraian).toBe('Pungut PPN N-1');
    expect(b[5].noBukti).toBe('A1B2C3D4E5F6A7B8');
  });
  it('saldo awal ikut dihitung, setor tunai dua baris', () => {
    const b = susunBaris([t({ jenis: 'SETOR_TUNAI', nilaiBruto: 100 })], 500);
    expect(b.map((x) => [x.buku, x.saldo])).toEqual([['TUNAI', 400], ['BANK', 500]]);
  });
});

describe('periksaKonsistensi', () => {
  it('konsisten', () => {
    expect(periksaKonsistensi(data, susunBaris(data, 0), ringkasan)).toEqual([]);
  });
  it('mendeteksi transaksi yang belum tiba', () => {
    const sebagian = data.slice(0, 2);
    const salah = periksaKonsistensi(sebagian, susunBaris(sebagian, 0), ringkasan);
    expect(salah[0]).toBe('jumlah transaksi 2 dari 4');
    expect(salah.some((s) => s.startsWith('pengeluaran tunai'))).toBe(true);
  });
});

describe('templat', () => {
  const dasar = {
    npsn: '20100001', tahun: 2026, bulan: 11, sumberDanaKode: 'BOSP_REG', ringkasan,
    rekonsiliasi: { saldoRekeningKoran: 9_000_000, selisihBank: 0, penjelasanBank: null, kasFisik: 445_000, selisihKas: 0, penjelasanKas: '<script>alert(1)</script>' },
    baris: susunBaris(data, 0), diajukanOleh: 'u-b', ditutupOleh: 'u-k', ditutupAt: '2026-11-30T09:00:00Z', dibuatAt: '2026-11-30T09:01:00Z',
  };
  it('meng-escape teks dari data', () => {
    expect(esc('<b>"&\'')).toBe('&lt;b&gt;&quot;&amp;&#39;');
    const html = htmlLaporanBku(dasar);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
  it('draf memuat tanda DRAF; tertanda simulasi diberi label jelas bukan TTE sah', () => {
    expect(htmlLaporanBku(dasar)).toContain('DRAF — BELUM DITANDATANGANI');
    const ttd = htmlLaporanBku({ ...dasar, tte: { oleh: 'u-k', at: '2026-11-30T10:00:00Z', sha256Asli: 'ab'.repeat(32), penyedia: 'SIMULASI_DEV' } });
    expect(ttd).not.toContain('DRAF — BELUM DITANDATANGANI');
    expect(ttd).toContain('BUKAN TTE YANG SAH');
    expect(ttd).toContain('Laporan Buku Kas Umum — November 2026');
  });
});
