// Sampul Buku Panduan & Buku Tutorial (HTML -> PNG A4). Jalankan: node buat-sampul.cjs
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const img = (f) => `data:image/png;base64,${fs.readFileSync(path.join(__dirname, 'gambar', f)).toString('base64')}`;
const sampul = ({ warna, warna2, jenis, judul, sub, isi, gbr1, gbr2 }) => `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}body{width:1240px;height:1754px;font-family:Inter,'Segoe UI',sans-serif;background:linear-gradient(160deg,${warna} 0%,${warna2} 62%,#0b1220 100%);color:#fff;overflow:hidden;position:relative}
.p{position:absolute;left:96px;right:96px}.tag{display:inline-block;border:2px solid rgba(255,255,255,.6);border-radius:999px;padding:10px 26px;font-size:26px;letter-spacing:.18em;font-weight:700}
h1{font-size:104px;line-height:1.04;font-weight:900;letter-spacing:-.02em}h2{font-size:40px;font-weight:500;opacity:.92;line-height:1.3}
.chip{display:inline-block;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35);border-radius:16px;padding:14px 24px;font-size:28px;margin:0 14px 14px 0}
.sh{position:absolute;border-radius:18px;box-shadow:0 30px 70px rgba(0,0,0,.45);border:6px solid rgba(255,255,255,.9);overflow:hidden;background:#fff}.sh img{width:100%;display:block}
.band{position:absolute;left:0;right:0;bottom:0;padding:44px 96px 64px;background:linear-gradient(180deg,rgba(11,18,32,0),rgba(11,18,32,.92) 30%);z-index:5}
.isi{font-size:26px;line-height:1.7;opacity:.95}
</style></head><body>
<div class="p" style="top:96px"><span class="tag">ARKAS WEB · ${jenis}</span></div>
<div class="p" style="top:210px"><h1>${judul}</h1></div>
<div class="p" style="top:560px"><h2>${sub}</h2></div>
<div class="p" style="top:730px">${['Operator Sekolah', 'Bendahara', 'Kepala Sekolah', 'Komite Sekolah'].map((x) => `<span class="chip">${x}</span>`).join('')}</div>
<div class="sh" style="left:420px;top:880px;width:860px;height:470px;transform:rotate(-4deg)"><img src="${gbr1}"></div>
<div class="sh" style="left:70px;top:1110px;width:700px;height:390px;transform:rotate(3deg)"><img src="${gbr2}"></div>
<div class="band"><div class="isi">${isi}</div><div style="margin-top:28px;font-size:24px;opacity:.75">Edisi 1 · November 2026 · disusun dari aplikasi ARKAS Web yang berjalan dengan data contoh</div></div>
</body></html>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1240, height: 1754 } });
  await p.setContent(sampul({ warna: '#1e40af', warna2: '#1e3a8a', jenis: 'BUKU PANDUAN', judul: 'Panduan<br>ARKAS Web<br>untuk Sekolah', sub: 'Memahami penganggaran (RKAS) dan penatausahaan dana BOSP — konsep, aturan, dan alurnya',
    isi: 'Penganggaran · Penatausahaan · Perpajakan · Penutupan BKU · Permasalahan & solusi', gbr1: img('20-disahkan.png'), gbr2: img('25-saldo-bank.png') }));
  await p.screenshot({ path: path.join(__dirname, 'diagram', 'sampul-panduan.png') });
  await p.setContent(sampul({ warna: '#0f766e', warna2: '#115e59', jenis: 'BUKU TUTORIAL', judul: 'Tutorial<br>ARKAS Web<br>untuk Sekolah', sub: 'Langkah demi langkah, klik demi klik — lengkap dengan tangkapan layar bertanda',
    isi: 'Ikuti satu cerita sekolah dari mengaktifkan kertas kerja sampai laporan bulanan ditandatangani', gbr1: img('31-belanja-langkah3-pajak.png'), gbr2: img('13-juknis-ok.png') }));
  await p.screenshot({ path: path.join(__dirname, 'diagram', 'sampul-tutorial.png') });
  await b.close(); console.log('sampul ok');
})();
