import { describe, expect, it } from 'vitest';
import { BarisValidasi, jadwalMerata, validasiKertasKerja } from '../src';

const komponen = [
  { kode: '03', nama: 'Kegiatan pembelajaran' },
  { kode: '07', nama: 'Langganan daya dan jasa' },
  { kode: '12', nama: 'Pembayaran honor', maksPersen: 20 },
  { kode: '02', nama: 'Pengembangan perpustakaan', minPersen: 5 },
];
const b = (id: string, komponenKode: string, volume: number, hargaSatuan: number, x: Partial<BarisValidasi> = {}): BarisValidasi => {
  const total = volume * hargaSatuan;
  return { id, komponenKode, kodeRekening: '5.1.02', uraian: id, volume, hargaSatuan, total, jadwal: jadwalMerata(total), ...x };
};
const sah = [b('a', '03', 10, 500_000), b('b', '07', 12, 100_000), b('c', '12', 2, 1_000_000), b('d', '02', 1, 800_000)];

describe('validasiKertasKerja', () => {
  it('valid bila seimbang dengan pagu dan batas komponen terpenuhi', () => {
    const r = validasiKertasKerja({ pagu: 9_000_000, baris: [...sah.slice(0, 2), b('c', '12', 1, 1_000_000), b('d', '02', 1, 800_000), b('e', '03', 1, 1_000_000)], komponen });
    expect(r).toMatchObject({ valid: true, pagu: 9_000_000, totalAnggaran: 9_000_000, sisaPagu: 0, galat: [] });
    expect(r.komponen.find((k) => k.kode === '12')).toMatchObject({ total: 1_000_000, persen: 11.11, ok: true });
  });

  it('pagu terlampaui dan sisa pagu', () => {
    expect(validasiKertasKerja({ pagu: 8_000_000, baris: sah, komponen }).galat.map((g) => g.kode)).toContain('PAGU_TERLAMPAUI');
    const r = validasiKertasKerja({ pagu: 10_000_000, baris: sah, komponen });
    expect(r.galat.map((g) => g.kode)).toContain('SISA_PAGU');
    expect(r.sisaPagu).toBe(1_000_000);
  });

  it('batas maksimum & minimum komponen (persen dari pagu)', () => {
    const r = validasiKertasKerja({ pagu: 9_000_000, baris: [b('a', '03', 1, 6_600_000), b('c', '12', 1, 2_000_000), b('d', '02', 1, 400_000)], komponen });
    const kode = r.galat.map((g) => g.kode);
    expect(kode).toContain('KOMPONEN_MELEBIHI_BATAS'); // 22,22% > 20%
    expect(kode).toContain('KOMPONEN_KURANG_DARI_MINIMUM'); // 4,44% < 5%
    expect(r.komponen.find((k) => k.kode === '12')).toMatchObject({ persen: 22.22, ok: false });
  });

  it('jumlah, jadwal kas, nilai positif, komponen dikenal, dan realisasi', () => {
    const r = validasiKertasKerja({
      pagu: 1, komponen,
      baris: [
        b('x', '03', 2, 100, { total: 150 }),
        b('y', '03', 1, 100, { jadwal: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] }),
        b('z', '99', 1, 100),
        b('w', '03', 0, 100, { total: 0, jadwal: Array(12).fill(0) }),
        b('v', '03', 1, 100, { jadwal: [100] }),
        b('u', '03', 1, 100, { realisasi: 150 }),
      ],
    });
    const kodeBaris = (id: string) => r.galat.filter((g) => g.barisId === id).map((g) => g.kode);
    expect(kodeBaris('x')).toEqual(['JUMLAH_TIDAK_SESUAI', 'JADWAL_KAS_TIDAK_SESUAI']);
    expect(kodeBaris('y')).toEqual(['JADWAL_KAS_TIDAK_SESUAI']);
    expect(kodeBaris('z')).toEqual(['KOMPONEN_TIDAK_DIKENAL']);
    expect(kodeBaris('w')).toEqual(['NILAI_TIDAK_POSITIF']);
    expect(kodeBaris('v')).toEqual(['JADWAL_KAS_TIDAK_VALID']);
    expect(kodeBaris('u')).toEqual(['DI_BAWAH_REALISASI']);
  });
});

describe('jadwalMerata', () => {
  it('membagi rata dengan sisa sen di bulan terakhir', () => {
    const j = jadwalMerata(1000);
    expect(j).toHaveLength(12);
    expect(j.slice(0, 11).every((x) => x === 83.33)).toBe(true);
    expect(Math.round(j.reduce((s, x) => s + x, 0) * 100)).toBe(100000);
  });
  it('mulai dari bulan tertentu', () => {
    const j = jadwalMerata(1200, 7);
    expect(j.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(j.slice(6)).toEqual([200, 200, 200, 200, 200, 200]);
  });
});
