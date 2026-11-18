/** svc-perencanaan: aktifkan -> susun -> validasi -> ajukan -> telaah -> sahkan -> perubahan, terhadap PostgreSQL sungguhan. */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { exportSPKI, generateKeyPair, KeyLike, SignJWT } from 'jose';
import { Client } from 'pg';
import { MemoryBroker } from '@arkas/common-ms';
import { KertasKerjaDisahkanData } from '@arkas/kontrak';
import { Aplikasi, buatAplikasi } from '../dist/app';

/** Role login berlaku untuk seluruh klaster: uji memakai kata sandi yang sama dengan dev. */
const SANDI = { api: process.env.API_DB_PASSWORD ?? 'api_dev', worker: process.env.WORKER_DB_PASSWORD ?? 'worker_dev' };
const ADMIN = process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = 'db_perencanaan_uji';
const TOKEN = 'token-internal-uji-0123456789';
const NPSN = '20100001';
const TAHUN = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric' }).format(new Date()));
const U = { operator: randomUUID(), kepsek: randomUUID(), verif: randomUUID(), verifLain: randomUUID() };

let A: Aplikasi; let http: ReturnType<typeof request>; let kunci: KeyLike; let superDb: Client; let broker: MemoryBroker;
let kkId = ''; let rv = 0;
const id: Record<string, string> = {};

const dbUrl = (u: string, p: string) => { const x = new URL(ADMIN); x.username = u; x.password = p; x.pathname = '/' + DB; return x.toString(); };
async function auth(peran: string, sub: string, klaim: Record<string, unknown> = { npsn: NPSN }) {
  return { Authorization: `Bearer ${await new SignJWT({ peran, direktorat: [], ...klaim }).setProtectedHeader({ alg: 'RS256' }).setSubject(sub)
    .setIssuer('arkas-identitas').setAudience('arkas-api').setIssuedAt().setExpirationTime('10m').sign(kunci)}` };
}
const op = () => auth('OPERATOR', U.operator);
const ks = () => auth('KEPSEK', U.kepsek);
const vf = (wilayah = '3201', sub = U.verif) => auth('VERIFIKATOR_DINAS', sub, { wilayah });
const baris = (komponenKode: string, kodeRekening: string, uraian: string, volume: number, hargaSatuan: number, x: object = {}) =>
  ({ komponenKode, kodeRekening, uraian, volume, satuan: 'unit', hargaSatuan, ...x });
async function tambah(b: object, versi = rv) {
  const r = await http.post(`/api/v1/kertas-kerja/${kkId}/baris`).set(await op()).set('If-Match', `W/"${versi}"`).send(b);
  if (r.status < 300) rv = r.body.rowVersion;
  return r;
}
async function aksi(path: string, h: Record<string, string>, body: object = {}) {
  const r = await http.post(`/api/v1/kertas-kerja/${kkId}/${path}`).set(h).set('If-Match', `W/"${rv}"`).send(body);
  if (r.status < 300) rv = r.body.rowVersion;
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
    port: 0, databaseUrl: dbUrl('api_perencanaan_login', SANDI.api), databaseWorkerUrl: dbUrl('worker_perencanaan_login', SANDI.worker),
    broker: 'memory', brokerBrokers: [], jwtPublicKey: await exportSPKI(publicKey), jwtIssuer: 'arkas-identitas', jwtAudience: 'arkas-api',
    devEvents: true, internalEventsToken: TOKEN, outboxIntervalMs: 100000, serviceName: 'svc-perencanaan',
  }, { broker, logger: process.env.UJI_LOG ? undefined : false });
  await A.app.init();
  http = request(A.app.getHttpServer());
  superDb = new Client({ connectionString: (() => { const u = new URL(ADMIN); u.pathname = '/' + DB; return u.toString(); })() });
  await superDb.connect();
});
afterAll(async () => { await superDb?.end(); await A?.app.close(); });

