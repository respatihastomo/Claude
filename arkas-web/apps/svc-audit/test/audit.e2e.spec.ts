/** svc-audit: audit stream dari trigger layanan lain -> rantai hash SHA-256, RLS UC-31, verifikasi & deteksi perusakan. */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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
const DB = 'db_audit_uji';
const DB_REF = 'db_ref_uji_audit';
const TAHUN = new Date().getFullYear();
let A: Aplikasi; let http: ReturnType<typeof request>; let kunci: KeyLike; let superDb: Client; let refDb: Client; let broker: MemoryBroker;
const url = (db: string, u?: string, p?: string) => { const x = new URL(ADMIN); if (u) { x.username = u; x.password = p!; } x.pathname = '/' + db; return x.toString(); };
const migrasi = (svc: string, db: string, seed = false) => execFileSync('node', [path.resolve(__dirname, '../../../scripts/migrate.mjs'), svc, '--fresh', ...(seed ? ['--seed'] : [])], {
  env: { ...process.env, DATABASE_ADMIN_URL: ADMIN, DB_NAME: db, API_DB_PASSWORD: SANDI.api, WORKER_DB_PASSWORD: SANDI.worker }, stdio: 'pipe',
});
async function auth(peran: string, klaim: Record<string, unknown> = {}) {
  return { Authorization: `Bearer ${await new SignJWT({ peran, direktorat: [], ...klaim }).setProtectedHeader({ alg: 'RS256' }).setSubject(randomUUID())
    .setIssuer('arkas-identitas').setAudience('arkas-api').setIssuedAt().setExpirationTime('10m').sign(kunci)}` };
}
const auditor = () => auth('AUDITOR');
const kepsek = (npsn = '20100001') => auth('KEPSEK', { npsn });

/** Meniru Outbox Relay svc-referensi: ambil AuditDicatat dari outbox db_ref dan terbitkan ke broker svc-audit. */
async function alirkanDariReferensi(): Promise<CloudEvent[]> {
  const { rows } = await refDb.query(`UPDATE ref.outbox SET status = 'TERKIRIM' WHERE status = 'MENUNGGU' AND tipe = 'AuditDicatat'
    RETURNING id, event_id, tipe, agregat_id, payload, dibuat_at`);
  rows.sort((a, b) => Number(a.id) - Number(b.id));
  const ev = rows.map((r): CloudEvent => ({ specversion: '1.0', id: r.event_id, source: 'svc-referensi', type: r.tipe, subject: r.agregat_id,
    time: r.dibuat_at.toISOString(), datacontenttype: 'application/json', data: r.payload }));
  for (const e of ev) await broker.publish(TOPIK.AUDIT_DICATAT, e);
  return ev;
}
function eventSintetis(npsn: string | null, ubah: Partial<Record<string, unknown>> = {}): CloudEvent {
  return { specversion: '1.0', id: randomUUID(), source: 'svc-penatausahaan', type: 'AuditDicatat', time: new Date().toISOString(), datacontenttype: 'application/json',
    data: { tabel: 'transaksi', aksi: 'UPDATE', kunci: randomUUID(), npsn, pelakuId: randomUUID(), peran: 'KEPSEK', ip: '10.0.0.7', requestId: null, alasan: null,
      sebelum: { status: 'DIAJUKAN', nilai: 150000.5 }, sesudah: { status: 'DISETUJUI', nilai: 150000.5 }, terjadiAt: new Date().toISOString(), ...ubah } };
}

beforeAll(async () => {
  migrasi('svc-audit', DB);
  migrasi('svc-referensi', DB_REF, true);
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  kunci = privateKey;
  broker = new MemoryBroker();
  A = await buatAplikasi({
    port: 0, databaseUrl: url(DB, 'api_audit_login', SANDI.api), databaseWorkerUrl: url(DB, 'worker_audit_login', SANDI.worker), broker: 'memory', brokerBrokers: [],
    jwtPublicKey: await exportSPKI(publicKey), jwtIssuer: 'arkas-identitas', jwtAudience: 'arkas-api', devEvents: false, outboxIntervalMs: 100000, serviceName: 'svc-audit',
  }, { broker, logger: process.env.UJI_LOG ? undefined : false });
  await A.app.init();
  http = request(A.app.getHttpServer());
  superDb = new Client({ connectionString: url(DB) }); await superDb.connect();
  refDb = new Client({ connectionString: url(DB_REF) }); await refDb.connect();
  await refDb.query(`UPDATE ref.outbox SET status = 'TERKIRIM' WHERE tipe = 'AuditDicatat'`); // abaikan jejak data contoh
});
afterAll(async () => { await superDb?.end(); await refDb?.end(); await A?.app.close(); });

