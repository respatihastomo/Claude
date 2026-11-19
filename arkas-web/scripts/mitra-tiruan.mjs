#!/usr/bin/env node
// HANYA pengembangan: aplikasi Mitra SIPLah tiruan untuk menguji svc-integrasi dua arah.
//   node scripts/mitra-tiruan.mjs server                 -> :3190 menerima {baseMitra}/arkas/v1/sumber-dana lalu mengonfirmasi DIBUKA
//   node scripts/mitra-tiruan.mjs belanja <npsn> [sd]    -> ambil anggaran, kirim transaksi (1 item ber-ID baris RKAS + 1 item tanpa ID)
//   node scripts/mitra-tiruan.mjs batal <transactionId> [DIBATALKAN|RETUR]
// Kredensial sesuai db/svc-integrasi/migrations/90_seed_dev.sql (Mitra MITRA_DEV).
import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

const ARKAS = process.env.ARKAS_MITRA_URL ?? 'http://localhost:3109';
const CLIENT_ID = process.env.MITRA_CLIENT_ID ?? 'mitra-dev';
const CLIENT_SECRET = process.env.MITRA_CLIENT_SECRET ?? 'rahasia-klien-mitra-dev';
const HMAC = process.env.MITRA_HMAC ?? 'rahasia-hmac-mitra-dev-0123456789';
const PORT = Number(process.env.PORT ?? 3190);
const tanda = (ts, body) => createHmac('sha256', HMAC).update(`${ts}.${body}`).digest('hex');

async function token() {
  const r = await fetch(`${ARKAS}/mitra/v1/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }) });
  if (!r.ok) throw new Error(`token: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}
async function panggil(metode, path, body) {
  const b = body === undefined ? '' : JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const r = await fetch(`${ARKAS}${path}`, { method: metode, body: body === undefined ? undefined : b,
    headers: { authorization: `Bearer ${await token()}`, 'x-timestamp': ts, 'x-signature': tanda(ts, b), ...(body === undefined ? {} : { 'content-type': 'application/json' }) } });
  const isi = await r.json().catch(() => null);
  return { status: r.status, isi };
}

const [perintah, a1, a2] = process.argv.slice(2);
if (perintah === 'server') {
  http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (req.method !== 'POST' || req.url !== '/arkas/v1/sumber-dana') return void res.writeHead(404).end();
      const ts = String(req.headers['x-timestamp'] ?? ''); const sig = Buffer.from(String(req.headers['x-signature'] ?? ''));
      const harap = Buffer.from(tanda(ts, body));
      if (sig.length !== harap.length || !timingSafeEqual(sig, harap)) { console.log('tanda tangan ARKAS tidak valid'); return void res.writeHead(401).end(); }
      const p = JSON.parse(body);
      console.log(`[mitra] ${req.headers['idempotency-key']} -> ${p.kode} v${p.versi} ${p.status}`);
      res.writeHead(202, { 'content-type': 'application/json' }).end(JSON.stringify({ idDiMitra: `MTR-${p.kode}-${p.versi}` }));
      if (p.status === 'DIBUKA' && process.env.AUTO_KONFIRMASI !== '0') {
        setTimeout(async () => {
          const r = await panggil('POST', `/mitra/v1/sumber-dana/${p.kode}/konfirmasi`, { status: 'DIBUKA', versi: p.versi, catatan: 'Dibuka otomatis oleh Mitra tiruan' });
          console.log(`[mitra] konfirmasi ${p.kode} v${p.versi}: ${r.status} ${JSON.stringify(r.isi)}`);
        }, 800);
      }
    });
  }).listen(PORT, () => console.log(`Mitra tiruan siap di :${PORT} (ARKAS ${ARKAS})`));
} else if (perintah === 'belanja') {
  const npsn = a1 ?? '20100001'; const sd = a2 ?? 'BOSP_REG';
  const tahun = new Date().getFullYear();
  const ang = await panggil('GET', `/mitra/v1/sekolah/${npsn}/anggaran?tahun=${tahun}&sumberDanaKode=${sd}`);
  if (ang.status !== 200) { console.error(ang); process.exit(1); }
  const ada = ang.isi.baris.filter((b) => b.sisa >= 50_000);
  if (ada.length < 2) { console.error('sisa anggaran tidak cukup untuk contoh'); process.exit(1); }
  const [x, y] = ada;
  const tanggal = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const transaksi = {
    transactionId: `SPL-${Date.now().toString(36).toUpperCase()}`, npsn, tahun, sumberDanaKode: sd, tanggal, namaToko: 'CV Sinar Jaya (SIPLah)', penjualPunyaNpwp: true,
    items: [
      { itemId: '1', barisId: x.barisId, kodeRekening: x.kodeRekening, uraian: `${x.uraian} (SIPLah)`, volume: 1, satuan: x.satuan, hargaSatuan: Math.min(x.sisa, 250_000) },
      { itemId: '2', barisId: null, kodeRekening: y.kodeRekening, uraian: `Pesanan katalog: ${y.uraian}`, volume: 2, satuan: y.satuan, hargaSatuan: Math.floor(Math.min(y.sisa, 100_000) / 2) },
    ],
  };
  const v = await panggil('POST', '/mitra/v1/validasi-keranjang', { npsn, tahun, sumberDanaKode: sd, items: transaksi.items.map((i) => ({ itemId: i.itemId, barisId: i.barisId, kodeRekening: i.kodeRekening, jumlah: i.volume * i.hargaSatuan })) });
  console.log('validasi keranjang:', JSON.stringify(v.isi));
  const r = await panggil('POST', '/mitra/v1/transaksi', transaksi);
  console.log(`transaksi ${transaksi.transactionId}: ${r.status} ${JSON.stringify(r.isi)}`);
} else if (perintah === 'batal') {
  const r = await panggil('POST', `/mitra/v1/transaksi/${a1}/status`, { status: a2 ?? 'DIBATALKAN', alasan: 'Dibatalkan pembeli (Mitra tiruan)' });
  console.log(r.status, JSON.stringify(r.isi));
} else {
  console.error('pakai: mitra-tiruan.mjs server | belanja <npsn> [sumberDana] | batal <transactionId> [DIBATALKAN|RETUR]');
  process.exit(2);
}
