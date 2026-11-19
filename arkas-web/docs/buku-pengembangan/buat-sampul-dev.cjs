// Sampul Dokumentasi Pengembangan ARKAS Web (A4 1240x1754). node buat-sampul-dev.cjs
const { chromium } = require('playwright');
const path = require('path');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1240px;height:1754px;font-family:Inter,'Segoe UI',system-ui,sans-serif;background:#0b1220;color:#fff;position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:56px 56px}
.glow{position:absolute;width:760px;height:760px;border-radius:50%;filter:blur(130px);opacity:.5}
.g1{background:#1d4ed8;top:-230px;right:-200px}.g2{background:#0f766e;bottom:-280px;left:-200px}
.isi{position:relative;padding:96px 86px}
.tag{display:inline-block;border:1.5px solid rgba(255,255,255,.4);border-radius:999px;padding:9px 20px;font-size:17px;letter-spacing:.17em;text-transform:uppercase}
h1{font-size:88px;line-height:1.03;font-weight:800;margin-top:34px;letter-spacing:-.02em}
h1 span{color:#5eead4}
.sub{font-size:27px;color:#cbd5e1;margin-top:26px;max-width:830px;line-height:1.45}
.pil{display:flex;flex-wrap:wrap;gap:12px;margin-top:40px}
.pil div{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);border-radius:10px;padding:10px 18px;font-size:19px}
.kode{position:absolute;left:86px;right:86px;top:830px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:30px 34px;font-family:'JetBrains Mono',Consolas,monospace;font-size:19px;line-height:1.95;color:#cbd5e1}
.kode b{color:#5eead4;font-weight:600}
.kode i{color:#64748b;font-style:normal}
.angka{position:absolute;left:86px;right:86px;top:1300px;display:flex;gap:18px}
.angka div{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:22px 20px}
.angka b{display:block;font-size:46px;font-weight:800;color:#fff}
.angka small{font-size:17px;color:#94a3b8}
.kaki{position:absolute;left:0;right:0;bottom:0;padding:34px 86px;background:rgba(0,0,0,.35);font-size:19px;color:#94a3b8;display:flex;justify-content:space-between}
</style></head><body>
<div class="grid"></div><div class="glow g1"></div><div class="glow g2"></div>
<div class="isi">
  <div class="tag">ARKAS Web · Dokumen Teknis</div>
  <h1>Dokumentasi<br><span>Pengembangan</span><br>Aplikasi</h1>
  <div class="sub">Arsitektur, model data, kontrak antarlayanan, keamanan, pengujian, dan cara menjalankan sistem — untuk tim pengembang dan pengelola teknis.</div>
  <div class="pil"><div>Monorepo pnpm + Turborepo</div><div>NestJS × 9</div><div>Next.js App Router</div><div>PostgreSQL 16</div><div>CloudEvents 1.0</div></div>
</div>
<div class="kode">
<i># menyiapkan dan menjalankan</i><br>
pnpm install<br>
node scripts/migrate.mjs <b>svc-penatausahaan</b> --seed<br>
./scripts/jalankan-svc.sh <b>svc-penatausahaan</b><br>
pnpm --filter web dev &nbsp;<i># http://localhost:3000</i>
</div>
<div class="angka">
  <div><b>9</b><small>layanan + web</small></div>
  <div><b>98</b><small>tabel basis data</small></div>
  <div><b>136</b><small>endpoint HTTP</small></div>
  <div><b>189</b><small>kasus uji</small></div>
</div>
<div class="kaki"><span>Edisi 1 · November 2026</span><span>Disusun dari kode yang berjalan</span></div>
</body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1240, height: 1754 } });
  await p.setContent(html); await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(__dirname, 'diagram', 'sampul-pengembangan.png') });
  await b.close(); console.log('sampul selesai');
})();