describe('audit stream dari trigger layanan', () => {
  it('perubahan Balai di db_ref tercatat dengan pelaku, peran, IP, alasan, sebelum & sesudah', async () => {
    const pelaku = randomUUID();
    await refDb.query('BEGIN');
    await refDb.query(`SELECT set_config('app.pengguna_id', $1, true), set_config('app.peran', 'SUPER_ADMIN', true), set_config('app.ip', '10.1.2.3', true),
      set_config('app.alasan', 'Juknis 2026 revisi', true)`, [pelaku]);
    await refDb.query(`UPDATE ref.komponen SET maks_persen = 25 WHERE sumber_dana_kode = 'BOSP_REG' AND kode = '12'`);
    await refDb.query(`UPDATE ref.satuan_pendidikan SET nama = 'SMP Negeri Contoh 1 Kota' WHERE npsn = '20100001'`);
    await refDb.query('COMMIT');
    const ev = await alirkanDariReferensi();
    expect(ev.length).toBeGreaterThanOrEqual(2);

    const r = await http.get('/api/v1/audit/jejak').query({ tahun: TAHUN, layanan: 'svc-referensi', tabel: 'komponen', pelakuId: pelaku }).set(await auditor());
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0]).toMatchObject({
      rantai: 'NASIONAL', aksi: 'UPDATE', kunci: 'BOSP_REG:12', peran: 'SUPER_ADMIN', ip: '10.1.2.3', alasan: 'Juknis 2026 revisi',
      sebelum: { maks_persen: 20 }, sesudah: { maks_persen: 25 },
    });
    // baris sekolah masuk rantai sekolahnya sendiri
    const s = await http.get('/api/v1/audit/jejak').query({ tahun: TAHUN, rantai: '20100001', tabel: 'satuan_pendidikan' }).set(await auditor());
    expect(s.body.data[0]).toMatchObject({ npsn: '20100001', kunci: '20100001', sesudah: { nama: 'SMP Negeri Contoh 1 Kota' } });
  });

  it('event duplikat tidak menambah entri (inbox idempoten); urutan & tautan hash bersambung', async () => {
    const e = eventSintetis('20100001');
    await broker.publish(TOPIK.AUDIT_DICATAT, e);
    await broker.publish(TOPIK.AUDIT_DICATAT, e);
    expect((await superDb.query('SELECT count(*)::int n FROM audit.jejak WHERE event_id = $1', [e.id])).rows[0].n).toBe(1);
    const { rows } = await superDb.query(`SELECT urutan, hash, hash_sebelum FROM audit.jejak WHERE tahun = $1 AND rantai = '20100001' ORDER BY urutan`, [TAHUN]);
    expect(rows.map((x) => Number(x.urutan))).toEqual(rows.map((_, i) => i + 1));
    rows.forEach((x, i) => expect(x.hash_sebelum).toBe(i === 0 ? '0'.repeat(64) : rows[i - 1].hash));
  });

  it('pesan tidak sah ditolak (dead letter), bukan dicatat', async () => {
    const mati = broker.mati.length;
    await broker.publish(TOPIK.AUDIT_DICATAT, { ...eventSintetis('20100001'), source: 'penyusup' });
    await broker.publish(TOPIK.AUDIT_DICATAT, eventSintetis('2010'));
    expect(broker.mati.length).toBe(mati + 2);
  });
});

describe('UC-31 hak akses', () => {
  it('Kepala Sekolah hanya melihat rantai sekolahnya; peran lain ditolak', async () => {
    await broker.publish(TOPIK.AUDIT_DICATAT, eventSintetis('20100002'));
    const k = await http.get('/api/v1/audit/jejak').query({ tahun: TAHUN }).set(await kepsek());
    expect(k.status).toBe(200);
    expect(new Set(k.body.data.map((x: { rantai: string }) => x.rantai))).toEqual(new Set(['20100001']));
    expect((await http.get('/api/v1/audit/jejak').query({ rantai: '20100002' }).set(await kepsek())).status).toBe(403);
    expect((await http.get('/api/v1/audit/rantai').query({ tahun: TAHUN }).set(await kepsek())).body.data.map((x: { rantai: string }) => x.rantai)).toEqual(['20100001']);
    expect((await http.get('/api/v1/audit/jejak').set(await auth('BENDAHARA', { npsn: '20100001' }))).status).toBe(403);
    expect((await http.get('/api/v1/audit/jejak').set(await auth('ADMIN_DINAS', { wilayah: '3201' }))).status).toBe(403);
    expect((await http.get('/api/v1/audit/jejak')).status).toBe(401);
    const a = await http.get('/api/v1/audit/rantai').query({ tahun: TAHUN }).set(await auditor());
    expect(a.body.data.map((x: { rantai: string }) => x.rantai)).toEqual(['NASIONAL', '20100001', '20100002']);
  });
});

describe('verifikasi rantai hash', () => {
  it('rantai utuh; perubahan isi oleh DBA terdeteksi; jejak tidak bisa diubah lewat jalur biasa', async () => {
    const v = await http.get('/api/v1/audit/verifikasi').query({ tahun: TAHUN }).set(await auditor());
    expect(v.body.utuh).toBe(true);
    expect(v.body.data.map((x: { rantai: string }) => x.rantai).sort()).toEqual(['20100001', '20100002', 'NASIONAL']);

    await expect(superDb.query(`UPDATE audit.jejak SET alasan = 'x' WHERE rantai = '20100002'`)).rejects.toThrow(/JEJAK_APPEND_ONLY/);
    await expect(superDb.query(`DELETE FROM audit.jejak WHERE rantai = '20100002'`)).rejects.toThrow(/JEJAK_APPEND_ONLY/);

    // perusak dengan hak DBA mematikan trigger lalu mengubah nilai
    await superDb.query('ALTER TABLE audit.jejak DISABLE TRIGGER trg_append_only');
    await superDb.query(`UPDATE audit.jejak SET sesudah = jsonb_set(sesudah, '{nilai}', '1') WHERE tahun = $1 AND rantai = '20100001' AND urutan = 1`, [TAHUN]);
    await superDb.query('ALTER TABLE audit.jejak ENABLE TRIGGER trg_append_only');
    const rusak = await http.get('/api/v1/audit/verifikasi').query({ tahun: TAHUN, rantai: '20100001' }).set(await kepsek());
    expect(rusak.body).toMatchObject({ utuh: false, data: [{ rantai: '20100001', rusak: { urutan: 1, alasan: 'ISI_BERUBAH' } }] });
    // rantai lain tetap utuh (rantai per NPSN)
    expect((await http.get('/api/v1/audit/verifikasi').query({ tahun: TAHUN, rantai: '20100002' }).set(await auditor())).body.utuh).toBe(true);
  });
});
