// Sampul Tutorial Menjalankan ARKAS Web di Windows. node buat-sampul-win.cjs
const { chromium } = require('playwright');
const path = require('path');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1240px;height:1754px;font-family:Inter,'Segoe UI',system-ui,sans-serif;background:#0a1a2f;color:#fff;position:relative;overflow:hidden}
.glow{position:absolute;width:820px;height:820px;border-radius:50%;filter:blur(140px);opacity:.45}
.g1{background:#0078d4;top:-250px;right:-220px}.g2{background:#16a34a;bottom:-300px;left:-220px}
.isi{position:relative;padding:92px 86px}
.tag{display:inline-block;border:1.5px solid rgba(255,255,255,.42);border-radius:999px;padding:9px 20px;font-size:17px;letter-spacing:.16em;text-transform:uppercase}
h1{font-size:84px;line-height:1.04;font-weight:800;margin-top:32px;letter-spacing:-.02em}
h1 span{color:#7dd3fc}
.sub{font-size:26px;color:#cbd5e1;margin-top:24px;max-width:840px;line-height:1.45}
.pil{display:flex;flex-wrap:wrap;gap:12px;margin-top:38px}
.pil div{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);border-radius:10px;padding:10px 18px;font-size:19px}
.kode{position:absolute;left:86px;right:86px;top:790px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:18px;padding:30px 34px;font-family:Consolas,monospace;font-size:19px;line-height:2;color:#cbd5e1}
.kode b{color:#7dd3fc;font-weight:600} .kode i{color:#64748b;font-style:normal}
.langkah{position:absolute;left:86px;right:86px;top:1230px;display:flex;gap:16px}
.langkah div{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:20px}
.langkah b{display:block;font-size:34px;font-weight:800;color:#7dd3fc}
.langkah small{font-size:17px;color:#cbd5e1;line-height:1.4;display:block;margin-top:6px}
.kaki{position:absolute;left:0;right:0;bottom:0;padding:32px 86px;background:rgba(0,0,0,.35);font-size:19px;color:#94a3b8;display:flex;justify-content:space-between}
</style></head><body>
<div class="glow g1"></div><div class="glow g2"></div>
<div class="isi">
  <div class="tag">ARKAS Web · Panduan Pemasangan</div>
  <h1>Menjalankan<br>ARKAS Web di<br><span>Komputer Windows</span></h1>
  <div class="sub">Dari komputer kosong sampai aplikasi terbuka di peramban: memasang prasyarat, menyiapkan sembilan basis data, menjalankan seluruh layanan, dan mengatasi masalah yang sering muncul.</div>
  <div class="pil"><div>Windows 10 / 11</div><div>Node.js 22</div><div>pnpm 10</div><div>PostgreSQL 16</div><div>PowerShell</div></div>
</div>
<div class="kode">
<i># tiga perintah utama</i><br>
.\\scripts\\windows\\<b>pasang-lokal.ps1</b> &nbsp;<i># sekali saja</i><br>
.\\scripts\\windows\\<b>jalankan-semua.ps1</b><br>
.\\scripts\\windows\\<b>hentikan-semua.ps1</b>
</div>
<div class="langkah">
  <div><b>1</b><small>Pasang Node, pnpm, dan PostgreSQL</small></div>
  <div><b>2</b><small>Jalankan skrip pemasangan sekali</small></div>
  <div><b>3</b><small>Nyalakan layanan dan buka localhost:3000</small></div>
</div>
<div class="kaki"><span>Edisi 1 · November 2026</span><span>Disertai skrip PowerShell siap pakai</span></div>
</body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1240, height: 1754 } });
  await p.setContent(html); await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(__dirname, 'diagram', 'sampul-windows.png') });
  await b.close(); console.log('sampul selesai');
})();