describe('UC-03/04 aktifkan & susun', () => {
  it('pagu terbaca; hanya penyusun yang mengaktifkan; aktifkan ulang mengembalikan versi terbuka', async () => {
    expect((await http.get(`/api/v1/sekolah/${NPSN}/pagu`).query({ tahun: TAHUN, sumberDanaKode: 'BOSP_REG' }).set(await ks())).body.nilai).toBe(19_580_000);
    expect((await http.post(`/api/v1/sekolah/${NPSN}/kertas-kerja`).set(await ks()).send({ tahun: TAHUN, sumberDanaKode: 'BOSP_REG' })).status).toBe(403);
    const r = await http.post(`/api/v1/sekolah/${NPSN}/kertas-kerja`).set(await op()).send({ tahun: TAHUN, sumberDanaKode: 'BOSP_REG' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ versi: 1, status: 'DRAF', namaSekolah: 'SMP Negeri Contoh 1', validasi: { pagu: 19_580_000, totalAnggaran: 0, valid: false } });
    kkId = r.body.id; rv = r.body.rowVersion;
    const lagi = await http.post(`/api/v1/sekolah/${NPSN}/kertas-kerja`).set(await op()).send({ tahun: TAHUN, sumberDanaKode: 'BOSP_REG' });
    expect([lagi.status, lagi.body.id]).toEqual([200, kkId]);
    const tanpaPagu = await http.post(`/api/v1/sekolah/${NPSN}/kertas-kerja`).set(await op()).send({ tahun: TAHUN + 1, sumberDanaKode: 'BOSP_REG' });
    expect(tanpaPagu.body.kode).toBe('PAGU_BELUM_DITETAPKAN');
  });

  it('tambah baris: If-Match, komponen, jadwal kas; validasi berjalan langsung', async () => {
    expect((await tambah(baris('03', '5.1.02.01.01.0024', 'Kertas HVS A4 & ATK', 40, 55_500), rv + 9)).status).toBe(412);
    expect((await tambah(baris('99', '5.1.02.01.01.0024', 'Uji komponen', 1, 1))).body.kode).toBe('KOMPONEN_TIDAK_DIKENAL');
    expect((await tambah(baris('03', '5.1.02.01.01.0024', 'Uji jadwal', 1, 1200, { jadwal: [100, ...Array(11).fill(0)] }))).body.kode).toBe('JADWAL_KAS_TIDAK_SESUAI');
    expect((await tambah(baris('03', '5.1', 'Uji rekening', 1, 1))).status).toBe(400);

    const r = await tambah(baris('03', '5.1.02.01.01.0024', 'Kertas HVS A4 & ATK', 40, 55_500));
    expect(r.status).toBe(201);
    id.atk = r.body.baris[0].id;
    expect(r.body.baris[0]).toMatchObject({ kegiatan: '03. Kegiatan pembelajaran dan ekstrakurikuler', total: 2_220_000 });
    expect(r.body.baris[0].jadwal.reduce((s: number, x: number) => s + x, 0)).toBeCloseTo(2_220_000, 2);
    expect(r.body.validasi.galat.map((g: { kode: string }) => g.kode)).toEqual(['SISA_PAGU']);
    for (const b of [
      baris('08', '5.1.02.02.01.0013', 'Servis printer dan komputer lab', 4, 350_000),
      baris('08', '5.1.02.02.01.0026', 'Jasa kebersihan (CV)', 6, 1_110_000),
      baris('04', '5.1.02.01.01.0052', 'Makan minum rapat penilaian', 60, 35_000),
      baris('12', '5.1.02.02.01.0003', 'Honor narasumber IHT', 2, 2_000_000),
      baris('07', '5.1.02.02.01.0061', 'Langganan daya dan jasa internet', 8, 400_000),
    ]) expect((await tambah(b)).status).toBe(201);
  });

  it('trigger cek_pagu menolak total di atas pagu', async () => {
    const r = await tambah(baris('03', '5.1.02.01.01.0024', 'Tambahan', 1, 1));
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'PAGU_TERLAMPAUI', rincian: { pagu: 19_580_000 } });
  });
});

