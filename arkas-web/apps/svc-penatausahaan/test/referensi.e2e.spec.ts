/** Konsumen ReferensiDiubah di svc-penatausahaan: tarif pajak daerah per wilayah sekolah (UC-32), penjaga versi, idempotensi. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Harness, SD, siapkan, TAHUN } from './bantu';

let h: Harness;
const MAMIN = randomUUID();
const ref = (entitas: string, kunci: string, versi: number, aktif: boolean, data: object, id = randomUUID()) => ({
  topik: 'arkas.ref.referensi-diubah',
  event: { specversion: '1.0', id, source: 'svc-referensi', type: 'ReferensiDiubah', time: new Date().toISOString(), data: { entitas, kunci, versi, aktif, data } },
});
const tarifSspd = (wilayahKode: string, tarif: number, versi: number, aktif = true) =>
  ref('TARIF_PAJAK', `5.1.02.01.01.0052:SSPD:${wilayahKode}`, versi, aktif, { kodeRekening: '5.1.02.01.01.0052', jenis: 'SSPD', wilayahKode, tarif, tarifTanpaNpwp: null });
async function simulasi() {
  const r = await h.http.post(`/api/v1/sekolah/${h.npsn}/bku/simulasi-pajak`).set(await h.auth('BENDAHARA', h.bendahara, h.npsn))
    .send({ tahun: TAHUN, sumberDanaKode: SD, penjualPunyaNpwp: true, items: [{ barisId: MAMIN, volume: 10, hargaSatuan: 30_000 }] });
  return r.body.pajak as Array<{ jenis: string; tarif: number; nilai: number }>;
}

beforeAll(async () => {
  h = await siapkan('db_tatausaha_uji_ref');
  await h.kirimEvent(h.eventKk(1, [{ id: MAMIN, kodeRekening: '5.1.02.01.01.0052', uraian: 'Mamin rapat', total: 1_000_000 }]));
});
afterAll(async () => { await h?.tutup(); });

describe('ReferensiDiubah -> tarif efektif', () => {
  it('tanpa penimpaan: tarif nasional (seed) 10%', async () => {
    expect(await simulasi()).toEqual([{ jenis: 'SSPD', tarif: 0.1, dpp: 300_000, nilai: 30_000 }].map(({ dpp: _d, ...x }) => expect.objectContaining(x)));
  });

  it('Dinas 3201 menetapkan 5%: sekolah di 3201 memakai 5%; event ganda diproses sekali', async () => {
    await h.kirimEvent(ref('SEKOLAH', h.npsn, 100, true, { npsn: h.npsn, nama: 'SMP Negeri Contoh 1', jenjangKode: 'SMP', wilayahKode: '3201', statusSekolah: 'NEGERI' }));
    const ev = tarifSspd('3201', 0.05, 101);
    expect((await h.kirimEvent(ev)).status).toBe(202);
    expect((await h.kirimEvent(ev)).status).toBe(202);
    expect(await simulasi()).toEqual([expect.objectContaining({ jenis: 'SSPD', tarif: 0.05, nilai: 15_000 })]);
    expect((await h.superDb.query(`SELECT count(*)::int n FROM tatausaha.inbox_processed WHERE event_id = $1`, [ev.event.id])).rows[0].n).toBe(1);
    // daftar RKAS menampilkan jenis pajak efektif
    const rkas = (await h.get('/bku/rkas')).body.data as Array<{ barisId: string; pajak: string[] }>;
    expect(rkas.find((b) => b.barisId === MAMIN)!.pajak).toEqual(['SSPD']);
  });

  it('event berversi lebih lama diabaikan (urutan acak aman)', async () => {
    await h.kirimEvent(tarifSspd('3201', 0.2, 50));
    expect((await simulasi())[0].tarif).toBe(0.05);
  });

  it('penimpaan nonaktif membebaskan SSPD di wilayah itu; sekolah pindah wilayah ikut aturan barunya', async () => {
    await h.kirimEvent(tarifSspd('3201', 0.05, 102, false));
    expect(await simulasi()).toEqual([]);
    await h.kirimEvent(ref('SEKOLAH', h.npsn, 103, true, { npsn: h.npsn, nama: 'SMP Negeri Contoh 1', jenjangKode: 'SMP', wilayahKode: '3202', statusSekolah: 'NEGERI' }));
    expect((await simulasi())[0].tarif).toBe(0.1);
  });

  it('entitas yang bukan urusan layanan ini diabaikan tanpa galat', async () => {
    expect((await h.kirimEvent(ref('KOMPONEN', 'BOSP_REG:12', 200, true, { kode: '12' }))).status).toBe(202);
  });
});
