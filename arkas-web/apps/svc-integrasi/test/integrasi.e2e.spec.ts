/** svc-integrasi: pembukaan sumber dana di Mitra (keluar & konfirmasi), API Mitra (OAuth2 + IP + HMAC), transaksi idempoten & pembatalan, admin Balai. */
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { exportSPKI, generateKeyPair, KeyLike, SignJWT } from 'jose';
import { Client } from 'pg';
import { CloudEvent, MemoryBroker } from '@arkas/common-ms';
import { TOPIK } from '@arkas/kontrak';
import { Aplikasi, buatAplikasi } from '../dist/app';

const SANDI = { api: process.env.API_DB_PASSWORD ?? 'api_dev', worker: process.env.WORKER_DB_PASSWORD ?? 'worker_dev' };
const ADMIN = process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = 'db_integrasi_uji';
const HMAC = 'rahasia-hmac-mitra-dev-0123456789';
const TAHUN = 2026;
let A: Aplikasi; let api: ReturnType<typeof request>; let kunci: KeyLike; let db: Client; let broker: MemoryBroker;
let mitraServer: http.Server; let mitraStatus = 202;
const diterimaMitra: Array<{ headers: http.IncomingHttpHeaders; body: string }> = [];
const url = (u?: string, p?: string) => { const x = new URL(ADMIN); if (u) { x.username = u; x.password = p!; } x.pathname = '/' + DB; return x.toString(); };
async function auth(peran: string, klaim: Record<string, unknown> = {}) {
  return { Authorization: `Bearer ${await new SignJWT({ peran, direktorat: [], ...klaim }).setProtectedHeader({ alg: 'RS256' }).setSubject(randomUUID())
    .setIssuer('arkas-identitas').setAudience('arkas-api').setIssuedAt().setExpirationTime('10m').sign(kunci)}` };
}
const ev = (type: string, data: unknown): CloudEvent => ({ specversion: '1.0', id: randomUUID(), source: 'svc-uji', type, time: new Date().toISOString(), datacontenttype: 'application/json', data });
const tanda = (ts: string, body: string, rahasia = HMAC) => createHmac('sha256', rahasia).update(`${ts}.${body}`).digest('hex');
let token = '';
/** Panggilan Mitra bertanda tangan. */
function mitra(metode: 'GET' | 'POST', p: string, body?: unknown, ubah: { ts?: string; sig?: string; token?: string } = {}) {
  const b = body === undefined ? '' : JSON.stringify(body);
  const ts = ubah.ts ?? String(Math.floor(Date.now() / 1000));
  const r = (metode === 'GET' ? api.get(p) : api.post(p)).set('authorization', `Bearer ${ubah.token ?? token}`).set('x-timestamp', ts).set('x-signature', ubah.sig ?? tanda(ts, b));
  return body === undefined ? r : r.set('content-type', 'application/json').send(b);
}
async function kurasOutbox() { const s = broker.terbit.length; while (await A.relay.tick()) { /* kuras */ } return broker.terbit.slice(s).map((x) => x.event); }
const pembukaan = async (sd = 'BOSP_REG', m = 'MITRA_DEV') => (await db.query('SELECT * FROM integrasi.pembukaan_sumber_dana WHERE sumber_dana_kode = $1 AND mitra_kode = $2', [sd, m])).rows[0];

const B1 = randomUUID(); const B2 = randomUUID(); const B3 = randomUUID();
const RKAS = { kertasKerjaId: randomUUID(), npsn: '20100001', tahun: TAHUN, sumberDanaKode: 'BOSP_REG', versi: 1, baris: [
  { id: B1, kodeRekening: '5.1.02.01.01.0024', kegiatan: 'Pembelajaran', uraian: 'Alat tulis kantor', volume: 10, satuan: 'paket', hargaSatuan: 100_000, total: 1_000_000 },
  { id: B2, kodeRekening: '5.1.02.01.01.0024', kegiatan: 'Asesmen', uraian: 'Kertas ujian', volume: 5, satuan: 'rim', hargaSatuan: 60_000, total: 300_000 },
  { id: B3, kodeRekening: '5.1.02.02.01.0013', kegiatan: 'Pemeliharaan', uraian: 'Servis AC', volume: 2, satuan: 'unit', hargaSatuan: 250_000, total: 500_000 },
] };
const transaksi = (id: string, items: unknown[]) => ({ transactionId: id, npsn: '20100001', tahun: TAHUN, sumberDanaKode: 'BOSP_REG', tanggal: `${TAHUN}-03-10`, namaToko: 'CV Sinar', penjualPunyaNpwp: true, items });

