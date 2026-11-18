import { describe, expect, it } from 'vitest';
import { AturanError, cekPemisahanTugas, hitungPajak, keRupiah, keSen, transisiTransaksi } from '../src';

const aturan = {
  '5.1.02.01.01.0024': [{ jenis: 'PPN' as const, tarif: 0.11 }], // ATK: PPN saja
  '5.1.02.02.01.0013': [{ jenis: 'PPH23' as const, tarif: 0.02, tarifTanpaNpwp: 0.04 }], // jasa servis
  '5.1.02.02.01.0026': [
    { jenis: 'PPN' as const, tarif: 0.11 },
    { jenis: 'PPH23' as const, tarif: 0.02, tarifTanpaNpwp: 0.04 },
  ],
  '5.1.02.01.01.0052': [{ jenis: 'SSPD' as const, tarif: 0.1 }], // makan minum: pajak restoran
  '5.1.02.02.01.0001': [{ jenis: 'PPH21' as const, tarif: 0.05, tarifTanpaNpwp: 0.06 }], // honor narasumber
};

describe('hitungPajak', () => {
  it('rekening tanpa pajak: netto = bruto', () => {
    const r = hitungPajak({ items: [{ kodeRekening: 'X', jumlah: 150000 }], aturan, penjualPunyaNpwp: true });
    expect(r).toEqual({ nilaiBruto: 150000, totalPajak: 0, nilaiNetto: 150000, pajak: [] });
  });

  it('PPN 11% dihitung dari DPP harga termasuk PPN dan dibulatkan ke bawah', () => {
    const r = hitungPajak({ items: [{ kodeRekening: '5.1.02.01.01.0024', jumlah: 1110000 }], aturan, penjualPunyaNpwp: true });
    expect(r.pajak).toEqual([{ jenis: 'PPN', tarif: 0.11, dpp: 1000000, nilai: 110000 }]);
    expect(r.nilaiNetto).toBe(1000000);
  });

  it('pembulatan ke bawah rupiah', () => {
    const r = hitungPajak({ items: [{ kodeRekening: '5.1.02.02.01.0013', jumlah: 123457 }], aturan, penjualPunyaNpwp: true });
    // 2% x 123.457 = 2.469,14 -> 2.469
    expect(r.pajak[0].nilai).toBe(2469);
  });

  it('PPh 23 memakai tarif tanpa NPWP bila penjual tidak ber-NPWP', () => {
    const r = hitungPajak({ items: [{ kodeRekening: '5.1.02.02.01.0013', jumlah: 500000 }], aturan, penjualPunyaNpwp: false });
    expect(r.pajak).toEqual([{ jenis: 'PPH23', tarif: 0.04, dpp: 500000, nilai: 20000 }]);
  });

  it('PPN + PPh 23: dasar PPh adalah DPP', () => {
    const r = hitungPajak({ items: [{ kodeRekening: '5.1.02.02.01.0026', jumlah: 2220000 }], aturan, penjualPunyaNpwp: true });
    expect(r.pajak).toEqual([
      { jenis: 'PPN', tarif: 0.11, dpp: 2000000, nilai: 220000 },
      { jenis: 'PPH23', tarif: 0.02, dpp: 2000000, nilai: 40000 },
    ]);
    expect(r.totalPajak).toBe(260000);
    expect(r.nilaiNetto).toBe(1960000);
  });

  it('menggabungkan item berjenis pajak sama', () => {
    const r = hitungPajak({
      items: [
        { kodeRekening: '5.1.02.01.01.0024', jumlah: 555000 },
        { kodeRekening: '5.1.02.01.01.0024', jumlah: 555000 },
      ],
      aturan,
      penjualPunyaNpwp: true,
    });
    expect(r.pajak).toEqual([{ jenis: 'PPN', tarif: 0.11, dpp: 1000000, nilai: 110000 }]);
  });

  it('SSPD dan PPh 21', () => {
    const r = hitungPajak({
      items: [
        { kodeRekening: '5.1.02.01.01.0052', jumlah: 300000 },
        { kodeRekening: '5.1.02.02.01.0001', jumlah: 1000000 },
      ],
      aturan,
      penjualPunyaNpwp: false,
    });
    expect(r.pajak.map((p) => [p.jenis, p.nilai])).toEqual([
      ['PPH21', 60000],
      ['SSPD', 30000],
    ]);
  });

  it('menolak lebih dari dua jenis pajak dalam satu transaksi', () => {
    expect(() =>
      hitungPajak({
        items: [
          { kodeRekening: '5.1.02.02.01.0026', jumlah: 100000 },
          { kodeRekening: '5.1.02.01.01.0052', jumlah: 100000 },
        ],
        aturan,
        penjualPunyaNpwp: true,
      }),
    ).toThrowError(expect.objectContaining({ kode: 'PAJAK_MELEBIHI_BATAS_JENIS' }));
  });

  it('menolak jumlah nol/negatif dan tarif tidak valid', () => {
    expect(() => hitungPajak({ items: [{ kodeRekening: 'X', jumlah: 0 }], aturan, penjualPunyaNpwp: true })).toThrow(AturanError);
    expect(() =>
      hitungPajak({ items: [{ kodeRekening: 'Y', jumlah: 10 }], aturan: { Y: [{ jenis: 'PPN', tarif: 11 }] }, penjualPunyaNpwp: true }),
    ).toThrowError(expect.objectContaining({ kode: 'TARIF_TIDAK_VALID' }));
  });
});

describe('uang', () => {
  it('konversi sen/rupiah bebas galat floating point', () => {
    expect(keSen('0.1') + keSen(0.2)).toBe(30);
    expect(keRupiah(keSen(1234.56))).toBe(1234.56);
    expect(() => keSen('abc')).toThrowError(expect.objectContaining({ kode: 'NILAI_TIDAK_VALID' }));
  });
});

describe('transisi transaksi & pemisahan tugas', () => {
  it('DICATAT dapat disetujui atau ditolak', () => {
    expect(transisiTransaksi('DICATAT', 'SETUJUI')).toBe('DISETUJUI');
    expect(transisiTransaksi('DICATAT', 'TOLAK')).toBe('DITOLAK');
  });
  it('status akhir tidak dapat berubah', () => {
    expect(() => transisiTransaksi('DISETUJUI', 'TOLAK')).toThrowError(expect.objectContaining({ kode: 'STATUS_TIDAK_SESUAI' }));
    expect(() => transisiTransaksi('DITOLAK', 'SETUJUI')).toThrow(AturanError);
  });
  it('penyetuju tidak boleh pembuat', () => {
    expect(() => cekPemisahanTugas('u1', 'u1')).toThrowError(expect.objectContaining({ kode: 'PEMISAHAN_TUGAS' }));
    expect(() => cekPemisahanTugas('u1', 'u2')).not.toThrow();
  });
});
