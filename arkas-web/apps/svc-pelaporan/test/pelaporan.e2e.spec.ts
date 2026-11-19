/** svc-pelaporan: PeriodeDitutup + TransaksiDisetujui -> laporan PDF -> tanda tangan -> LaporanDitandatangani. PostgreSQL & Chromium sungguhan. */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { exportSPKI, generateKeyPair, KeyLike, SignJWT } from 'jose';
import { Client } from 'pg';
import { MemoryBroker } from '@arkas/common-ms';
import { Aplikasi, buatAplikasi } from '../dist/app';

/** Role login PostgreSQL berlaku untuk SELURUH klaster: uji wajib memakai kata sandi yang sama dengan dev
 *  (atau API_DB_PASSWORD/WORKER_DB_PASSWORD) agar migrasi uji tidak mengubah kredensial layanan yang sedang berjalan. */
const SANDI = { api: process.env.API_DB_PASSWORD ?? 'api_dev', worker: process.env.WORKER_DB_PASSWORD ?? 'worker_dev' };
const ADMIN = process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = 'db_pelaporan_uji';
const TOKEN = 'token-internal-uji-0123456789';
const NPSN = '20100001';
const SD = 'BOSP_REG';
const BENDAHARA = randomUUID();
const KEPSEK = randomUUID();
const PERIODE = randomUUID();
const PERIODE_RUSAK = randomUUID();

let A: Aplikasi; let http: ReturnType<typeof request>; let kunci: KeyLike; let superDb: Client; let broker: MemoryBroker; let dir: string;
let laporanId = '';

const dbUrl = (u: string, p: string) => { const x = new URL(ADMIN); x.username = u; x.password = p; x.pathname = '/' + DB; return x.toString(); };
const auth = async (peran: string, sub: string, npsn = NPSN) => ({
  Authorization: `Bearer ${await new SignJWT({ peran, npsn, direktorat: [] }).setProtectedHeader({ alg: 'RS256' }).setSubject(sub)
    .setIssuer('arkas-identitas').setAudience('arkas-api').setIssuedAt().setExpirationTime('10m').sign(kunci)}`,
});
const kirim = (topik: string, type: string, data: object, id = randomUUID()) =>
  http.post('/internal/v1/events').set('X-Internal-Token', TOKEN)
    .send({ topik, event: { specversion: '1.0', id, source: 'svc-penatausahaan', type, time: new Date().toISOString(), data } });
const trx = (id: string, x: object) => ({ transaksiId: id, npsn: NPSN, tahun: 2026, sumberDanaKode: SD, tanggal: '2026-10-05', totalPajak: 0,
  disetujuiOleh: KEPSEK, disetujuiAt: '2026-10-05T03:00:00Z', items: [], pajak: [], noBukti: null, caraBayar: null, ...x });
const periode = (periodeId: string, bulan: number, ringkasanBank = 10_000_000) => ({
  periodeId, npsn: NPSN, tahun: 2026, sumberDanaKode: SD, bulan, diajukanOleh: BENDAHARA, ditutupOleh: KEPSEK, ditutupAt: '2026-10-31T09:00:00Z',
  ringkasan: {
    tunai: { saldoAwal: 0, penerimaan: 1_055_000, pengeluaran: 555_000, saldoAkhir: 500_000 },
    bank: { saldoAwal: 0, penerimaan: ringkasanBank, pengeluaran: 1_000_000, saldoAkhir: ringkasanBank - 1_000_000 },
    pajak: { saldoAwal: 0, dipungut: 55_000, disetor: 0, saldoAkhir: 55_000 }, jumlahTransaksi: 3,
  },
  rekonsiliasi: { saldoRekeningKoran: 8_997_500, selisihBank: -2_500, penjelasanBank: 'Biaya administrasi bank <b>Oktober</b>', kasFisik: 500_000, selisihKas: 0, penjelasanKas: null },
  periodeBerikutBulan: bulan + 1,
});
const ulangSegera = () => superDb.query(`UPDATE pelaporan.laporan SET berikutnya_at = now() WHERE status = 'MENUNGGU'`);