beforeAll(async () => {
  execFileSync('node', [path.resolve(__dirname, '../../../scripts/migrate.mjs'), 'svc-integrasi', '--seed', '--fresh'], {
    env: { ...process.env, DATABASE_ADMIN_URL: ADMIN, DB_NAME: DB, API_DB_PASSWORD: SANDI.api, WORKER_DB_PASSWORD: SANDI.worker }, stdio: 'pipe' });
  mitraServer = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => { body += c; });
    req.on('end', () => { diterimaMitra.push({ headers: req.headers, body }); res.writeHead(mitraStatus, { 'content-type': 'application/json' }).end(JSON.stringify({ idDiMitra: `MTR-${diterimaMitra.length}` })); });
  });
  await new Promise<void>((r) => mitraServer.listen(0, '127.0.0.1', r));
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  kunci = privateKey;
  broker = new MemoryBroker();
  A = await buatAplikasi({
    port: 0, databaseUrl: url('api_integrasi_login', SANDI.api), databaseWorkerUrl: url('worker_integrasi_login', SANDI.worker), broker: 'memory', brokerBrokers: [],
    jwtPublicKey: await exportSPKI(publicKey), jwtIssuer: 'arkas-identitas', jwtAudience: 'arkas-api', devEvents: false,
    mitraTokenSecret: 'kunci-token-mitra-uji-0123456789abcdef', trustProxy: 0, outboxIntervalMs: 100000, pengirimIntervalMs: 100000, pengirimMaksPercobaan: 2, serviceName: 'svc-integrasi',
  }, { broker, logger: process.env.UJI_LOG ? undefined : false });
  await A.app.init();
  api = request(A.app.getHttpServer());
  db = new Client({ connectionString: url() }); await db.connect();
  await db.query(`UPDATE integrasi.mitra_siplah SET base_url = $1`, [`http://127.0.0.1:${(mitraServer.address() as AddressInfo).port}`]);
});
afterAll(async () => { await db?.end(); await A?.app.close(); mitraServer?.close(); });

