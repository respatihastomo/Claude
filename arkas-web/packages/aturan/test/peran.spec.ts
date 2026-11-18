import { describe, expect, it } from 'vitest';
import { Cakupan, dalamWilayah, peranBerlaku, periksaPemberianPeran, RujukanCakupan, validasiBentukCakupan } from '../src';

const ref: RujukanCakupan = {
  wilayahSekolah: (n) => ({ '20100001': '3201', '20100002': '3202', '30100001': '3301' } as Record<string, string>)[n],
  ditjenDirektorat: (k) => ({ SMP: 'PAUDDIKDASMEN', SD: 'PAUDDIKDASMEN', VOKASI: 'VOK' } as Record<string, string>)[k],
  wilayahAda: (k) => ['32', '3201', '3202', '33', '3301'].includes(k),
  ditjenAda: (k) => ['PAUDDIKDASMEN', 'VOK'].includes(k),
};
const besok = new Date(Date.now() + 86_400_000).toISOString();
const u = (peran: Cakupan['peran'], x: Partial<Cakupan> = {}, penggunaId = 'pemberi') => ({ peran, penggunaId, ...x });
const t = (peran: Cakupan['peran'], x: Partial<Cakupan> = {}) => ({ peran, penggunaId: 'target', ...x });
const kode = (f: () => void) => { try { f(); return 'OK'; } catch (e) { return (e as { kode: string }).kode; } };

describe('validasiBentukCakupan', () => {
  it.each([
    [t('BENDAHARA', { npsn: '20100001' }), 'OK'],
    [t('BENDAHARA', {}), 'CAKUPAN_TIDAK_SESUAI'],
    [t('BENDAHARA', { npsn: '20100001', wilayahKode: '3201' }), 'CAKUPAN_TIDAK_SESUAI'],
    [t('BENDAHARA', { npsn: '123' }), 'CAKUPAN_TIDAK_SESUAI'],
    [t('VERIFIKATOR_DINAS', { wilayahKode: '3201' }), 'OK'],
    [t('VERIFIKATOR_DINAS', { wilayahKode: '320' }), 'CAKUPAN_TIDAK_SESUAI'],
    [t('TIM_KERJA', { direktoratKode: 'SMP' }), 'OK'],
    [t('ADMIN_DITJEN', { ditjenKode: 'VOK' }), 'OK'],
    [t('PEMANTAU', {}), 'OK'],
    [t('PEMANTAU', { npsn: '20100001' }), 'CAKUPAN_TIDAK_SESUAI'],
    [t('AUDITOR', {}), 'MASA_BERLAKU_WAJIB'],
    [t('AUDITOR', { berlakuSampai: '2020-01-01T00:00:00Z' }), 'MASA_BERLAKU_TIDAK_VALID'],
    [t('AUDITOR', { berlakuSampai: besok }), 'OK'],
    [t('SISTEM' as Cakupan['peran'], {}), 'PERAN_TIDAK_DIKENAL'],
  ])('%j -> %s', (c, harap) => {
    expect(kode(() => validasiBentukCakupan(c))).toBe(harap);
  });
});

