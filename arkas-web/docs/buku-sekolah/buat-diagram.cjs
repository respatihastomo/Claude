#!/usr/bin/env node
// Merender diagram alur & mind map buku sekolah (HTML/SVG -> PNG lewat Playwright). Jalankan: node buat-diagram.cjs
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'diagram');
const W = { biru: '#1d4ed8', hijau: '#15803d', oranye: '#c2410c', ungu: '#7c3aed', merah: '#be123c', abu: '#475569', teal: '#0f766e', kuning: '#a16207' };
const MUDA = { biru: '#dbeafe', hijau: '#dcfce7', oranye: '#ffedd5', ungu: '#ede9fe', merah: '#ffe4e6', abu: '#f1f5f9', teal: '#ccfbf1', kuning: '#fef9c3' };
const css = `*{box-sizing:border-box;margin:0}body{font-family:Inter,'Segoe UI',system-ui,sans-serif;background:#fff;color:#0f172a;padding:28px;width:1400px}
h1{font-size:30px;font-weight:800;margin-bottom:4px} .sub{color:#475569;font-size:18px;margin-bottom:22px}
.k{border-radius:14px;padding:14px 16px;border:2px solid;font-size:18px;line-height:1.3;background:#fff}
.k b{display:block;font-size:19px;margin-bottom:3px} .k small{color:#334155;font-size:15px}
.ikon{font-size:26px;margin-right:6px} .pan{font-size:34px;color:#94a3b8;display:flex;align-items:center;justify-content:center;font-weight:700}
.baris{display:flex;align-items:stretch;gap:10px} .lbl{font-size:14px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}`;
const kotak = (w, judul, isi = '', ikon = '') => `<div class="k" style="border-color:${W[w]};background:${MUDA[w]}"><b style="color:${W[w]}">${ikon ? `<span class="ikon">${ikon}</span>` : ''}${judul}</b>${isi ? `<small>${isi}</small>` : ''}</div>`;
const halaman = (judul, sub, isi) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><h1>${judul}</h1><div class="sub">${sub}</div>${isi}</body></html>`;

/** Alur berbaris: langkah [{w, judul, isi, ikon}] dipotong per `perBaris`, arah ular (kiri→kanan lalu kanan→kiri). */
function alur(langkah, perBaris = 4) {
  const baris = []; for (let i = 0; i < langkah.length; i += perBaris) baris.push(langkah.slice(i, i + perBaris));
  return baris.map((b, bi) => {
    const isi = b.map((s, i) => `<div style="flex:1">${kotak(s.w, `${bi * perBaris + i + 1}. ${s.judul}`, s.isi, s.ikon)}</div>${i < b.length - 1 ? '<div class="pan">→</div>' : ''}`).join('');
    const turun = bi < baris.length - 1 ? `<div class="pan" style="font-size:17px;color:#64748b;margin:6px 0">⤵ lanjut ke baris berikutnya</div>` : '';
    return `<div class="baris">${isi}</div>${turun}`;
  }).join('');
}

/** Lajur peran: lajur [{nama, w}] dan sel [lajur, kolom, judul, isi, w]; panah antarsel berurutan. */
function lajur(lajurList, sel, kolom) {
  const tinggi = 150, lebarKol = (1340 - 190) / kolom;
  const pos = (l, c) => ({ x: 190 + c * lebarKol + 8, y: l * tinggi + 12 });
  const kot = sel.map(([l, c, j, isi, w]) => { const p = pos(l, c); return `<div class="k" style="position:absolute;left:${p.x}px;top:${p.y}px;width:${lebarKol - 34}px;border-color:${W[w]};background:${MUDA[w]}"><b style="color:${W[w]}">${j}</b><small>${isi}</small></div>`; }).join('');
  const lj = lajurList.map((x, i) => `<div style="position:absolute;left:0;top:${i * tinggi}px;width:1340px;height:${tinggi}px;border-top:2px dashed #cbd5e1;${i % 2 ? 'background:#f8fafc' : ''}"></div><div style="position:absolute;left:8px;top:${i * tinggi + 14}px;width:165px;font-weight:800;font-size:18px;color:${W[x.w]}">${x.ikon ?? ''} ${x.nama}</div>`).join('');
  const panah = []; for (let i = 0; i < sel.length - 1; i++) {
    const a = pos(sel[i][0], sel[i][1]), b = pos(sel[i + 1][0], sel[i + 1][1]); const w = lebarKol - 34;
    const x1 = a.x + w, y1 = a.y + 50, x2 = b.x, y2 = b.y + 50;
    panah.push(sel[i + 1][1] > sel[i][1] ? `<path d="M${x1} ${y1} C ${x1 + 20} ${y1}, ${x2 - 20} ${y2}, ${x2 - 4} ${y2}" />` : `<path d="M${a.x + w / 2} ${a.y + 100} L ${b.x + w / 2} ${b.y - 4}" />`);
  }
  if (sel.panahKhusus) panah.push(...sel.panahKhusus);
  return `<div style="position:relative;height:${lajurList.length * tinggi + 10}px">${lj}${kot}<svg style="position:absolute;left:0;top:0" width="1340" height="${lajurList.length * tinggi + 10}"><defs><marker id="m" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" refX="13" refY="8" orient="auto"><path d="M0,0 L16,8 L0,16 z" fill="#475569"/></marker></defs><g fill="none" stroke="#475569" stroke-width="2.5" marker-end="url(#m)">${panah.join('')}</g></svg></div>`;
}

