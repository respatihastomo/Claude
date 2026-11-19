import { describe, expect, it } from 'vitest';
import { AturanError, bolehBelanja, hitungHpp, Pembukaan, transisiPembukaan } from '../src';

const p = (status: Pembukaan['status'], versi = 1, target: Pembukaan['target'] = 'BUKA'): Pembukaan => ({ status, versi, target });
const kode = (f: () => unknown) => { try { f(); } catch (e) { return (e as AturanError).kode; } return null; };

describe('transisiPembukaan (SK-08)', () => {
  it('alur normal MENUNGGU -> TERKIRIM -> DIBUKA; hanya DIBUKA yang boleh belanja', () => {
    let x = transisiPembukaan(p('MENUNGGU'), { aksi: 'KIRIM_BERHASIL' });
    expect(x.status).toBe('TERKIRIM');
    expect(bolehBelanja(x)).toBe(false);
    x = transisiPembukaan(x, { aksi: 'KONFIRMASI', status: 'DIBUKA', versi: 1 });
    expect(x).toEqual(p('DIBUKA'));
    expect(bolehBelanja(x)).toBe(true);
    expect(transisiPembukaan(x, { aksi: 'KONFIRMASI', status: 'DIBUKA', versi: 1 })).toEqual(x); // idempoten
  });
  it('konfirmasi versi lama ditolak; perubahan menaikkan versi dan kembali MENUNGGU', () => {
    const x = transisiPembukaan(p('DIBUKA'), { aksi: 'VERSI_BARU' });
    expect(x).toEqual(p('MENUNGGU', 2));
    expect(kode(() => transisiPembukaan({ ...x, status: 'TERKIRIM' }, { aksi: 'KONFIRMASI', status: 'DIBUKA', versi: 1 }))).toBe('VERSI_USANG');
    expect(kode(() => transisiPembukaan(p('MENUNGGU'), { aksi: 'KONFIRMASI', status: 'DIBUKA', versi: 1 }))).toBe('STATUS_PEMBUKAAN_TIDAK_SESUAI');
  });
  it('gagal -> kirim ulang; tutup menaikkan versi dan selesai DITUTUP tanpa konfirmasi', () => {
    const g = transisiPembukaan(p('MENUNGGU'), { aksi: 'KIRIM_GAGAL_AKHIR', alasan: 'timeout' });
    expect(g.status).toBe('GAGAL');
    expect(transisiPembukaan(g, { aksi: 'KIRIM_ULANG' }).status).toBe('MENUNGGU');
    expect(kode(() => transisiPembukaan(p('DIBUKA'), { aksi: 'KIRIM_ULANG' }))).toBe('STATUS_PEMBUKAAN_TIDAK_SESUAI');
    const t = transisiPembukaan(p('DIBUKA', 3), { aksi: 'TUTUP' });
    expect(t).toEqual(p('MENUNGGU', 4, 'TUTUP'));
    expect(bolehBelanja(t)).toBe(false);
    expect(transisiPembukaan(t, { aksi: 'KIRIM_BERHASIL' }).status).toBe('DITUTUP');
    expect(kode(() => transisiPembukaan(t, { aksi: 'KONFIRMASI', status: 'DIBUKA', versi: 4 }))).toBe('SUMBER_DANA_DITUTUP');
    expect(kode(() => transisiPembukaan(t, { aksi: 'VERSI_BARU' }))).toBe('STATUS_PEMBUKAAN_TIDAK_SESUAI');
  });
});

describe('hitungHpp (SK-11)', () => {
  const rencana = [
    { barisId: 'b1', kodeRekening: '5.1.02.01.01.0024', uraian: 'ATK', total: 1_000_000 },
    { barisId: 'b2', kodeRekening: '5.1.02.01.01.0024', uraian: 'Kertas ujian', total: 500_000 },
    { barisId: 'b3', kodeRekening: '5.1.02.02.01.0013', uraian: 'Servis', total: 300_000 },
    { barisId: 'b4', kodeRekening: '5.1.02.01.01.0052', uraian: 'Konsumsi rapat', total: 200_000 },
  ];
  it('empat kategori: sesuai, melebihi, di luar rencana, belum dibelanjakan', () => {
    const h = hitungHpp(rencana, [
      { itemId: 'i1', barisId: 'b1', kodeRekening: '5.1.02.01.01.0024', uraian: 'Pulpen', jumlah: 400_000.5 },
      { itemId: 'i2', barisId: null, kodeRekening: '5.1.02.02.01.0013', uraian: 'Servis AC', jumlah: 350_000 },
      { itemId: 'i3', barisId: null, kodeRekening: '5.1.02.03.02.0001', uraian: 'Laptop', jumlah: 8_000_000 },
      { itemId: 'i4', barisId: 'tak-ada', kodeRekening: '5.1.02.01.01.0024', uraian: 'Map', jumlah: 100_000 },
    ]);
    const k = Object.fromEntries(h.baris.map((b) => [b.barisId, b.kategori]));
    expect(k).toEqual({ b1: 'SESUAI', b2: 'BELUM_DIBELANJAKAN', b3: 'MELEBIHI_RENCANA', b4: 'BELUM_DIBELANJAKAN' });
    // i4 (ID baris tak dikenal) dicocokkan lewat kode rekening ke baris berkode sama yang sisanya terbesar (b1 sisa 599.999,5 > b2 500.000)
    expect(h.cocok.find((c) => c.itemId === 'i4')).toEqual({ itemId: 'i4', barisId: 'b1', cara: 'KODE_REKENING', jumlah: 100_000 });
    expect(h.diLuarRencana).toEqual([{ itemId: 'i3', kodeRekening: '5.1.02.03.02.0001', uraian: 'Laptop', jumlah: 8_000_000 }]);
    expect(h.baris.find((b) => b.barisId === 'b3')).toMatchObject({ belanja: 350_000, selisih: -50_000 });
    expect(h.ringkasan).toMatchObject({
      SESUAI: { jumlah: 1, nilai: 500_000.5 }, MELEBIHI_RENCANA: { jumlah: 1, nilai: 350_000 }, BELUM_DIBELANJAKAN: { jumlah: 2, nilai: 700_000 },
      DI_LUAR_RENCANA: { jumlah: 1, nilai: 8_000_000 }, rencana: 2_000_000, belanja: 8_850_000.5,
    });
  });
  it('tanpa belanja semua baris belum dibelanjakan; tanpa rencana semua belanja di luar rencana', () => {
    expect(hitungHpp(rencana, []).ringkasan.BELUM_DIBELANJAKAN.jumlah).toBe(4);
    expect(hitungHpp([], [{ itemId: 'x', barisId: 'b1', kodeRekening: 'k', uraian: 'u', jumlah: 5 }]).ringkasan.DI_LUAR_RENCANA).toEqual({ jumlah: 1, nilai: 5 });
  });
});
