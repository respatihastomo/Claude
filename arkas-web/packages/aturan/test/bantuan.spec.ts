import { describe, expect, it } from 'vitest';
import { AturanError, cekKelengkapan, dalamMasaPengajuan, putuskanDokumen, transisiPengajuanSekolah, transisiSumberDanaBantuan } from '../src';

const kode = (f: () => unknown) => { try { f(); } catch (e) { return (e as AturanError).kode; } return null; };

describe('siklus Bantuan Pemerintah (Tabel 8.2)', () => {
  it('sumber dana: ajukan, kembalikan, ajukan ulang, sahkan; sesudah sah final', () => {
    expect(transisiSumberDanaBantuan('DRAF', 'AJUKAN')).toBe('DIAJUKAN');
    expect(transisiSumberDanaBantuan('DIAJUKAN', 'KEMBALIKAN')).toBe('DIKEMBALIKAN');
    expect(transisiSumberDanaBantuan('DIKEMBALIKAN', 'AJUKAN')).toBe('DIAJUKAN');
    expect(transisiSumberDanaBantuan('DIAJUKAN', 'SAHKAN')).toBe('DISAHKAN');
    expect(kode(() => transisiSumberDanaBantuan('DRAF', 'SAHKAN'))).toBe('STATUS_TIDAK_SESUAI');
    expect(kode(() => transisiSumberDanaBantuan('DISAHKAN', 'KEMBALIKAN'))).toBe('STATUS_TIDAK_SESUAI');
  });
  it('kelengkapan pengajuan & dokumen', () => {
    expect(cekKelengkapan({ juknisDisetujui: false, panduanDisahkan: false, jumlahKomponen: 0, jumlahPenerima: 0 })).toHaveLength(4);
    expect(cekKelengkapan({ juknisDisetujui: true, panduanDisahkan: true, jumlahKomponen: 1, jumlahPenerima: 3 })).toEqual([]);
    expect(putuskanDokumen('JUKNIS', 'DIUNGGAH', true, false)).toBe('DISETUJUI');
    expect(putuskanDokumen('PANDUAN', 'DIUNGGAH', false, false)).toBe('DITOLAK');
    expect(kode(() => putuskanDokumen('PANDUAN', 'DIUNGGAH', true, false))).toBe('JUKNIS_BELUM_DISETUJUI');
    expect(putuskanDokumen('PANDUAN', 'DIUNGGAH', true, true)).toBe('DISAHKAN');
    expect(kode(() => putuskanDokumen('JUKNIS', 'DISETUJUI', false, true))).toBe('STATUS_TIDAK_SESUAI');
  });
  it('pengajuan sekolah & masa pengajuan', () => {
    expect(transisiPengajuanSekolah('DIAJUKAN', 'KEMBALIKAN')).toBe('DIKEMBALIKAN');
    expect(transisiPengajuanSekolah('DIKEMBALIKAN', 'AJUKAN')).toBe('DIAJUKAN');
    expect(kode(() => transisiPengajuanSekolah('DITOLAK', 'AJUKAN'))).toBe('STATUS_TIDAK_SESUAI');
    expect(dalamMasaPengajuan('2026-05-31', '2026-05-01', '2026-05-31')).toBe(true);
    expect(dalamMasaPengajuan('2026-06-01', '2026-05-01', '2026-05-31')).toBe(false);
    expect(dalamMasaPengajuan('2026-05-10', null, null)).toBe(false);
  });
});
