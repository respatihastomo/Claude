#!/usr/bin/env node
// Diagram teknis Dokumentasi Pengembangan ARKAS Web. node buat-diagram-dev.cjs
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'diagram');
const W = { biru: '#1d4ed8', hijau: '#15803d', oranye: '#c2410c', ungu: '#7c3aed', merah: '#be123c', abu: '#475569', teal: '#0f766e', kuning: '#a16207' };
const MUDA = { biru: '#dbeafe', hijau: '#dcfce7', oranye: '#ffedd5', ungu: '#ede9fe', merah: '#ffe4e6', abu: '#f1f5f9', teal: '#ccfbf1', kuning: '#fef9c3' };
const css = `*{box-sizing:border-box;margin:0}body{font-family:Inter,'Segoe UI',system-ui,sans-serif;background:#fff;color:#0f172a;padding:26px;width:1400px}
h1{font-size:29px;font-weight:800;margin-bottom:4px}.sub{color:#475569;font-size:17px;margin-bottom:20px}
.k{border-radius:13px;padding:12px 14px;border:2px solid;font-size:17px;line-height:1.3;background:#fff}
.k b{display:block;font-size:18px;margin-bottom:3px}.k small{color:#334155;font-size:14px;display:block}
.m{font-family:'JetBrains Mono',Consolas,monospace;font-size:14px}
.baris{display:flex;align-items:stretch;gap:10px}.pan{font-size:30px;color:#94a3b8;display:flex;align-items:center;justify-content:center;font-weight:700}
.lbl{font-size:13px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#64748b;margin:16px 0 8px}`;
const kotak = (w, judul, isi = '', ikon = '') => `<div class="k" style="border-color:${W[w]};background:${MUDA[w]}"><b style="color:${W[w]}">${ikon ? ikon + ' ' : ''}${judul}</b>${isi ? `<small>${isi}</small>` : ''}</div>`;
const halaman = (judul, sub, isi) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><h1>${judul}</h1><div class="sub">${sub}</div>${isi}</body></html>`;
const kolom = (isi, gap = 10) => `<div class="baris" style="gap:${gap}px">${isi.map((x) => `<div style="flex:1">${x}</div>`).join('')}</div>`;
/** Alur berbaris dengan panah. */
const alur = (langkah, perBaris = 4) => {
  const baris = []; for (let i = 0; i < langkah.length; i += perBaris) baris.push(langkah.slice(i, i + perBaris));
  return baris.map((b, bi) => `<div class="baris">${b.map((s, i) => `<div style="flex:1">${kotak(s.w, `${bi * perBaris + i + 1}. ${s.judul}`, s.isi, s.ikon)}</div>${i < b.length - 1 ? '<div class="pan">→</div>' : ''}`).join('')}</div>${bi < baris.length - 1 ? '<div class="pan" style="font-size:16px;color:#64748b;margin:5px 0">⤵</div>' : ''}`).join('');
};
/** Tabel entitas untuk ERD sederhana. */
const entitas = (w, nama, kolomList, catatan) => `<div class="k" style="border-color:${W[w]};background:#fff;padding:0;overflow:hidden">
  <div style="background:${W[w]};color:#fff;font-weight:800;padding:8px 12px;font-size:17px">${nama}</div>
  <div style="padding:9px 12px" class="m">${kolomList.map((c) => `<div>${c}</div>`).join('')}</div>
  ${catatan ? `<div style="padding:7px 12px;background:${MUDA[w]};font-size:13px;color:#334155">${catatan}</div>` : ''}</div>`;

const DIAGRAM = {
  'p01-konteks': halaman('Diagram konteks sistem', 'Siapa dan apa yang berinteraksi dengan ARKAS Web', `
    <div class="baris" style="gap:14px;align-items:center">
      <div style="flex:1">${kotak('biru', 'Warga sekolah', 'Operator, Bendahara, Kepala Sekolah, Komite', '🏫')}</div>
      <div class="pan">→</div>
      <div style="flex:1.1">${kotak('abu', 'ARKAS Web', 'Peramban → Next.js (BFF) → 9 layanan NestJS → PostgreSQL per layanan', '🧩')}</div>
      <div class="pan">←</div>
      <div style="flex:1">${kotak('oranye', 'Dinas & Pusat', 'Verifikator/Admin Dinas, Direktorat, Balai SDSP, Pemantau, Auditor', '🏛️')}</div>
    </div>
    <div class="lbl">Sistem luar</div>
    ${kolom([
      kotak('ungu', 'Penyedia SSO (OIDC)', 'Authorization Code + PKCE; sumber identitas pengguna', '🔑'),
      kotak('kuning', 'Mitra SIPLah', 'API dua sisi: ARKAS → Mitra (pembukaan sumber dana, anggaran) dan Mitra → ARKAS (transaksi belanja)', '🛒'),
      kotak('teal', 'Kas negara / daerah', 'Setoran pajak dibuktikan dengan NTPN yang dicatat Bendahara', '🏦'),
    ], 14)}
    <div style="margin-top:14px">${kotak('merah', 'Batas tanggung jawab', 'ARKAS Web tidak memindahkan uang. Aplikasi mencatat, memvalidasi, dan melaporkan; perpindahan dana tetap lewat bank dan kanal resmi.')}</div>`),

  'p02-arsitektur': halaman('Arsitektur aplikasi', 'Satu monorepo, sembilan layanan NestJS, satu basis data per layanan', `
    <div class="lbl">Lapisan tampilan</div>
    ${kotak('biru', 'apps/web — Next.js App Router', 'Halaman server & klien, TanStack Query, Tailwind. <span class="m">middleware.ts</span> menjaga sesi; <span class="m">app/api/v1/[...path]/route.ts</span> bertindak sebagai BFF/gateway: menukar cookie sesi menjadi JWT internal lalu meneruskan ke layanan. — :3000', '🖥️')}
    <div class="lbl">Lapisan layanan (NestJS + SQL langsung lewat node-postgres)</div>
    ${kolom([
      kotak('abu', 'svc-referensi :3103', 'Wilayah, sekolah, sumber dana, komponen, kode rekening, tarif pajak — db_ref'),
      kotak('ungu', 'svc-identitas :3104', 'SSO OIDC, sesi, peran aktif, JWT internal & JWKS — db_auth'),
      kotak('hijau', 'svc-penatausahaan :3105', 'BKU, BKP, pajak, periode, penutupan — db_tatausaha'),
    ])}
    <div style="height:10px"></div>
    ${kolom([
      kotak('teal', 'svc-pelaporan :3106', 'Laporan BKU PDF & tanda tangan — db_pelaporan'),
      kotak('biru', 'svc-perencanaan :3107', 'Pagu, kertas kerja RKAS, penelaahan — db_perencanaan'),
      kotak('merah', 'svc-audit :3108', 'Jejak audit berantai hash SHA-256 — db_audit'),
    ])}
    <div style="height:10px"></div>
    ${kolom([
      kotak('kuning', 'svc-integrasi :3109', 'API Mitra SIPLah /mitra/v1, pembukaan sumber dana — db_integrasi'),
      kotak('oranye', 'svc-pemantauan :3110', 'HPP, serapan & kepatuhan, dasbor — db_pemantauan'),
      kotak('ungu', 'svc-bantuan :3111', 'Bantuan Pemerintah, penerima, penyaluran — db_banper'),
    ])}
    <div class="lbl">Paket bersama (packages/)</div>
    ${kolom([
      kotak('abu', 'aturan', 'Fungsi murni tanpa I/O: hitung pajak, tarif efektif, validasi juknis, transisi status, pemisahan tugas'),
      kotak('abu', 'kontrak', 'Skema Zod bersama, definisi CloudEvents 1.0, dan daftar topik broker'),
      kotak('abu', 'common-ms', 'DbContextService (RLS), ScopeGuard, ProblemFilter RFC 9457, Outbox Relay, Inbox Consumer, broker HTTP/Kafka'),
    ])}`),

  'p03-alur-event': halaman('Pertukaran data antarlayanan', 'Outbox–Inbox: satu transaksi basis data, pengiriman menyusul', `
    ${alur([
      { w: 'hijau', judul: 'Tulis data + outbox', isi: 'Perubahan domain dan baris <span class="m">outbox</span> disimpan dalam SATU transaksi', ikon: '💾' },
      { w: 'biru', judul: 'Outbox Relay', isi: 'Worker mengambil baris MENUNGGU dengan <span class="m">FOR UPDATE SKIP LOCKED</span>', ikon: '🔁' },
      { w: 'ungu', judul: 'Broker', isi: 'HTTP (dev) atau Kafka/Redpanda; muatan CloudEvents 1.0 JSON', ikon: '📡' },
      { w: 'teal', judul: 'Inbox Consumer', isi: 'Penerima mencatat <span class="m">event_id</span> di <span class="m">inbox_processed</span> → idempoten', ikon: '📥' },
      { w: 'oranye', judul: 'Proyeksi lokal', isi: 'Data disalin ke tabel <span class="m">*_lokal</span> milik layanan penerima', ikon: '🗂️' },
    ], 5)}
    <div style="margin-top:16px">${kolom([
      kotak('merah', 'Kegagalan pengiriman', 'Backoff eksponensial sampai batas percobaan; lewat batas → status MATI dan dipantau operator.'),
      kotak('abu', 'Kenapa tidak panggil API langsung?', 'Layanan tetap bisa menulis walau penerima sedang mati, dan tidak ada data yang hilang di tengah jalan.'),
      kotak('hijau', 'Idempoten', 'Event yang sama boleh datang dua kali; <span class="m">inbox_processed</span> membuat pemrosesan kedua tidak berefek.'),
    ], 14)}</div>`),

  'p04-topik': halaman('Peta topik event', 'Siapa menerbitkan, siapa mendengarkan', `
    <div class="baris" style="gap:14px">
      <div style="flex:1">${kotak('biru', 'arkas.perencanaan.kk-disahkan', 'svc-perencanaan → penatausahaan (buka periode, salin baris RKAS), integrasi (anggaran Mitra), pemantauan (rencana HPP)')}</div>
      <div style="flex:1">${kotak('hijau', 'arkas.tatausaha.transaksi-disetujui', 'svc-penatausahaan → pelaporan, perencanaan (realisasi baris), pemantauan (serapan)')}</div>
    </div>
    <div style="height:10px"></div>
    <div class="baris" style="gap:14px">
      <div style="flex:1">${kotak('teal', 'arkas.tatausaha.periode-ditutup', 'svc-penatausahaan → pelaporan (buat laporan PDF), pemantauan')}</div>
      <div style="flex:1">${kotak('abu', 'arkas.ref.referensi-diubah', 'svc-referensi → identitas, penatausahaan, perencanaan, integrasi, pemantauan, bantuan')}</div>
    </div>
    <div style="height:10px"></div>
    <div class="baris" style="gap:14px">
      <div style="flex:1">${kotak('kuning', 'arkas.integrasi.transaksi-mitra-diterima / -dibatalkan', 'svc-integrasi → penatausahaan (panel SIPLah), pemantauan (HPP)')}</div>
      <div style="flex:1">${kotak('ungu', 'arkas.banper.sumber-dana-disahkan / penyaluran-dicatat', 'svc-bantuan → referensi, perencanaan (pagu), integrasi, penatausahaan')}</div>
    </div>
    <div style="height:10px"></div>
    <div class="baris" style="gap:14px">
      <div style="flex:1">${kotak('merah', 'arkas.audit.dicatat', 'SEMUA layanan → svc-audit. Diterbitkan trigger <span class="m">catat_audit()</span> yang disertakan lewat <span class="m">-- #sertakan _bersama/audit.sql</span>')}</div>
      <div style="flex:1">${kotak('oranye', 'Lainnya', 'identitas.pengguna-dibuat, identitas.peran-diubah, pelaporan.laporan-ditandatangani, pemantauan.hpp-dihitung, banper.pengajuan-sekolah-diputuskan')}</div>
    </div>`),

  'p05-erd-perencanaan': halaman('Model data — svc-perencanaan', 'db_perencanaan · 12 tabel. Versi RKAS disimpan utuh, bukan ditimpa', `
    <div class="baris" style="gap:12px;align-items:flex-start">
      <div style="flex:1">${entitas('abu', 'pagu', ['npsn, tahun, sumber_dana_kode', 'nilai numeric(18,2)'], 'Jatah dana dari pusat; sumber kebenaran validasi total')}</div>
      <div class="pan">→</div>
      <div style="flex:1.15">${entitas('biru', 'kertas_kerja', ['id uuid PK', 'npsn, tahun, sumber_dana_kode', 'versi int, status varchar(10)', 'asal_kertas_kerja_id uuid', 'row_version int', 'diajukan_* / disahkan_* / catatan_kembali'], 'Status: DRAF → DIAJUKAN → DISAHKAN / DIGANTI')}</div>
      <div class="pan">→</div>
      <div style="flex:1.15">${entitas('hijau', 'baris_kertas_kerja', ['id uuid PK', 'kertas_kerja_id uuid FK', 'komponen_kode, kode_rekening', 'uraian, volume, satuan', 'harga_satuan, total', 'asal_baris_id, akar_baris_id'], '<b>akar_baris_id</b> menautkan baris yang sama lintas versi — dipakai memindahkan realisasi')}</div>
    </div>
    <div style="height:12px"></div>
    <div class="baris" style="gap:12px;align-items:flex-start">
      <div style="flex:1">${entitas('teal', 'jadwal_kas', ['baris_id uuid FK', 'bulan smallint (1–12)', 'nilai numeric(18,2)'], 'Rencana kas 12 bulan per baris')}</div>
      <div style="flex:1">${entitas('oranye', 'verifikasi / catatan_baris', ['kertas_kerja_id', 'baris_id, catatan', 'aksi, oleh, pada'], 'Jejak penelaahan Dinas')}</div>
      <div style="flex:1">${entitas('ungu', 'realisasi_baris_lokal', ['baris_akar_id', 'nilai_realisasi'], 'Proyeksi dari event transaksi-disetujui — jadi batas bawah saat pergeseran')}</div>
      <div style="flex:1">${entitas('abu', 'ref_*_lokal, outbox, inbox_processed', ['ref_sekolah_lokal', 'ref_komponen_lokal', 'ref_rekening_lokal'], 'Proyeksi referensi + infrastruktur pesan')}</div>
    </div>`),

  'p06-erd-penatausahaan': halaman('Model data — svc-penatausahaan', 'db_tatausaha · 18 tabel. Transaksi dipartisi per tahun', `
    <div class="baris" style="gap:12px;align-items:flex-start">
      <div style="flex:1">${entitas('abu', 'periode', ['npsn, tahun, bulan', 'status: BUKA / DIAJUKAN_TUTUP / TUTUP'], 'Gerbang pencatatan: di luar periode BUKA, transaksi ditolak')}</div>
      <div class="pan">→</div>
      <div style="flex:1.2">${entitas('hijau', 'transaksi (partisi per tahun)', ['id uuid PK', 'npsn, tanggal, jenis, buku', 'status: DICATAT / DISETUJUI / DITOLAK', 'no_bukti, uraian, alasan_tolak', 'dibuat_oleh / diputus_oleh'], 'transaksi_2025, _2026, _2027 — partisi RANGE pada tanggal')}</div>
      <div class="pan">→</div>
      <div style="flex:1.2">${entitas('biru', 'item_transaksi (partisi)', ['transaksi_id FK', 'rkas_baris_akar_id', 'volume, harga_satuan, total'], 'Menautkan belanja ke baris RKAS; dipakai menghitung sisa anggaran')}</div>
    </div>
    <div style="height:12px"></div>
    <div class="baris" style="gap:12px;align-items:flex-start">
      <div style="flex:1">${entitas('oranye', 'pajak', ['transaksi_id, jenis', 'dpp, tarif, nilai', 'ntpn, disetor_transaksi_id'], 'Satu baris per pungutan; NTPN unik')}</div>
      <div style="flex:1">${entitas('teal', 'rkas_baris_sah', ['baris_akar_id', 'kode_rekening, total'], 'Proyeksi RKAS yang disahkan (dari event)')}</div>
      <div style="flex:1">${entitas('ungu', 'rekonsiliasi', ['npsn, tahun, bulan', 'saldo_koran, kas_fisik', 'selisih_*, penjelasan_*'], 'Berita acara penutupan bulanan')}</div>
      <div style="flex:1">${entitas('kuning', 'transaksi_mitra_masuk / penyaluran_masuk', ['no_transaksi, status', 'payload jsonb'], 'Antrean dari svc-integrasi & svc-bantuan')}</div>
    </div>`),

  'p07-keamanan': halaman('Lapisan keamanan', 'Empat lapis, dari peramban sampai baris tabel', `
    ${alur([
      { w: 'ungu', judul: 'Sesi di peramban', isi: 'Cookie <span class="m">arkas_sesi</span> HttpOnly; middleware Next.js menolak halaman tanpa sesi', ikon: '🍪' },
      { w: 'biru', judul: 'JWT internal', isi: 'BFF menukar cookie ke JWT berumur pendek (EdDSA, JWKS dari svc-identitas) dan meneruskan sebagai Bearer', ikon: '🎫' },
      { w: 'hijau', judul: 'ScopeGuard', isi: 'Dekorator <span class="m">@Izinkan(...)</span> memeriksa peran & cakupan (npsn, wilayah, direktorat) di tiap endpoint', ikon: '🛡️' },
      { w: 'merah', judul: 'Row Level Security', isi: '66 kebijakan RLS; klaim disuntikkan per transaksi lewat <span class="m">set_config(app.*, …, true)</span>', ikon: '🔒' },
    ], 4)}
    <div class="lbl">Pengaman tambahan</div>
    ${kolom([
      kotak('oranye', 'Pemisahan tugas', 'Pembuat transaksi tidak boleh menyetujui transaksinya sendiri; pengajuan RKAS hanya oleh Kepala Sekolah'),
      kotak('abu', 'Dua peran basis data', '<span class="m">api_*_login</span> untuk permintaan pengguna, <span class="m">worker_*_login</span> untuk relay/konsumen — hak akses berbeda'),
      kotak('merah', 'Jejak audit', 'Trigger <span class="m">catat_audit()</span> di setiap tabel penting → svc-audit; rantai SHA-256 membuat penyuntingan diam-diam ketahuan'),
      kotak('kuning', 'Mitra SIPLah', 'OAuth2 client credentials + daftar IP + tanda tangan HMAC per permintaan'),
    ], 12)}`),

  'p08-alur-rkas-teknis': halaman('Alur teknis: kertas kerja sampai RKAS berlaku', 'Dari klik pengguna sampai efeknya di layanan lain', `
    ${alur([
      { w: 'biru', judul: 'POST /kertas-kerja', isi: 'svc-perencanaan membuat versi 1 DRAF, divalidasi paket <span class="m">aturan</span>', ikon: '📝' },
      { w: 'biru', judul: 'POST /baris', isi: 'Trigger <span class="m">cek_pagu</span> menolak bila total > pagu', ikon: '➕' },
      { w: 'ungu', judul: 'POST /ajukan', isi: 'Hanya KEPSEK; status → DIAJUKAN, kertas kerja terkunci', ikon: '📤' },
      { w: 'oranye', judul: 'POST /sahkan', isi: 'Verifikator Dinas; status → DISAHKAN, versi lama → DIGANTI', ikon: '✅' },
      { w: 'hijau', judul: 'Event kk-disahkan', isi: 'Outbox → broker, membawa snapshot seluruh baris', ikon: '📡' },
      { w: 'teal', judul: 'Efek di hilir', isi: 'penatausahaan membuka periode & menyalin baris; integrasi mengirim anggaran ke Mitra; pemantauan menyiapkan HPP', ikon: '⚙️' },
    ], 3)}`),

  'p09-alur-transaksi-teknis': halaman('Alur teknis: belanja sampai laporan', 'Jalur luring dan daring bertemu di tabel transaksi yang sama', `
    <div class="lbl">Luring — Bendahara mengetik</div>
    ${alur([
      { w: 'hijau', judul: 'POST /transaksi', isi: 'Validasi periode, saldo, sisa baris RKAS' },
      { w: 'hijau', judul: 'Hitung pajak', isi: 'Paket <span class="m">aturan</span>: DPP, PPN, PPh, SSPD dari kode rekening + NPWP' },
      { w: 'kuning', judul: 'status DICATAT', isi: 'Belum mengubah saldo' },
      { w: 'ungu', judul: 'POST /setujui', isi: 'Peran KEPSEK, bukan pembuat; status → DISETUJUI' },
    ], 4)}
    <div class="lbl">Daring — Mitra SIPLah mengirim</div>
    ${alur([
      { w: 'kuning', judul: 'POST /mitra/v1/transaksi', isi: 'svc-integrasi: OAuth2 + IP + HMAC' },
      { w: 'kuning', judul: 'Event transaksi-mitra-diterima', isi: 'Masuk <span class="m">transaksi_mitra_masuk</span> di penatausahaan' },
      { w: 'hijau', judul: 'Pemetaan ke baris RKAS', isi: 'Barang tanpa kode dipetakan Bendahara, lalu dicatat sebagai transaksi biasa' },
      { w: 'ungu', judul: 'Persetujuan', isi: 'Sama seperti jalur luring' },
    ], 4)}
    <div style="margin-top:14px">${kotak('teal', 'Setelah DISETUJUI', 'Event <span class="m">transaksi-disetujui</span> menggerakkan: saldo & BKP di penatausahaan, realisasi baris di perencanaan, serapan di pemantauan, dan data laporan di pelaporan. Saat periode ditutup, pelaporan membuat PDF laporan BKU.')}</div>`),

  'p10-pengembangan': halaman('Alur kerja pengembangan', 'Dari menyiapkan lingkungan sampai perubahan masuk ke cabang utama', `
    ${alur([
      { w: 'abu', judul: 'pnpm install', isi: 'Node 22, pnpm 10, PostgreSQL 16', ikon: '📦' },
      { w: 'biru', judul: 'Siapkan basis data', isi: '<span class="m">node scripts/migrate.mjs &lt;svc&gt; --seed</span> untuk tiap layanan', ikon: '🗄️' },
      { w: 'ungu', judul: 'Kunci dev & token', isi: '<span class="m">node scripts/dev-keys.mjs</span>, lalu salin <span class="m">.env.*.example</span>', ikon: '🔑' },
      { w: 'hijau', judul: 'Jalankan', isi: '<span class="m">./scripts/jalankan-svc.sh svc-…</span> dan <span class="m">next dev</span>', ikon: '▶️' },
    ], 4)}
    <div style="height:10px"></div>
    ${alur([
      { w: 'teal', judul: 'Tulis aturan dulu', isi: 'Logika bisnis murni di <span class="m">packages/aturan</span> beserta uji unitnya', ikon: '🧮' },
      { w: 'teal', judul: 'Migrasi SQL', isi: 'Berkas bernomor di <span class="m">db/&lt;svc&gt;/migrations</span>; dijalankan berurutan dan idempoten', ikon: '📐' },
      { w: 'oranye', judul: 'Endpoint & UI', isi: 'Controller NestJS + skema Zod di <span class="m">kontrak</span>, lalu halaman Next.js', ikon: '🔌' },
      { w: 'merah', judul: 'Uji & kirim', isi: '<span class="m">pnpm test</span>, <span class="m">pnpm typecheck</span>, lalu pull request', ikon: '✅' },
    ], 4)}`),

  'p11-pengujian': halaman('Piramida pengujian', '189 kasus uji: unit cepat di bawah, uji ujung-ke-ujung sedikit di atas', `
    <div style="max-width:980px;margin:0 auto">
      ${kotak('merah', '13 uji e2e peramban (apps/web/e2e)', 'Vitest + Playwright menjalankan alur nyata di aplikasi yang hidup: audit, bantuan, transaksi ditolak, pemantauan, referensi, SIPLah')}
      <div class="pan" style="font-size:22px">▲</div>
      ${kotak('oranye', '129 uji integrasi layanan (apps/svc-*/test)', 'Satu basis data uji per berkas (<span class="m">*_uji</span>), migrasi dijalankan ulang, lalu endpoint diuji lewat HTTP termasuk RLS dan trigger')}
      <div class="pan" style="font-size:22px">▲</div>
      ${kotak('hijau', '47 uji unit aturan (packages/aturan/test)', 'Fungsi murni tanpa basis data: hitung pajak, tarif efektif, validasi juknis, penutupan, peran, pemisahan tugas')}
    </div>
    <div style="margin-top:16px">${kolom([
      kotak('abu', 'Menjalankan', '<span class="m">pnpm test</span> (seluruh monorepo, berurutan) atau <span class="m">pnpm --filter svc-penatausahaan test</span>'),
      kotak('biru', 'Prinsip', 'Aturan bisnis diuji sebagai fungsi murni; basis data diuji dengan SQL asli, bukan tiruan'),
    ], 14)}</div>`),

  'p12-penyebaran': halaman('Penyebaran dan operasional', 'Lingkungan pengembangan sekarang, dan bentuk produksinya', `
    <div class="lbl">Pengembangan lokal (sekarang)</div>
    ${kolom([
      kotak('abu', 'Proses', '9 layanan NestJS (:3103–:3111), Next.js :3000, Mitra tiruan :3190 — dijalankan langsung dengan Node'),
      kotak('biru', 'Data', 'Satu PostgreSQL 16, sembilan basis data terpisah; <span class="m">docker compose up -d postgres</span>'),
      kotak('ungu', 'Broker', '<span class="m">BROKER=http</span>: event dikirim langsung lewat HTTP antar-proses, tanpa Kafka'),
    ], 12)}
    <div class="lbl">Produksi (arah yang disiapkan kode)</div>
    ${kolom([
      kotak('hijau', 'Kontainer per layanan', 'Setiap layanan punya build sendiri; penskalaan terpisah. Outbox Relay aman untuk banyak pod berkat <span class="m">SKIP LOCKED</span>'),
      kotak('teal', 'Broker sungguhan', '<span class="m">BROKER=kafka</span> ke Redpanda/Kafka; topik sama persis dengan mode HTTP'),
      kotak('oranye', 'Gateway', 'BFF Next.js digantikan API Gateway; penukaran sesi → JWT tetap pola yang sama'),
      kotak('merah', 'Pemantauan', 'Baris outbox berstatus MATI, antrean inbox, dan verifikasi rantai audit jadi sinyal utama'),
    ], 12)}`),
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 200 }, deviceScaleFactor: 1.5 });
  for (const [nama, html] of Object.entries(DIAGRAM)) {
    await p.setContent(html); await p.waitForTimeout(140);
    await p.screenshot({ path: path.join(OUT, `${nama}.png`), fullPage: true }); console.log('diagram', nama);
  }
  await b.close();
})();
