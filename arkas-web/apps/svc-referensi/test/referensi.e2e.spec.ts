/** svc-referensi: baca referensi, pengelolaan Balai (event ReferensiDiubah dari trigger), pajak daerah Dinas (UC-32), UC-02, terbit ulang. */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { exportSPKI, generateKeyPair, KeyLike, SignJWT } from 'jose';
import { Client } from 'pg';
import { MemoryBroker } from '@arkas/common-ms';
import { ReferensiDiubahData } from '@arkas/kontrak';
import { Aplikasi, buatAplikasi } from '../dist/app';

const SANDI = { api: process.env.API_DB_PASSWORD ?? 'api_dev', worker: process.env.WORKER_DB_PASSWORD ?? 'worker_dev' };
const ADMIN = process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = 'db_ref_uji';
let A: Aplikasi; let http: ReturnType<typeof request>; let kunci: KeyLike; let superDb: Client; let broker: MemoryBroker;
const dbUrl = (u: string, p: string) => { const x = new URL(ADMIN); x.username = u; x.password = p; x.pathname = '/' + DB; return x.toString(); };
async function auth(peran: string, klaim: Record<string, unknown> = {}, sub = randomUUID()) {
  return { Authorization: `Bearer ${await new SignJWT({ peran, direktorat: [], ...klaim }).setProtectedHeader({ alg: 'RS256' }).setSubject(sub)
    .setIssuer('arkas-identitas').setAudience('arkas-api').setIssuedAt().setExpirationTime('10m').sign(kunci)}` };
}
const balai = () => auth('SUPER_ADMIN');
const dinas = (wilayah = '3201') => auth('ADMIN_DINAS', { wilayah });
async function eventBaru(): Promise<ReferensiDiubahData[]> {
  const sebelum = broker.terbit.length;
  while (await A.relay.tick()) { /* kuras */ }
  return broker.terbit.slice(sebelum).filter((e) => e.event.type === 'ReferensiDiubah').map((e) => ReferensiDiubahData.parse(e.event.data));
}

beforeAll(async () => {
  execFileSync('node', [path.resolve(__dirname, '../../../scripts/migrate.mjs'), 'svc-referensi', '--seed', '--fresh'], {
    env: { ...process.env, DATABASE_ADMIN_URL: ADMIN, DB_NAME: DB, API_DB_PASSWORD: SANDI.api, WORKER_DB_PASSWORD: SANDI.worker }, stdio: 'pipe',
  });
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  kunci = privateKey;
  broker = new MemoryBroker();
  A = await buatAplikasi({
    port: 0, databaseUrl: dbUrl('api_ref_login', SANDI.api), databaseWorkerUrl: dbUrl('worker_ref_login', SANDI.worker), broker: 'memory', brokerBrokers: [],
    jwtPublicKey: await exportSPKI(publicKey), jwtIssuer: 'arkas-identitas', jwtAudience: 'arkas-api', devEvents: false, outboxIntervalMs: 100000, serviceName: 'svc-referensi',
  }, { broker, logger: process.env.UJI_LOG ? undefined : false });
  await A.app.init();
  http = request(A.app.getHttpServer());
  superDb = new Client({ connectionString: (() => { const u = new URL(ADMIN); u.pathname = '/' + DB; return u.toString(); })() });
  await superDb.connect();
});
afterAll(async () => { await superDb?.end(); await A?.app.close(); });

describe('baca referensi', () => {
  it('semua pengguna terautentikasi dapat membaca; filter berjalan', async () => {
    const bendahara = await auth('BENDAHARA', { npsn: '20100001' });
    const k = (await http.get('/api/v1/referensi/komponen').query({ sumberDanaKode: 'BOSP_REG' }).set(bendahara)).body.data;
    expect(k).toHaveLength(10);
    expect(k.find((x: { kode: string }) => x.kode === '12')).toMatchObject({ nama: 'Pembayaran honor', maksPersen: 20, aktif: true });
    expect((await http.get('/api/v1/referensi/sekolah').query({ wilayahKode: '3201' }).set(bendahara)).body.data.map((s: { npsn: string }) => s.npsn)).toEqual(['20100001']);
    expect((await http.get('/api/v1/referensi/tidak-ada').set(bendahara)).status).toBe(404);
    expect((await http.get('/api/v1/referensi/wilayah')).status).toBe(401);
  });

  it('UC-02: sumber dana sesuai jenjang sekolah; profil sekolah dalam cakupan', async () => {
    const r = await http.get('/api/v1/sekolah/20100001/sumber-dana').set(await auth('OPERATOR', { npsn: '20100001' }));
    expect(r.body.data).toEqual([{ kode: 'BOSP_REG', nama: 'BOSP Reguler', kategori: 'BOSP', direktoratKode: null, aktif: true }]);
    expect((await http.get('/api/v1/sekolah/20100001').set(await auth('OPERATOR', { npsn: '20100001' }))).body).toMatchObject({ jenjangKode: 'SMP', namaWilayah: 'Kabupaten Contoh 1' });
    expect((await http.get('/api/v1/sekolah/20100002').set(await auth('OPERATOR', { npsn: '20100001' }))).status).toBe(403);
  });
});