describe('SK-08 pembukaan sumber dana di Mitra', () => {
  it('ReferensiDiubah sumber dana aktif -> pembukaan MENUNGGU -> dikirim bertanda tangan -> TERKIRIM', async () => {
    await broker.publish(TOPIK.REFERENSI_DIUBAH, ev('ReferensiDiubah', { entitas: 'SUMBER_DANA', kunci: 'BOSP_REG', versi: 10, aktif: true, data: { kode: 'BOSP_REG', nama: 'BOSP Reguler', kategori: 'BOSP' } }));
    await broker.publish(TOPIK.REFERENSI_DIUBAH, ev('ReferensiDiubah', { entitas: 'SEKOLAH', kunci: '20100001', versi: 11, aktif: true, data: { npsn: '20100001', nama: 'SMP Negeri Contoh 1', jenjangKode: 'SMP', wilayahKode: '3201' } }));
    expect(await pembukaan()).toMatchObject({ status: 'MENUNGGU', versi: 1, target: 'BUKA' });
    expect(await A.pengirim.tick()).toBe(1);
    const k = diterimaMitra.at(-1)!;
    expect(JSON.parse(k.body)).toEqual({ kode: 'BOSP_REG', nama: 'BOSP Reguler', kategori: 'BOSP', versi: 1, status: 'DIBUKA' });
    expect(k.headers['idempotency-key']).toBe('BOSP_REG:1:SUMBER_DANA_DIBUKA');
    expect(k.headers['x-signature']).toBe(tanda(String(k.headers['x-timestamp']), k.body));
    expect(await pembukaan()).toMatchObject({ status: 'TERKIRIM', id_di_mitra: 'MTR-1' });
    // terbit ulang referensi (versi sama) tidak membuka ulang
    await broker.publish(TOPIK.REFERENSI_DIUBAH, ev('ReferensiDiubah', { entitas: 'SUMBER_DANA', kunci: 'BOSP_REG', versi: 10, aktif: true, data: { kode: 'BOSP_REG', nama: 'BOSP Reguler', kategori: 'BOSP' } }));
    expect((await pembukaan()).status).toBe('TERKIRIM');
  });

  it('OAuth2 client credentials: rahasia salah 401, benar -> token 10 menit', async () => {
    expect((await api.post('/mitra/v1/oauth/token').send({ grant_type: 'client_credentials', client_id: 'mitra-dev', client_secret: 'salah-salah' })).status).toBe(401);
    const r = await api.post('/mitra/v1/oauth/token').type('form').send({ grant_type: 'client_credentials', client_id: 'mitra-dev', client_secret: 'rahasia-klien-mitra-dev' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ token_type: 'Bearer', expires_in: 600 });
    token = r.body.access_token;
  });

  it('sebelum dikonfirmasi DIBUKA Mitra tidak boleh melayani belanja; konfirmasi versi usang 409; konfirmasi sah -> DIBUKA + event', async () => {
    await broker.publish(TOPIK.KERTAS_KERJA_DISAHKAN, ev('KertasKerjaDisahkan', RKAS));
    expect((await mitra('GET', `/mitra/v1/sekolah/20100001/anggaran?tahun=${TAHUN}&sumberDanaKode=BOSP_REG`)).body.kode).toBe('SUMBER_DANA_BELUM_DIBUKA');
    expect((await mitra('POST', '/mitra/v1/sumber-dana/BOSP_REG/konfirmasi', { status: 'DIBUKA', versi: 2 })).status).toBe(409);
    const k = await mitra('POST', '/mitra/v1/sumber-dana/BOSP_REG/konfirmasi', { status: 'DIBUKA', versi: 1 });
    expect(k.body).toEqual({ status: 'DIBUKA', versiDikonfirmasi: 1 });
    expect((await kurasOutbox()).filter((e) => e.type === 'PembukaanDikonfirmasi').map((e) => e.data)).toMatchObject([{ sumberDanaKode: 'BOSP_REG', mitraKode: 'MITRA_DEV', versi: 1, status: 'DIBUKA' }]);
    const s = await mitra('GET', `/mitra/v1/sumber-dana/BOSP_REG/sekolah?tahun=${TAHUN}`);
    expect(s.body).toEqual({ data: [{ npsn: '20100001', jenjang: 'SMP', nilai: 1_800_000, status: 'BERHAK' }], pagination: { kursorBerikut: null, batas: 500 } });
  });
});

