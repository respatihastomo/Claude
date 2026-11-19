/** svc-bantuan: siklus sumber dana Bantuan Pemerintah (UC-21–29), impor Excel (SK-07), penyaluran (cek_penyaluran), pengajuan sekolah (UC-17/18). */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { exportSPKI, generateKeyPair, KeyLike, SignJWT } from 'jose';
import { Client } from 'pg';
import { CloudEvent, MemoryBroker } from '@arkas/common-ms';
import { SumberDanaDisahkanData, TOPIK } from '@arkas/kontrak';
import { Aplikasi, buatAplikasi } from '../dist/app';

const SANDI = { api: process.env.API_DB_PASSWORD ?? 'api_dev', worker: process.env.WORKER_DB_PASSWORD ?? 'worker_dev' };
const ADMIN = process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = 'db_banper_uji';
const HARI = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const TAHUN = Number(HARI.slice(0, 4));
let A: Aplikasi; let http: ReturnType<typeof request>; let kunci: KeyLike; let db: Client; let broker: MemoryBroker; let dir: string;
const url = (u?: string, p?: string) => { const x = new URL(ADMIN); if (u) { x.username = u; x.password = p!; } x.pathname = '/' + DB; return x.toString(); };
async function auth(peran: string, klaim: Record<string, unknown> = {}) {
  return { Authorization: `Bearer ${await new SignJWT({ peran, direktorat: [], ...klaim }).setProtectedHeader({ alg: 'RS256' }).setSubject(randomUUID())
    .setIssuer('arkas-identitas').setAudience('arkas-api').setIssuedAt().setExpirationTime('10m').sign(kunci)}` };
}
const direktorat = () => auth('ADMIN_DIREKTORAT', { direktorat: ['SMP'] });
const ditjen = () => auth('ADMIN_DITJEN', { ditjen: 'PAUDDIKDASMEN' });
const balai = () => auth('SUPER_ADMIN');
const PDF = Buffer.from('%PDF-1.4\n% uji\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF');
let versi = 1;
const ev = (data: object) => broker.publish(TOPIK.REFERENSI_DIUBAH, { specversion: '1.0', id: randomUUID(), source: 'svc-referensi', type: 'ReferensiDiubah', time: new Date().toISOString(), data: { versi: ++versi, aktif: true, ...data } } as CloudEvent);
async function xlsx(baris: Array<[string, number | string]>) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Penerima');
  ws.addRow(['NPSN', 'Nilai']); baris.forEach((b) => ws.addRow(b));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const unggah = async (p: string, isi: Buffer, jenis = 'application/pdf', h?: Record<string, string>) => http.post(p).set(h ?? await direktorat()).set('content-type', jenis).send(isi);
const KODE = 'BANPER_TIK_SMP';

beforeAll(async () => {
  execFileSync('node', [path.resolve(__dirname, '../../../scripts/migrate.mjs'), 'svc-bantuan', '--fresh'], {
    env: { ...process.env, DATABASE_ADMIN_URL: ADMIN, DB_NAME: DB, API_DB_PASSWORD: SANDI.api, WORKER_DB_PASSWORD: SANDI.worker }, stdio: 'pipe' });
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'banper-'));
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  kunci = privateKey;
  broker = new MemoryBroker();
  A = await buatAplikasi({
    port: 0, databaseUrl: url('api_banper_login', SANDI.api), databaseWorkerUrl: url('worker_banper_login', SANDI.worker), broker: 'memory', brokerBrokers: [],
    jwtPublicKey: await exportSPKI(publicKey), jwtIssuer: 'arkas-identitas', jwtAudience: 'arkas-api', devEvents: false, outboxIntervalMs: 100000,
    penyimpananDir: dir, imporIntervalMs: 100000, serviceName: 'svc-bantuan',
  }, { broker, logger: process.env.UJI_LOG ? undefined : false });
  await A.app.init();
  http = request(A.app.getHttpServer());
  db = new Client({ connectionString: url() }); await db.connect();
  await ev({ entitas: 'DIREKTORAT', kunci: 'SMP', data: { kode: 'SMP', nama: 'Direktorat SMP', ditjenKode: 'PAUDDIKDASMEN' } });
  await ev({ entitas: 'SEKOLAH', kunci: '20100001', data: { npsn: '20100001', nama: 'SMP Negeri Contoh 1', jenjangKode: 'SMP', wilayahKode: '3201' } });
  await ev({ entitas: 'SEKOLAH', kunci: '20100002', data: { npsn: '20100002', nama: 'SMP Swasta Contoh 2', jenjangKode: 'SMP', wilayahKode: '3202' } });
  await ev({ entitas: 'SEKOLAH', kunci: '20100003', data: { npsn: '20100003', nama: 'SD Negeri Contoh 3', jenjangKode: 'SD', wilayahKode: '3201' } });
});
afterAll(async () => { await db?.end(); await A?.app.close(); fs.rmSync(dir, { recursive: true, force: true }); });