describe('UC-19 pengelolaan Balai & event ReferensiDiubah', () => {
  it('migrasi contoh sudah menerbitkan event untuk setiap baris, bernomor versi naik', async () => {
    const ev = await eventBaru();
    expect(ev.length).toBe(36);
    const versi = ev.map((e) => e.versi);
    expect([...versi].sort((a, b) => a - b)).toEqual(versi);
    expect(ev.find((e) => e.entitas === 'TARIF_PAJAK' && e.kunci === '5.1.02.01.01.0052:SSPD:')).toMatchObject({ aktif: true, data: { tarif: 0.1, wilayahKode: '' } });
  });

  it('ubah komponen: versi naik & event terbit; simpan isi sama tidak menerbitkan event', async () => {
    const isi = { sumberDanaKode: 'BOSP_REG', kode: '12', nama: 'Pembayaran honor', maksPersen: 15, minPersen: null };
    const r = await http.put('/api/v1/admin/referensi/komponen').set(await balai()).send(isi);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ maksPersen: 15 });
    const ev = await eventBaru();
    expect(ev).toEqual([expect.objectContaining({ entitas: 'KOMPONEN', kunci: 'BOSP_REG:12', versi: r.body.versi, data: expect.objectContaining({ maksPersen: 15 }) })]);
    const sama = await http.put('/api/v1/admin/referensi/komponen').set(await balai()).send(isi);
    expect(sama.status).toBe(200);
    expect(await eventBaru()).toEqual([]);
  });

  it('nonaktifkan, validasi, rujukan, dan hanya Balai', async () => {
    const r = await http.put('/api/v1/admin/referensi/kode-rekening').set(await balai()).send({ kode: '5.1.02.02.01.0061', nama: 'Belanja Jasa Internet', aktif: false });
    expect(r.body.aktif).toBe(false);
    expect((await eventBaru())[0]).toMatchObject({ entitas: 'KODE_REKENING', aktif: false });
    expect((await http.put('/api/v1/admin/referensi/kode-rekening').set(await balai()).send({ kode: '5.1', nama: 'x' })).body.kode).toBe('VALIDASI');
    expect((await http.put('/api/v1/admin/referensi/sekolah').set(await balai())
      .send({ npsn: '20100009', nama: 'SMP Uji', jenjangKode: 'SMP', wilayahKode: '9999', statusSekolah: 'NEGERI' })).body.kode).toBe('RUJUKAN_TIDAK_DIKENAL');
    expect((await http.put('/api/v1/admin/referensi/komponen').set(await dinas()).send({ sumberDanaKode: 'BOSP_REG', kode: '12', nama: 'x' })).status).toBe(403);
    await expect(superDb.query(`DELETE FROM ref.komponen WHERE kode = '12'`)).rejects.toMatchObject({ message: 'HAPUS_DILARANG' });
  });

  it('terbit ulang: semua baris terkirim lagi dengan versi yang sama (tanpa menaikkan versi)', async () => {
    const versiSebelum = (await superDb.query(`SELECT max(versi)::int v FROM ref.komponen`)).rows[0].v;
    expect((await http.post('/api/v1/admin/referensi/terbit-ulang').set(await dinas())).status).toBe(403);
    const r = await http.post('/api/v1/admin/referensi/terbit-ulang').set(await balai());
    expect(r.status).toBe(202);
    expect(r.body.jumlah).toBe(36);
    const ev = await eventBaru();
    expect(ev).toHaveLength(36);
    expect(ev[0].entitas).toBe('WILAYAH'); // urutan ketergantungan
    expect((await superDb.query(`SELECT max(versi)::int v FROM ref.komponen`)).rows[0].v).toBe(versiSebelum);
  });
});

