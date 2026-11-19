import { afterAll, describe, expect, it } from 'vitest';
import { api, buka, masuk, NPSN, tutupPeramban } from './bantu';

afterAll(tutupPeramban);

describe('UI pemantauan & HPP (svc-pemantauan)', () => {
  it('Pemantau menelusuri Nasional → provinsi → kabupaten → HPP sekolah', async () => {
    const p = await masuk('pemantau');
    await buka(p, '/dasbor');
    await p.getByRole('button', { name: 'Provinsi Contoh A' }).click();
    await p.getByRole('button', { name: 'Kabupaten Contoh 1' }).click();
    const sekolah = p.getByRole('link', { name: 'SMP Negeri Contoh 1' });
    await expect.poll(() => sekolah.count(), { timeout: 10_000 }).toBe(1);
    expect(await p.getByRole('navigation', { name: 'Tingkat wilayah' }).innerText()).toMatch(/Nasional\s*›\s*Provinsi Contoh A\s*›\s*Kabupaten Contoh 1/);
    await sekolah.click();
    await p.waitForURL(/\/sekolah\/20100001\/hpp/);
    await expect.poll(() => p.getByTestId('hpp-baris').count(), { timeout: 10_000 }).toBeGreaterThan(0);
    expect(await p.getByText('Sesuai rencana').count()).toBeGreaterThan(0);
  });

  it('Verifikator Dinas dikunci ke wilayahnya; Kepala Sekolah membuka HPP sekolahnya saja', async () => {
    const v = await masuk('verifikator');
    await buka(v, '/dasbor');
    await expect.poll(() => v.getByTestId('baris-serapan').count(), { timeout: 10_000 }).toBeGreaterThan(0);
    expect(await v.getByRole('button', { name: 'Provinsi Contoh A' }).count()).toBe(0);
    expect(await v.getByRole('link', { name: 'SMP Negeri Contoh 1' }).count()).toBe(1);
    const k = await masuk('kepsek');
    expect((await api(k, 'GET', `/hpp/sekolah/${NPSN}?sumberDanaKode=BOSP_REG`)).status).toBe(200);
    expect((await api(k, 'GET', '/hpp/sekolah/20100002?sumberDanaKode=BOSP_REG')).status).toBe(403);
    expect((await api(k, 'GET', '/dasbor/serapan')).status).toBe(403);
  });
});
