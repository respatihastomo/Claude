import { afterAll, describe, expect, it } from 'vitest';
import { api, buka, HARI_INI, masuk, NPSN, TAHUN, tutupPeramban } from './bantu';

afterAll(tutupPeramban);
const KODE = 'BANPER_TIK_SMP';
const PDF = (nama: string) => ({ name: nama, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n% ${nama}\n%%EOF`) });

describe('UI Bantuan Pemerintah (svc-bantuan) lintas peran', () => {
  it('Direktorat menyusun → Ditjen menyetujui juknis → Balai mengesahkan → referensi, pagu & Mitra mengikuti → penyaluran', async () => {
    const dit = await masuk('direktorat');
    const ada = await api<{ status: string }>(dit, 'GET', `/sumber-dana/${KODE}`);
    if (ada.status === 404) {
      await buka(dit, '/bantuan');
      await dit.getByRole('button', { name: '+ Sumber dana baru' }).click();
      await dit.getByLabel('Kode').fill(KODE);
      await dit.getByLabel('Nama bantuan').fill('Bantuan Peralatan TIK SMP');
      await dit.getByLabel('Masa pengajuan sekolah mulai').fill(HARI_INI);
      await dit.getByLabel('Selesai').fill(`${TAHUN}-12-31`);
      await dit.getByRole('button', { name: 'Buat draf' }).click();
      await dit.waitForURL(new RegExp(`/bantuan/${KODE}$`));
      await dit.getByTestId('dokumen-JUKNIS').locator('input[type=file]').setInputFiles(PDF('Juknis Bantuan TIK 2026.pdf'));
      await dit.getByTestId('dokumen-PANDUAN').locator('input[type=file]').setInputFiles(PDF('Panduan Pelaksanaan TIK.pdf'));
      await expect.poll(() => dit.getByTestId('dokumen-PANDUAN').innerText(), { timeout: 10_000 }).toContain('Menunggu keputusan');

      const dj = await masuk('ditjen');
      await buka(dj, `/bantuan/${KODE}`);
      await dj.getByTestId('dokumen-JUKNIS').getByRole('button', { name: 'Setujui' }).click();
      await expect.poll(() => dj.getByTestId('dokumen-JUKNIS').innerText(), { timeout: 10_000 }).toContain('Disetujui');
      expect(await dj.getByTestId('dokumen-PANDUAN').getByRole('button', { name: 'Sahkan' }).count()).toBe(0); // panduan milik direktorat

      await buka(dit, `/bantuan/${KODE}`);
      await dit.getByTestId('dokumen-PANDUAN').getByRole('button', { name: 'Sahkan' }).click();
      await dit.getByPlaceholder('01', { exact: true }).fill('01'); await dit.getByPlaceholder('Pengadaan laptop', { exact: true }).fill('Pengadaan laptop & proyektor'); await dit.getByPlaceholder('80', { exact: true }).fill('90');
      await dit.getByRole('button', { name: 'Simpan' }).first().click();
      await dit.getByPlaceholder('20100001', { exact: true }).fill(NPSN); await dit.getByPlaceholder('50000000', { exact: true }).fill('50000000');
      await dit.getByRole('button', { name: 'Simpan' }).last().click();
      await expect.poll(() => dit.getByRole('button', { name: 'Ajukan ke Balai SDSP' }).isEnabled(), { timeout: 10_000 }).toBe(true);
      await dit.getByRole('button', { name: 'Ajukan ke Balai SDSP' }).click();

      const balai = await masuk('balai');
      await buka(balai, `/bantuan/${KODE}`);
      await balai.getByRole('button', { name: 'Sahkan' }).click(); // dialog konfirmasi diterima otomatis
      await expect.poll(async () => (await api<{ status: string }>(balai, 'GET', `/sumber-dana/${KODE}`)).body.status, { timeout: 10_000 }).toBe('DISAHKAN');
    }

    // hilir: referensi BANPER aktif bagi sekolah penerima, pagu terbentuk, sumber dana dibuka di Mitra (Mitra tiruan mengonfirmasi)
    const kepsek = await masuk('kepsek');
    await expect.poll(async () => (await api<{ data: Array<{ kode: string }> }>(kepsek, 'GET', `/sekolah/${NPSN}/sumber-dana`)).body.data.map((s) => s.kode), { timeout: 20_000, interval: 1000 }).toContain(KODE);
    await expect.poll(async () => (await api<{ nilai: number }>(kepsek, 'GET', `/sekolah/${NPSN}/pagu?tahun=${TAHUN}&sumberDanaKode=${KODE}`)).body.nilai, { timeout: 20_000, interval: 1000 }).toBe(50_000_000);
    const balai = await masuk('balai');
    await expect.poll(async () => (await api<{ sel: Array<{ sumberDanaKode: string; mitraKode: string; status: string }> }>(balai, 'GET', '/pembukaan-sumber-dana')).body.sel
      .find((x) => x.sumberDanaKode === KODE && x.mitraKode === 'MITRA_DEV')?.status, { timeout: 30_000, interval: 1000 }).toBe('DIBUKA');

    // penyaluran (sekali): PKS bank lalu tahap 1
    const det = await api<{ penyaluran: unknown[] }>(dit, 'GET', `/sumber-dana/${KODE}`);
    if (!det.body.penyaluran.length) {
      await buka(dit, `/bantuan/${KODE}`);
      await dit.getByLabel('Bank', { exact: true }).selectOption('BRI');
      await dit.getByLabel('Nomor PKS').fill('PKS/DITSMP/BRI/2026/07');
      await dit.getByLabel('Tanggal PKS').fill(HARI_INI);
      await dit.getByRole('button', { name: 'Simpan PKS' }).click();
      await expect.poll(() => dit.getByLabel('Bank penyalur').locator('option[value=BRI]').count(), { timeout: 10_000 }).toBe(1);
      await dit.getByLabel('Sekolah', { exact: true }).selectOption(NPSN);
      await dit.getByLabel('Tanggal salur').fill(HARI_INI);
      await dit.getByLabel('Nilai salur').fill('25000000');
      await dit.getByLabel('Bank penyalur').selectOption('BRI');
      await dit.getByLabel('Nomor referensi').fill('TRF-BRI-0001');
      await dit.getByRole('button', { name: 'Catat penyaluran' }).click();
    }
    await expect.poll(async () => (await api<{ data: Array<{ sumberDanaKode: string; nilai: number }> }>(kepsek, 'GET', `/sekolah/${NPSN}/penyaluran-bantuan`)).body.data.filter((x) => x.sumberDanaKode === KODE).length,
      { timeout: 15_000, interval: 1000 }).toBeGreaterThan(0);
  });

  it('sekolah mengajukan PKS, RAB, SPTJM → Tim Kerja menyetujui', async () => {
    const op = await masuk('operator');
    await buka(op, `/sekolah/${NPSN}/bantuan`);
    const kartu = op.locator('section').filter({ hasText: 'Bantuan Peralatan TIK SMP' });
    await expect.poll(() => kartu.count(), { timeout: 10_000 }).toBe(1);
    if (await kartu.getByRole('button', { name: 'Mulai pengajuan' }).count()) {
      await kartu.getByRole('button', { name: 'Mulai pengajuan' }).click();
      await expect.poll(() => kartu.getByTestId('dok-PKS').count(), { timeout: 10_000 }).toBe(1);
      await kartu.getByTestId('dok-PKS').locator('input[type=file]').setInputFiles(PDF('PKS SMPN 1.pdf'));
      await expect.poll(() => kartu.getByTestId('dok-PKS').innerText(), { timeout: 10_000 }).toContain('PKS SMPN 1.pdf');
      await kartu.getByLabel('Total RAB (Rp)').fill('49500000');
      await kartu.getByTestId('dok-RAB').locator('input[type=file]').setInputFiles(PDF('RAB TIK.pdf'));
      await expect.poll(() => kartu.getByTestId('dok-RAB').innerText(), { timeout: 10_000 }).toContain('RAB TIK.pdf');
      await kartu.getByTestId('dok-SPTJM').locator('input[type=file]').setInputFiles(PDF('SPTJM.pdf'));
      await expect.poll(() => kartu.getByTestId('dok-SPTJM').innerText(), { timeout: 10_000 }).toContain('SPTJM.pdf');
      expect(await kartu.getByRole('button', { name: 'Ajukan ke direktorat' }).count()).toBe(0); // hanya Kepala Sekolah
      const ks = await masuk('kepsek');
      await buka(ks, `/sekolah/${NPSN}/bantuan`);
      await ks.getByRole('button', { name: 'Ajukan ke direktorat' }).click();
      await expect.poll(() => ks.locator('section').filter({ hasText: 'Bantuan Peralatan TIK SMP' }).innerText(), { timeout: 10_000 }).toContain('Diajukan');
      const tk = await masuk('timkerja');
      await buka(tk, `/bantuan/${KODE}`);
      const item = tk.getByTestId('pengajuan-sekolah').filter({ hasText: NPSN });
      await item.getByRole('button', { name: 'Setujui' }).click();
      await expect.poll(() => item.innerText(), { timeout: 10_000 }).toContain('Disetujui');
    }
    await buka(op, `/sekolah/${NPSN}/bantuan`);
    await expect.poll(() => op.getByText('Pengajuan disetujui').count(), { timeout: 10_000 }).toBe(1);
  });
});