describe('periksaPemberianPeran (SK-12 berjenjang)', () => {
  it.each([
    ['Balai memberi Admin Dinas', u('SUPER_ADMIN'), t('ADMIN_DINAS', { wilayahKode: '32' }), 'OK'],
    ['Balai: wilayah tak dikenal', u('SUPER_ADMIN'), t('ADMIN_DINAS', { wilayahKode: '99' }), 'DI_LUAR_CAKUPAN'],
    ['Balai tidak langsung memberi Bendahara', u('SUPER_ADMIN'), t('BENDAHARA', { npsn: '20100001' }), 'PERAN_DI_LUAR_KEWENANGAN'],
    ['Dinas provinsi -> verifikator kab di bawahnya', u('ADMIN_DINAS', { wilayahKode: '32' }), t('VERIFIKATOR_DINAS', { wilayahKode: '3201' }), 'OK'],
    ['Dinas kab -> verifikator kab lain', u('ADMIN_DINAS', { wilayahKode: '3201' }), t('VERIFIKATOR_DINAS', { wilayahKode: '3202' }), 'DI_LUAR_CAKUPAN'],
    ['Dinas kab -> operator sekolah di wilayahnya', u('ADMIN_DINAS', { wilayahKode: '3201' }), t('OPERATOR', { npsn: '20100001' }), 'OK'],
    ['Dinas kab -> operator sekolah wilayah lain', u('ADMIN_DINAS', { wilayahKode: '3201' }), t('OPERATOR', { npsn: '30100001' }), 'DI_LUAR_CAKUPAN'],
    ['Dinas -> sekolah tak dikenal', u('ADMIN_DINAS', { wilayahKode: '32' }), t('OPERATOR', { npsn: '99999999' }), 'DI_LUAR_CAKUPAN'],
    ['Dinas tidak memberi Bendahara', u('ADMIN_DINAS', { wilayahKode: '3201' }), t('BENDAHARA', { npsn: '20100001' }), 'PERAN_DI_LUAR_KEWENANGAN'],
    ['Operator -> Bendahara sekolahnya', u('OPERATOR', { npsn: '20100001' }), t('BENDAHARA', { npsn: '20100001' }), 'OK'],
    ['Operator -> Kepsek sekolah lain', u('OPERATOR', { npsn: '20100001' }), t('KEPSEK', { npsn: '20100002' }), 'DI_LUAR_CAKUPAN'],
    ['Ditjen -> Admin Direktorat di bawahnya', u('ADMIN_DITJEN', { ditjenKode: 'PAUDDIKDASMEN' }), t('ADMIN_DIREKTORAT', { direktoratKode: 'SMP' }), 'OK'],
    ['Ditjen -> direktorat ditjen lain', u('ADMIN_DITJEN', { ditjenKode: 'PAUDDIKDASMEN' }), t('ADMIN_DIREKTORAT', { direktoratKode: 'VOKASI' }), 'DI_LUAR_CAKUPAN'],
    ['Ditjen -> direktorat tak dikenal', u('ADMIN_DITJEN', { ditjenKode: 'PAUDDIKDASMEN' }), t('ADMIN_DIREKTORAT', { direktoratKode: 'XX' }), 'DI_LUAR_CAKUPAN'],
    ['Admin Direktorat -> Tim Kerja direktoratnya', u('ADMIN_DIREKTORAT', { direktoratKode: 'SMP' }), t('TIM_KERJA', { direktoratKode: 'SMP' }), 'OK'],
    ['Admin Direktorat -> Tim Kerja direktorat lain', u('ADMIN_DIREKTORAT', { direktoratKode: 'SMP' }), t('TIM_KERJA', { direktoratKode: 'SD' }), 'DI_LUAR_CAKUPAN'],
    ['Bendahara tidak mengelola pengguna', u('BENDAHARA', { npsn: '20100001' }), t('KOMITE', { npsn: '20100001' }), 'PERAN_DI_LUAR_KEWENANGAN'],
    ['tidak untuk diri sendiri', u('OPERATOR', { npsn: '20100001' }, 'sama'), { ...t('BENDAHARA', { npsn: '20100001' }), penggunaId: 'sama' }, 'PEMISAHAN_TUGAS'],
  ])('%s', (_n, pemberi, target, harap) => {
    expect(kode(() => periksaPemberianPeran(pemberi, target, ref))).toBe(harap);
  });

  it('pencabutan mengabaikan masa berlaku (Auditor yang tugasnya sudah selesai tetap bisa dicabut)', () => {
    const lewat = t('AUDITOR', { berlakuSampai: '2020-01-01T00:00:00Z' });
    expect(kode(() => periksaPemberianPeran(u('SUPER_ADMIN'), lewat, ref))).toBe('MASA_BERLAKU_TIDAK_VALID');
    expect(kode(() => periksaPemberianPeran(u('SUPER_ADMIN'), lewat, ref, new Date(), { pencabutan: true }))).toBe('OK');
  });

  it('cabang default: peran pengelola tanpa aturan cakupan', () => {
    expect(kode(() => periksaPemberianPeran(u('PEMANTAU'), t('PEMANTAU'), { ...ref }))).toBe('PERAN_DI_LUAR_KEWENANGAN');
  });
});

describe('pembantu', () => {
  it('dalamWilayah & peranBerlaku', () => {
    expect(dalamWilayah('32', '3201')).toBe(true);
    expect(dalamWilayah('3201', '32')).toBe(false);
    expect(peranBerlaku({})).toBe(true);
    expect(peranBerlaku({ dicabut: true })).toBe(false);
    expect(peranBerlaku({ berlakuSampai: '2020-01-01T00:00:00Z' })).toBe(false);
  });
});
