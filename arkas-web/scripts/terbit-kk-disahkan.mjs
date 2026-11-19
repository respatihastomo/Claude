#!/usr/bin/env node
// Menggantikan svc-perencanaan (belum dirilis) di lingkungan dev: menerbitkan KertasKerjaDisahkan contoh
// lewat endpoint dev svc-penatausahaan. node scripts/terbit-kk-disahkan.mjs [npsn] [tahun]
import { randomUUID } from 'node:crypto';
const npsn = process.argv[2] ?? '20100001';
const tahun = Number(process.argv[3] ?? new Date().getFullYear());
const base = process.env.SVC_URL ?? 'http://localhost:3105';
const token = process.env.INTERNAL_EVENTS_TOKEN ?? 'dev-internal-token-ganti-saya';
// UUID deterministik per npsn agar menjalankan ulang tidak menggandakan baris RKAS.
const uuidDari = (s) => { let h = 0n; for (const c of s) h = (h * 131n + BigInt(c.charCodeAt(0))) % (1n << 122n);
  const x = h.toString(16).padStart(32, '0'); return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-8${x.slice(17, 20)}-${x.slice(20, 32)}`; };
const baris = [
  ['02. Pengembangan standar isi', '5.1.02.01.01.0024', 'Kertas HVS A4 & alat tulis kantor', 40, 'rim', 55500],
  ['05. Pengembangan sarana dan prasarana', '5.1.02.02.01.0013', 'Servis printer dan komputer lab', 4, 'kali', 350000],
  ['05. Pengembangan sarana dan prasarana', '5.1.02.02.01.0026', 'Jasa kebersihan (CV)', 6, 'bulan', 1110000],
  ['07. Pengembangan dan implementasi sistem penilaian', '5.1.02.01.01.0052', 'Makan minum rapat penilaian', 60, 'kotak', 35000],
  ['04. Pengembangan pendidik dan tenaga kependidikan', '5.1.02.02.01.0003', 'Honor narasumber IHT', 2, 'OJ', 900000],
  ['06. Pengembangan standar pengelolaan', '5.1.02.01.01.0001', 'Langganan daya dan jasa internet', 12, 'bulan', 450000],
].map(([kegiatan, kodeRekening, uraian, volume, satuan, hargaSatuan]) => ({
  id: uuidDari(`${npsn}:${tahun}:${kodeRekening}:${uraian}`), kodeRekening, kegiatan, uraian, volume, satuan, hargaSatuan,
  total: volume * hargaSatuan, asalBarisId: null,
}));
const body = {
  topik: 'arkas.perencanaan.kk-disahkan',
  event: {
    specversion: '1.0', id: randomUUID(), source: 'svc-perencanaan', type: 'KertasKerjaDisahkan', time: new Date().toISOString(),
    data: { kertasKerjaId: uuidDari(`kk:${npsn}:${tahun}`), npsn, tahun, sumberDanaKode: 'BOSP_REG', versi: 1, baris },
  },
};
const r = await fetch(`${base}/internal/v1/events`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-token': token }, body: JSON.stringify(body) });
console.log(r.status, await r.text());
