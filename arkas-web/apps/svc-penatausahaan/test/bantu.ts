/** Perkakas bersama uji integrasi: basis data uji baru, aplikasi dengan MemoryBroker, token JWT, dan pembantu HTTP. */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import request from 'supertest';
import { exportSPKI, generateKeyPair, KeyLike, SignJWT } from 'jose';
import { Client } from 'pg';
import { MemoryBroker } from '@arkas/common-ms';
import { Aplikasi, buatAplikasi } from '../dist/app';
import { hariIniJakarta } from '../dist/infra/waktu';

/** Role login PostgreSQL berlaku untuk SELURUH klaster: uji wajib memakai kata sandi yang sama dengan dev
 *  (atau API_DB_PASSWORD/WORKER_DB_PASSWORD) agar migrasi uji tidak mengubah kredensial layanan yang sedang berjalan. */
export const SANDI = { api: process.env.API_DB_PASSWORD ?? 'api_dev', worker: process.env.WORKER_DB_PASSWORD ?? 'worker_dev' };
export const ADMIN = process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
export const HARI_INI = hariIniJakarta();
export const TAHUN = Number(HARI_INI.slice(0, 4));
export const SD = 'BOSP_REG';
const TOKEN_INTERNAL = 'token-internal-uji-0123456789';

export interface Harness {
  A: Aplikasi; http: ReturnType<typeof request>; broker: MemoryBroker; superDb: Client; db: string; npsn: string;
  bendahara: string; kepsek: string;
  auth(peran: string, sub: string, npsn?: string): Promise<Record<string, string>>;
  kirimEvent(body: object): request.Test;
  eventKk(versi: number, baris: Array<{ id: string; kodeRekening: string; uraian: string; total: number; asalBarisId?: string }>, id?: string): object;
  catat(body: Record<string, unknown>, kunci?: string): Promise<request.Response>;
  setujui(id: string, versi?: number): Promise<request.Response>;
  tolak(id: string, alasan: string, versi?: number): Promise<request.Response>;
  get(path: string, query?: Record<string, unknown>, peran?: 'BENDAHARA' | 'KEPSEK'): Promise<request.Response>;
  dbUrl(user: string, pass: string): string;
  tutup(): Promise<void>;
}

export async function siapkan(db: string, npsn = '20100001'): Promise<Harness> {
  execFileSync('node', [path.resolve(__dirname, '../../../scripts/migrate.mjs'), 'svc-penatausahaan', '--seed', '--fresh'], {
    env: { ...process.env, DATABASE_ADMIN_URL: ADMIN, DB_NAME: db, API_DB_PASSWORD: SANDI.api, WORKER_DB_PASSWORD: SANDI.worker }, stdio: 'pipe',
  });
  const dbUrl = (user: string, pass: string) => { const u = new URL(ADMIN); u.username = user; u.password = pass; u.pathname = '/' + db; return u.toString(); };
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const kunci: KeyLike = privateKey;
  const broker = new MemoryBroker();
  const A = await buatAplikasi({
    port: 0, databaseUrl: dbUrl('api_tatausaha_login', SANDI.api), databaseWorkerUrl: dbUrl('worker_tatausaha_login', SANDI.worker),
    broker: 'memory', brokerBrokers: [], jwtPublicKey: await exportSPKI(publicKey), jwtIssuer: 'arkas-identitas', jwtAudience: 'arkas-api',
    devEvents: true, internalEventsToken: TOKEN_INTERNAL, outboxIntervalMs: 100000, serviceName: 'svc-penatausahaan',
    tutupSebelumAkhirBulan: true,
  }, { broker, logger: process.env.UJI_LOG ? undefined : false });
  await A.app.init();
  const http = request(A.app.getHttpServer());
  const superDb = new Client({ connectionString: (() => { const u = new URL(ADMIN); u.pathname = '/' + db; return u.toString(); })() });
  await superDb.connect();
  const bendahara = randomUUID();
  const kepsek = randomUUID();

  const auth = async (peran: string, sub: string, n?: string) => ({
    Authorization: `Bearer ${await new SignJWT({ peran, ...(n ? { npsn: n } : {}), direktorat: [] })
      .setProtectedHeader({ alg: 'RS256' }).setSubject(sub).setIssuer('arkas-identitas').setAudience('arkas-api')
      .setIssuedAt().setExpirationTime('10m').sign(kunci)}`,
  });
  const h: Harness = {
    A, http, broker, superDb, db, npsn, bendahara, kepsek, auth, dbUrl,
    kirimEvent: (body) => http.post('/internal/v1/events').set('X-Internal-Token', TOKEN_INTERNAL).send(body),
    eventKk: (versi, baris, id = randomUUID()) => ({
      topik: 'arkas.perencanaan.kk-disahkan',
      event: {
        specversion: '1.0', id, source: 'svc-perencanaan', type: 'KertasKerjaDisahkan', time: new Date().toISOString(),
        data: {
          kertasKerjaId: randomUUID(), npsn, tahun: TAHUN, sumberDanaKode: SD, versi,
          baris: baris.map((b) => ({ id: b.id, kodeRekening: b.kodeRekening, kegiatan: '05. Sarana', uraian: b.uraian, volume: 1,
            satuan: 'paket', hargaSatuan: b.total, total: b.total, asalBarisId: b.asalBarisId ?? null })),
        },
      },
    }),
    catat: async (body, k = randomUUID()) =>
      http.post(`/api/v1/sekolah/${npsn}/bku`).set(await auth('BENDAHARA', bendahara, npsn)).set('Idempotency-Key', k)
        .send({ tahun: TAHUN, sumberDanaKode: SD, tanggal: HARI_INI, ...body }),
    setujui: async (id, versi = 1) =>
      http.post(`/api/v1/transaksi/${id}/setujui`).set(await auth('KEPSEK', kepsek, npsn)).set('If-Match', `W/"${versi}"`).send({}),
    tolak: async (id, alasan, versi = 1) =>
      http.post(`/api/v1/transaksi/${id}/tolak`).set(await auth('KEPSEK', kepsek, npsn)).set('If-Match', `W/"${versi}"`).send({ alasan }),
    get: async (p, q = {}, peran = 'BENDAHARA') =>
      http.get(`/api/v1/sekolah/${npsn}${p}`).query({ tahun: TAHUN, sumberDanaKode: SD, ...q })
        .set(await auth(peran, peran === 'BENDAHARA' ? bendahara : kepsek, npsn)),
    tutup: async () => { await superDb.end(); await A.app.close(); },
  };
  return h;
}