describe('keamanan /mitra/v1 (12.4)', () => {
  it('tanpa token, tanda tangan salah, pesan kedaluwarsa, IP tak terdaftar, Mitra nonaktif -> ditolak', async () => {
    const p = `/mitra/v1/sumber-dana`;
    expect((await api.get(p)).body.kode).toBe('TOKEN_MITRA_WAJIB');
    expect((await mitra('GET', p, undefined, { token: 'x.y.z' })).body.kode).toBe('TOKEN_MITRA_TIDAK_VALID');
    expect((await mitra('GET', p, undefined, { sig: 'a'.repeat(64) })).body.kode).toBe('TANDA_TANGAN_TIDAK_VALID');
    const lama = String(Math.floor(Date.now() / 1000) - 301);
    expect((await mitra('GET', p, undefined, { ts: lama, sig: tanda(lama, '') })).body.kode).toBe('PESAN_KEDALUWARSA');
    // body diubah setelah ditandatangani
    const ts = String(Math.floor(Date.now() / 1000));
    const asli = JSON.stringify({ status: 'DIBUKA', versi: 1 });
    const r = await api.post('/mitra/v1/sumber-dana/BOSP_REG/konfirmasi').set('authorization', `Bearer ${token}`).set('x-timestamp', ts).set('x-signature', tanda(ts, asli))
      .set('content-type', 'application/json').send(JSON.stringify({ status: 'GAGAL', versi: 1 }));
    expect(r.body.kode).toBe('TANDA_TANGAN_TIDAK_VALID');
    await db.query(`UPDATE integrasi.mitra_siplah SET ip_diizinkan = '{10.9.9.9}'`);
    expect((await mitra('GET', p)).body.kode).toBe('IP_TIDAK_DIIZINKAN');
    await db.query(`UPDATE integrasi.mitra_siplah SET ip_diizinkan = '{127.0.0.1,::1}', status = 'NONAKTIF'`);
    expect((await mitra('GET', p)).body.kode).toBe('MITRA_NONAKTIF');
    await db.query(`UPDATE integrasi.mitra_siplah SET status = 'AKTIF'`);
    expect((await mitra('GET', p)).body.data).toMatchObject([{ kode: 'BOSP_REG', status: 'DIBUKA', target: 'BUKA', versi: 1 }]);
  });
});

