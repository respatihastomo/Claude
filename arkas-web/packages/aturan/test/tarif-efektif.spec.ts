import { describe, expect, it } from 'vitest';
import { KandidatTarif, pilihTarifEfektif } from '../src';

const k = (x: Partial<KandidatTarif>): KandidatTarif => ({ kodeRekening: '5.1.02.01.01.0052', jenis: 'SSPD', tarif: 0.1, tarifTanpaNpwp: null, wilayahKode: '', aktif: true, ...x });

describe('pilihTarifEfektif (UC-32)', () => {
  const data = [
    k({}), // nasional 10%
    k({ wilayahKode: '32', tarif: 0.08 }), // provinsi
    k({ wilayahKode: '3201', tarif: 0.05 }), // kab 3201
    k({ wilayahKode: '3203', aktif: false }), // kab 3203 membebaskan
    k({ kodeRekening: '5.1.02.01.01.0024', jenis: 'PPN', tarif: 0.11 }),
  ];
  it('memakai wilayah paling spesifik', () => {
    expect(pilihTarifEfektif(data, '3201')['5.1.02.01.01.0052']).toEqual([{ jenis: 'SSPD', tarif: 0.05, tarifTanpaNpwp: null }]);
    expect(pilihTarifEfektif(data, '3202')['5.1.02.01.01.0052'][0].tarif).toBe(0.08);
    expect(pilihTarifEfektif(data, '3301')['5.1.02.01.01.0052'][0].tarif).toBe(0.1);
  });
  it('baris wilayah nonaktif membebaskan (menutup tarif nasional/provinsi)', () => {
    expect(pilihTarifEfektif(data, '3203')['5.1.02.01.01.0052']).toBeUndefined();
    expect(pilihTarifEfektif(data, '3203')['5.1.02.01.01.0024']).toEqual([{ jenis: 'PPN', tarif: 0.11, tarifTanpaNpwp: null }]);
  });
  it('tanpa wilayah sekolah hanya tarif nasional; nasional nonaktif tidak dipungut', () => {
    expect(pilihTarifEfektif(data, null)['5.1.02.01.01.0052'][0].tarif).toBe(0.1);
    expect(pilihTarifEfektif([k({ aktif: false })], '3201')).toEqual({});
  });
  it('beberapa jenis pada satu rekening diurutkan', () => {
    const r = pilihTarifEfektif([k({ kodeRekening: 'R', jenis: 'PPH23', tarif: 0.02 }), k({ kodeRekening: 'R', jenis: 'PPN', tarif: 0.11 })], '3201');
    expect(r.R.map((x) => x.jenis)).toEqual(['PPH23', 'PPN']);
  });
});
