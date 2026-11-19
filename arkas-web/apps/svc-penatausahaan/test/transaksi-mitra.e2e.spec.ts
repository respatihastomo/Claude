/** UC-12 / SK-04: transaksi Mitra SIPLah -> antrean pemetaan -> BELANJA di BKU; kompensasi pembatalan. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Harness, HARI_INI, SD, siapkan, TAHUN } from './bantu';

let h: Harness;
const B = { atk: randomUUID(), servis: randomUUID() };
const evMitra = (type: 'TransaksiMitraDiterima' | 'TransaksiMitraDibatalkan', data: object) => ({
  topik: type === 'TransaksiMitraDiterima' ? 'arkas.integrasi.transaksi-mitra-diterima' : 'arkas.integrasi.transaksi-mitra-dibatalkan',
  event: { specversion: '1.0', id: randomUUID(), source: 'svc-integrasi', type, time: new Date().toISOString(), data },
});
function diterima(transactionId: string, barisAtk: string | null) {
  const id = randomUUID();
  return { id, ev: evMitra('TransaksiMitraDiterima', {
    transaksiMitraId: id, mitraKode: 'MITRA_DEV', transactionId, npsn: h.npsn, tahun: TAHUN, sumberDanaKode: SD, tanggal: HARI_INI,
    namaToko: 'CV Sinar Jaya', penjualPunyaNpwp: true, total: 1_110_000 + 300_000, diterimaAt: new Date().toISOString(), items: [
      { itemId: '1', barisId: barisAtk, kodeRekening: '5.1.02.01.01.0024', uraian: 'Kertas HVS', volume: 10, satuan: 'rim', hargaSatuan: 111_000, jumlah: 1_110_000 },
      { itemId: '2', barisId: null, kodeRekening: '5.1.02.02.01.0013', uraian: 'Servis printer', volume: 1, satuan: null, hargaSatuan: 300_000, jumlah: 300_000 },
    ] }) };
}
const catat = async (id: string, body: object) => h.http.post(`/api/v1/transaksi-mitra/${id}/catat`).set(await h.auth('BENDAHARA', h.bendahara, h.npsn)).send(body);

beforeAll(async () => {
  h = await siapkan('db_tatausaha_uji_mitra');
  expect((await h.kirimEvent(h.eventKk(1, [
    { id: B.atk, kodeRekening: '5.1.02.01.01.0024', uraian: 'ATK', total: 5_000_000 },
    { id: B.servis, kodeRekening: '5.1.02.02.01.0013', uraian: 'Servis', total: 2_000_000 },
  ]))).status).toBe(202);
  const masuk = await h.catat({ jenis: 'PENERIMAAN', nilai: 20_000_000, uraian: 'BOSP tahap 1' });
  await h.setujui(masuk.body.id);
});
afterAll(async () => { await h?.tutup(); });

describe('UC-12 memetakan transaksi Mitra SIPLah', () => {
  it('event masuk antrean; item tanpa baris wajib dipetakan; dicatat sebagai BELANJA NON_TUNAI dengan pajak ARKAS', async () => {
    const t = diterima('SPL-A1', B.atk);
    expect((await h.kirimEvent(t.ev)).status).toBe(202);
    expect((await h.kirimEvent(t.ev)).status).toBe(202); // duplikat aman
    const daftar = (await h.get('/transaksi-mitra')).body.data;
    expect(daftar).toHaveLength(1);
    expect(daftar[0]).toMatchObject({ id: t.id, status: 'MENUNGGU', statusMitra: 'DITERIMA', total: 1_410_000, transaksiId: null });

    expect((await catat(t.id, {})).body).toMatchObject({ kode: 'ITEM_BELUM_DIPETAKAN', rincian: { itemId: ['2'] } });
    const r = await catat(t.id, { pemetaan: [{ itemId: '2', barisId: B.servis }] });
    expect(r.status).toBe(201);
    expect(r.body.masuk).toMatchObject({ status: 'DICATAT', statusTransaksi: 'DICATAT' });
    expect(r.body.transaksi).toMatchObject({
      jenis: 'BELANJA', status: 'DICATAT', caraBayar: 'NON_TUNAI', noBukti: 'SPL-A1', namaToko: 'CV Sinar Jaya', nilaiBruto: 1_410_000,
      totalPajak: 110_000 + 6_000, // PPN 11% atas ATK; PPh 23 2% (ber-NPWP) atas servis
    });
    expect((await catat(t.id, { pemetaan: [{ itemId: '2', barisId: B.servis }] })).status).toBe(409);
    expect((await h.http.post(`/api/v1/transaksi-mitra/${t.id}/catat`).set(await h.auth('KEPSEK', h.kepsek, h.npsn)).send({})).status).toBe(403);

    // Kepala Sekolah menyetujui -> TransaksiDisetujui membawa asal Mitra (hindari hitung ganda di hilir)
    expect((await h.setujui(r.body.transaksi.id)).status).toBe(200);
    const sebelum = h.broker.terbit.length;
    while (await h.A.relay.tick()) { /* kuras */ }
    const ev = h.broker.terbit.slice(sebelum).find((e) => e.event.type === 'TransaksiDisetujui' && e.event.subject === r.body.transaksi.id)!;
    expect(ev.event.data).toMatchObject({ sumberMitra: { mitraKode: 'MITRA_DEV', transactionId: 'SPL-A1', transaksiMitraId: t.id } });
  });

  it('pembatalan sebelum dicatat -> DIBATALKAN dan tidak bisa dicatat; sesudah dicatat -> ditandai untuk ditindaklanjuti', async () => {
    const a = diterima('SPL-A2', B.atk);
    await h.kirimEvent(a.ev);
    await h.kirimEvent(evMitra('TransaksiMitraDibatalkan', { transaksiMitraId: a.id, status: 'DIBATALKAN', alasan: 'Stok habis' }));
    const b = diterima('SPL-A3', B.atk);
    await h.kirimEvent(b.ev);
    const r = await catat(b.id, { pemetaan: [{ itemId: '2', barisId: B.servis }] });
    expect(r.status).toBe(201);
    await h.kirimEvent(evMitra('TransaksiMitraDibatalkan', { transaksiMitraId: b.id, status: 'RETUR', alasan: 'Barang rusak' }));
    const d = Object.fromEntries((await h.get('/transaksi-mitra')).body.data.map((x: { transactionId: string }) => [x.transactionId, x]));
    expect(d['SPL-A2']).toMatchObject({ status: 'DIBATALKAN', statusMitra: 'DIBATALKAN', alasanBatal: 'Stok habis' });
    expect(d['SPL-A3']).toMatchObject({ status: 'DICATAT', statusMitra: 'RETUR', statusTransaksi: 'DICATAT' });
    expect((await catat(a.id, {})).body.kode).toBe('TRANSAKSI_MITRA_DIBATALKAN');
    // pembatalan untuk transaksi yang belum diterima -> 422 agar pengirim mencoba ulang
    expect((await h.kirimEvent(evMitra('TransaksiMitraDibatalkan', { transaksiMitraId: randomUUID(), status: 'RETUR', alasan: 'x' }))).status).toBe(422);
  });

  it('sekolah lain tidak melihat antrean', async () => {
    const r = await h.http.get(`/api/v1/sekolah/${h.npsn}/transaksi-mitra`).query({ tahun: TAHUN, sumberDanaKode: SD }).set(await h.auth('BENDAHARA', randomUUID(), '20100002'));
    expect(r.status).toBe(403);
  });
});
