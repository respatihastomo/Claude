#!/usr/bin/env node
// Mengisi data demo lewat API (bukan SQL): RKAS disahkan -> penerimaan, tarik tunai, 3 belanja (PPN, PPh 23), setor PPN,
// semua disetujui -> penutupan buku bulan berjalan diajukan & disetujui. Butuh kedua layanan berjalan dengan BROKER=http
// dan TUTUP_SEBELUM_AKHIR_BULAN=true. Pakai: node scripts/isi-demo.mjs [npsn]
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const npsn = process.argv[2] ?? '20100001';
const S = process.env.SVC_URL ?? 'http://localhost:3105';
const token = (peran, sub) => execFileSync('node', [new URL('./dev-token.mjs', import.meta.url).pathname, peran, npsn, sub]).toString();
const B = token('BENDAHARA', '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e01');
const K = token('KEPSEK', '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e02');
const hari = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const tahun = Number(hari.slice(0, 4));
const buku = { tahun, sumberDanaKode: 'BOSP_REG' };

async function panggil(metode, path, tkn, body, hdr = {}) {
  const r = await fetch(`${S}/api/v1${path}`, { method: metode, headers: { authorization: `Bearer ${tkn}`, 'content-type': 'application/json', ...hdr }, body: body ? JSON.stringify(body) : undefined });
  const isi = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${metode} ${path} -> ${r.status} ${JSON.stringify(isi)}`);
  return { isi, etag: r.headers.get('etag') };
}
const catat = async (body) => (await panggil('POST', `/sekolah/${npsn}/bku`, B, { ...buku, tanggal: hari, ...body }, { 'idempotency-key': randomUUID() })).isi;
const setujui = (id) => panggil('POST', `/transaksi/${id}/setujui`, K, {}, { 'if-match': 'W/"1"' });

execFileSync('node', [new URL('./terbit-kk-disahkan.mjs', import.meta.url).pathname, npsn, String(tahun)], { stdio: 'inherit' });
const rkas = (await panggil('GET', `/sekolah/${npsn}/bku/rkas?tahun=${tahun}&sumberDanaKode=BOSP_REG`, B)).isi.data;
const baris = (kode) => rkas.find((b) => b.kodeRekening === kode).barisId;

await setujui((await catat({ jenis: 'PENERIMAAN', nilai: 50_000_000, uraian: 'Penerimaan BOSP Reguler tahap 2' })).id);
await setujui((await catat({ jenis: 'TARIK_TUNAI', nilai: 3_000_000, uraian: 'Tarik tunai operasional' })).id);
for (const b of [
  { caraBayar: 'TUNAI', noBukti: 'NOTA-0021', namaToko: 'Toko Sinar Jaya', penjualPunyaNpwp: true, uraian: 'ATK ujian', kode: '5.1.02.01.01.0024', item: 'Kertas HVS A4', volume: 20, harga: 55500 },
  { caraBayar: 'NON_TUNAI', noBukti: 'INV-0388', namaToko: 'CV Servis Prima', penjualPunyaNpwp: false, uraian: 'Servis printer lab', kode: '5.1.02.02.01.0013', item: 'Servis printer', volume: 2, harga: 350000 },
  { caraBayar: 'NON_TUNAI', noBukti: 'INV-0412', namaToko: 'CV Maju Bersama', penjualPunyaNpwp: true, uraian: 'Toner & kertas', kode: '5.1.02.01.01.0024', item: 'Kertas F4', volume: 10, harga: 55500 },
]) {
  const { kode, item, volume, harga, ...x } = b;
  await setujui((await catat({ jenis: 'BELANJA', ...x, items: [{ barisId: baris(kode), uraian: item, volume, hargaSatuan: harga }] })).id);
}
const ppn = (await panggil('GET', `/sekolah/${npsn}/pajak?tahun=${tahun}&sumberDanaKode=BOSP_REG&status=DIPUNGUT`, B)).isi.data.filter((p) => p.jenis === 'PPN');
const setor = (await panggil('POST', `/sekolah/${npsn}/pajak/setor`, B, { ...buku, pajakIds: ppn.map((p) => p.id), ntpn: '0A1B2C3D4E5F6A7B', tanggalSetor: hari, caraBayar: 'NON_TUNAI' }, { 'idempotency-key': randomUUID() })).isi;
await setujui(setor.id);

const periode = (await panggil('GET', `/sekolah/${npsn}/periode?tahun=${tahun}&sumberDanaKode=BOSP_REG`, B)).isi.data.find((p) => p.status === 'BUKA');
const d = await panggil('GET', `/periode/${periode.id}`, B);
const r = d.isi.ringkasan;
const aj = await panggil('POST', `/periode/${periode.id}/ajukan-tutup`, B,
  { saldoRekeningKoran: r.bank.saldoAkhir - 2500, penjelasanBank: 'Biaya administrasi bank Rp 2.500 belum dicatat di BKU', kasFisik: r.tunai.saldoAkhir }, { 'if-match': d.etag });
await panggil('POST', `/periode/${periode.id}/setujui`, K, {}, { 'if-match': aj.etag });
console.log(`demo terisi: periode ${periode.bulan}/${tahun} ditutup; laporan akan dibuat svc-pelaporan`);
