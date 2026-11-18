/** Irisan 3 — UC-15 penutupan buku kas bulanan, rekonsiliasi & pemeriksaan kas, terhadap PostgreSQL sungguhan. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { Harness, HARI_INI, siapkan } from './bantu';

let h: Harness;
const B = { atk: randomUUID() };
const BULAN = Number(HARI_INI.slice(5, 7));
let periodeId = '';
let idMenunggu = '';
type Detail = {
  id: string; status: string; versi: number; bulan: number; alasanKembali: string | null;
  kesiapan: { siap: boolean; syarat: Array<{ kode: string; ok: boolean }>; peringatan: Array<{ kode: string }> };
  ringkasan: { tunai: { saldoAkhir: number; penerimaan: number; pengeluaran: number }; bank: { saldoAkhir: number; penerimaan: number }; pajak: { dipungut: number; disetor: number; saldoAkhir: number }; jumlahTransaksi: number };
  rekonsiliasi: { selisihBank: number; selisihKas: number; penjelasanBank: string | null; saldoBukuBank: number } | null;
};
const detail = async (peran: 'BENDAHARA' | 'KEPSEK' = 'BENDAHARA') =>
  h.http.get(`/api/v1/periode/${periodeId}`).set(await h.auth(peran, peran === 'BENDAHARA' ? h.bendahara : h.kepsek, h.npsn));
const ajukan = async (body: Record<string, unknown>, versi: number) =>
  h.http.post(`/api/v1/periode/${periodeId}/ajukan-tutup`).set(await h.auth('BENDAHARA', h.bendahara, h.npsn)).set('If-Match', `W/"${versi}"`).send(body);
const kepsek = async (aksi: 'setujui' | 'kembalikan', versi: number, body: object = {}, sub?: string) =>
  h.http.post(`/api/v1/periode/${periodeId}/${aksi}`).set(await h.auth('KEPSEK', sub ?? h.kepsek, h.npsn)).set('If-Match', `W/"${versi}"`).send(body);

beforeAll(async () => {
  h = await siapkan('db_tatausaha_uji_tutup');
  expect((await h.kirimEvent(h.eventKk(1, [{ id: B.atk, kodeRekening: '5.1.02.01.01.0024', uraian: 'ATK', total: 5_000_000 }]))).status).toBe(202);
  const masuk = await h.catat({ jenis: 'PENERIMAAN', nilai: 10_000_000, uraian: 'BOSP tahap 1' });
  await h.setujui(masuk.body.id);
  const tarik = await h.catat({ jenis: 'TARIK_TUNAI', nilai: 1_000_000, uraian: 'Tarik tunai' });
  await h.setujui(tarik.body.id);
  const bl = await h.catat({ jenis: 'BELANJA', caraBayar: 'TUNAI', noBukti: 'N-1', namaToko: 'Toko', penjualPunyaNpwp: true, uraian: 'ATK',
    items: [{ barisId: B.atk, uraian: 'Kertas', volume: 1, hargaSatuan: 555_000 }] });
  await h.setujui(bl.body.id);
  const menunggu = await h.catat({ jenis: 'PENERIMAAN', nilai: 1_000, uraian: 'Jasa giro belum disetujui' });
  idMenunggu = menunggu.body.id;
  const daftar = (await h.get('/periode')).body.data as Array<{ id: string; bulan: number; status: string }>;
  expect(daftar).toEqual([expect.objectContaining({ bulan: BULAN, status: 'BUKA' })]);
  periodeId = daftar[0].id;
});
afterAll(async () => { await h?.tutup(); });

describe('UC-15 penutupan buku kas', () => {
  it('detail periode BUKA: ringkasan dihitung langsung & daftar periksa menolak bila ada transaksi menunggu', async () => {
    const r = await detail();
    expect(r.status).toBe(200);
    expect(r.headers.etag).toBe('W/"1"');
    const d = r.body as Detail;
    // bank: 10jt - 1jt ; tunai: 1jt - 555rb + PPN 55rb
    expect(d.ringkasan.bank.saldoAkhir).toBe(9_000_000);
    expect(d.ringkasan.tunai.saldoAkhir).toBe(500_000);
    expect(d.ringkasan.pajak).toMatchObject({ dipungut: 55_000, disetor: 0, saldoAkhir: 55_000 });
    expect(d.kesiapan.siap).toBe(false);
    expect(d.kesiapan.syarat.find((s) => !s.ok)!.kode).toBe('MASIH_ADA_TRANSAKSI_MENUNGGU');
    expect(d.kesiapan.peringatan.map((p) => p.kode)).toEqual(['PAJAK_BELUM_DISETOR']);
    const tolak = await ajukan({ saldoRekeningKoran: 9_000_000, kasFisik: 500_000 }, 1);
    expect(tolak.status).toBe(422);
    expect(tolak.body.kode).toBe('MASIH_ADA_TRANSAKSI_MENUNGGU');
  });

  it('selisih bank/kas wajib dijelaskan; If-Match wajib; hanya Bendahara yang mengajukan', async () => {
    await h.tolak(idMenunggu, 'Bukan pendapatan BOSP');
    const v = (await detail()).body.versi as number;
    expect((await ajukan({ saldoRekeningKoran: 8_997_500, kasFisik: 500_000 }, v)).body.kode).toBe('SELISIH_BANK_WAJIB_DIJELASKAN');
    expect((await ajukan({ saldoRekeningKoran: 9_000_000, kasFisik: 499_000, penjelasanKas: 'kurang' }, v)).body.kode).toBe('SELISIH_KAS_WAJIB_DIJELASKAN');
    const tanpa = await h.http.post(`/api/v1/periode/${periodeId}/ajukan-tutup`).set(await h.auth('BENDAHARA', h.bendahara, h.npsn)).send({ saldoRekeningKoran: 1, kasFisik: 1 });
    expect(tanpa.status).toBe(428);
    const olehKepsek = await h.http.post(`/api/v1/periode/${periodeId}/ajukan-tutup`).set(await h.auth('KEPSEK', h.kepsek, h.npsn)).set('If-Match', `W/"${v}"`).send({ saldoRekeningKoran: 1, kasFisik: 1 });
    expect(olehKepsek.status).toBe(403);
    expect((await ajukan({ saldoRekeningKoran: 9_000_000, kasFisik: 500_000 }, v + 5)).status).toBe(412);
  });

  it('ajukan: rekonsiliasi tersimpan, periode DIAJUKAN, transaksi baru di bulan itu ditolak', async () => {
    const r = await ajukan({ saldoRekeningKoran: 8_997_500, penjelasanBank: 'Biaya administrasi bank Rp 2.500 belum dicatat', kasFisik: 500_000 }, 1);
    expect(r.status).toBe(200);
    const d = r.body as Detail;
    expect(d.status).toBe('DIAJUKAN');
    expect(d.rekonsiliasi).toMatchObject({ saldoBukuBank: 9_000_000, selisihBank: -2_500, selisihKas: 0 });
    expect(r.headers.etag).toBe('W/"2"');
    const baru = await h.catat({ jenis: 'PENERIMAAN', nilai: 1_000, uraian: 'Penerimaan susulan' });
    expect(baru.status).toBe(422);
    expect(baru.body).toMatchObject({ kode: 'PERIODE_TERTUTUP', detail: 'Periode sedang diajukan untuk ditutup' });
    expect((await h.get('/bku/ringkasan')).body.periodeBerjalan).toEqual({ bulan: BULAN, status: 'DIAJUKAN' });
  });

  it('Kepala Sekolah mengembalikan: periode BUKA lagi dengan alasan, transaksi boleh dicatat', async () => {
    const r = await kepsek('kembalikan', 2, { alasan: 'Lampirkan rekening koran asli' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'BUKA', alasanKembali: 'Lampirkan rekening koran asli', diajukanOleh: null, versi: 3 });
    const susulan = await h.catat({ jenis: 'PENERIMAAN', nilai: 2_500, uraian: 'Koreksi: jasa giro bank' });
    expect(susulan.status).toBe(201);
    await h.setujui(susulan.body.id);
    expect(((await detail()).body as Detail).ringkasan.bank.saldoAkhir).toBe(9_002_500);
  });

  it('pemisahan tugas: pengaju tidak boleh menutup', async () => {
    expect((await ajukan({ saldoRekeningKoran: 9_002_500, kasFisik: 500_000 }, 3)).status).toBe(200);
    const sod = await kepsek('setujui', 4, {}, h.bendahara);
    expect(sod.status).toBe(422);
    expect(sod.body.kode).toBe('PEMISAHAN_TUGAS');
  });

  it('setujui: DITUTUP, bulan berikut dibuka, PeriodeDitutup terbit dengan ringkasan & rekonsiliasi', async () => {
    const r = await kepsek('setujui', 4);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'DITUTUP', ditutupOleh: h.kepsek, versi: 5 });
    const daftar = (await h.get('/periode')).body.data as Array<{ bulan: number; status: string }>;
    expect(daftar.map((p) => [p.bulan, p.status])).toEqual(BULAN < 12 ? [[BULAN, 'DITUTUP'], [BULAN + 1, 'BUKA']] : [[BULAN, 'DITUTUP']]);

    const sebelum = h.broker.terbit.length;
    await h.A.relay.tick();
    const ev = h.broker.terbit.slice(sebelum).find((e) => e.event.type === 'PeriodeDitutup')!;
    expect(ev.topik).toBe('arkas.tatausaha.periode-ditutup');
    expect(ev.event.data).toMatchObject({
      periodeId, bulan: BULAN, diajukanOleh: h.bendahara, ditutupOleh: h.kepsek, periodeBerikutBulan: BULAN < 12 ? BULAN + 1 : null,
      ringkasan: { bank: { saldoAwal: 0, penerimaan: 10_002_500, pengeluaran: 1_000_000, saldoAkhir: 9_002_500 }, tunai: { saldoAkhir: 500_000 }, pajak: { saldoAkhir: 55_000 }, jumlahTransaksi: 4 },
      rekonsiliasi: { saldoRekeningKoran: 9_002_500, selisihBank: 0, kasFisik: 500_000, selisihKas: 0, penjelasanBank: null },
    });
  });

  it('periode DITUTUP terkunci: transaksi, setoran, rekonsiliasi, dan perubahan status ditolak', async () => {
    const t = await h.catat({ jenis: 'PENERIMAAN', nilai: 1_000, uraian: 'Terlambat dicatat' });
    expect(t.body).toMatchObject({ kode: 'PERIODE_TERTUTUP', detail: 'Periode buku kas sudah ditutup' });
    expect((await kepsek('kembalikan', 5, { alasan: 'buka lagi dong' })).body.kode).toBe('STATUS_PERIODE_TIDAK_SESUAI');
    await expect(h.superDb.query(`UPDATE tatausaha.rekonsiliasi SET kas_fisik = 1 WHERE periode_id = $1`, [periodeId])).rejects.toMatchObject({ message: 'REKONSILIASI_TERKUNCI' });
    await expect(h.superDb.query(`UPDATE tatausaha.periode SET status = 'BUKA' WHERE id = $1`, [periodeId])).rejects.toMatchObject({ message: 'TRANSISI_PERIODE_TIDAK_SAH' });
    await expect(h.superDb.query(`DELETE FROM tatausaha.periode WHERE id = $1`, [periodeId])).rejects.toMatchObject({ message: 'HAPUS_DILARANG' });
  });

  it('trigger jaga_periode menolak pengajuan langsung lewat SQL bila ada transaksi menunggu', async () => {
    // siapkan periode lain (bulan sebelumnya tahun yang sama, bila ada) agar urutan diuji pada periode berikut
    if (BULAN === 12) return;
    const berikut = (await h.superDb.query(`SELECT id FROM tatausaha.periode WHERE bulan = $1`, [BULAN + 1])).rows[0].id as string;
    const c = new Client({ connectionString: h.dbUrl('api_tatausaha_login', 'api_uji') });
    await c.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.peran','BENDAHARA',true), set_config('app.npsn',$1,true), set_config('app.pengguna_id',$2,true)`, [h.npsn, h.bendahara]);
      await expect(c.query(`UPDATE tatausaha.periode SET status = 'DIAJUKAN', diajukan_oleh = $2, diajukan_at = now() WHERE id = $1`, [berikut, h.bendahara]))
        .rejects.toMatchObject({ message: 'REKONSILIASI_BELUM_ADA' });
    } finally {
      await c.query('ROLLBACK');
      await c.end();
    }
  });
});