/** Mind map: pusat + cabang [{judul, w, daun:[...]}] di kiri & kanan, garis lengkung SVG. */
function mindmap(pusat, cabang, tinggi = 860) {
  const LB = 300, cx = 670; const kiri = cabang.filter((_, i) => i % 2 === 1), kanan = cabang.filter((_, i) => i % 2 === 0);
  const tinggiKotak = (c) => 62 + c.daun.reduce((t, d) => t + Math.ceil((d.length + 2) / 27) * 26, 0) + (c.judul.length > 20 ? 30 : 0);
  const butuh = (d) => d.reduce((t, c) => t + tinggiKotak(c), 0) + (d.length - 1) * 34;
  tinggi = Math.max(tinggi, butuh(kiri) + 40, butuh(kanan) + 40);
  const cy = tinggi / 2;
  let svg = '', html = `<div class="k" style="position:absolute;left:${cx - 140}px;top:${cy - 52}px;width:280px;text-align:center;border-color:#0f172a;background:#0f172a;color:#fff;font-size:24px;font-weight:800;padding:22px">${pusat}</div>`;
  const sisi = (daftar, arah) => {
    let y0 = (tinggi - butuh(daftar)) / 2;
    daftar.forEach((c) => {
      const h = tinggiKotak(c); const y = y0 + h / 2; const bx = arah > 0 ? cx + 230 : cx - 230 - LB;
      html += `<div class="k" style="position:absolute;left:${bx}px;top:${y0}px;width:${LB}px;border-color:${W[c.w]};background:${MUDA[c.w]}"><b style="color:${W[c.w]}">${c.ikon ?? ''} ${c.judul}</b><small>${c.daun.map((d) => `• ${d}`).join('<br>')}</small></div>`;
      const x1 = cx + arah * 140, x2 = arah > 0 ? bx : bx + LB;
      svg += `<path d="M${x1} ${cy} C ${x1 + arah * 50} ${cy}, ${x2 - arah * 50} ${y}, ${x2} ${y}" stroke="${W[c.w]}" stroke-width="4" fill="none"/>`;
      y0 += h + 34;
    });
  };
  sisi(kanan, 1); sisi(kiri, -1);
  return `<div style="position:relative;height:${tinggi}px"><svg style="position:absolute;left:0;top:0" width="1340" height="${tinggi}">${svg}</svg>${html}</div>`;
}
const dua = (a, b) => `<div class="baris" style="gap:22px"><div style="flex:1">${a}</div><div style="flex:1">${b}</div></div>`;
const kartu = (w, judul, daftar) => `<div class="k" style="border-color:${W[w]};background:${MUDA[w]};padding:20px"><b style="color:${W[w]};font-size:24px;margin-bottom:10px">${judul}</b><div style="font-size:18px;line-height:1.6">${daftar.map((d) => `<div>• ${d}</div>`).join('')}</div></div>`;

