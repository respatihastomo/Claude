/** svc-pemantauan: HPP asinkron (SK-11) dari rencana & belanja Mitra, dasbor serapan/kepatuhan berjenjang (UC-30), cakupan peran. */
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
import { bulanWajibTutup } from '../dist/dasbor/dasbor.service';

const SANDI = { api: process.env.API_DB_PASSWORD ?? 'api_dev', worker: process.env.WORKER_DB_PASSWORD ?? 'worker_dev' };
const ADMIN = process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = 'db_pemantauan_uji';
const TAHUN = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric' }).format(new Date()));
const WAJIB = bulanWajibTutup(TAHUN);
let A: Aplikasi; let http: ReturnType<typeof request>; let kunci: KeyLike; let db: Client; let broker: MemoryBroker;
const url = (u?: string, p?: string) => { const x = new URL(ADMIN); if (u) { x.username = u; x.password = p!; } x.pathname = '/' + DB; return x.toString(); };
async function auth(peran: string, klaim: Record<string, unknown> = {}) {
  return { Authorization: `Bearer ${await new SignJWT({ peran, direktorat: [], ...klaim }).setProtectedHeader({ alg: 'RS256' }).setSubject(randomUUID())
    .setIssuer('arkas-identitas').setAudience('arkas-api').setIssuedAt().setExpirationTime('10m').sign(kunci)}` };
}
let versi = 100;
const ev = (topik: string, type: string, data: unknown) => broker.publish(topik, { specversion: '1.0', id: randomUUID(), source: 'svc-uji', type, time: new Date().toISOString(), datacontenttype: 'application/json', data } as CloudEvent);
const ref = (entitas: string, kunciRef: string, data: object) => ev(TOPIK.REFERENSI_DIUBAH, 'ReferensiDiubah', { entitas, kunci: kunciRef, versi: ++versi, aktif: true, data });
const B = { atk: randomUUID(), servis: randomUUID(), konsumsi: randomUUID(), b2: randomUUID() };
const TRX = randomUUID();
const q = { tahun: TAHUN, sumberDanaKode: 'BOSP_REG' };

beforeAll(async () => {
  execFileSync('node', [path.resolve(__dirname, '../../../scripts/migrate.mjs'), 'svc-pemantauan', '--fresh'], {
    env: { ...process.env, DATABASE_ADMIN_URL: ADMIN, DB_NAME: DB, API_DB_PASSWORD: SANDI.api, WORKER_DB_PASSWORD: SANDI.worker }, stdio: 'pipe' });
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  kunci = privateKey;
  broker = new MemoryBroker();
  A = await buatAplikasi({
    port: 0, databaseUrl: url('api_pemantauan_login', SANDI.api), databaseWorkerUrl: url('worker_pemantauan_login', SANDI.worker), broker: 'memory', brokerBrokers: [],
    jwtPublicKey: await exportSPKI(publicKey), jwtIssuer: 'arkas-identitas', jwtAudience: 'arkas-api', devEvents: false, outboxIntervalMs: 100000, hppIntervalMs: 100000, serviceName: 'svc-pemantauan',
  }, { broker, logger: process.env.UJI_LOG ? undefined : false });
  await A.app.init();
  http = request(A.app.getHttpServer());
  db = new Client({ connectionString: url() }); await db.connect();

  await ref('WILAYAH', '32', { kode: '32', nama: 'Provinsi Contoh A', indukKode: null });
  await ref('WILAYAH', '3201', { kode: '3201', nama: 'Kabupaten Contoh 1', indukKode: '32' });
  await ref('WILAYAH', '3202', { kode: '3202', nama: 'Kabupaten Contoh 2', indukKode: '32' });
  await ref('SEKOLAH', '20100001', { npsn: '20100001', nama: 'SMP Negeri Contoh 1', jenjangKode: 'SMP', wilayahKode: '3201' });
  await ref('SEKOLAH', '20100002', { npsn: '20100002', nama: 'SMP Swasta Contoh 2', jenjangKode: 'SMP', wilayahKode: '3202' });
  const kk = (npsn: string, baris: object[]) => ev(TOPIK.KERTAS_KERJA_DISAHKAN, 'KertasKerjaDisahkan', { kertasKerjaId: randomUUID(), npsn, tahun: TAHUN, sumberDanaKode: 'BOSP_REG', versi: 1, baris });
  const b = (id: string, kodeRekening: string, uraian: string, total: number) => ({ id, kodeRekening, kegiatan: 'Kegiatan', uraian, volume: 1, satuan: 'paket', hargaSatuan: total, total });
  await kk('20100001', [b(B.atk, '5.1.02.01.01.0024', 'ATK', 1_000_000), b(B.servis, '5.1.02.02.01.0013', 'Servis', 300_000), b(B.konsumsi, '5.1.02.01.01.0052', 'Konsumsi', 200_000)]);
  await kk('20100002', [b(B.b2, '5.1.02.01.01.0024', 'ATK', 2_000_000)]);
});
afterAll(async () => { await db?.end(); await A?.app.close(); });

