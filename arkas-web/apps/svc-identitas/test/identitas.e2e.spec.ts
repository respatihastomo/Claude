/** svc-identitas: SSO OIDC (PKCE), sesi, peran aktif, JWT internal, pengelolaan pengguna berjenjang. PostgreSQL sungguhan + IdP tiruan. */
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { Client } from 'pg';
import { MemoryBroker } from '@arkas/common-ms';
import { Aplikasi, buatAplikasi } from '../dist/app';
import { idpTiruan } from './idp-tiruan';

const SANDI = { api: process.env.API_DB_PASSWORD ?? 'api_dev', worker: process.env.WORKER_DB_PASSWORD ?? 'worker_dev' };
const ADMIN = process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = 'db_auth_uji';
const ID = { sri: '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e01', rina: '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e03', adminDinas: '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e04' };
const PERAN = { sriBendahara: '8a000000-0000-4000-8000-000000000001', sriOperator: '8a000000-0000-4000-8000-000000000002', rinaVerif: '8a000000-0000-4000-8000-000000000004' };

let A: Aplikasi; let http: ReturnType<typeof request>; let superDb: Client; let broker: MemoryBroker; let idp: Awaited<ReturnType<typeof idpTiruan>>;
const dbUrl = (u: string, p: string) => { const x = new URL(ADMIN); x.username = u; x.password = p; x.pathname = '/' + DB; return x.toString(); };
const cookieDari = (res: request.Response, nama: string) =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${nama}=`));
const nilaiCookie = (c?: string) => c?.split(';')[0];

async function masukDev(email: string) {
  const r = await http.post('/api/v1/auth/dev-masuk').send({ email });
  expect(r.status).toBe(204);
  return nilaiCookie(cookieDari(r, 'arkas_sesi'))!;
}
async function token(sesi: string) {
  const r = await http.post('/api/v1/auth/token').set('Cookie', sesi);
  return { status: r.status, body: r.body, bearer: { Authorization: `Bearer ${r.body.accessToken}` } };
}
async function alurSso(hibah: Parameters<typeof idp.setujui>[1], kembali = '/sekolah/20100001/perencanaan') {
  const m = await http.get('/api/v1/auth/masuk').query({ kembali });
  const transaksi = nilaiCookie(cookieDari(m, 'arkas_oidc'))!;
  const kode = idp.setujui(m.headers.location, hibah);
  const state = new URL(m.headers.location).searchParams.get('state')!;
  return { m, transaksi, kode, state, callback: (s = state, c = transaksi) => http.get('/api/v1/auth/callback').query({ code: kode, state: s }).set('Cookie', c) };
}

beforeAll(async () => {
  execFileSync('node', [path.resolve(__dirname, '../../../scripts/migrate.mjs'), 'svc-identitas', '--seed', '--fresh'], {
    env: { ...process.env, DATABASE_ADMIN_URL: ADMIN, DB_NAME: DB, API_DB_PASSWORD: SANDI.api, WORKER_DB_PASSWORD: SANDI.worker }, stdio: 'pipe',
  });
  idp = await idpTiruan('arkas-web');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  broker = new MemoryBroker();
  A = await buatAplikasi({
    port: 0, databaseUrl: dbUrl('api_auth_login', SANDI.api), databaseWorkerUrl: dbUrl('worker_auth_login', SANDI.worker),
    broker: 'memory', brokerBrokers: [], jwtPrivateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    jwtIssuer: 'arkas-identitas', jwtAudience: 'arkas-api', tokenTtlDetik: 900, sesiTtlJam: 8, sesiIdleMenit: 60, cookieSecure: false,
    oidcStateSecret: 'rahasia-uji-yang-panjangnya-lebih-dari-32-karakter',
    oidc: { issuer: idp.issuer, clientId: 'arkas-web', redirectUri: 'http://localhost/api/v1/auth/callback', scope: 'openid email' },
    authDev: true, outboxIntervalMs: 100000, serviceName: 'svc-identitas',
  }, { broker, logger: process.env.UJI_LOG ? undefined : false });
  await A.app.init();
  http = request(A.app.getHttpServer());
  superDb = new Client({ connectionString: (() => { const u = new URL(ADMIN); u.pathname = '/' + DB; return u.toString(); })() });
  await superDb.connect();
});
afterAll(async () => { await superDb?.end(); await A?.app.close(); await idp?.tutup(); });

describe('UC-01 masuk lewat SSO (OIDC + PKCE)', () => {
  it('metode & JWKS tersedia', async () => {
    expect((await http.get('/api/v1/auth/metode')).body).toEqual({ sso: true, dev: true });
    const j = (await http.get('/.well-known/jwks.json')).body;
    expect(j.keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig' });
    expect(j.keys[0].kid).toMatch(/^[\w-]{43}$/);
    expect(j.keys[0].d).toBeUndefined(); // tidak pernah membocorkan kunci privat
  });

  it('alur sukses: redirect berisi PKCE S256 + state + nonce; callback membuat sesi & menautkan akun lewat email terverifikasi', async () => {
    const a = await alurSso({ sub: 'sso-sri', email: 'bendahara@smpn1.example' });
    expect(a.m.status).toBe(302);
    const q = new URL(a.m.headers.location).searchParams;
    expect(q.get('code_challenge_method')).toBe('S256');
    expect(q.get('client_id')).toBe('arkas-web');
    expect(a.transaksi).toBeTruthy();
    expect(cookieDari(a.m, 'arkas_oidc')).toMatch(/HttpOnly/);
    const c = await a.callback();
    expect(c.status).toBe(302);
    expect(c.headers.location).toBe('/sekolah/20100001/perencanaan');
    const sesi = cookieDari(c, 'arkas_sesi')!;
    expect(sesi).toMatch(/HttpOnly/);
    expect(sesi).toMatch(/SameSite=Lax/);
    const tautan = await superDb.query(`SELECT sso_issuer, sso_sub FROM auth.pengguna WHERE id = $1`, [ID.sri]);
    expect(tautan.rows[0]).toEqual({ sso_issuer: idp.issuer, sso_sub: 'sso-sri' });

    // dua peran -> harus memilih peran aktif dulu
    const me = (await http.get('/api/v1/me').set('Cookie', nilaiCookie(sesi)!)).body;
    expect(me.peran.map((p: { peran: string }) => p.peran).sort()).toEqual(['BENDAHARA', 'OPERATOR']);
    expect(me.peranAktif).toBeNull();
    expect((await token(nilaiCookie(sesi)!)).body.kode).toBe('PERAN_BELUM_DIPILIH');
    const pilih = await http.put('/api/v1/me/peran-aktif').set('Cookie', nilaiCookie(sesi)!).send({ peranPenggunaId: PERAN.sriBendahara });
    expect(pilih.body.peranAktif).toMatchObject({ peran: 'BENDAHARA', npsn: '20100001', namaSekolah: 'SMP Negeri Contoh 1' });

    const t = await token(nilaiCookie(sesi)!);
    expect(t.status).toBe(200);
    const jwks = createLocalJWKSet((await http.get('/.well-known/jwks.json')).body);
    const { payload } = await jwtVerify(t.body.accessToken, jwks, { issuer: 'arkas-identitas', audience: 'arkas-api' });
    expect(payload).toMatchObject({ sub: ID.sri, peran: 'BENDAHARA', npsn: '20100001', direktorat: [] });
    expect(payload.exp! - payload.iat!).toBe(900);
    // masuk SSO berikutnya mengenali akun lewat (iss, sub) walau email tidak dikirim
    const b = await alurSso({ sub: 'sso-sri' });
    expect((await b.callback()).status).toBe(302);
  });

  it('menolak: state tak cocok, cookie transaksi dipalsukan, nonce salah, akun belum terdaftar, email belum terverifikasi', async () => {
    const a = await alurSso({ sub: 'x1', email: 'bendahara@smpn1.example' });
    expect((await a.callback('state-lain')).body.kode).toBe('STATE_TIDAK_COCOK');
    const b = await alurSso({ sub: 'x2', email: 'bendahara@smpn1.example' });
    expect((await b.callback(b.state, b.transaksi.slice(0, -3) + 'abc')).body.kode).toBe('TRANSAKSI_SSO_TIDAK_VALID');
    const c = await alurSso({ sub: 'x3', email: 'kepsek@smpn1.example', nonceSalah: true });
    expect((await c.callback()).body.kode).toBe('SSO_GAGAL');
    const d = await alurSso({ sub: 'x4', email: 'tidak.terdaftar@contoh.example' });
    expect((await d.callback()).body.kode).toBe('PENGGUNA_BELUM_TERDAFTAR');
    const e = await alurSso({ sub: 'x5', email: 'kepsek@smpn1.example', emailVerified: false });
    expect((await e.callback()).body.kode).toBe('PENGGUNA_BELUM_TERDAFTAR');
    expect((await http.get('/api/v1/auth/callback').query({ error: 'access_denied' })).body.kode).toBe('SSO_DITOLAK');
  });

  it('kembali hanya ke jalur relatif (tanpa open redirect)', async () => {
    for (const jahat of ['//evil.example/x', 'https://evil.example', '/\\evil.example']) {
      const a = await alurSso({ sub: 'sso-sri' }, jahat);
      expect((await a.callback()).headers.location).toBe('/');
    }
  });
});

describe('sesi', () => {
  it('peran tunggal otomatis aktif; keluar mencabut sesi', async () => {
    const s = await masukDev('kepsek@smpn1.example');
    expect((await http.get('/api/v1/me').set('Cookie', s)).body.peranAktif.peran).toBe('KEPSEK');
    expect((await token(s)).status).toBe(200);
    expect((await http.post('/api/v1/auth/keluar').set('Cookie', s)).status).toBe(204);
    expect((await http.get('/api/v1/me').set('Cookie', s)).body.kode).toBe('SESI_TIDAK_VALID');
    expect((await http.post('/api/v1/auth/token').set('Cookie', s)).status).toBe(401);
  });

  it('sesi menganggur melewati batas tidak berlaku; token di DB disimpan sebagai hash', async () => {
    const s = await masukDev('kepsek@smpn1.example');
    const mentah = s.split('=')[1];
    expect((await superDb.query(`SELECT count(*)::int n FROM auth.sesi WHERE token_hash = $1`, [mentah])).rows[0].n).toBe(0);
    await superDb.query(`UPDATE auth.sesi SET terakhir_at = now() - interval '2 hours' WHERE dicabut_at IS NULL AND pengguna_id = '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e02'`);
    expect((await http.get('/api/v1/me').set('Cookie', s)).status).toBe(401);
  });

  it('memilih peran milik orang lain ditolak', async () => {
    const s = await masukDev('kepsek@smpn1.example');
    expect((await http.put('/api/v1/me/peran-aktif').set('Cookie', s).send({ peranPenggunaId: PERAN.sriBendahara })).status).toBe(404);
  });
});

describe('UC-20 / SK-12 pengelolaan pengguna berjenjang', () => {
  let adminDinas: Record<string, string>;
  let penggunaBaru = '';
  beforeAll(async () => { adminDinas = (await token(await masukDev('admin@dinas3201.example'))).bearer; });

  it('Admin Dinas menambah Verifikator di wilayahnya; PenggunaDibuat & PeranDiubah terbit', async () => {
    const r = await http.post('/api/v1/admin/pengguna').set(adminDinas)
      .send({ email: 'Verif.Baru@Dinas3201.example', nama: 'Dewi K.', peran: { peran: 'VERIFIKATOR_DINAS', wilayahKode: '3201' } });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ email: 'verif.baru@dinas3201.example', peran: [expect.objectContaining({ peran: 'VERIFIKATOR_DINAS', wilayahKode: '3201' })] });
    penggunaBaru = r.body.id;
    const sebelum = broker.terbit.length;
    await A.relay.tick();
    expect(broker.terbit.slice(sebelum).map((e) => e.event.type)).toEqual(['PenggunaDibuat', 'PeranDiubah']);
  });

  it('di luar kewenangan / cakupan ditolak dengan kode jelas', async () => {
    const tambah = (peran: object, email = `x${randomUUID().slice(0, 6)}@contoh.example`) =>
      http.post('/api/v1/admin/pengguna').set(adminDinas).send({ email, nama: 'Uji Coba', peran });
    expect((await tambah({ peran: 'OPERATOR', npsn: '20100002' })).body.kode).toBe('DI_LUAR_CAKUPAN');
    expect((await tambah({ peran: 'BENDAHARA', npsn: '20100001' })).body.kode).toBe('PERAN_DI_LUAR_KEWENANGAN');
    expect((await tambah({ peran: 'VERIFIKATOR_DINAS' })).body.kode).toBe('CAKUPAN_TIDAK_SESUAI');
    expect((await tambah({ peran: 'VERIFIKATOR_DINAS', wilayahKode: '3201' }, 'admin@balai.example')).body.kode).toBe('EMAIL_SUDAH_TERDAFTAR');
    expect((await tambah({ peran: 'VERIFIKATOR_DINAS', wilayahKode: '3201' }, 'verif.baru@dinas3201.example')).body.kode).toBe('PERAN_SUDAH_ADA');
    const kepsek = (await token(await masukDev('kepsek@smpn1.example'))).bearer;
    expect((await http.get('/api/v1/admin/pengguna').set(kepsek)).status).toBe(403);
  });

  it('daftar hanya pengguna dalam cakupan', async () => {
    const d = (await http.get('/api/v1/admin/pengguna').set(adminDinas)).body.data as Array<{ email: string }>;
    expect(d.map((x) => x.email).sort()).toEqual(['bendahara@smpn1.example', 'kepsek@smpn1.example', 'verif.baru@dinas3201.example', 'verifikator@dinas3201.example']);
  });

  it('Operator memberi peran Komite di sekolahnya, tidak untuk dirinya sendiri', async () => {
    const s = await masukDev('bendahara@smpn1.example');
    await http.put('/api/v1/me/peran-aktif').set('Cookie', s).send({ peranPenggunaId: PERAN.sriOperator });
    const op = (await token(s)).bearer;
    const r = await http.post('/api/v1/admin/pengguna').set(op).send({ email: 'komite@smpn1.example', nama: 'Ketua Komite', peran: { peran: 'KOMITE', npsn: '20100001' } });
    expect(r.status).toBe(201);
    expect((await http.post(`/api/v1/admin/pengguna/${ID.sri}/peran`).set(op).send({ peran: 'KOMITE', npsn: '20100001' })).body.kode).toBe('PEMISAHAN_TUGAS');
  });

  it('mencabut peran melepas peran aktif pada sesi yang sedang dipakai', async () => {
    const sRina = await masukDev('verifikator@dinas3201.example');
    expect((await token(sRina)).status).toBe(200);
    const c = await http.delete(`/api/v1/admin/pengguna/${ID.rina}/peran/${PERAN.rinaVerif}`).set(adminDinas).send({ alasan: 'Mutasi ke instansi lain' });
    expect(c.status).toBe(200);
    expect(c.body.peran[0]).toMatchObject({ berlaku: false });
    expect((await token(sRina)).body.kode).toBe('PERAN_BELUM_DIPILIH');
    expect((await http.delete(`/api/v1/admin/pengguna/${ID.rina}/peran/${PERAN.rinaVerif}`).set(adminDinas).send({ alasan: 'lagi lagi' })).status).toBe(409);
  });

  it('RLS: Dinas wilayah lain tidak melihat/ memberi peran di 3201 walau aplikasi dilewati', async () => {
    const c = new Client({ connectionString: dbUrl('api_auth_login', SANDI.api) });
    await c.connect();
    try {
      await c.query('BEGIN');
      const aktor = randomUUID();
      await c.query(`SELECT set_config('app.peran','ADMIN_DINAS',true), set_config('app.wilayah','3202',true), set_config('app.pengguna_id',$1,true)`, [aktor]);
      expect((await c.query(`SELECT count(*)::int n FROM auth.peran_pengguna WHERE wilayah_kode = '3201' OR npsn = '20100001'`)).rows[0].n).toBe(0);
      await expect(c.query(`INSERT INTO auth.peran_pengguna (pengguna_id, peran, wilayah_kode, diberikan_oleh) VALUES ($1,'VERIFIKATOR_DINAS','3201',$2)`,
        [penggunaBaru, aktor])).rejects.toMatchObject({ code: '42501' });
    } finally {
      await c.query('ROLLBACK');
      await c.end();
    }
    await expect(superDb.query(`DELETE FROM auth.peran_pengguna WHERE id = $1`, [PERAN.rinaVerif])).rejects.toMatchObject({ message: 'HAPUS_DILARANG' });
  });
});