const DIAGRAM = {
  'd01-peta-peran': halaman('Siapa mengerjakan apa?', 'Peran di ARKAS Web untuk satu sekolah — setiap orang hanya melihat menu sesuai perannya', `
    <div class="baris" style="gap:16px;margin-bottom:16px">
      <div style="flex:1">${kotak('biru', 'Operator Sekolah', 'Mengaktifkan & menyusun kertas kerja (RKAS), membuat pergeseran/perubahan, mengunggah dokumen bantuan, mengelola akun sekolah', '🧑‍💻')}</div>
      <div style="flex:1">${kotak('hijau', 'Bendahara', 'Ikut menyusun RKAS; mencatat penerimaan, tarik/setor tunai, belanja luring & SIPLah, setor pajak; rekonsiliasi & mengajukan tutup buku', '💰')}</div>
    </div>
    <div class="baris" style="gap:16px;margin-bottom:16px">
      <div style="flex:1">${kotak('ungu', 'Kepala Sekolah', 'Mengajukan RKAS ke Dinas; menyetujui/menolak setiap transaksi; menyetujui tutup buku & berita acara; menandatangani laporan; melihat HPP & jejak audit', '🧑‍🏫')}</div>
      <div style="flex:1">${kotak('teal', 'Komite Sekolah', 'Melihat RKAS, BKU, dan laporan (hanya baca) sebagai bentuk transparansi', '👀')}</div>
    </div>
    <div class="lbl" style="color:#64748b;margin:18px 0 10px">Di luar sekolah</div>
    <div class="baris" style="gap:16px">
      <div style="flex:1">${kotak('oranye', 'Verifikator Dinas', 'Menelaah, memberi catatan, mengembalikan, atau mengesahkan RKAS', '🏛️')}</div>
      <div style="flex:1">${kotak('abu', 'Balai SDSP / Pusat', 'Menetapkan referensi (komponen, kode rekening, tarif pajak) & pagu', '🗂️')}</div>
      <div style="flex:1">${kotak('kuning', 'Mitra SIPLah', 'Toko daring; mengirim transaksi belanja sekolah otomatis ke ARKAS', '🛒')}</div>
    </div>`),
  'd02-siklus-tahunan': halaman('Satu tahun anggaran dalam satu gambar', 'Urutan besar pekerjaan sekolah di ARKAS Web — dari pagu sampai laporan', alur([
    { w: 'abu', judul: 'Pagu ditetapkan', isi: 'Pusat menetapkan nilai BOSP sekolah', ikon: '📌' },
    { w: 'biru', judul: 'Aktifkan & susun', isi: 'Operator/Bendahara menyusun kertas kerja sesuai juknis', ikon: '📝' },
    { w: 'ungu', judul: 'Ajukan', isi: 'Kepala Sekolah mengajukan ke Dinas', ikon: '📤' },
    { w: 'oranye', judul: 'Telaah & sahkan', isi: 'Dinas mengesahkan → jadi RKAS', ikon: '✅' },
    { w: 'hijau', judul: 'Catat di BKU', isi: 'Penerimaan, belanja luring & SIPLah, pajak', ikon: '📒' },
    { w: 'ungu', judul: 'Setujui transaksi', isi: 'Kepala Sekolah memeriksa tiap transaksi', ikon: '👍' },
    { w: 'hijau', judul: 'Tutup buku bulanan', isi: 'Rekonsiliasi bank & kas, berita acara', ikon: '🔒' },
    { w: 'teal', judul: 'Laporan & evaluasi', isi: 'Laporan PDF bertanda tangan, HPP; bila perlu perubahan/pergeseran', ikon: '📊' },
  ], 4)),
  'd03-mindmap-aplikasi': halaman('Peta isi ARKAS Web untuk sekolah', 'Mind map menu dan pekerjaan utama — gunakan sebagai “peta jalan” buku ini', mindmap('ARKAS Web<br>Sekolah', [
    { judul: 'Penganggaran (RKAS)', w: 'biru', ikon: '📝', daun: ['Aktifkan kertas kerja', 'Susun baris per komponen', 'Cek kepatuhan juknis', 'Ajukan → disahkan Dinas', 'Perubahan & pergeseran'] },
    { judul: 'Penatausahaan', w: 'hijau', ikon: '📒', daun: ['BKU & BKP tunai/bank/pajak', 'Penerimaan & tarik tunai', 'Belanja luring (wizard)', 'Belanja daring (SIPLah)', 'Persetujuan Kepala Sekolah'] },
    { judul: 'Perpajakan', w: 'oranye', ikon: '🧾', daun: ['Dipungut otomatis', 'PPN, PPh 21/23, pajak daerah', 'Setor dengan NTPN', 'BKP Pajak'] },
    { judul: 'Tutup buku & laporan', w: 'ungu', ikon: '🔒', daun: ['Rekonsiliasi bank', 'Hitung kas fisik', 'Berita acara', 'Laporan PDF + tanda tangan'] },
    { judul: 'Pemantauan', w: 'teal', ikon: '📊', daun: ['HPP: rencana vs belanja SIPLah', 'Jejak audit', 'Bantuan pemerintah'] },
    { judul: 'Akun & peran', w: 'abu', ikon: '👤', daun: ['Masuk dengan SSO', 'Pilih/ganti peran', 'Kelola pengguna sekolah'] },
  ], 600)),
  'd04-alur-rkas': halaman('Alur penyusunan sampai pengesahan RKAS', 'Siapa melakukan apa, dan apa yang terjadi bila RKAS dikembalikan', lajur(
    [{ nama: 'Operator / Bendahara', w: 'biru', ikon: '🧑‍💻' }, { nama: 'Sistem', w: 'abu', ikon: '⚙️' }, { nama: 'Kepala Sekolah', w: 'ungu', ikon: '🧑‍🏫' }, { nama: 'Verifikator Dinas', w: 'oranye', ikon: '🏛️' }],
    [[0, 0, '1. Aktifkan', 'Versi 1 berstatus Draf', 'biru'], [0, 1, '2. Susun baris', 'Komponen, rekening, volume, harga', 'biru'], [1, 2, '3. Cek juknis', 'Total = pagu, batas komponen', 'abu'],
      [2, 3, '4. Ajukan', 'Status: Diajukan ke Dinas', 'ungu'], [3, 4, '5. Telaah', 'Catatan per baris; kembalikan / sahkan', 'oranye'], [1, 5, '6. RKAS berlaku', 'Periode BKU dibuka; data ke Mitra & HPP', 'hijau']], 6)
    + `<div style="margin-top:16px">${kotak('merah', '↩︎ Bila dikembalikan', 'Kertas kerja kembali menjadi Draf beserta alasan & catatan per baris. Operator memperbaiki, Kepala Sekolah mengajukan lagi (kembali ke langkah 2).')}</div>`),
  'd05-status-kk': halaman('Status kertas kerja', 'Setiap versi kertas kerja selalu berada di salah satu status ini', `
    <div class="baris" style="align-items:center;gap:0">
      <div style="flex:1">${kotak('abu', 'Draf', 'Boleh diubah oleh Operator/Bendahara')}</div><div class="pan" style="width:150px;flex-direction:column;font-size:15px;text-align:center">Ajukan<br><span style="font-size:34px">→</span><span style="font-size:13px">Kepala Sekolah</span></div>
      <div style="flex:1">${kotak('kuning', 'Diajukan ke Dinas', 'Terkunci; menunggu telaah')}</div><div class="pan" style="width:150px;flex-direction:column;font-size:15px;text-align:center">Sahkan<br><span style="font-size:34px">→</span><span style="font-size:13px">Dinas</span></div>
      <div style="flex:1">${kotak('hijau', 'Disahkan', 'Menjadi RKAS yang berlaku')}</div><div class="pan" style="width:150px;flex-direction:column;font-size:15px;text-align:center">Versi baru disahkan<br><span style="font-size:34px">→</span></div>
      <div style="flex:1">${kotak('abu', 'Diganti', 'Arsip versi lama')}</div>
    </div>
    <div style="margin:18px 0 0 270px;width:520px">${kotak('merah', '↩︎ Dikembalikan (Dinas)', 'Diajukan → kembali ke Draf, dengan alasan dan catatan per baris')}</div>`),
  'd06-perubahan-pergeseran': halaman('Perubahan atau pergeseran?', 'Keduanya dibuat dengan tombol “Buat pergeseran/perubahan” — bedanya pada pagu dan total anggaran', dua(
    kartu('biru', '📈 Perubahan anggaran', ['Terjadi karena <strong>pagu berubah</strong> (penetapan ulang, tambahan dana, SiLPA)', 'Total RKAS ikut berubah mengikuti pagu baru', 'Boleh menambah kegiatan/baris baru', 'Dibuat sebagai versi baru → diajukan → disahkan Dinas', 'Contoh: pagu Rp12 juta → Rp13,5 juta, tambah workshop KKG Rp1,5 juta']),
    kartu('hijau', '🔀 Pergeseran anggaran', ['<strong>Pagu tetap</strong>, total RKAS tetap', 'Memindahkan nilai dari satu baris ke baris lain', 'Baris tidak boleh dikurangi di bawah yang sudah dibelanjakan (realisasi)', 'Batas persentase komponen tetap berlaku', 'Dibuat sebagai versi baru → diajukan → disahkan Dinas', 'Contoh: kurangi cetak soal Rp210 ribu, tambahkan ke servis AC']))),
  'd07-alur-transaksi': halaman('Perjalanan satu transaksi di BKU', 'Setiap transaksi baru masuk saldo setelah disetujui Kepala Sekolah (pemisahan tugas)', alur([
    { w: 'hijau', judul: 'Bendahara mencatat', isi: 'Penerimaan, tarik tunai, belanja, setor pajak', ikon: '✍️' },
    { w: 'kuning', judul: 'Menunggu persetujuan', isi: 'Tampil di BKU, saldo belum berubah', ikon: '⏳' },
    { w: 'ungu', judul: 'Kepala Sekolah memeriksa', isi: 'Cek bukti/nota & kesesuaian RKAS', ikon: '🔍' },
    { w: 'teal', judul: 'Disetujui', isi: 'Masuk BKU & BKP, saldo & realisasi berubah, final', ikon: '✅' },
  ], 4) + `<div style="margin-top:18px">${kotak('merah', '✖ Ditolak', 'Transaksi tidak masuk BKU. Bendahara melihat alasannya di panel “Transaksi ditolak”, lalu menekan “Catat ulang” untuk memperbaiki.')}</div>`),
  'd08-luring-daring': halaman('Dua cara mencatat belanja', 'Belanja luring dicatat sendiri oleh Bendahara; belanja daring lewat SIPLah dikirim otomatis oleh Mitra', dua(
    `<div class="lbl" style="color:${W.hijau};margin-bottom:10px">🏪 Luring (toko / penyedia langsung)</div>` + alur([
      { w: 'hijau', judul: 'Belanja & terima nota', isi: 'Tunai atau transfer' }, { w: 'hijau', judul: 'Wizard langkah 1', isi: 'Tanggal, cara bayar, nota, toko, NPWP' },
      { w: 'hijau', judul: 'Langkah 2: pilih RKAS', isi: 'Baris, volume, harga' }, { w: 'hijau', judul: 'Langkah 3: pajak', isi: 'Dihitung otomatis → simpan' }], 1),
    `<div class="lbl" style="color:${W.kuning};margin-bottom:10px">🛒 Daring (SIPLah)</div>` + alur([
      { w: 'kuning', judul: 'Pesan di aplikasi Mitra', isi: 'Mitra membaca sisa anggaran RKAS' }, { w: 'kuning', judul: 'Transaksi masuk ARKAS', isi: 'Panel “Transaksi SIPLah” di BKU' },
      { w: 'kuning', judul: 'Petakan ke RKAS', isi: 'Pilih baris untuk barang tanpa kode' }, { w: 'kuning', judul: 'Catat ke BKU', isi: 'Non-tunai, pajak dihitung → disetujui Kepsek' }], 1))
    + `<div style="margin-top:16px">${kotak('teal', 'Setelah keduanya disetujui', 'Saldo & realisasi RKAS berkurang; belanja SIPLah juga dibandingkan dengan rencana di halaman HPP.')}</div>`),
  'd09-alur-pajak': halaman('Alur perpajakan di sekolah', 'Bendahara tidak perlu menghitung pajak — cukup memastikan disetor tepat waktu', alur([
    { w: 'hijau', judul: 'Belanja dicatat', isi: 'Kode rekening menentukan jenis pajak', ikon: '🧾' },
    { w: 'oranye', judul: 'Pajak dipungut', isi: 'PPN 11%, PPh 21/23, pajak daerah — otomatis', ikon: '⚙️' },
    { w: 'oranye', judul: 'BKP Pajak', isi: 'Muncul di “Pajak belum disetor”', ikon: '📋' },
    { w: 'abu', judul: 'Setor ke kas negara/daerah', isi: 'Bank/kantor pos/e-billing → dapat NTPN', ikon: '🏦' },
    { w: 'hijau', judul: 'Catat setor', isi: 'Centang pajak sejenis, isi tanggal & NTPN', ikon: '✍️' },
    { w: 'ungu', judul: 'Disetujui', isi: 'Saldo pajak kembali Rp0', ikon: '✅' },
  ], 3)),
  'd10-alur-tutup-buku': halaman('Alur penutupan BKU setiap bulan', 'Dilakukan setelah bulan berakhir; bulan berikutnya terbuka otomatis', alur([
    { w: 'hijau', judul: 'Bereskan transaksi', isi: 'Tidak ada yang menunggu persetujuan', ikon: '🧹' },
    { w: 'hijau', judul: 'Rekonsiliasi bank', isi: 'Saldo buku = rekening koran', ikon: '🏦' },
    { w: 'hijau', judul: 'Hitung kas fisik', isi: 'Uang di brankas = saldo tunai', ikon: '💵' },
    { w: 'hijau', judul: 'Ajukan penutupan', isi: 'Selisih? wajib dijelaskan', ikon: '📤' },
    { w: 'ungu', judul: 'Kepala Sekolah', isi: 'Periksa berita acara → setujui & tutup', ikon: '🧑‍🏫' },
    { w: 'teal', judul: 'Laporan PDF', isi: 'Dibuat otomatis → ditandatangani', ikon: '📄' },
  ], 3)),
  'd11-mindmap-bku': halaman('BKU dan buku kas pembantu', 'Satu transaksi bisa muncul di lebih dari satu buku — semuanya otomatis', mindmap('Buku Kas<br>Umum (BKU)', [
    { judul: 'BKP Tunai', w: 'hijau', ikon: '💵', daun: ['Tarik tunai (masuk)', 'Belanja tunai (keluar)', 'Setor tunai ke bank'] },
    { judul: 'BKP Bank', w: 'biru', ikon: '🏦', daun: ['Penerimaan dana BOSP', 'Belanja non-tunai & SIPLah', 'Setor pajak'] },
    { judul: 'BKP Pajak', w: 'oranye', ikon: '🧾', daun: ['Pungutan PPN/PPh/pajak daerah', 'Setoran dengan NTPN', 'Saldo pajak terutang'] },
    { judul: 'Penutupan & laporan', w: 'ungu', ikon: '🔒', daun: ['Ringkasan per buku', 'Rekonsiliasi', 'Laporan BKU bulanan'] },
  ], 500)),
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 200 }, deviceScaleFactor: 1.5 });
  for (const [nama, html] of Object.entries(DIAGRAM)) {
    await p.setContent(html); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(OUT, `${nama}.png`), fullPage: true }); console.log('diagram', nama);
  }
  await b.close();
})();
