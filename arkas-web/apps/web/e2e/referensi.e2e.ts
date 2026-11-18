import { afterAll, describe, expect, it } from 'vitest';
import { api, buka, masuk, NPSN, TAHUN, tutupPeramban } from './bantu';

const SSPD = '5.1.02.01.01.0052';
const atur = (tarif: number | null, dasarHukum: string) => ({ kodeRekening: SSPD, wilayahKode: '3201', tarif, dasarHukum });
afterAll(tutupPeramban);

describe('UI pajak daerah (Admin Dinas) & referensi nasional (Balai)', () => {
  it('Dinas menetapkan SSPD lewat UI → tarif berlaku di simulasi pajak Bendahara → dibebaskan → dipulihkan', async () => {
    const d = await masuk('adminDinas');
    try {
    await buka(d, '/dinas/pajak-daerah');
    await expect.poll(() => d.getByRole('heading', { name: 'Pajak daerah (SSPD)' }).count()).toBe(1);
    const baris = d.getByRole('row', { name: new RegExp(SSPD.replace(/\./g, '\\.')) });
    await baris.getByRole('button', { name: 'Atur' }).click();
    await d.getByLabel('Tarif (%)').fill('7');
    await d.getByLabel(/Dasar hukum/).fill('Perda Kab. 3201 No. 9/2026 (uji UI)');
    await d.getByRole('button', { name: 'Simpan' }).click();
    await expect.poll(async () => (await baris.innerText()).includes('7%'), { timeout: 10_000 }).toBe(true);

    // event ReferensiDiubah → proyeksi svc-penatausahaan → simulasi pajak Bendahara
    const b = await masuk('bendahara');
    const rkas = await api<{ data: Array<{ barisId: string; kodeRekening: string }> }>(b, 'GET', `/sekolah/${NPSN}/bku/rkas?tahun=${TAHUN}&sumberDanaKode=BOSP_REG`);
    const barisId = rkas.body.data.find((x) => x.kodeRekening === SSPD)!.barisId;
    const simulasi = async () => (await api<{ pajak: Array<{ jenis: string; tarif: number }> }>(b, 'POST', `/sekolah/${NPSN}/bku/simulasi-pajak`,
      { tahun: TAHUN, sumberDanaKode: 'BOSP_REG', penjualPunyaNpwp: true, items: [{ barisId, volume: 1, hargaSatuan: 100_000 }] })).body.pajak;
    await expect.poll(async () => (await simulasi()).find((x) => x.jenis === 'SSPD')?.tarif, { timeout: 15_000 }).toBe(0.07);

    // bebaskan lewat UI
    await baris.getByRole('button', { name: 'Atur' }).click();
    await d.getByLabel(/Tidak dipungut/).check();
    await d.getByRole('button', { name: 'Simpan' }).click();
    await expect.poll(async () => (await baris.innerText()).includes('Dibebaskan'), { timeout: 10_000 }).toBe(true);
    await expect.poll(async () => (await simulasi()).some((x) => x.jenis === 'SSPD'), { timeout: 15_000 }).toBe(false);

    } finally {
      // pulihkan keadaan demo (5%) apa pun hasil ujinya
      expect((await api(d, 'PUT', '/dinas/konfigurasi-pajak', atur(0.05, 'Perda Kab. 3201 No. 7/2026'))).status).toBe(200);
    }
  });

  it('Dinas tidak bisa membuka halaman referensi nasional, dan tidak bisa mengatur wilayah lain', async () => {
    const d = await masuk('adminDinas');
    const r = await d.goto(`${process.env.WEB_URL ?? 'http://localhost:3000'}/admin/referensi`);
    expect(r?.status()).toBe(404);
    const lain = await api<{ kode: string }>(d, 'PUT', '/dinas/konfigurasi-pajak', { ...atur(0.05, 'x x x'), wilayahKode: '3202' });
    expect([lain.status, lain.body.kode]).toEqual([422, 'DI_LUAR_CAKUPAN']);
  });

  it('Balai: tab tarif pajak memuat baris wilayah, ubah batas komponen, terbitkan ulang', async () => {
    let jawab: string | null = '25';
    const a = await masuk('balai', () => jawab);
    await buka(a, '/admin/referensi');
    await a.getByRole('tab', { name: 'Tarif pajak' }).click();
    await expect.poll(() => a.getByRole('row', { name: /3201/ }).count(), { timeout: 10_000 }).toBeGreaterThan(0);

    await a.getByRole('tab', { name: 'Komponen BOSP' }).click();
    const honor = a.getByRole('row', { name: /Pembayaran honor/ });
    try {
      await honor.getByRole('button', { name: 'Ubah batas' }).click();
      await expect.poll(async () => (await honor.innerText()).includes('25%'), { timeout: 10_000 }).toBe(true);
    } finally {
      jawab = '20';
      await honor.getByRole('button', { name: 'Ubah batas' }).click();
      await expect.poll(async () => (await honor.innerText()).includes('20%'), { timeout: 10_000 }).toBe(true);
    }

    await a.getByRole('button', { name: 'Terbitkan ulang ke semua layanan' }).click();
    await expect.poll(() => a.getByText(/baris referensi diantrekan/).count(), { timeout: 10_000 }).toBe(1);
  });
});