describe('UC-35 anggaran, validasi keranjang, transaksi', () => {
  it('anggaran & validasi keranjang terhadap sisa RKAS', async () => {
    const a = await mitra('GET', `/mitra/v1/sekolah/20100001/anggaran?tahun=${TAHUN}&sumberDanaKode=BOSP_REG`);
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ namaSekolah: 'SMP Negeri Contoh 1', versiRkas: 1, totalAnggaran: 1_800_000, totalSisa: 1_800_000 });
    const v = await mitra('POST', '/mitra/v1/validasi-keranjang', { npsn: '20100001', tahun: TAHUN, sumberDanaKode: 'BOSP_REG', items: [
      { itemId: 'a', barisId: B1, kodeRekening: '5.1.02.01.01.0024', jumlah: 900_000 },
      { itemId: 'b', kodeRekening: '5.1.02.01.01.0024', jumlah: 450_000 }, // gabungan sisa B1 (100rb) + B2 (300rb) = 400rb
      { itemId: 'c', kodeRekening: '5.1.02.03.02.0001', jumlah: 5_000_000 },
    ] });
    expect(v.body).toMatchObject({ valid: false, items: [
      { itemId: 'a', ok: true, sisa: 100_000 }, { itemId: 'b', ok: false, kode: 'MELEBIHI_SISA_ANGGARAN', sisa: 400_000 }, { itemId: 'c', ok: false, kode: 'DI_LUAR_RENCANA' },
    ] });
  });

  it('transaksi idempoten per transactionId; event TransaksiMitraDiterima; sisa berkurang', async () => {
    const t = transaksi('SPL-0001', [
      { itemId: '1', barisId: B1, kodeRekening: '5.1.02.01.01.0024', uraian: 'Pulpen 1 lusin', volume: 4, satuan: 'pak', hargaSatuan: 50_000 },
      { itemId: '2', kodeRekening: '5.1.02.02.01.0013', uraian: 'Servis AC ruang guru', volume: 1, hargaSatuan: 275_000 },
    ]);
    const r = await mitra('POST', '/mitra/v1/transaksi', t);
    expect(r.status).toBe(202);
    expect(r.body).toMatchObject({ transactionId: 'SPL-0001', status: 'DITERIMA' });
    const ulang = await mitra('POST', '/mitra/v1/transaksi', t);
    expect(ulang.status).toBe(200);
    expect(ulang.headers['idempotent-replayed']).toBe('true');
    expect(ulang.body.id).toBe(r.body.id);
    expect((await mitra('POST', '/mitra/v1/transaksi', { ...t, namaToko: 'Toko Lain' })).body.kode).toBe('TRANSACTION_ID_DIPAKAI_ULANG');
    expect((await mitra('POST', '/mitra/v1/transaksi', transaksi('SPL-0002', [{ itemId: '1', barisId: randomUUID(), kodeRekening: '5.1.02.01.01.0024', uraian: 'x', volume: 1, hargaSatuan: 1 }]))).body.kode).toBe('BARIS_RKAS_TIDAK_SAH');

    const e = (await kurasOutbox()).filter((x) => x.type === 'TransaksiMitraDiterima');
    expect(e).toHaveLength(1);
    expect(e[0].data).toMatchObject({ transaksiMitraId: r.body.id, mitraKode: 'MITRA_DEV', total: 475_000, items: [{ itemId: '1', barisId: B1, jumlah: 200_000 }, { itemId: '2', barisId: null, jumlah: 275_000 }] });
    const a = await mitra('GET', `/mitra/v1/sekolah/20100001/anggaran?tahun=${TAHUN}&sumberDanaKode=BOSP_REG`);
    expect(a.body.baris.find((b: { barisId: string }) => b.barisId === B1)).toMatchObject({ terpakai: 200_000, sisa: 800_000 });
  });

  it('pergeseran RKAS: belanja di baris lama tetap mengurangi sisa baris penerusnya (akar baris)', async () => {
    const B1b = randomUUID();
    await broker.publish(TOPIK.KERTAS_KERJA_DISAHKAN, ev('KertasKerjaDisahkan', { ...RKAS, kertasKerjaId: randomUUID(), versi: 2,
      baris: [{ ...RKAS.baris[0], id: B1b, asalBarisId: B1, volume: 12, total: 1_200_000 }, RKAS.baris[1], RKAS.baris[2]] }));
    const a = await mitra('GET', `/mitra/v1/sekolah/20100001/anggaran?tahun=${TAHUN}&sumberDanaKode=BOSP_REG`);
    expect(a.body.versiRkas).toBe(2);
    expect(a.body.baris.find((b: { barisId: string }) => b.barisId === B1b)).toMatchObject({ total: 1_200_000, terpakai: 200_000, sisa: 1_000_000 });
  });

  it('pembatalan oleh Mitra (kompensasi): event TransaksiMitraDibatalkan, sisa kembali, status final', async () => {
    const r = await mitra('POST', '/mitra/v1/transaksi/SPL-0001/status', { status: 'DIBATALKAN', alasan: 'Barang tidak tersedia' });
    expect(r.body).toMatchObject({ status: 'DIBATALKAN' });
    expect((await mitra('POST', '/mitra/v1/transaksi/SPL-0001/status', { status: 'DIBATALKAN', alasan: 'Barang tidak tersedia' })).status).toBe(200);
    expect((await mitra('POST', '/mitra/v1/transaksi/SPL-0001/status', { status: 'RETUR', alasan: 'ubah pikiran' })).status).toBe(409);
    expect((await kurasOutbox()).filter((x) => x.type === 'TransaksiMitraDibatalkan').map((x) => x.data)).toMatchObject([{ transactionId: 'SPL-0001', status: 'DIBATALKAN' }]);
    const a = await mitra('GET', `/mitra/v1/sekolah/20100001/anggaran?tahun=${TAHUN}&sumberDanaKode=BOSP_REG`);
    expect(a.body.totalSisa).toBe(2_000_000);
    await expect(db.query(`DELETE FROM integrasi.transaksi_mitra`)).rejects.toThrow(/HAPUS_DILARANG/);
  });
});

