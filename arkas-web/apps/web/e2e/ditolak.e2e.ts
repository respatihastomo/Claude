import { afterAll, describe, expect, it } from 'vitest';
import { api, buka, HARI_INI, masuk, NPSN, TAHUN, tutupPeramban } from './bantu';

afterAll(tutupPeramban);
const BKU = `/sekolah/${NPSN}/penatausahaan/bku`;

describe('UI transaksi ditolak', () => {
  it('Kepala Sekolah menolak lewat UI → Bendahara melihat alasan dan Catat ulang membuka formulir', async () => {
    const b = await masuk('bendahara');
    const noBukti = `UJI-${Date.now().toString(36).toUpperCase()}`;
    const t = await api<{ id: string }>(b, 'POST', `/sekolah/${NPSN}/bku`,
      { tahun: TAHUN, sumberDanaKode: 'BOSP_REG', jenis: 'PENERIMAAN', tanggal: HARI_INI, nilai: 1_000, uraian: `Penerimaan uji UI ${noBukti}`, noBukti }, true);
    expect(t.status).toBe(201);

    const alasan = `Bukti transfer ${noBukti} tidak terbaca`;
    const k = await masuk('kepsek', () => alasan);
    await buka(k, BKU);
    await k.getByRole('row', { name: new RegExp(noBukti) }).getByRole('button', { name: 'Tolak' }).click();
    const panelK = k.getByRole('alert', { name: 'Transaksi ditolak' });
    await expect.poll(async () => (await panelK.innerText()).includes(alasan), { timeout: 10_000 }).toBe(true);
    expect(await panelK.getByRole('button', { name: 'Catat ulang' }).count()).toBe(0);

    await buka(b, BKU);
    const panel = b.getByRole('alert', { name: 'Transaksi ditolak' });
    await expect.poll(async () => (await panel.innerText()).includes(alasan), { timeout: 10_000 }).toBe(true);
    expect(await b.getByRole('row', { name: new RegExp(noBukti) }).count()).toBe(0);
    const item = panel.getByRole('listitem').filter({ hasText: noBukti });
    await item.getByRole('button', { name: 'Catat ulang' }).click();
    await expect.poll(() => b.getByRole('dialog').filter({ hasText: 'Catat penerimaan dana' }).count(), { timeout: 5_000 }).toBeGreaterThan(0);
    expect(await b.getByLabel('Nilai (Rp)').inputValue()).toBe('1000');
  });
});