describe('UC-05/06 validasi & ajukan', () => {
  it('honor 20,43% melebihi batas 20%: pengajuan ditolak dengan rincian galat', async () => {
    const d = (await http.get(`/api/v1/kertas-kerja/${kkId}`).set(await ks())).body;
    expect(d.validasi).toMatchObject({ totalAnggaran: 19_580_000, sisaPagu: 0, valid: false });
    expect(d.validasi.komponen.find((k: { kode: string }) => k.kode === '12')).toMatchObject({ persen: 20.43, maksPersen: 20, ok: false });
    const r = await aksi('ajukan', await ks());
    expect(r.status).toBe(422);
    expect(r.body.kode).toBe('VALIDASI_KERTAS_KERJA');
    expect(r.body.rincian.galat.map((g: { kode: string }) => g.kode)).toEqual(['KOMPONEN_MELEBIHI_BATAS']);
  });

  it('perbaiki baris (PUT), lalu Kepala Sekolah mengajukan; KertasKerjaDiajukan terbit', async () => {
    const d = (await http.get(`/api/v1/kertas-kerja/${kkId}`).set(await op())).body;
    const honor = d.baris.find((b: { komponenKode: string }) => b.komponenKode === '12');
    const internet = d.baris.find((b: { komponenKode: string }) => b.komponenKode === '07');
    let r = await http.put(`/api/v1/kertas-kerja/${kkId}/baris/${honor.id}`).set(await op()).set('If-Match', `W/"${rv}"`)
      .send(baris('12', '5.1.02.02.01.0003', 'Honor narasumber IHT', 2, 1_800_000));
    expect(r.status).toBe(200); rv = r.body.rowVersion;
    r = await http.put(`/api/v1/kertas-kerja/${kkId}/baris/${internet.id}`).set(await op()).set('If-Match', `W/"${rv}"`)
      .send(baris('07', '5.1.02.02.01.0061', 'Langganan daya dan jasa internet', 8, 450_000));
    expect(r.body.validasi).toMatchObject({ valid: true, totalAnggaran: 19_580_000 }); rv = r.body.rowVersion;

    expect((await aksi('ajukan', await op())).status).toBe(403);
    const a = await aksi('ajukan', await ks());
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ status: 'DIAJUKAN', diajukanOleh: U.kepsek });
    const sebelum = broker.terbit.length;
    await A.relay.tick();
    expect(broker.terbit.slice(sebelum).map((e) => e.event.type)).toEqual(['KertasKerjaDiajukan']);
  });

  it('kertas kerja DIAJUKAN terkunci', async () => {
    expect((await tambah(baris('03', '5.1.02.01.01.0024', 'Uji komponen', 1, 1))).body.kode).toBe('KERTAS_KERJA_TERKUNCI');
  });
});

