import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { api, buka, masuk, NPSN, TAHUN, tutupPeramban } from './bantu';

afterAll(tutupPeramban);
const MITRA = path.resolve(__dirname, '../../../scripts/mitra-tiruan.mjs');
const BKU = `/sekolah/${NPSN}/penatausahaan/bku`;

describe('UI transaksi SIPLah (svc-integrasi -> svc-penatausahaan)', () => {
  it('Mitra mengirim belanja → Bendahara memetakan & mencatat ke BKU → Kepala Sekolah melihatnya menunggu persetujuan', async () => {
    const keluaran = execFileSync('node', [MITRA, 'belanja', NPSN], { encoding: 'utf8' });
    const transactionId = /transaksi (SPL-[A-Z0-9]+): 202/.exec(keluaran)?.[1];
    expect(transactionId, keluaran).toBeTruthy();

    const b = await masuk('bendahara');
    await buka(b, BKU);
    const panel = b.getByRole('region', { name: 'Transaksi SIPLah' });
    const item = panel.getByTestId('siplah-menunggu').filter({ hasText: transactionId! });
    await expect.poll(async () => { if (!(await item.count())) await b.reload(); return item.count(); }, { timeout: 20_000, interval: 1000 }).toBe(1);
    // item tanpa baris RKAS wajib dipetakan dulu
    const tombol = item.getByRole('button', { name: 'Catat ke BKU' });
    expect(await tombol.isDisabled()).toBe(true);
    const pilih = item.getByRole('combobox');
    const opsi = await pilih.locator('option').nth(1).getAttribute('value');
    await pilih.selectOption(opsi!);
    await tombol.click();
    // baris belanja (+ baris pajaknya) muncul di BKU dengan nomor bukti = transactionId
    const baris = b.getByRole('row', { name: new RegExp(transactionId!) });
    await expect.poll(() => baris.count(), { timeout: 10_000 }).toBeGreaterThan(0);
    await expect.poll(() => item.count(), { timeout: 10_000 }).toBe(0);

    const k = await masuk('kepsek');
    await buka(k, BKU);
    const barisK = k.getByRole('row', { name: new RegExp(transactionId!) });
    expect(await barisK.getByRole('button', { name: 'Setujui' }).count()).toBeGreaterThan(0);

    // pemulihan: Kepala Sekolah menolak, Mitra membatalkan pesanan (sisa anggaran Mitra kembali)
    const t = (await api<{ data: Array<{ transactionId: string; transaksiId: string }> }>(b, 'GET', `/sekolah/${NPSN}/transaksi-mitra?tahun=${TAHUN}&sumberDanaKode=BOSP_REG`)).body.data.find((x) => x.transactionId === transactionId)!;
    expect((await k.request.post(`${process.env.WEB_URL ?? 'http://localhost:3000'}/api/v1/transaksi/${t.transaksiId}/tolak`, { data: { alasan: 'Uji otomatis SIPLah' }, headers: { 'if-match': 'W/"1"' } })).status()).toBe(200);
    execFileSync('node', [MITRA, 'batal', transactionId!]);
  });

  it('Balai melihat matriks pembukaan: BOSP Reguler dibuka di Mitra tiruan', async () => {
    const p = await masuk('balai');
    await buka(p, '/admin/mitra');
    await expect.poll(() => p.getByTestId('sel-BOSP_REG-MITRA_DEV').innerText(), { timeout: 10_000 }).toContain('Dibuka');
    expect(await p.getByRole('table', { name: 'Matriks pembukaan' }).count()).toBe(1);
  });
});
