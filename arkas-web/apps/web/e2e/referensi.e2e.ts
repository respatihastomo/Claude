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

  it('Balai: tab tarif pajak memuat baris wilayah, ubah batas komponen lewat formulir, terbitkan ulang', async () => {
    const a = await masuk('balai');
    await buka(a, '/admin/referensi');
    await a.getByRole('tab', { name: 'Tarif pajak' }).click();
    await expect.poll(() => a.getByRole('row', { name: /3201/ }).count(), { timeout: 10_000 }).toBeGreaterThan(0);

    await a.getByRole('tab', { name: 'Komponen BOSP' }).click();
    const honor = a.getByRole('row', { name: /Pembayaran honor/ });
    const ubahBatas = async (nilai: string) => {
      await honor.getByRole('button', { name: 'Ubah' }).click();
      await a.getByLabel(/Batas maksimal/).fill(nilai);
      await a.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
      await expect.poll(async () => (await honor.innerText()).includes(`${nilai}%`), { timeout: 10_000 }).toBe(true);
    };
    try {
      await ubahBatas('25');
      await expect.poll(() => a.getByText(/tersimpan \(versi \d+\)/).count(), { timeout: 5_000 }).toBe(1);
    } finally {
      await ubahBatas('20');
    }

    await a.getByRole('button', { name: 'Terbitkan ulang ke semua layanan' }).click();
    await expect.poll(() => a.getByText(/baris referensi diantrekan/).count(), { timeout: 10_000 }).toBe(1);
  });

  it('Balai: menonaktifkan & mengaktifkan kode rekening lewat formulir; simpan tanpa perubahan tidak menaikkan versi', async () => {
    const a = await masuk('balai');
    await buka(a, '/admin/referensi');
    await a.getByRole('tab', { name: 'Kode rekening' }).click();
    const baris = a.getByRole('row', { name: /5\.1\.02\.02\.01\.0061/ });
    await expect.poll(() => baris.count(), { timeout: 10_000 }).toBe(1);
    const versi = async () => Number((await baris.getByRole('cell').nth(2).innerText()).trim());
    const atur = async (aktif: boolean) => {
      await baris.getByRole('button', { name: 'Ubah' }).click();
      const c = a.getByRole('dialog').getByRole('checkbox');
      if (aktif) await c.check(); else await c.uncheck();
      await a.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
    };
    const v0 = await versi();
    try {
      await atur(false);
      await expect.poll(async () => (await baris.innerText()).includes('Nonaktif'), { timeout: 10_000 }).toBe(true);
      expect(await versi()).toBeGreaterThan(v0);
    } finally {
      await atur(true);
      await expect.poll(async () => (await baris.innerText()).includes('Aktif') && !(await baris.innerText()).includes('Nonaktif'), { timeout: 10_000 }).toBe(true);
    }
    const v1 = await versi();
    await atur(true); // isi sama
    await expect.poll(() => a.getByText('Tidak ada perubahan; isian sama dengan data yang tersimpan.').count(), { timeout: 5_000 }).toBe(1);
    expect(await versi()).toBe(v1);
  });
});