describe('UC-07 penelaahan Dinas', () => {
  it('cakupan wilayah: Verifikator wilayah lain tidak melihat', async () => {
    expect((await http.get('/api/v1/penelaahan').set(await vf('3202', U.verifLain))).body.data).toEqual([]);
    expect((await http.get(`/api/v1/kertas-kerja/${kkId}`).set(await vf('3202', U.verifLain))).status).toBe(404);
    expect((await http.get('/api/v1/penelaahan').set(await vf())).body.data.map((k: { id: string }) => k.id)).toEqual([kkId]);
    expect((await http.get('/api/v1/penelaahan').set(await ks())).status).toBe(403);
  });

  it('catatan & kembalikan; sekolah memperbaiki dan mengajukan ulang', async () => {
    const c = await http.post(`/api/v1/kertas-kerja/${kkId}/catatan`).set(await vf()).send({ barisId: id.atk, catatan: 'Rincikan spesifikasi kertas' });
    expect(c.body.catatan).toEqual([expect.objectContaining({ barisId: id.atk, peran: 'VERIFIKATOR_DINAS' })]);
    const k = await aksi('kembalikan', await vf(), { alasan: 'Lengkapi rincian ATK' });
    expect(k.body).toMatchObject({ status: 'DRAF', catatanKembali: 'Lengkapi rincian ATK', diajukanOleh: null });
    const u = await http.put(`/api/v1/kertas-kerja/${kkId}/baris/${id.atk}`).set(await op()).set('If-Match', `W/"${rv}"`)
      .send(baris('03', '5.1.02.01.01.0024', 'Kertas HVS A4 80 gsm & ATK', 40, 55_500));
    rv = u.body.rowVersion;
    expect((await aksi('ajukan', await ks())).body.status).toBe('DIAJUKAN');
  });

  it('pengesahan: hanya penelaah; KertasKerjaDisahkan memenuhi kontrak svc-penatausahaan', async () => {
    expect((await aksi('sahkan', await ks())).status).toBe(403);
    const r = await aksi('sahkan', await vf(), { catatan: 'Sesuai juknis' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'DISAHKAN', disahkanOleh: U.verif });
    expect(r.body.riwayat.map((x: { aksi: string }) => x.aksi)).toEqual(['AJUKAN', 'KEMBALIKAN', 'AJUKAN', 'SAHKAN']);
    const sebelum = broker.terbit.length;
    await A.relay.tick();
    const ev = broker.terbit.slice(sebelum).find((e) => e.event.type === 'KertasKerjaDisahkan')!;
    expect(ev.topik).toBe('arkas.perencanaan.kk-disahkan');
    const data = KertasKerjaDisahkanData.parse(ev.event.data); // uji kontrak konsumen svc-penatausahaan
    expect(data).toMatchObject({ kertasKerjaId: kkId, npsn: NPSN, versi: 1 });
    expect(data.baris).toHaveLength(6);
    expect(data.baris.reduce((s, b) => s + b.total, 0)).toBe(19_580_000);
    expect((await http.post(`/api/v1/sekolah/${NPSN}/kertas-kerja`).set(await op()).send({ tahun: TAHUN, sumberDanaKode: 'BOSP_REG' })).body.kode).toBe('SUDAH_DISAHKAN');
  });
});