describe('SK-11 HPP asinkron', () => {
  it('belanja Mitra -> antrean -> pekerja menghitung 4 kategori, menerbitkan HppDihitung', async () => {
    await ev(TOPIK.TRANSAKSI_MITRA_DITERIMA, 'TransaksiMitraDiterima', {
      transaksiMitraId: TRX, mitraKode: 'MITRA_DEV', transactionId: 'SPL-1', npsn: '20100001', tahun: TAHUN, sumberDanaKode: 'BOSP_REG', tanggal: `${TAHUN}-03-01`,
      namaToko: 'CV', penjualPunyaNpwp: true, total: 1, diterimaAt: new Date().toISOString(), items: [
        { itemId: '1', barisId: B.atk, kodeRekening: '5.1.02.01.01.0024', uraian: 'Kertas', volume: 1, satuan: null, hargaSatuan: 600_000, jumlah: 600_000 },
        { itemId: '2', barisId: null, kodeRekening: '5.1.02.02.01.0013', uraian: 'Servis AC', volume: 1, satuan: null, hargaSatuan: 450_000, jumlah: 450_000 },
        { itemId: '3', barisId: null, kodeRekening: '5.1.02.03.02.0001', uraian: 'Laptop', volume: 1, satuan: null, hargaSatuan: 7_000_000, jumlah: 7_000_000 },
      ] });
    expect((await db.query('SELECT count(*)::int n FROM pemantauan.hpp_antrean')).rows[0].n).toBe(2); // dua sekolah ber-RKAS
    expect(await A.hpp.tick()).toBe(2);
    const r = await http.get('/api/v1/hpp/sekolah/20100001').query(q).set(await auth('KEPSEK', { npsn: '20100001' }));
    expect(r.status).toBe(200);
    expect(r.body.ringkasan).toMatchObject({
      SESUAI: { jumlah: 1, nilai: 600_000 }, MELEBIHI_RENCANA: { jumlah: 1, nilai: 450_000 }, BELUM_DIBELANJAKAN: { jumlah: 1, nilai: 200_000 }, DI_LUAR_RENCANA: { jumlah: 1, nilai: 7_000_000 },
    });
    expect(r.body.baris[0]).toMatchObject({ uraian: 'Servis', kategori: 'MELEBIHI_RENCANA', selisih: -150_000 });
    expect(r.body.item.map((i: { cara: string }) => i.cara).sort()).toEqual(['ID_BARIS', 'KODE_REKENING', 'TIDAK_COCOK']);
    while (await A.relay.tick()) { /* kuras */ }
    expect(broker.terbit.filter((e) => e.event.type === 'HppDihitung').map((e) => (e.event.data as { npsn: string }).npsn).sort()).toEqual(['20100001', '20100002']);
  });

  it('pembatalan pesanan Mitra menghitung ulang HPP (kompensasi)', async () => {
    await ev(TOPIK.TRANSAKSI_MITRA_DIBATALKAN, 'TransaksiMitraDibatalkan', { transaksiMitraId: TRX, mitraKode: 'MITRA_DEV', transactionId: 'SPL-1', npsn: '20100001', tahun: TAHUN, sumberDanaKode: 'BOSP_REG', status: 'RETUR', alasan: 'rusak', at: new Date().toISOString() });
    expect(await A.hpp.tick()).toBe(1);
    const r = await http.get('/api/v1/hpp/sekolah/20100001').query(q).set(await auth('PEMANTAU'));
    expect(r.body.ringkasan).toMatchObject({ BELUM_DIBELANJAKAN: { jumlah: 3 }, DI_LUAR_RENCANA: { jumlah: 0 } });
  });
});

