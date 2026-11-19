/** Konsumen ReferensiDiubah di svc-perencanaan: batas komponen, kode rekening, profil sekolah — dengan penjaga versi. */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { exportSPKI, generateKeyPair, KeyLike, SignJWT } from 'jose';
import { MemoryBroker } from '@arkas/common-ms';
import { Aplikasi, buatAplikasi } from '../dist/app';

const SANDI = { api: process.env.API_DB_PASSWORD ?? 'api_dev', worker: process.env.WORKER_DB_PASSWORD ?? 'worker_dev' };
const ADMIN = process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = 'db_perencanaan_uji_ref';
const NPSN = '20100001';
const TAHUN = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric' }).format(new Date()));
let A: Aplikasi; let http: ReturnType<typeof request>; let kunci: KeyLike; let broker: MemoryBroker;
let kk: { id: string; rowVersion: number };
const dbUrl = (u: string, p: string) => { const x = new URL(ADMIN); x.username = u; x.password = p; x.pathname = '/' + DB; return x.toString(); };
const op = async () => ({ Authorization: `Bearer ${await new SignJWT({ peran: 'OPERATOR', npsn: NPSN, direktorat: [] }).setProtectedHeader({ alg: 'RS256' })
  .setSubject(randomUUID()).setIssuer('arkas-identitas').setAudience('arkas-api').setIssuedAt().setExpirationTime('10m').sign(kunci)}` });
const ref = (entitas: string, kunci: string, versi: number, aktif: boolean, data: object) => broker.publish('arkas.ref.referensi-diubah', {
  specversion: '1.0', id: randomUUID(), source: 'svc-referensi', type: 'ReferensiDiubah', time: new Date().toISOString(), datacontenttype: 'application/json',
  data: { entitas, kunci, versi, aktif, data },
});
async function tambah(b: object) {
  const r = await http.post(`/api/v1/kertas-kerja/${kk.id}/baris`).set(await op()).set('If-Match', `W/"${kk.rowVersion}"`).send({ satuan: 'unit', ...b });
  if (r.status < 300) kk = r.body;
  return r;
}

beforeAll(async () => {
  execFileSync('node', [path.resolve(__dirname, '../../../scripts/migrate.mjs'), 'svc-perencanaan', '--seed', '--fresh'], {
    env: { ...process.env, DATABASE_ADMIN_URL: ADMIN, DB_NAME: DB, API_DB_PASSWORD: SANDI.api, WORKER_DB_PASSWORD: SANDI.worker }, stdio: 'pipe',
  });
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  kunci = privateKey;
  broker = new MemoryBroker();
  A = await buatAplikasi({
    port: 0, databaseUrl: dbUrl('api_perencanaan_login', SANDI.api), databaseWorkerUrl: dbUrl('worker_perencanaan_login', SANDI.worker), broker: 'memory', brokerBrokers: [],
    jwtPublicKey: await exportSPKI(publicKey), jwtIssuer: 'arkas-identitas', jwtAudience: 'arkas-api', devEvents: false, outboxIntervalMs: 100000, serviceName: 'svc-perencanaan',
  }, { broker, logger: false });
  await A.app.init();
  http = request(A.app.getHttpServer());
  kk = (await http.post(`/api/v1/sekolah/${NPSN}/kertas-kerja`).set(await op()).send({ tahun: TAHUN, sumberDanaKode: 'BOSP_REG' })).body;
});
afterAll(async () => { await A?.app.close(); });

describe('ReferensiDiubah -> svc-perencanaan', () => {
  it('kode rekening tak terdaftar ditolak; setelah event KODE_REKENING tiba, diterima', async () => {
    const baris = { komponenKode: '05', kodeRekening: '5.1.02.01.01.0099', uraian: 'Belanja cetak', volume: 1, hargaSatuan: 100_000 };
    expect((await tambah(baris)).body.kode).toBe('KODE_REKENING_TIDAK_DIKENAL');
    await ref('KODE_REKENING', '5.1.02.01.01.0099', 500, true, { kode: '5.1.02.01.01.0099', nama: 'Belanja Cetak' });
    expect((await tambah(baris)).status).toBe(201);
  });

  it('rekening dinonaktifkan tidak dapat dipakai baris baru; event lama tidak menghidupkannya kembali', async () => {
    await ref('KODE_REKENING', '5.1.02.01.01.0099', 501, false, { kode: '5.1.02.01.01.0099', nama: 'Belanja Cetak' });
    await ref('KODE_REKENING', '5.1.02.01.01.0099', 499, true, { kode: '5.1.02.01.01.0099', nama: 'Belanja Cetak' });
    expect((await tambah({ komponenKode: '05', kodeRekening: '5.1.02.01.01.0099', uraian: 'Cetak lagi', volume: 1, hargaSatuan: 1 })).body.kode).toBe('KODE_REKENING_TIDAK_DIKENAL');
  });

  it('batas komponen dari referensi dipakai validasi juknis; komponen nonaktif hilang dari pilihan', async () => {
    await tambah({ komponenKode: '12', kodeRekening: '5.1.02.02.01.0003', uraian: 'Honor narasumber', volume: 1, hargaSatuan: 3_000_000 });
    const sebelum = (await http.get(`/api/v1/kertas-kerja/${kk.id}`).set(await op())).body.validasi.komponen.find((k: { kode: string }) => k.kode === '12');
    expect(sebelum).toMatchObject({ maksPersen: 20, ok: true }); // 15,3% dari pagu 19,58 jt
    await ref('KOMPONEN', 'BOSP_REG:12', 600, true, { sumberDanaKode: 'BOSP_REG', kode: '12', nama: 'Pembayaran honor', maksPersen: 15, minPersen: null });
    const sesudah = (await http.get(`/api/v1/kertas-kerja/${kk.id}`).set(await op())).body.validasi.komponen.find((k: { kode: string }) => k.kode === '12');
    expect(sesudah).toMatchObject({ maksPersen: 15, ok: false });
    await ref('KOMPONEN', 'BOSP_REG:09', 601, false, { sumberDanaKode: 'BOSP_REG', kode: '09', nama: 'Penyediaan alat multimedia pembelajaran', maksPersen: null, minPersen: null });
    const komponen = (await http.get(`/api/v1/kertas-kerja/${kk.id}/komponen`).set(await op())).body.data.map((k: { kode: string }) => k.kode);
    expect(komponen).not.toContain('09');
  });

  it('profil sekolah diperbarui dari event SEKOLAH', async () => {
    await ref('SEKOLAH', NPSN, 700, true, { npsn: NPSN, nama: 'SMP Negeri 1 Contoh (nama baru)', jenjangKode: 'SMP', wilayahKode: '3201', statusSekolah: 'NEGERI' });
    expect((await http.get(`/api/v1/kertas-kerja/${kk.id}`).set(await op())).body.namaSekolah).toBe('SMP Negeri 1 Contoh (nama baru)');
  });
});