describe('UC-34/37/39 pengelolaan Balai SDSP', () => {
  it('daftarkan Mitra: rahasia sekali tampil, pembukaan otomatis; peran lain ditolak', async () => {
    expect((await api.post('/api/v1/admin/mitra-siplah').set(await auth('BENDAHARA', { npsn: '20100001' })).send({})).status).toBe(403);
    const r = await api.post('/api/v1/admin/mitra-siplah').set(await auth('SUPER_ADMIN'))
      .send({ kode: 'MITRA_B', nama: 'Mitra Belanja B', baseUrl: diterimaMitra.length ? `http://127.0.0.1:${(mitraServer.address() as AddressInfo).port}` : 'http://x', ipDiizinkan: ['127.0.0.1'] });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ kode: 'MITRA_B', pembukaanDibuat: 1 });
    expect(r.body.clientSecret).toHaveLength(43);
    const daftar = await api.get('/api/v1/admin/mitra-siplah').set(await auth('PEMANTAU'));
    expect(JSON.stringify(daftar.body)).not.toContain(r.body.clientSecret);
    expect(JSON.stringify(daftar.body)).not.toContain(r.body.hmacRahasia);
    expect((await api.post('/mitra/v1/oauth/token').send({ grant_type: 'client_credentials', client_id: r.body.clientId, client_secret: r.body.clientSecret })).status).toBe(200);
    expect((await api.post('/api/v1/admin/mitra-siplah').set(await auth('SUPER_ADMIN')).send({ kode: 'MITRA_B', nama: 'Dobel', baseUrl: 'http://x', ipDiizinkan: ['127.0.0.1'] })).status).toBe(409);
  });

  it('pengiriman gagal berulang -> GAGAL; Balai kirim ulang -> terkirim', async () => {
    mitraStatus = 503;
    await A.pengirim.tick();
    await db.query(`UPDATE integrasi.pembukaan_sumber_dana SET berikutnya_at = now() WHERE mitra_kode = 'MITRA_B'`);
    await A.pengirim.tick();
    const g = await pembukaan('BOSP_REG', 'MITRA_B');
    expect(g).toMatchObject({ status: 'GAGAL', percobaan: 2 });
    expect(g.galat_terakhir).toContain('HTTP 503');
    mitraStatus = 202;
    expect((await api.post(`/api/v1/pembukaan-sumber-dana/${g.id}/kirim-ulang`).set(await auth('SUPER_ADMIN'))).body).toMatchObject({ status: 'MENUNGGU' });
    await A.pengirim.tick();
    expect((await pembukaan('BOSP_REG', 'MITRA_B')).status).toBe('TERKIRIM');
    const m = await api.get('/api/v1/pembukaan-sumber-dana').set(await auth('SUPER_ADMIN'));
    expect(m.body.sel.map((s: { mitraKode: string; status: string }) => `${s.mitraKode}:${s.status}`).sort()).toEqual(['MITRA_B:TERKIRIM', 'MITRA_DEV:DIBUKA']);
    const rw = await api.get(`/api/v1/pembukaan-sumber-dana/${g.id}/riwayat`).set(await auth('SUPER_ADMIN'));
    expect(rw.body.data.map((x: { peristiwa: string }) => x.peristiwa)).toEqual(['KIRIM_BERHASIL', 'KIRIM_ULANG', 'KIRIM_GAGAL_AKHIR', 'DIBUAT']);
  });

  it('tutup sumber dana: semua Mitra menerima DITUTUP (versi naik); belanja sesudahnya ditolak', async () => {
    const r = await api.post('/api/v1/sumber-dana/BOSP_REG/tutup').set(await auth('SUPER_ADMIN')).send({ alasan: 'Masa belanja tahap 1 berakhir' });
    expect(r.body).toEqual({ sumberDanaKode: 'BOSP_REG', ditutup: 2 });
    await A.pengirim.tick();
    expect(await pembukaan()).toMatchObject({ status: 'DITUTUP', target: 'TUTUP', versi: 2 });
    expect(JSON.parse(diterimaMitra.at(-1)!.body)).toMatchObject({ status: 'DITUTUP', versi: 2 });
    expect((await mitra('POST', '/mitra/v1/transaksi', transaksi('SPL-0099', [{ itemId: '1', barisId: B2, kodeRekening: '5.1.02.01.01.0024', uraian: 'x', volume: 1, hargaSatuan: 1000 }]))).body.kode).toBe('SUMBER_DANA_BELUM_DIBUKA');
    expect((await mitra('POST', '/mitra/v1/sumber-dana/BOSP_REG/konfirmasi', { status: 'DIBUKA', versi: 2 })).body.kode).toBe('SUMBER_DANA_DITUTUP');
  });
});