describe('UC-30 dasbor serapan & kepatuhan berjenjang', () => {
  beforeAll(async () => {
    await ev(TOPIK.TRANSAKSI_DISETUJUI, 'TransaksiDisetujui', { transaksiId: randomUUID(), npsn: '20100001', tahun: TAHUN, sumberDanaKode: 'BOSP_REG', jenis: 'BELANJA', tanggal: `${TAHUN}-02-01`, nilaiBruto: 600_000 });
    await ev(TOPIK.TRANSAKSI_DISETUJUI, 'TransaksiDisetujui', { transaksiId: randomUUID(), npsn: '20100001', tahun: TAHUN, sumberDanaKode: 'BOSP_REG', jenis: 'PENERIMAAN', tanggal: `${TAHUN}-01-05`, nilaiBruto: 9_000_000 });
    if (WAJIB > 0) await ev(TOPIK.PERIODE_DITUTUP, 'PeriodeDitutup', { npsn: '20100001', tahun: TAHUN, sumberDanaKode: 'BOSP_REG', bulan: WAJIB, ditutupAt: new Date().toISOString() });
  });

  it('pusat: provinsi -> kabupaten -> sekolah; serapan dari belanja disetujui; terlambat lapor', async () => {
    const p = await http.get('/api/v1/dasbor/serapan').query(q).set(await auth('PEMANTAU'));
    expect(p.body).toMatchObject({ tingkat: 'PROVINSI', namaInduk: 'Nasional', total: { jumlahSekolah: 2, rencana: 3_500_000, realisasi: 600_000, persen: 17.1 } });
    expect(p.body.data).toEqual([expect.objectContaining({ kode: '32', nama: 'Provinsi Contoh A', jumlahSekolah: 2, terlambat: WAJIB > 0 ? 1 : 0 })]);
    const k = await http.get('/api/v1/dasbor/serapan').query({ ...q, induk: '32' }).set(await auth('PEMANTAU'));
    expect(k.body.data.map((x: { kode: string; persen: number }) => [x.kode, x.persen])).toEqual([['3201', 40], ['3202', 0]]);
    const s = await http.get('/api/v1/dasbor/serapan').query({ ...q, induk: '3201' }).set(await auth('PEMANTAU'));
    expect(s.body).toMatchObject({ tingkat: 'SEKOLAH', data: [{ kode: '20100001', nama: 'SMP Negeri Contoh 1', bulanDitutup: WAJIB, terlambat: 0 }] });
  });

  it('Dinas dikunci ke wilayahnya; sekolah lain 403; peran sekolah tidak membuka dasbor', async () => {
    const d = await auth('ADMIN_DINAS', { wilayah: '3201' });
    const r = await http.get('/api/v1/dasbor/serapan').query(q).set(d);
    expect(r.body).toMatchObject({ tingkat: 'SEKOLAH', induk: '3201', total: { jumlahSekolah: 1 } });
    expect((await http.get('/api/v1/dasbor/serapan').query({ ...q, induk: '32' }).set(d)).body.induk).toBe('3201');
    expect((await http.get('/api/v1/hpp/sekolah/20100002').query(q).set(d)).status).toBe(403);
    expect((await http.get('/api/v1/hpp/sekolah/20100002').query(q).set(await auth('KEPSEK', { npsn: '20100001' }))).status).toBe(403);
    expect((await http.get('/api/v1/dasbor/serapan').query(q).set(await auth('BENDAHARA', { npsn: '20100001' }))).status).toBe(403);
  });

  it('agregat HPP per jenjang (MV pusat) & alarm pembukaan GAGAL', async () => {
    await ev(TOPIK.PEMBUKAAN_DIKONFIRMASI, 'PembukaanDikonfirmasi', { sumberDanaKode: 'BOSP_REG', mitraKode: 'MITRA_X', versi: 1, status: 'GAGAL', at: new Date().toISOString() });
    const r = await http.get('/api/v1/dasbor/hpp').query(q).set(await auth('SUPER_ADMIN'));
    expect(r.body.data.find((x: { kategori: string }) => x.kategori === 'BELUM_DIBELANJAKAN')).toMatchObject({ jenjang: 'SMP', jumlah: 4 });
    expect(r.body.pembukaanGagal).toMatchObject([{ sumberDanaKode: 'BOSP_REG', mitraKode: 'MITRA_X' }]);
    const d = await http.get('/api/v1/dasbor/hpp').query(q).set(await auth('VERIFIKATOR_DINAS', { wilayah: '3202' }));
    expect(d.body.data.find((x: { kategori: string }) => x.kategori === 'BELUM_DIBELANJAKAN')).toMatchObject({ jumlah: 1 });
    expect(d.body.pembukaanGagal).toEqual([]);
  });
});