describe('UC-23/21/22/29/25: menyusun sumber dana', () => {
  it('Admin Direktorat membuat draf; direktorat lain & peran lain ditolak', async () => {
    const isi = { kode: KODE, nama: 'Bantuan Peralatan TIK SMP', direktoratKode: 'SMP', tahun: TAHUN, jenjang: ['SMP'], pengajuanMulai: HARI, pengajuanSelesai: `${TAHUN}-12-31` };
    expect((await http.post('/api/v1/sumber-dana').set(await auth('ADMIN_DIREKTORAT', { direktorat: ['SD'] })).send(isi)).status).toBe(403);
    expect((await http.post('/api/v1/sumber-dana').set(await balai()).send(isi)).status).toBe(403);
    expect((await http.post('/api/v1/sumber-dana').set(await direktorat()).send(isi)).body).toEqual({ kode: KODE, status: 'DRAF' });
    expect((await http.post('/api/v1/sumber-dana').set(await direktorat()).send(isi)).status).toBe(409);
    expect((await http.get(`/api/v1/sumber-dana/${KODE}`).set(await auth('ADMIN_DIREKTORAT', { direktorat: ['SD'] }))).status).toBe(404); // RLS
  });

  it('dokumen: hanya PDF; juknis diputuskan Ditjen, panduan disahkan Direktorat setelah juknis disetujui', async () => {
    expect((await unggah(`/api/v1/sumber-dana/${KODE}/dokumen/JUKNIS?nama=juknis.pdf`, Buffer.from('bukan pdf'))).body.kode).toBe('JENIS_BERKAS_SALAH');
    const j = await unggah(`/api/v1/sumber-dana/${KODE}/dokumen/JUKNIS?nama=Juknis TIK 2026.pdf`, PDF);
    const p = await unggah(`/api/v1/sumber-dana/${KODE}/dokumen/PANDUAN?nama=panduan.pdf`, PDF);
    expect(j.status).toBe(201);
    expect((await http.post(`/api/v1/dokumen/${p.body.id}/keputusan`).set(await direktorat()).send({ setuju: true })).body.kode).toBe('JUKNIS_BELUM_DISETUJUI');
    expect((await http.post(`/api/v1/dokumen/${j.body.id}/keputusan`).set(await direktorat()).send({ setuju: true })).status).toBe(403);
    expect((await http.post(`/api/v1/dokumen/${j.body.id}/keputusan`).set(await ditjen()).send({ setuju: false })).body.kode).toBe('CATATAN_WAJIB');
    expect((await http.post(`/api/v1/dokumen/${j.body.id}/keputusan`).set(await ditjen()).send({ setuju: true })).body).toMatchObject({ status: 'DISETUJUI' });
    expect((await http.post(`/api/v1/dokumen/${p.body.id}/keputusan`).set(await direktorat()).send({ setuju: true })).body).toMatchObject({ status: 'DISAHKAN' });
    const u = await http.get(`/api/v1/dokumen/${j.body.id}/berkas`).set(await ditjen()).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(u.headers['content-disposition']).toContain('Juknis TIK 2026.pdf');
    expect(Buffer.compare(u.body, PDF)).toBe(0);
  });

  it('komponen & penerima: NPSN harus ada dan jenjangnya sasaran', async () => {
    expect((await http.put(`/api/v1/sumber-dana/${KODE}/komponen/01`).set(await direktorat()).send({ nama: 'Pengadaan laptop', maksPersen: 80 })).status).toBe(200);
    expect((await http.put(`/api/v1/sumber-dana/${KODE}/penerima/20100003`).set(await direktorat()).send({ nilai: 50_000_000 })).body.kode).toBe('PENERIMA_TIDAK_SAH');
    expect((await http.put(`/api/v1/sumber-dana/${KODE}/penerima/29999999`).set(await direktorat()).send({ nilai: 50_000_000 })).body.kode).toBe('PENERIMA_TIDAK_SAH');
    expect((await http.put(`/api/v1/sumber-dana/${KODE}/penerima/20100001`).set(await direktorat()).send({ nilai: 50_000_000 })).status).toBe(200);
  });

  it('SK-07 impor Excel: satu baris salah -> seluruh berkas ditolak dengan rincian; berkas benar -> diterapkan', async () => {
    const buruk = await unggah(`/api/v1/impor/penerima/${KODE}?nama=penerima.xlsx`, await xlsx([['20100002', 75_000_000], ['20100003', 10], ['123', 5], ['20100002', 1]]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(buruk.status).toBe(202);
    await A.impor.tick();
    const g = (await http.get(`/api/v1/impor/${buruk.body.id}`).set(await direktorat())).body;
    expect(g).toMatchObject({ status: 'GAGAL', jumlahOk: 0 });
    expect(g.galat.map((x: { baris: number }) => x.baris)).toEqual([3, 4, 5]);
    expect((await db.query(`SELECT count(*)::int n FROM banper.penerima WHERE sumber_dana_kode = $1`, [KODE])).rows[0].n).toBe(1);
    const baik = await unggah(`/api/v1/impor/penerima/${KODE}`, await xlsx([['20100002', '75.000.000'], ['20100001', 60_000_000]]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await A.impor.tick();
    expect((await http.get(`/api/v1/impor/${baik.body.id}`).set(await direktorat())).body).toMatchObject({ status: 'SELESAI', jumlahOk: 2 });
    const t = await http.get(`/api/v1/sumber-dana/${KODE}/penerima/templat`).set(await direktorat());
    expect(t.headers['content-type']).toContain('spreadsheetml');
  });
});

describe('UC-24/26: pengajuan ke Balai & pengesahan', () => {
  it('kembalikan dengan catatan -> perbaiki -> ajukan -> sahkan -> SumberDanaDisahkan; data terkunci', async () => {
    expect((await http.post(`/api/v1/sumber-dana/${KODE}/ajukan`).set(await direktorat())).body).toEqual({ kode: KODE, status: 'DIAJUKAN' });
    expect((await http.put(`/api/v1/sumber-dana/${KODE}/penerima/20100001`).set(await direktorat()).send({ nilai: 1 })).body.kode).toBe('SUMBER_DANA_TERKUNCI');
    expect((await http.post(`/api/v1/sumber-dana/${KODE}/kembalikan`).set(await balai()).send({ catatan: 'Nilai SMP Negeri Contoh 1 melebihi plafon' })).body.status).toBe('DIKEMBALIKAN');
    expect((await http.put(`/api/v1/sumber-dana/${KODE}/penerima/20100001`).set(await direktorat()).send({ nilai: 50_000_000 })).status).toBe(200);
    await http.post(`/api/v1/sumber-dana/${KODE}/ajukan`).set(await direktorat());
    expect((await http.post(`/api/v1/sumber-dana/${KODE}/sahkan`).set(await direktorat())).status).toBe(403);
    const s = await http.post(`/api/v1/sumber-dana/${KODE}/sahkan`).set(await balai());
    expect(s.body).toEqual({ kode: KODE, status: 'DISAHKAN', penerima: 2 });
    const sebelum = broker.terbit.length;
    while (await A.relay.tick()) { /* kuras */ }
    const e = broker.terbit.slice(sebelum).find((x) => x.event.type === 'SumberDanaDisahkan')!;
    expect(SumberDanaDisahkanData.parse(e.event.data)).toMatchObject({ kode: KODE, kategori: 'BANPER', direktoratKode: 'SMP', jenjang: ['SMP'],
      komponen: [{ kode: '01', maksPersen: 80 }], penerima: [{ npsn: '20100001', nilai: 50_000_000 }, { npsn: '20100002', nilai: 75_000_000 }] });
    expect((await http.post(`/api/v1/sumber-dana/${KODE}/kembalikan`).set(await balai()).send({ catatan: 'ulang' })).body.kode).toBe('STATUS_TIDAK_SESUAI');
  });
});

describe('UC-27/28: PKS bank & penyaluran (cek_penyaluran)', () => {
  it('tanpa PKS ditolak; bukan penerima ditolak; melebihi nilai ditolak; sah -> PenyaluranDicatat', async () => {
    const salur = async (b: object) => http.post(`/api/v1/sumber-dana/${KODE}/penyaluran`).set(await direktorat()).send({ tahap: 1, tanggal: HARI, bankKode: 'BRI', nomorReferensi: 'TRF-001', ...b });
    expect((await salur({ npsn: '20100001', nilai: 25_000_000 })).body.kode).toBe('PKS_BANK_BELUM_ADA');
    expect((await http.post(`/api/v1/sumber-dana/${KODE}/pks-bank`).set(await direktorat()).send({ bankKode: 'BRI', nomor: 'PKS/SMP/BRI/2026/01', tanggal: HARI })).status).toBe(201);
    expect((await salur({ npsn: '20100003', nilai: 1_000 })).body.kode).toBe('BUKAN_PENERIMA');
    expect((await salur({ npsn: '20100001', nilai: 50_000_001 })).body.kode).toBe('MELEBIHI_NILAI_BANTUAN');
    const r = await salur({ npsn: '20100001', nilai: 25_000_000 });
    expect(r.status).toBe(201);
    expect((await salur({ npsn: '20100001', nilai: 25_000_000, tahap: 2, nomorReferensi: 'TRF-002' })).status).toBe(201);
    expect((await salur({ npsn: '20100001', nilai: 1, tahap: 3, nomorReferensi: 'TRF-003' })).body.kode).toBe('MELEBIHI_NILAI_BANTUAN');
    const sebelum = broker.terbit.length;
    while (await A.relay.tick()) { /* kuras */ }
    expect(broker.terbit.slice(sebelum).filter((x) => x.event.type === 'PenyaluranDicatat').map((x) => (x.event.data as { nilai: number; tahap: number }).tahap)).toEqual([1, 2]);
    await expect(db.query(`UPDATE banper.penyaluran SET nilai = 1`)).rejects.toThrow(/PENYALURAN_FINAL/);
  });
});

describe('UC-17/18: pengajuan sekolah', () => {
  let id = '';
  it('sekolah penerima melihat bantuannya; sekolah lain tidak', async () => {
    const r = await http.get('/api/v1/sekolah/20100001/pengajuan-bantuan').set(await auth('KEPSEK', { npsn: '20100001' }));
    expect(r.body.data).toMatchObject([{ kode: KODE, nilai: 50_000_000, disalurkan: 50_000_000, dalamMasa: true, pengajuan: null }]);
    expect((await http.get('/api/v1/sekolah/20100003/pengajuan-bantuan').set(await auth('KEPSEK', { npsn: '20100003' }))).body.data).toEqual([]);
    expect((await http.get('/api/v1/sekolah/20100002/pengajuan-bantuan').set(await auth('KEPSEK', { npsn: '20100001' }))).status).toBe(403);
  });

  it('Operator mengunggah PKS/RAB/SPTJM, Kepala Sekolah mengajukan; satu pengajuan aktif', async () => {
    const op = await auth('OPERATOR', { npsn: '20100001' });
    const m = await http.post('/api/v1/pengajuan-bantuan').set(op).send({ sumberDanaKode: KODE });
    id = m.body.id;
    expect((await http.post('/api/v1/pengajuan-bantuan').set(op).send({ sumberDanaKode: KODE })).body).toEqual({ id, baru: false });
    const kepsek = await auth('KEPSEK', { npsn: '20100001' });
    expect((await http.post(`/api/v1/pengajuan-bantuan/${id}/ajukan`).set(kepsek)).body).toMatchObject({ kode: 'DOKUMEN_BELUM_LENGKAP', rincian: { kurang: ['PKS', 'RAB', 'SPTJM'] } });
    expect((await unggah(`/api/v1/pengajuan-bantuan/${id}/dokumen/RAB`, PDF, 'application/pdf', op)).body.kode).toBe('NILAI_RAB_WAJIB');
    expect((await unggah(`/api/v1/pengajuan-bantuan/${id}/dokumen/RAB?nilaiRab=60000000`, PDF, 'application/pdf', op)).body.kode).toBe('RAB_MELEBIHI_NILAI');
    for (const j of ['PKS', 'RAB', 'SPTJM']) expect((await unggah(`/api/v1/pengajuan-bantuan/${id}/dokumen/${j}?nilaiRab=49500000`, PDF, 'application/pdf', op)).status).toBe(201);
    expect((await http.post(`/api/v1/pengajuan-bantuan/${id}/ajukan`).set(op)).status).toBe(403);
    expect((await http.post(`/api/v1/pengajuan-bantuan/${id}/ajukan`).set(kepsek)).body).toEqual({ id, status: 'DIAJUKAN' });
    expect((await unggah(`/api/v1/pengajuan-bantuan/${id}/dokumen/PKS`, PDF, 'application/pdf', op)).body.kode).toBe('PENGAJUAN_TERKUNCI');
  });

  it('Tim Kerja direktoratnya memutuskan -> PengajuanSekolahDiputuskan; direktorat lain tidak melihat', async () => {
    const tk = await auth('TIM_KERJA', { direktorat: ['SMP'] });
    const d = await http.get(`/api/v1/sumber-dana/${KODE}/pengajuan`).set(tk);
    expect(d.body.data).toMatchObject([{ id, status: 'DIAJUKAN', nilaiRab: 49_500_000, dokumen: { PKS: { namaBerkas: 'pks.pdf' } } }]);
    expect(JSON.stringify(d.body)).not.toContain('kunci');
    expect((await http.get(`/api/v1/sumber-dana/${KODE}/pengajuan`).set(await auth('TIM_KERJA', { direktorat: ['SD'] }))).body.data).toEqual([]);
    expect((await http.post(`/api/v1/pengajuan-bantuan/${id}/keputusan`).set(tk).send({ keputusan: 'TOLAK' })).body.kode).toBe('CATATAN_WAJIB');
    expect((await http.post(`/api/v1/pengajuan-bantuan/${id}/keputusan`).set(tk).send({ keputusan: 'SETUJUI', catatan: 'Lengkap' })).body).toEqual({ id, status: 'DISETUJUI' });
    const sebelum = broker.terbit.length;
    while (await A.relay.tick()) { /* kuras */ }
    expect(broker.terbit.slice(sebelum).find((x) => x.event.type === 'PengajuanSekolahDiputuskan')?.event.data).toMatchObject({ pengajuanId: id, npsn: '20100001', status: 'DISETUJUI' });
  });
});