describe('UC-32 pajak daerah oleh Dinas', () => {
  it('Dinas menetapkan SSPD untuk wilayahnya; event TARIF_PAJAK berwilayah terbit', async () => {
    const r = await http.put('/api/v1/dinas/konfigurasi-pajak').set(await dinas())
      .send({ kodeRekening: '5.1.02.01.01.0052', wilayahKode: '3201', tarif: 0.05, dasarHukum: 'Perda Kab. Contoh 1 No. 1/2026 (contoh)' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ jenis: 'SSPD', wilayahKode: '3201', tarif: 0.05, aktif: true });
    expect((await eventBaru())[0]).toMatchObject({ entitas: 'TARIF_PAJAK', kunci: '5.1.02.01.01.0052:SSPD:3201', data: { tarif: 0.05 } });
    const daftar = (await http.get('/api/v1/dinas/konfigurasi-pajak').set(await dinas())).body.data as Array<{ kodeRekening: string; jenis: string; wilayahKode: string }>;
    expect(daftar.filter((t) => t.kodeRekening === '5.1.02.01.01.0052').map((t) => t.wilayahKode)).toEqual(['', '3201']);
  });

  it('membebaskan (tarif null) disimpan sebagai baris nonaktif', async () => {
    const r = await http.put('/api/v1/dinas/konfigurasi-pajak').set(await dinas())
      .send({ kodeRekening: '5.1.02.01.01.0052', wilayahKode: '3201', tarif: null, dasarHukum: 'Pembebasan sementara (contoh)' });
    expect(r.body).toMatchObject({ aktif: false, tarif: 0.05 });
    expect((await eventBaru())[0]).toMatchObject({ aktif: false });
  });

  it('di luar wilayah, rekening tak dikenal, dan RLS saat aplikasi dilewati', async () => {
    const atur = async (x: object, w = '3201') => http.put('/api/v1/dinas/konfigurasi-pajak').set(await dinas(w)).send({ kodeRekening: '5.1.02.01.01.0052', tarif: 0.05, dasarHukum: 'contoh', ...x });
    expect((await atur({ wilayahKode: '3202' })).body.kode).toBe('DI_LUAR_CAKUPAN');
    expect((await atur({ wilayahKode: '32' })).body.kode).toBe('DI_LUAR_CAKUPAN'); // Dinas kab tidak mengatur tingkat provinsi
    expect((await atur({ wilayahKode: '3201', kodeRekening: '9.9.99.99' })).body.kode).toBe('KODE_REKENING_TIDAK_DIKENAL');
    const c = new Client({ connectionString: dbUrl('api_ref_login', SANDI.api) });
    await c.connect();
    try {
      for (const [sql, harap] of [
        [`INSERT INTO ref.tarif_pajak (kode_rekening, jenis, wilayah_kode, tarif, diubah_oleh) VALUES ('5.1.02.01.01.0052','SSPD','3202',0.07,$1)`, '42501'],
        [`INSERT INTO ref.tarif_pajak (kode_rekening, jenis, wilayah_kode, tarif, diubah_oleh) VALUES ('5.1.02.01.01.0024','PPN','3201',0.07,$1)`, '42501'],
        [`UPDATE ref.tarif_pajak SET tarif = 0.5 WHERE wilayah_kode = '' AND kode_rekening = '5.1.02.01.01.0024' RETURNING 1`, 'kosong'],
      ] as const) {
        await c.query('BEGIN');
        const aktor = randomUUID();
        await c.query(`SELECT set_config('app.peran','ADMIN_DINAS',true), set_config('app.wilayah','3201',true), set_config('app.pengguna_id',$1,true)`, [aktor]);
        if (harap === 'kosong') expect((await c.query(sql)).rowCount).toBe(0); // tarif nasional tak terlihat untuk diubah Dinas
        else await expect(c.query(sql, [aktor])).rejects.toMatchObject({ code: harap });
        await c.query('ROLLBACK');
      }
    } finally {
      await c.end();
    }
    // CHECK basis data: hanya SSPD yang boleh berwilayah, bahkan untuk superuser
    await expect(superDb.query(`INSERT INTO ref.tarif_pajak (kode_rekening, jenis, wilayah_kode, tarif) VALUES ('5.1.02.01.01.0024','PPN','3201',0.07)`))
      .rejects.toMatchObject({ code: '23514' });
  });
});

describe('SumberDanaDisahkan (svc-bantuan) -> referensi BANPER', () => {
  it('sumber dana, jenjang & komponen aktif lalu ReferensiDiubah terbit; event ulang tidak menaikkan versi', async () => {
    await eventBaru();
    const data = { kode: 'BANPER_UJI', nama: 'Bantuan Uji SMP', kategori: 'BANPER', direktoratKode: 'SMP', tahun: 2026, jenjang: ['SMP'],
      komponen: [{ kode: '01', nama: 'Pengadaan laptop', maksPersen: 80 }], penerima: [{ npsn: '20100001', nilai: 1_000_000 }], disahkanAt: new Date().toISOString() };
    const kirim = () => broker.publish('arkas.banper.sumber-dana-disahkan', { specversion: '1.0', id: randomUUID(), source: 'svc-bantuan', type: 'SumberDanaDisahkan', time: new Date().toISOString(), datacontenttype: 'application/json', data });
    await kirim();
    const ev = await eventBaru();
    expect(ev.find((e) => e.entitas === 'SUMBER_DANA' && e.kunci === 'BANPER_UJI')).toMatchObject({ aktif: true, data: { kategori: 'BANPER', direktoratKode: 'SMP' } });
    expect(ev.find((e) => e.entitas === 'KOMPONEN' && e.kunci === 'BANPER_UJI:01')).toMatchObject({ data: { maksPersen: 80 } });
    const bendahara = await auth('BENDAHARA', { npsn: '20100001' });
    expect((await http.get('/api/v1/sekolah/20100001/sumber-dana').set(bendahara)).body.data.map((s: { kode: string }) => s.kode)).toContain('BANPER_UJI');
    await kirim();
    expect((await eventBaru()).filter((e) => e.entitas === 'SUMBER_DANA' || e.entitas === 'KOMPONEN')).toEqual([]);
  });
});
