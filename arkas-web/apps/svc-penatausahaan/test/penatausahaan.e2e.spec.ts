/**
 * Uji integrasi irisan vertikal 1 terhadap PostgreSQL 16 sungguhan (basis data uji dibuat ulang tiap run).
 * Membutuhkan: DATABASE_ADMIN_URL (default postgres://postgres:postgres@localhost:5432/postgres) dan hasil build (dist/).
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { exportSPKI, generateKeyPair, SignJWT, KeyLike } from 'jose';
import { Client } from 'pg';
import { MemoryBroker } from '@arkas/common-ms';
import { SANDI } from './bantu';
import { buatAplikasi, Aplikasi } from '../dist/app';
import { hariIniJakarta } from '../dist/infra/waktu';

const ADMIN = process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = 'db_tatausaha_uji';
const dbUrl = (user: string, pass: string) => { const u = new URL(ADMIN); u.username = user; u.password = pass; u.pathname = '/' + DB; return u.toString(); };

const NPSN = '20100001';
const NPSN_LAIN = '20100002';
const HARI_INI = hariIniJakarta();
const TAHUN = Number(HARI_INI.slice(0, 4));
const SD = 'BOSP_REG';
const BENDAHARA = randomUUID();
const KEPSEK = randomUUID();
const KEPSEK_LAIN = randomUUID();
const TOKEN_INTERNAL = 'token-internal-uji-0123456789';

const BARIS = { atk: randomUUID(), servis: randomUUID(), mamin: randomUUID() };

let A: Aplikasi;
let http: ReturnType<typeof request>;
let kunciPrivat: KeyLike;
let broker: MemoryBroker;
let superDb: Client;

async function token(peran: string, sub: string, npsn?: string) {
  return new SignJWT({ peran, ...(npsn ? { npsn } : {}), direktorat: [] })
    .setProtectedHeader({ alg: 'RS256' }).setSubject(sub).setIssuer('arkas-identitas').setAudience('arkas-api')
    .setIssuedAt().setExpirationTime('10m').sign(kunciPrivat);
}
const auth = async (peran: string, sub: string, npsn?: string) => ({ Authorization: `Bearer ${await token(peran, sub, npsn)}` });

function eventKk(versi: number, baris: Array<{ id: string; kodeRekening: string; uraian: string; total: number; asalBarisId?: string }>, id = randomUUID()) {
  return {
    topik: 'arkas.perencanaan.kk-disahkan',
    event: {
      specversion: '1.0', id, source: 'svc-perencanaan', type: 'KertasKerjaDisahkan', time: new Date().toISOString(),
      data: {
        kertasKerjaId: randomUUID(), npsn: NPSN, tahun: TAHUN, sumberDanaKode: SD, versi,
        baris: baris.map((b) => ({ id: b.id, kodeRekening: b.kodeRekening, kegiatan: '05. Pengembangan sarana', uraian: b.uraian,
          volume: 1, satuan: 'paket', hargaSatuan: b.total, total: b.total, asalBarisId: b.asalBarisId ?? null })),
      },
    },
  };
}
const kirimEvent = (body: object) => http.post('/internal/v1/events').set('X-Internal-Token', TOKEN_INTERNAL).send(body);

async function catat(body: Record<string, unknown>, kunci: string = randomUUID()) {
  return http.post(`/api/v1/sekolah/${NPSN}/bku`).set(await auth('BENDAHARA', BENDAHARA, NPSN)).set('Idempotency-Key', kunci)
    .send({ tahun: TAHUN, sumberDanaKode: SD, tanggal: HARI_INI, ...body });
}
async function setujui(id: string, versi = 1) {
  return http.post(`/api/v1/transaksi/${id}/setujui`).set(await auth('KEPSEK', KEPSEK, NPSN)).set('If-Match', `W/"${versi}"`).send({});
}
async function ringkasan() {
  return (await http.get(`/api/v1/sekolah/${NPSN}/bku/ringkasan`).query({ tahun: TAHUN, sumberDanaKode: SD }).set(await auth('BENDAHARA', BENDAHARA, NPSN))).body;
}
async function rkas() {
  const r = await http.get(`/api/v1/sekolah/${NPSN}/bku/rkas`).query({ tahun: TAHUN, sumberDanaKode: SD }).set(await auth('BENDAHARA', BENDAHARA, NPSN));
  return r.body.data as Array<{ barisId: string; sisa: number; realisasi: number; anggaran: number }>;
}

beforeAll(async () => {
  execFileSync('node', [path.resolve(__dirname, '../../../scripts/migrate.mjs'), 'svc-penatausahaan', '--seed', '--fresh'], {
    env: { ...process.env, DATABASE_ADMIN_URL: ADMIN, DB_NAME: DB, API_DB_PASSWORD: SANDI.api, WORKER_DB_PASSWORD: SANDI.worker },
    stdio: 'pipe',
  });
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  kunciPrivat = privateKey;
  broker = new MemoryBroker();
  A = await buatAplikasi({
    port: 0, databaseUrl: dbUrl('api_tatausaha_login', SANDI.api), databaseWorkerUrl: dbUrl('worker_tatausaha_login', SANDI.worker),
    broker: 'memory', brokerBrokers: [], jwtPublicKey: await exportSPKI(publicKey), jwtIssuer: 'arkas-identitas', jwtAudience: 'arkas-api',
    devEvents: true, internalEventsToken: TOKEN_INTERNAL, outboxIntervalMs: 100000, serviceName: 'svc-penatausahaan',
  }, { broker, logger: false });
  await A.app.init();
  http = request(A.app.getHttpServer());
  superDb = new Client({ connectionString: (() => { const u = new URL(ADMIN); u.pathname = '/' + DB; return u.toString(); })() });
  await superDb.connect();
});

afterAll(async () => {
  await superDb?.end();
  await A?.app.close();
});

describe('autentikasi & cakupan', () => {
  it('tanpa token -> 401 problem+json', async () => {
    const r = await http.get(`/api/v1/sekolah/${NPSN}/bku`).query({ tahun: TAHUN, sumberDanaKode: SD });
    expect(r.status).toBe(401);
    expect(r.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(r.body.kode).toBe('TOKEN_TIDAK_ADA');
  });
  it('bendahara mengakses NPSN lain -> 403 DI_LUAR_CAKUPAN', async () => {
    const r = await http.get(`/api/v1/sekolah/${NPSN_LAIN}/bku`).query({ tahun: TAHUN, sumberDanaKode: SD }).set(await auth('BENDAHARA', BENDAHARA, NPSN));
    expect(r.status).toBe(403);
    expect(r.body.kode).toBe('DI_LUAR_CAKUPAN');
  });
  it('validasi body -> 400 VALIDASI dengan daftar galat', async () => {
    const r = await catat({ jenis: 'PENERIMAAN', nilai: -5, uraian: 'x' });
    expect(r.status).toBe(400);
    expect(r.body.kode).toBe('VALIDASI');
    expect(r.body.galat.map((g: { path: string }) => g.path)).toEqual(expect.arrayContaining(['nilai', 'uraian']));
  });
});

describe('alur SK-03: RKAS disahkan -> belanja -> persetujuan -> TransaksiDisetujui', () => {
  it('sebelum RKAS disahkan periode belum dibuka', async () => {
    const r = await catat({ jenis: 'PENERIMAAN', nilai: 1000, uraian: 'Penerimaan BOSP tahap 1' });
    expect(r.status).toBe(422);
    expect(r.body.kode).toBe('PERIODE_BELUM_DIBUKA');
  });

  it('KertasKerjaDisahkan membangun proyeksi RKAS & membuka periode; event ganda diproses sekali', async () => {
    const ev = eventKk(1, [
      { id: BARIS.atk, kodeRekening: '5.1.02.01.01.0024', uraian: 'Kertas HVS & ATK', total: 3_330_000 },
      { id: BARIS.servis, kodeRekening: '5.1.02.02.01.0013', uraian: 'Servis printer', total: 1_000_000 },
      { id: BARIS.mamin, kodeRekening: '5.1.02.01.01.0052', uraian: 'Mamin rapat komite', total: 600_000 },
    ]);
    expect((await kirimEvent(ev)).status).toBe(202);
    expect((await kirimEvent(ev)).status).toBe(202);
    const inbox = await superDb.query('SELECT count(*)::int AS n FROM tatausaha.inbox_processed WHERE event_id = $1', [ev.event.id]);
    expect(inbox.rows[0].n).toBe(1);
    const baris = await rkas();
    expect(baris).toHaveLength(3);
    const s = await ringkasan();
    expect(s.periodeBerjalan).toEqual({ bulan: Number(HARI_INI.slice(5, 7)), status: 'BUKA' });
    expect(s.pagu).toBe(4_930_000);
  });

  let idPenerimaan = '';
  it('penerimaan dana: Idempotency-Key wajib, replay aman, isi berbeda ditolak', async () => {
    const tanpaKunci = await http.post(`/api/v1/sekolah/${NPSN}/bku`).set(await auth('BENDAHARA', BENDAHARA, NPSN))
      .send({ tahun: TAHUN, sumberDanaKode: SD, tanggal: HARI_INI, jenis: 'PENERIMAAN', nilai: 1, uraian: 'abc' });
    expect(tanpaKunci.status).toBe(428);

    const kunci = 'penerimaan-tahap-1';
    const r1 = await catat({ jenis: 'PENERIMAAN', nilai: 50_000_000, uraian: 'Penerimaan BOSP Reguler tahap 1' }, kunci);
    expect(r1.status).toBe(201);
    expect(r1.body).toMatchObject({ status: 'DICATAT', nilaiBruto: 50_000_000, versi: 1 });
    expect(r1.headers.etag).toBe('W/"1"');
    idPenerimaan = r1.body.id;

    const r2 = await catat({ jenis: 'PENERIMAAN', nilai: 50_000_000, uraian: 'Penerimaan BOSP Reguler tahap 1' }, kunci);
    expect(r2.status).toBe(200);
    expect(r2.headers['idempotent-replayed']).toBe('true');
    expect(r2.body.id).toBe(idPenerimaan);

    const r3 = await catat({ jenis: 'PENERIMAAN', nilai: 49_000_000, uraian: 'Penerimaan BOSP Reguler tahap 1' }, kunci);
    expect(r3.status).toBe(422);
    expect(r3.body.kode).toBe('IDEMPOTENCY_KEY_DIPAKAI_ULANG');
  });

  it('persetujuan: peran, If-Match, versi, dan pemisahan tugas', async () => {
    const olehBendahara = await http.post(`/api/v1/transaksi/${idPenerimaan}/setujui`).set(await auth('BENDAHARA', BENDAHARA, NPSN)).set('If-Match', 'W/"1"').send({});
    expect(olehBendahara.status).toBe(403);
    expect(olehBendahara.body.kode).toBe('PERAN_TIDAK_DIIZINKAN');

    const tanpaIfMatch = await http.post(`/api/v1/transaksi/${idPenerimaan}/setujui`).set(await auth('KEPSEK', KEPSEK, NPSN)).send({});
    expect(tanpaIfMatch.status).toBe(428);

    expect((await setujui(idPenerimaan, 7)).status).toBe(412);

    const sod = await http.post(`/api/v1/transaksi/${idPenerimaan}/setujui`).set(await auth('KEPSEK', BENDAHARA, NPSN)).set('If-Match', 'W/"1"').send({});
    expect(sod.status).toBe(422);
    expect(sod.body.kode).toBe('PEMISAHAN_TUGAS');

    const ok = await setujui(idPenerimaan);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'DISETUJUI', diputuskanOleh: KEPSEK, versi: 2 });
    expect(ok.headers.etag).toBe('W/"2"');

    const lagi = await setujui(idPenerimaan, 2);
    expect(lagi.status).toBe(422);
    expect(lagi.body.kode).toBe('STATUS_TIDAK_SESUAI');
  });

  it('belanja tunai tanpa saldo tunai -> SALDO_TIDAK_CUKUP dengan saran tarik tunai', async () => {
    const r = await catat({
      jenis: 'BELANJA', caraBayar: 'TUNAI', noBukti: 'NOTA-001', namaToko: 'Toko Sinar', penjualPunyaNpwp: true, uraian: 'Belanja ATK',
      items: [{ barisId: BARIS.atk, uraian: 'Kertas HVS A4', volume: 10, satuan: 'rim', hargaSatuan: 55_500 }],
    });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'SALDO_TIDAK_CUKUP', rincian: { buku: 'TUNAI', saran: 'TARIK_TUNAI' } });
  });

  let idBelanja = '';
  it('tarik tunai lalu belanja ATK tunai dengan PPN otomatis', async () => {
    const tarik = await catat({ jenis: 'TARIK_TUNAI', nilai: 5_000_000, uraian: 'Tarik tunai untuk belanja operasional' });
    expect(tarik.status).toBe(201);
    expect((await setujui(tarik.body.id)).status).toBe(200);

    const sim = await http.post(`/api/v1/sekolah/${NPSN}/bku/simulasi-pajak`).set(await auth('BENDAHARA', BENDAHARA, NPSN))
      .send({ tahun: TAHUN, sumberDanaKode: SD, penjualPunyaNpwp: true, items: [{ barisId: BARIS.atk, volume: 20, hargaSatuan: 55_500 }] });
    expect(sim.status).toBe(200);
    expect(sim.body).toEqual({ nilaiBruto: 1_110_000, totalPajak: 110_000, nilaiNetto: 1_000_000, pajak: [{ jenis: 'PPN', tarif: 0.11, dpp: 1_000_000, nilai: 110_000 }] });

    const r = await catat({
      jenis: 'BELANJA', caraBayar: 'TUNAI', noBukti: 'NOTA-001', namaToko: 'Toko Sinar', penjualPunyaNpwp: true, uraian: 'Belanja ATK',
      items: [{ barisId: BARIS.atk, uraian: 'Kertas HVS A4', volume: 20, satuan: 'rim', hargaSatuan: 55_500 }],
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ jenis: 'BELANJA', nilaiBruto: 1_110_000, totalPajak: 110_000, nilaiNetto: 1_000_000, status: 'DICATAT' });
    expect(r.body.items[0]).toMatchObject({ kodeRekening: '5.1.02.01.01.0024', jumlah: 1_110_000 });
    expect(r.body.pajak).toEqual([{ jenis: 'PPN', tarif: 0.11, dpp: 1_000_000, nilai: 110_000, status: 'DIPUNGUT' }]);
    idBelanja = r.body.id;

    // Belanja DICATAT sudah mengurangi sisa anggaran (reservasi) tetapi belum masuk realisasi resmi.
    expect((await rkas()).find((b) => b.barisId === BARIS.atk)).toMatchObject({ realisasi: 1_110_000, sisa: 2_220_000 });
    expect((await ringkasan()).menungguPersetujuan).toBe(1);
  });

  it('persetujuan belanja menulis outbox; relay menerbitkan TransaksiDisetujui (CloudEvents)', async () => {
    const ok = await setujui(idBelanja);
    expect(ok.status).toBe(200);
    const sebelum = broker.terbit.length;
    const n = await A.relay.tick();
    expect(n).toBeGreaterThanOrEqual(1);
    const ev = broker.terbit.slice(sebelum).find((e) => e.event.subject === idBelanja)!;
    expect(ev.topik).toBe('arkas.tatausaha.transaksi-disetujui');
    expect(ev.event).toMatchObject({ specversion: '1.0', type: 'TransaksiDisetujui', source: 'svc-penatausahaan' });
    expect(ev.event.data).toMatchObject({
      transaksiId: idBelanja, npsn: NPSN, jenis: 'BELANJA', nilaiBruto: 1_110_000, disetujuiOleh: KEPSEK,
      items: [{ barisId: BARIS.atk, kodeRekening: '5.1.02.01.01.0024', jumlah: 1_110_000 }], pajak: [{ jenis: 'PPN', nilai: 110_000 }],
    });
    const status = await superDb.query(`SELECT status FROM tatausaha.outbox WHERE agregat_id = $1`, [idBelanja]);
    expect(status.rows[0].status).toBe('TERKIRIM');
    expect(await A.relay.tick()).toBe(0);
  });

  it('BKU: saldo berjalan per buku dan ringkasan', async () => {
    const s = await ringkasan();
    // bank 50jt - 5jt; tunai 5jt - 1,11jt + PPN dipungut 110rb (belum disetor)
    expect(s.saldo).toEqual({ tunai: 4_000_000, bank: 45_000_000, total: 49_000_000 });
    expect(s.realisasi).toBe(1_110_000);
    expect(s.menungguPersetujuan).toBe(0);

    const bku = await http.get(`/api/v1/sekolah/${NPSN}/bku`).query({ tahun: TAHUN, sumberDanaKode: SD }).set(await auth('KEPSEK', KEPSEK, NPSN));
    expect(bku.status).toBe(200);
    const baris = bku.body.data as Array<{ uraian: string; penerimaan: number; pengeluaran: number; saldo: number; buku: string }>;
    expect(baris.map((b) => [b.buku, b.penerimaan, b.pengeluaran, b.saldo])).toEqual([
      ['BANK', 50_000_000, 0, 50_000_000],
      ['BANK', 0, 5_000_000, 45_000_000],
      ['TUNAI', 5_000_000, 0, 50_000_000],
      ['TUNAI', 0, 1_110_000, 48_890_000],
      ['TUNAI', 110_000, 0, 49_000_000],
    ]);
    const bkpTunai = await http.get(`/api/v1/sekolah/${NPSN}/bku`).query({ tahun: TAHUN, sumberDanaKode: SD, buku: 'TUNAI' }).set(await auth('KEPSEK', KEPSEK, NPSN));
    expect(bkpTunai.body.data.at(-1).saldo).toBe(4_000_000);
  });

  it('melebihi sisa anggaran ditolak di aplikasi', async () => {
    const r = await catat({
      jenis: 'BELANJA', caraBayar: 'NON_TUNAI', noBukti: 'INV-77', namaToko: 'CV Maju', penjualPunyaNpwp: true, uraian: 'ATK tambahan',
      items: [{ barisId: BARIS.atk, uraian: 'Toner', volume: 1, hargaSatuan: 2_220_001 }],
    });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'MELEBIHI_ANGGARAN', rincian: { sisa: 2_220_000 } });
  });

  it('trigger cek_item_rkas tetap menolak meski aplikasi dilewati (lapis terakhir)', async () => {
    const c = new Client({ connectionString: dbUrl('api_tatausaha_login', SANDI.api) });
    await c.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.peran','BENDAHARA',true), set_config('app.npsn',$1,true), set_config('app.pengguna_id',$2,true)`, [NPSN, BENDAHARA]);
      const p = await c.query(`SELECT id FROM tatausaha.periode WHERE npsn = $1 LIMIT 1`, [NPSN]);
      const t = await c.query(
        `INSERT INTO tatausaha.transaksi (tahun,npsn,sumber_dana_kode,periode_id,jenis,tanggal,cara_bayar,no_bukti,uraian,nama_toko,penjual_punya_npwp,nilai_bruto,dibuat_oleh,idempotency_key,idempotency_hash)
         VALUES ($1,$2,$3,$4,'BELANJA',$5,'NON_TUNAI','X1','langsung SQL','Toko',true,9000000,$6,'sql-langsung',repeat('0',64)) RETURNING id`,
        [TAHUN, NPSN, SD, p.rows[0].id, HARI_INI, BENDAHARA],
      );
      await expect(c.query(
        `INSERT INTO tatausaha.item_transaksi (tahun,transaksi_id,npsn,sumber_dana_kode,baris_kertas_kerja_id,akar_baris_id,kode_rekening,uraian,volume,harga_satuan,jumlah)
         VALUES ($1,$2,$3,$4,$5,$5,'palsu','x',1,9000000,9000000)`,
        [TAHUN, t.rows[0].id, NPSN, SD, BARIS.atk],
      )).rejects.toMatchObject({ message: 'MELEBIHI_ANGGARAN' });
    } finally {
      await c.query('ROLLBACK');
      await c.end();
    }
  });

  it('RLS: Kepala Sekolah sekolah lain tidak melihat transaksi (404), RLS menolak insert lintas sekolah', async () => {
    const r = await http.get(`/api/v1/transaksi/${idBelanja}`).set(await auth('KEPSEK', KEPSEK_LAIN, NPSN_LAIN));
    expect(r.status).toBe(404);
    const c = new Client({ connectionString: dbUrl('api_tatausaha_login', SANDI.api) });
    await c.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.peran','BENDAHARA',true), set_config('app.npsn',$1,true), set_config('app.pengguna_id',$2,true)`, [NPSN_LAIN, BENDAHARA]);
      const lihat = await c.query(`SELECT count(*)::int AS n FROM tatausaha.transaksi`);
      expect(lihat.rows[0].n).toBe(0);
      const p = await superDb.query(`SELECT id FROM tatausaha.periode WHERE npsn = $1 LIMIT 1`, [NPSN]);
      await expect(c.query(
        `INSERT INTO tatausaha.transaksi (tahun,npsn,sumber_dana_kode,periode_id,jenis,tanggal,uraian,nilai_bruto,dibuat_oleh,idempotency_key,idempotency_hash)
         VALUES ($1,$2,$3,$4,'PENERIMAAN',$5,'lintas sekolah',1,$6,'lintas',repeat('0',64))`,
        [TAHUN, NPSN, SD, p.rows[0].id, HARI_INI, BENDAHARA],
      )).rejects.toMatchObject({ code: '42501' });
    } finally {
      await c.query('ROLLBACK');
      await c.end();
    }
  });

  it('penolakan membebaskan reservasi anggaran', async () => {
    const r = await catat({
      jenis: 'BELANJA', caraBayar: 'NON_TUNAI', noBukti: 'INV-88', namaToko: 'CV Servis Jaya', penjualPunyaNpwp: false, uraian: 'Servis printer',
      items: [{ barisId: BARIS.servis, uraian: 'Servis printer lab', volume: 1, hargaSatuan: 500_000 }],
    });
    expect(r.status).toBe(201);
    expect(r.body.pajak).toEqual([{ jenis: 'PPH23', tarif: 0.04, dpp: 500_000, nilai: 20_000, status: 'DIPUNGUT' }]);
    expect((await rkas()).find((b) => b.barisId === BARIS.servis)!.sisa).toBe(500_000);
    const t = await http.post(`/api/v1/transaksi/${r.body.id}/tolak`).set(await auth('KEPSEK', KEPSEK, NPSN)).set('If-Match', 'W/"1"').send({ alasan: 'Nota belum lengkap' });
    expect(t.status).toBe(200);
    expect(t.body).toMatchObject({ status: 'DITOLAK', alasanTolak: 'Nota belum lengkap' });
    expect((await rkas()).find((b) => b.barisId === BARIS.servis)!.sisa).toBe(1_000_000);
    // Bendahara melihat penolakan beserta alasannya (tidak masuk BKU)
    const d = await http.get(`/api/v1/sekolah/${NPSN}/bku/ditolak`).query({ tahun: TAHUN, sumberDanaKode: SD }).set(await auth('BENDAHARA', BENDAHARA, NPSN));
    expect(d.status).toBe(200);
    expect(d.body.data).toContainEqual(expect.objectContaining({ id: r.body.id, jenis: 'BELANJA', noBukti: 'INV-88', nilaiBruto: 500_000, alasanTolak: 'Nota belum lengkap' }));
    const bku = await http.get(`/api/v1/sekolah/${NPSN}/bku`).query({ tahun: TAHUN, sumberDanaKode: SD }).set(await auth('BENDAHARA', BENDAHARA, NPSN));
    expect(bku.body.data.some((x: { transaksiId: string }) => x.transaksiId === r.body.id)).toBe(false);
  });

  it('konkurensi: dua belanja bersamaan pada baris yang sama tidak bisa melampaui anggaran', async () => {
    const kirim = () => catat({
      jenis: 'BELANJA', caraBayar: 'NON_TUNAI', noBukti: `INV-${randomUUID().slice(0, 6)}`, namaToko: 'Rumah Makan Sari', penjualPunyaNpwp: true,
      uraian: 'Mamin rapat', items: [{ barisId: BARIS.mamin, uraian: 'Nasi kotak', volume: 10, hargaSatuan: 40_000 }],
    });
    const hasil = await Promise.all([kirim(), kirim()]);
    expect(hasil.map((h) => h.status).sort()).toEqual([201, 422]);
    expect(hasil.find((h) => h.status === 422)!.body.kode).toBe('MELEBIHI_ANGGARAN');
    expect(hasil.find((h) => h.status === 201)!.body.pajak).toEqual([{ jenis: 'SSPD', tarif: 0.1, dpp: 400_000, nilai: 40_000, status: 'DIPUNGUT' }]);
  });

  it('pergeseran RKAS (versi 2): realisasi terbawa lewat asal_baris_id; event versi lama diabaikan', async () => {
    const atkV2 = randomUUID();
    const ev2 = eventKk(2, [
      { id: atkV2, kodeRekening: '5.1.02.01.01.0024', uraian: 'Kertas HVS & ATK', total: 2_000_000, asalBarisId: BARIS.atk },
      { id: BARIS.servis, kodeRekening: '5.1.02.02.01.0013', uraian: 'Servis printer', total: 1_000_000 },
      { id: BARIS.mamin, kodeRekening: '5.1.02.01.01.0052', uraian: 'Mamin rapat komite', total: 600_000 },
    ]);
    expect((await kirimEvent(ev2)).status).toBe(202);
    const baris = await rkas();
    expect(baris.find((b) => b.barisId === BARIS.atk)).toBeUndefined();
    expect(baris.find((b) => b.barisId === atkV2)).toMatchObject({ anggaran: 2_000_000, realisasi: 1_110_000, sisa: 890_000 });

    expect((await kirimEvent(eventKk(1, [{ id: randomUUID(), kodeRekening: 'X', uraian: 'basi', total: 1 }]))).status).toBe(202);
    expect(await rkas()).toHaveLength(3);

    const lama = await catat({
      jenis: 'BELANJA', caraBayar: 'NON_TUNAI', noBukti: 'INV-99', namaToko: 'Toko', penjualPunyaNpwp: true, uraian: 'ATK',
      items: [{ barisId: BARIS.atk, uraian: 'Pulpen', volume: 1, hargaSatuan: 10_000 }],
    });
    expect(lama.status).toBe(422);
    expect(lama.body.kode).toBe('BARIS_RKAS_TIDAK_SAH');
  });

  it('data keuangan tidak dapat dihapus, bahkan oleh superuser', async () => {
    await expect(superDb.query(`DELETE FROM tatausaha.transaksi WHERE id = $1`, [idBelanja])).rejects.toMatchObject({ message: 'HAPUS_DILARANG' });
  });

  it('event KertasKerjaDisahkan cacat ditolak (masuk dead letter, tidak mengubah proyeksi)', async () => {
    const r = await kirimEvent({ topik: 'arkas.perencanaan.kk-disahkan', event: { ...eventKk(3, []).event } });
    expect(r.status).toBe(422);
    expect(r.body.kode).toBe('EVENT_GAGAL_DIPROSES');
    expect(await rkas()).toHaveLength(3);
  });
});