beforeAll(async () => {
  execFileSync('node', [path.resolve(__dirname, '../../../scripts/migrate.mjs'), 'svc-pelaporan', '--fresh'], {
    env: { ...process.env, DATABASE_ADMIN_URL: ADMIN, DB_NAME: DB, API_DB_PASSWORD: SANDI.api, WORKER_DB_PASSWORD: SANDI.worker }, stdio: 'pipe',
  });
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pelaporan-uji-'));
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  kunci = privateKey;
  broker = new MemoryBroker();
  A = await buatAplikasi({
    port: 0, databaseUrl: dbUrl('api_pelaporan_login', SANDI.api), databaseWorkerUrl: dbUrl('worker_pelaporan_login', SANDI.worker),
    broker: 'memory', brokerBrokers: [], jwtPublicKey: await exportSPKI(publicKey), jwtIssuer: 'arkas-identitas', jwtAudience: 'arkas-api',
    devEvents: true, internalEventsToken: TOKEN, pdf: 'chromium', penyimpananDir: dir, tte: 'simulasi', outboxIntervalMs: 100000,
    pembuatIntervalMs: 100000, serviceName: 'svc-pelaporan',
  }, { broker, logger: process.env.UJI_LOG ? undefined : false });
  await A.app.init();
  http = request(A.app.getHttpServer());
  superDb = new Client({ connectionString: (() => { const u = new URL(ADMIN); u.pathname = '/' + DB; return u.toString(); })() });
  await superDb.connect();
}, 120_000);
afterAll(async () => { await superDb?.end(); await A?.app.close(); if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

describe('svc-pelaporan', () => {
  it('PeriodeDitutup tiba lebih dulu: laporan diantrekan tetapi menunggu data transaksi lengkap', async () => {
    expect((await kirim('arkas.tatausaha.periode-ditutup', 'PeriodeDitutup', periode(PERIODE, 10))).status).toBe(202);
    expect(await A.pembuat.tick()).toBeTruthy();
    const r = await superDb.query(`SELECT id, status, percobaan, galat_terakhir FROM pelaporan.laporan WHERE periode_id = $1`, [PERIODE]);
    expect(r.rows[0]).toMatchObject({ status: 'MENUNGGU', percobaan: 1 });
    expect(r.rows[0].galat_terakhir).toMatch(/jumlah transaksi 0 dari 3/);
    laporanId = r.rows[0].id;
  });

  it('setelah TransaksiDisetujui tiba (sekali walau dikirim ganda), PDF dibuat dan SIAP', async () => {
    const id1 = randomUUID();
    const ev1 = randomUUID();
    expect((await kirim('arkas.tatausaha.transaksi-disetujui', 'TransaksiDisetujui', trx(id1, { jenis: 'PENERIMAAN', nilaiBruto: 10_000_000, uraian: 'BOSP tahap 3' }), ev1)).status).toBe(202);
    expect((await kirim('arkas.tatausaha.transaksi-disetujui', 'TransaksiDisetujui', trx(id1, { jenis: 'PENERIMAAN', nilaiBruto: 10_000_000, uraian: 'BOSP tahap 3' }), ev1)).status).toBe(202);
    await kirim('arkas.tatausaha.transaksi-disetujui', 'TransaksiDisetujui', trx(randomUUID(), { jenis: 'TARIK_TUNAI', nilaiBruto: 1_000_000, uraian: 'Tarik tunai', disetujuiAt: '2026-10-05T04:00:00Z' }));
    await kirim('arkas.tatausaha.transaksi-disetujui', 'TransaksiDisetujui', trx(randomUUID(), {
      jenis: 'BELANJA', nilaiBruto: 555_000, totalPajak: 55_000, caraBayar: 'TUNAI', noBukti: 'NOTA-9', uraian: 'ATK <script>x</script>', tanggal: '2026-10-09',
      items: [{ barisId: randomUUID(), kodeRekening: '5.1.02.01.01.0024', jumlah: 555_000, uraian: 'Kertas HVS' }], pajak: [{ jenis: 'PPN', nilai: 55_000 }],
    }));
    // transaksi bulan lain tidak ikut
    await kirim('arkas.tatausaha.transaksi-disetujui', 'TransaksiDisetujui', trx(randomUUID(), { jenis: 'PENERIMAAN', nilaiBruto: 5, uraian: 'November', tanggal: '2026-11-02' }));
    expect((await superDb.query(`SELECT count(*)::int n FROM pelaporan.bku_transaksi_lokal`)).rows[0].n).toBe(4);

    await ulangSegera();
    await A.pembuat.tick();
    const r = await http.get(`/api/v1/laporan/${laporanId}`).set(await auth('BENDAHARA', BENDAHARA));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'SIAP', bulan: 10, galatTerakhir: null, penyediaTte: null });
    expect(r.body.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.body.ukuran).toBeGreaterThan(10_000);
  }, 60_000);

  it('daftar & unduh PDF dengan integritas SHA-256; cakupan sekolah dijaga', async () => {
    const d = await http.get('/api/v1/laporan').query({ npsn: NPSN, tahun: 2026, sumberDanaKode: SD }).set(await auth('KEPSEK', KEPSEK));
    expect(d.body.data.map((x: { id: string; status: string }) => [x.id, x.status])).toEqual([[laporanId, 'SIAP']]);
    const b = await http.get(`/api/v1/laporan/${laporanId}/berkas`).set(await auth('BENDAHARA', BENDAHARA)).buffer(true).parse((res, cb) => {
      const c: Buffer[] = []; res.on('data', (x: Buffer) => c.push(x)); res.on('end', () => cb(null, Buffer.concat(c)));
    });
    expect(b.status).toBe(200);
    expect(b.headers['content-type']).toBe('application/pdf');
    expect((b.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect(b.headers.etag).toBe(`"${d.body.data[0].sha256}"`);

    const lain = await http.get('/api/v1/laporan').query({ npsn: '20100002', tahun: 2026, sumberDanaKode: SD }).set(await auth('KEPSEK', KEPSEK));
    expect(lain.status).toBe(403);
    const rls = await http.get(`/api/v1/laporan/${laporanId}`).set(await auth('KEPSEK', randomUUID(), '20100002'));
    expect(rls.status).toBe(404);
  });

  it('tanda tangan: hanya Kepala Sekolah, wajib If-Match; hasilnya berkas baru & LaporanDitandatangani', async () => {
    expect((await http.post(`/api/v1/laporan/${laporanId}/tandatangani`).set(await auth('BENDAHARA', BENDAHARA)).set('If-Match', 'W/"1"')).status).toBe(403);
    expect((await http.post(`/api/v1/laporan/${laporanId}/tandatangani`).set(await auth('KEPSEK', KEPSEK))).status).toBe(428);
    const versi = (await http.get(`/api/v1/laporan/${laporanId}`).set(await auth('KEPSEK', KEPSEK))).body.versi;
    const r = await http.post(`/api/v1/laporan/${laporanId}/tandatangani`).set(await auth('KEPSEK', KEPSEK)).set('If-Match', `W/"${versi}"`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'DITANDATANGANI', ditandatanganiOleh: KEPSEK, penyediaTte: 'SIMULASI_DEV' });
    expect(r.body.sha256Tertanda).not.toBe(r.body.sha256);

    const sebelum = broker.terbit.length;
    await A.relay.tick();
    const ev = broker.terbit.slice(sebelum).find((e) => e.event.type === 'LaporanDitandatangani')!;
    expect(ev.topik).toBe('arkas.pelaporan.laporan-ditandatangani');
    expect(ev.event.data).toMatchObject({ laporanId, periodeId: PERIODE, bulan: 10, sha256: r.body.sha256Tertanda, penyediaTte: 'SIMULASI_DEV' });

    const asli = await http.get(`/api/v1/laporan/${laporanId}/berkas?versi=asli`).set(await auth('KEPSEK', KEPSEK));
    expect(asli.headers.etag).toBe(`"${r.body.sha256}"`);
    const ttd = await http.get(`/api/v1/laporan/${laporanId}/berkas`).set(await auth('KEPSEK', KEPSEK));
    expect(ttd.headers.etag).toBe(`"${r.body.sha256Tertanda}"`);
    expect(ttd.headers['content-disposition']).toContain('-ttd.pdf');

    const lagi = await http.post(`/api/v1/laporan/${laporanId}/tandatangani`).set(await auth('KEPSEK', KEPSEK)).set('If-Match', `W/"${r.body.versi}"`);
    expect(lagi.body.kode).toBe('LAPORAN_FINAL');
    await expect(superDb.query(`UPDATE pelaporan.laporan SET status = 'SIAP' WHERE id = $1`, [laporanId])).rejects.toMatchObject({ message: 'LAPORAN_FINAL' });
  }, 60_000);

  it('berkas yang diubah di penyimpanan terdeteksi (SHA-256 tidak cocok)', async () => {
    const k = (await superDb.query(`SELECT tertanda_kunci FROM pelaporan.laporan WHERE id = $1`, [laporanId])).rows[0].tertanda_kunci;
    fs.appendFileSync(path.join(dir, k), 'rusak');
    expect((await http.get(`/api/v1/laporan/${laporanId}/berkas`).set(await auth('KEPSEK', KEPSEK))).status).toBe(500);
  });

  it('data yang tak pernah konsisten berakhir GAGAL setelah batas percobaan', async () => {
    await kirim('arkas.tatausaha.periode-ditutup', 'PeriodeDitutup', { ...periode(PERIODE_RUSAK, 9, 99_000_000), ditutupAt: '2026-09-30T09:00:00Z' });
    await superDb.query(`UPDATE pelaporan.laporan SET percobaan = 7 WHERE periode_id = $1`, [PERIODE_RUSAK]);
    await A.pembuat.tick();
    const r = (await superDb.query(`SELECT status, galat_terakhir FROM pelaporan.laporan WHERE periode_id = $1`, [PERIODE_RUSAK])).rows[0];
    expect(r.status).toBe('GAGAL');
    expect(r.galat_terakhir).toMatch(/belum lengkap/);
  });

  it('event cacat ditolak 422 agar pengirim mencoba ulang', async () => {
    const r = await kirim('arkas.tatausaha.periode-ditutup', 'PeriodeDitutup', { periodeId: 'bukan-uuid' });
    expect(r.status).toBe(422);
  });
});
