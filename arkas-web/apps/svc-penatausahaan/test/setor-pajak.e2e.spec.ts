/** Irisan 2 — UC-14 setor pajak & BKP Pajak, terhadap PostgreSQL sungguhan. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { Harness, HARI_INI, SD, siapkan, TAHUN } from './bantu';

let h: Harness;
const B = { atk: randomUUID(), servis: randomUUID() };
const id: Record<string, string> = {};
type Pajak = { id: string; jenis: string; nilai: number; status: string; statusBelanja: string; statusSetor: string | null; ntpn: string | null; transaksiId: string };
const pajakDari = async (status?: string) => (await h.get('/pajak', status ? { status } : {})).body.data as Pajak[];
async function setor(body: Record<string, unknown>, kunci: string = randomUUID()) {
  return h.http.post(`/api/v1/sekolah/${h.npsn}/pajak/setor`).set(await h.auth('BENDAHARA', h.bendahara, h.npsn)).set('Idempotency-Key', kunci)
    .send({ tahun: TAHUN, sumberDanaKode: SD, tanggalSetor: HARI_INI, caraBayar: 'NON_TUNAI', ...body });
}
async function belanja(baris: string, hargaSatuan: number, caraBayar: 'TUNAI' | 'NON_TUNAI', npwp: boolean, setujui = true) {
  const r = await h.catat({ jenis: 'BELANJA', caraBayar, noBukti: `N-${randomUUID().slice(0, 5)}`, namaToko: 'Toko Uji', penjualPunyaNpwp: npwp,
    uraian: 'Belanja uji', items: [{ barisId: baris, uraian: 'item', volume: 1, hargaSatuan }] });
  expect(r.status).toBe(201);
  if (setujui) expect((await h.setujui(r.body.id)).status).toBe(200);
  return r.body.id as string;
}

beforeAll(async () => {
  h = await siapkan('db_tatausaha_uji_pajak');
  expect((await h.kirimEvent(h.eventKk(1, [
    { id: B.atk, kodeRekening: '5.1.02.01.01.0024', uraian: 'ATK', total: 5_000_000 },
    { id: B.servis, kodeRekening: '5.1.02.02.01.0013', uraian: 'Servis', total: 2_000_000 },
  ]))).status).toBe(202);
  const masuk = await h.catat({ jenis: 'PENERIMAAN', nilai: 20_000_000, uraian: 'BOSP tahap 1' });
  await h.setujui(masuk.body.id);
  const tarik = await h.catat({ jenis: 'TARIK_TUNAI', nilai: 2_000_000, uraian: 'Tarik tunai' });
  await h.setujui(tarik.body.id);
  id.atkTunai = await belanja(B.atk, 1_110_000, 'TUNAI', true);         // PPN 110.000 (buku tunai)
  id.servis = await belanja(B.servis, 500_000, 'NON_TUNAI', false);     // PPh 23 4% = 20.000
  id.atkBank = await belanja(B.atk, 555_000, 'NON_TUNAI', true);        // PPN 55.000
  id.menunggu = await belanja(B.atk, 222_000, 'NON_TUNAI', true, false); // PPN 22.000, belanja belum disetujui
});
afterAll(async () => { await h?.tutup(); });

describe('UC-14 setor pajak', () => {
  it('daftar pajak terutang & ringkasan pajakTerutang (hanya belanja disetujui)', async () => {
    const p = await pajakDari('DIPUNGUT');
    expect(p.map((x) => [x.jenis, x.nilai, x.statusBelanja])).toEqual([
      ['PPN', 110_000, 'DISETUJUI'], ['PPH23', 20_000, 'DISETUJUI'], ['PPN', 55_000, 'DISETUJUI'], ['PPN', 22_000, 'DICATAT'],
    ]);
    expect((await h.get('/bku/ringkasan')).body.pajakTerutang).toBe(185_000);
  });

  it('validasi: jenis campur, belanja belum sah, NTPN salah format, tanpa Idempotency-Key', async () => {
    const p = await pajakDari('DIPUNGUT');
    const ppn = p.filter((x) => x.jenis === 'PPN');
    const pph = p.find((x) => x.jenis === 'PPH23')!;
    expect((await setor({ pajakIds: [ppn[0].id, pph.id], ntpn: 'A1B2C3D4E5F6A7B8' })).body.kode).toBe('JENIS_PAJAK_CAMPUR');
    expect((await setor({ pajakIds: [ppn[2].id], ntpn: 'A1B2C3D4E5F6A7B8' })).body.kode).toBe('PAJAK_BELUM_SAH');
    const salah = await setor({ pajakIds: [ppn[0].id], ntpn: '123' });
    expect(salah.status).toBe(400);
    expect(salah.body.galat[0].path).toBe('ntpn');
    const tanpaKunci = await h.http.post(`/api/v1/sekolah/${h.npsn}/pajak/setor`).set(await h.auth('BENDAHARA', h.bendahara, h.npsn))
      .send({ tahun: TAHUN, sumberDanaKode: SD, tanggalSetor: HARI_INI, caraBayar: 'NON_TUNAI', pajakIds: [ppn[0].id], ntpn: 'A1B2C3D4E5F6A7B8' });
    expect(tanpaKunci.status).toBe(428);
    const olehKepsek = await h.http.post(`/api/v1/sekolah/${h.npsn}/pajak/setor`).set(await h.auth('KEPSEK', h.kepsek, h.npsn)).set('Idempotency-Key', randomUUID())
      .send({ tahun: TAHUN, sumberDanaKode: SD, tanggalSetor: HARI_INI, caraBayar: 'NON_TUNAI', pajakIds: [ppn[0].id], ntpn: 'A1B2C3D4E5F6A7B8' });
    expect(olehKepsek.status).toBe(403);
  });

  it('setor dua PPN: NTPN dinormalisasi, pajak tertaut, saldo tersedia berkurang, replay aman', async () => {
    const ppn = (await pajakDari('DIPUNGUT')).filter((x) => x.jenis === 'PPN' && x.statusBelanja === 'DISETUJUI');
    const sebelum = (await h.get('/bku/ringkasan')).body;
    const kunci = 'setor-ppn-1';
    const r = await setor({ pajakIds: ppn.map((x) => x.id), ntpn: 'a1b2 c3d4-e5f6 a7b8' }, kunci);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ jenis: 'SETOR_PAJAK', nilaiBruto: 165_000, ntpn: 'A1B2C3D4E5F6A7B8', noBukti: 'A1B2C3D4E5F6A7B8', status: 'DICATAT', caraBayar: 'NON_TUNAI' });
    expect(r.body.pajak.map((p: { status: string; nilai: number }) => [p.status, p.nilai]).sort((a: [string, number], b: [string, number]) => a[1] - b[1]))
      .toEqual([['DISETOR', 55_000], ['DISETOR', 110_000]]);
    id.setor1 = r.body.id;

    const replay = await setor({ pajakIds: ppn.map((x) => x.id), ntpn: 'a1b2 c3d4-e5f6 a7b8' }, kunci);
    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(id.setor1);

    const sesudah = (await h.get('/bku/ringkasan')).body;
    expect(sesudah.saldoTersedia.bank).toBe(sebelum.saldoTersedia.bank - 165_000);
    expect(sesudah.saldo.bank).toBe(sebelum.saldo.bank);
    expect(sesudah.pajakTerutang).toBe(20_000);
    const tertaut = (await pajakDari('DISETOR'));
    expect(tertaut.every((x) => x.statusSetor === 'DICATAT' && x.ntpn === 'A1B2C3D4E5F6A7B8')).toBe(true);
  });

  it('pajak yang sudah disetor tidak bisa disetor lagi; NTPN yang sedang dipakai ditolak', async () => {
    const disetor = await pajakDari('DISETOR');
    expect((await setor({ pajakIds: [disetor[0].id], ntpn: 'FFFFFFFFFFFFFFFF' })).body.kode).toBe('PAJAK_SUDAH_DISETOR');
    const pph = (await pajakDari('DIPUNGUT')).find((x) => x.jenis === 'PPH23')!;
    const dup = await setor({ pajakIds: [pph.id], ntpn: 'A1B2C3D4E5F6A7B8' });
    expect(dup.status).toBe(422);
    expect(dup.body.kode).toBe('NTPN_SUDAH_DIPAKAI');
  });

  it('setoran ditolak: pajak kembali terutang dan NTPN dapat dipakai lagi', async () => {
    const t = await h.tolak(id.setor1, 'Bukti setor belum dilampirkan');
    expect(t.status).toBe(200);
    expect(t.body.pajak).toEqual([]);
    expect((await h.get('/bku/ringkasan')).body.pajakTerutang).toBe(185_000);
    const ppn = (await pajakDari('DIPUNGUT')).filter((x) => x.jenis === 'PPN' && x.statusBelanja === 'DISETUJUI');
    expect(ppn).toHaveLength(2);
    const ulang = await setor({ pajakIds: ppn.map((x) => x.id), ntpn: 'A1B2C3D4E5F6A7B8' });
    expect(ulang.status).toBe(201);
    id.setor2 = ulang.body.id;
  });

  it('setoran disetujui: TransaksiDisetujui membawa NTPN & rincian pajak; BKU dan BKP Pajak benar', async () => {
    const ok = await h.setujui(id.setor2);
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('DISETUJUI');
    const sebelum = h.broker.terbit.length;
    await h.A.relay.tick();
    const ev = h.broker.terbit.slice(sebelum).find((e) => e.event.subject === id.setor2)!;
    expect(ev.event.data).toMatchObject({ jenis: 'SETOR_PAJAK', ntpn: 'A1B2C3D4E5F6A7B8', nilaiBruto: 165_000, items: [] });
    expect((ev.event.data as { pajak: Array<{ nilai: number }> }).pajak.map((p) => p.nilai).sort((a, b) => a - b)).toEqual([55_000, 110_000]);

    const r = (await h.get('/bku/ringkasan')).body;
    // bank: 20jt - 2jt - 500rb + 20rb(pungut) - 555rb + 55rb - 165rb(setor) ; tunai: 2jt - 1,11jt + 110rb
    expect(r.saldo).toEqual({ tunai: 1_000_000, bank: 16_855_000, total: 17_855_000 });
    expect(r.pajakTerutang).toBe(20_000);

    const bku = (await h.get('/bku', { buku: 'BANK' })).body.data as Array<{ uraian: string; pengeluaran: number; status: string }>;
    expect(bku.at(-1)).toMatchObject({ uraian: 'Setor PPN (2 bukti pungut)', pengeluaran: 165_000, status: 'DISETUJUI' });

    const bkp = (await h.get('/bkp/pajak')).body.data as Array<{ jenis: string; penerimaan: number; pengeluaran: number; saldo: number | null; status: string; ntpn: string | null }>;
    expect(bkp.map((x) => [x.jenis, x.penerimaan, x.pengeluaran, x.saldo])).toEqual([
      ['PPN', 110_000, 0, 110_000],
      ['PPH23', 20_000, 0, 130_000],
      ['PPN', 55_000, 0, 185_000],
      ['PPN', 22_000, 0, null],
      ['PPN', 0, 165_000, 20_000],
    ]);
    expect(bkp.at(-1)!.ntpn).toBe('A1B2C3D4E5F6A7B8');
  });

  it('dua setoran bersamaan atas pajak yang sama: hanya satu yang berhasil', async () => {
    const pph = (await pajakDari('DIPUNGUT')).find((x) => x.jenis === 'PPH23')!;
    const hasil = await Promise.all([
      setor({ pajakIds: [pph.id], ntpn: '1111222233334444' }),
      setor({ pajakIds: [pph.id], ntpn: '5555666677778888' }),
    ]);
    expect(hasil.map((x) => x.status).sort()).toEqual([201, 422]);
    expect(hasil.find((x) => x.status === 422)!.body.kode).toBe('PAJAK_SUDAH_DISETOR');
  });

  it('trigger cek_setor_pajak menolak perubahan langsung lewat SQL', async () => {
    const c = new Client({ connectionString: h.dbUrl('api_tatausaha_login', 'api_uji') });
    await c.connect();
    try {
      const pajak = await h.superDb.query(`SELECT id FROM tatausaha.pajak WHERE status = 'DIPUNGUT' AND transaksi_id = $1`, [id.menunggu]);
      for (const [sql, kode] of [
        [`UPDATE tatausaha.pajak SET ntpn = NULL WHERE id = $1`, 'PAJAK_TIDAK_DAPAT_DIUBAH'],
        [`UPDATE tatausaha.pajak SET status = 'DISETOR', ntpn = 'ZZZZZZZZZZZZZZZZ', tanggal_setor = current_date, setor_transaksi_id = gen_random_uuid() WHERE id = $1`, 'PAJAK_BELUM_SAH'],
      ] as const) {
        await c.query('BEGIN');
        await c.query(`SELECT set_config('app.peran','BENDAHARA',true), set_config('app.npsn',$1,true), set_config('app.pengguna_id',$2,true)`, [h.npsn, h.bendahara]);
        await expect(c.query(sql, [pajak.rows[0].id])).rejects.toMatchObject({ message: kode });
        await c.query('ROLLBACK');
      }
    } finally {
      await c.end();
    }
  });
});