describe('UC-09 pergeseran dengan realisasi', () => {
  let v2 = '';
  it('realisasi dari TransaksiDisetujui membatasi pergeseran', async () => {
    const ev = { topik: 'arkas.tatausaha.transaksi-disetujui', event: { specversion: '1.0', id: randomUUID(), source: 'svc-penatausahaan', type: 'TransaksiDisetujui',
      time: new Date().toISOString(), data: { transaksiId: randomUUID(), jenis: 'BELANJA', items: [{ barisId: id.atk, kodeRekening: '5.1.02.01.01.0024', jumlah: 1_110_000 }] } } };
    expect((await http.post('/internal/v1/events').set('X-Internal-Token', TOKEN).send(ev)).status).toBe(202);
    expect((await http.post('/internal/v1/events').set('X-Internal-Token', TOKEN).send(ev)).status).toBe(202); // ganda: sekali saja

    const r = await http.post(`/api/v1/sekolah/${NPSN}/kertas-kerja/perubahan`).set(await op()).send({ tahun: TAHUN, sumberDanaKode: 'BOSP_REG' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ versi: 2, status: 'DRAF', asalKertasKerjaId: kkId });
    v2 = r.body.id; kkId = v2; rv = r.body.rowVersion;
    const atk2 = r.body.baris.find((b: { asalBarisId: string }) => b.asalBarisId === id.atk);
    expect(atk2.realisasi).toBe(1_110_000);
    id.atk2 = atk2.id;

    const turun = await http.put(`/api/v1/kertas-kerja/${v2}/baris/${atk2.id}`).set(await op()).set('If-Match', `W/"${rv}"`)
      .send(baris('03', '5.1.02.01.01.0024', 'Kertas HVS A4 80 gsm & ATK', 10, 55_500));
    expect(turun.body.kode).toBe('DI_BAWAH_REALISASI');
    const hapus = await http.delete(`/api/v1/kertas-kerja/${v2}/baris/${atk2.id}`).set(await op()).set('If-Match', `W/"${rv}"`);
    expect(hapus.body.kode).toBe('BARIS_SUDAH_DIREALISASIKAN');
  });

  it('pergeseran sah disahkan: versi lama DIGANTI, event membawa asalBarisId', async () => {
    const d = (await http.get(`/api/v1/kertas-kerja/${kkId}`).set(await op())).body;
    const atk = d.baris.find((b: { id: string }) => b.id === id.atk2);
    const mamin = d.baris.find((b: { komponenKode: string }) => b.komponenKode === '04');
    let r = await http.put(`/api/v1/kertas-kerja/${kkId}/baris/${mamin.id}`).set(await op()).set('If-Match', `W/"${rv}"`)
      .send(baris('04', '5.1.02.01.01.0052', 'Makan minum rapat penilaian', 40, 35_000));
    rv = r.body.rowVersion;
    r = await http.put(`/api/v1/kertas-kerja/${kkId}/baris/${atk.id}`).set(await op()).set('If-Match', `W/"${rv}"`)
      .send(baris('03', '5.1.02.01.01.0024', 'Kertas HVS A4 80 gsm & ATK', 52, 55_500, { satuan: 'rim' }));
    expect(r.status).toBe(200); rv = r.body.rowVersion;
    // ATK +666.000, mamin -700.000 -> sisa 34.000; tambah baris kecil agar seimbang
    r = await tambah(baris('05', '5.1.02.01.01.0025', 'Materai', 2, 17_000));
    expect(r.body.validasi).toMatchObject({ valid: true });
    expect((await aksi('ajukan', await ks())).status).toBe(200);
    expect((await aksi('sahkan', await vf())).body.status).toBe('DISAHKAN');

    const daftar = (await http.get(`/api/v1/sekolah/${NPSN}/kertas-kerja`).query({ tahun: TAHUN, sumberDanaKode: 'BOSP_REG' }).set(await op())).body.data;
    expect(daftar.map((k: { versi: number; status: string }) => [k.versi, k.status])).toEqual([[2, 'DISAHKAN'], [1, 'DIGANTI']]);
    const sebelum = broker.terbit.length;
    await A.relay.tick();
    const data = KertasKerjaDisahkanData.parse(broker.terbit.slice(sebelum).find((e) => e.event.type === 'KertasKerjaDisahkan')!.event.data);
    expect(data.versi).toBe(2);
    expect(data.baris.find((b) => b.id === id.atk2)).toMatchObject({ asalBarisId: id.atk, total: 2_886_000 });
    expect(data.baris.filter((b) => b.asalBarisId === null)).toHaveLength(1); // hanya materai yang baru
  });

  it('kertas kerja DISAHKAN tidak dapat diubah atau dihapus, bahkan oleh superuser', async () => {
    await expect(superDb.query(`UPDATE perencanaan.baris_kertas_kerja SET uraian = 'x' WHERE id = $1`, [id.atk2])).rejects.toMatchObject({ message: 'KERTAS_KERJA_TERKUNCI' });
    await expect(superDb.query(`DELETE FROM perencanaan.kertas_kerja WHERE id = $1`, [kkId])).rejects.toMatchObject({ message: 'HAPUS_DILARANG' });
    await expect(superDb.query(`UPDATE perencanaan.kertas_kerja SET status = 'DRAF' WHERE id = $1`, [kkId])).rejects.toMatchObject({ message: 'TRANSISI_TIDAK_SAH' });
  });
});
