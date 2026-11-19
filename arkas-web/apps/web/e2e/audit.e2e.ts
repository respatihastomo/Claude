import { afterAll, describe, expect, it } from 'vitest';
import { api, buka, masuk, NPSN, tutupPeramban } from './bantu';

afterAll(tutupPeramban);
const KOMPONEN = { sumberDanaKode: 'BOSP_REG', kode: '12', nama: 'Pembayaran honor', minPersen: null };

describe('UI jejak audit (svc-audit)', () => {
  it('perubahan Balai muncul di linimasa Auditor dengan sebelum/sesudah; rantai terverifikasi utuh', async () => {
    const balai = await masuk('balai');
    const awal = (await api<{ data: Array<{ kode: string; maksPersen: number }> }>(balai, 'GET', '/referensi/komponen?sumberDanaKode=BOSP_REG')).body.data;
    const maksAwal = awal.find((k) => k.kode === '12')!.maksPersen;
    const maksUji = maksAwal === 21 ? 22 : 21;
    try {
      expect((await api(balai, 'PUT', '/admin/referensi/komponen', { ...KOMPONEN, maksPersen: maksUji })).status).toBe(201);
      const a = await masuk('auditor');
      await buka(a, '/audit');
      await expect.poll(() => a.getByTestId('status-verifikasi').innerText(), { timeout: 15_000 }).toBe('Terverifikasi utuh');
      await a.getByLabel('Layanan').selectOption('svc-referensi');
      // jejak tiba secara asinkron (outbox -> svc-audit): muat ulang sampai entri terbaru tampil
      const entri = a.getByTestId('entri-jejak').filter({ hasText: 'Komponen diubah' }).first();
      await expect.poll(async () => {
        if (await entri.count() === 0) { await a.reload(); await a.waitForLoadState('networkidle'); await a.getByLabel('Layanan').selectOption('svc-referensi'); }
        return (await entri.count()) > 0 && (await entri.innerText()).includes('BOSP_REG:12');
      }, { timeout: 20_000, interval: 1_000 }).toBe(true);
      expect(await entri.innerText()).toContain('Balai SDSP');
      await entri.getByRole('button', { name: /Lihat perubahan/ }).click();
      const baris = entri.getByRole('row').filter({ hasText: 'maks_persen' });
      expect((await baris.innerText()).replace(/\s+/g, ' ')).toContain(`maks_persen ${maksAwal} ${maksUji}`);
    } finally {
      await api(balai, 'PUT', '/admin/referensi/komponen', { ...KOMPONEN, maksPersen: maksAwal });
    }
  });

  it('Kepala Sekolah hanya melihat rantai sekolahnya; Bendahara tidak punya akses', async () => {
    const k = await masuk('kepsek');
    await buka(k, '/audit');
    await expect.poll(() => k.getByTestId('status-verifikasi').innerText(), { timeout: 15_000 }).toBe('Terverifikasi utuh');
    expect(await k.getByLabel('Rantai').isDisabled()).toBe(true);
    const teks = await k.locator('ol').innerText();
    expect(teks).not.toContain('Nasional (tanpa sekolah)');
    if (teks.trim()) expect(teks).toContain(`Sekolah ${NPSN}`);
    expect((await api(k, 'GET', '/audit/jejak?rantai=NASIONAL')).status).toBe(403);
    const b = await masuk('bendahara');
    expect((await api(b, 'GET', '/audit/jejak')).status).toBe(403);
  });
});
