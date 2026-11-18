// Membuat "Buku Panduan & Tutorial ARKAS Web untuk Sekolah" (DOCX) dengan docx-js.
// Jalankan dari folder ini: node buat-buku.cjs  → Buku-Panduan-ARKAS-Web.docx
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, PageBreak, TableOfContents, Footer, Header, PageNumber, LevelFormat,
  TabStopType,
} = require('docx');

const IMG = path.join(__dirname, '..', 'tutorial-sekolah');
const ALUR = path.join(__dirname, '..', 'panduan-docx', 'alur-kerja.png');
const BIRU = '1F4E8C';
const FONT = 'Calibri';

// ---------- teks inline: **tebal**, *miring*, `kode` ----------
function runs(teks, dasar = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let i = 0; let m;
  while ((m = re.exec(teks))) {
    if (m.index > i) out.push(new TextRun({ text: teks.slice(i, m.index), ...dasar }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...dasar }));
    else if (t.startsWith('`')) out.push(new TextRun({ text: t.slice(1, -1), font: 'Consolas', ...dasar }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...dasar }));
    i = m.index + t.length;
  }
  if (i < teks.length) out.push(new TextRun({ text: teks.slice(i), ...dasar }));
  return out;
}

// ---------- ukuran gambar dari header PNG ----------
function ukuranPng(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), data: b };
}

// ---------- penomoran gambar per bab ----------
let bab = 0; let nomorGambar = 0;
const anak = [];
const tambah = (...x) => anak.push(...x);

function H1(judul, nomor = true) {
  if (nomor) { bab += 1; nomorGambar = 0; }
  tambah(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(nomor ? `Bab ${bab}. ${judul}` : judul)] }));
}
const H2 = (judul) => tambah(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(judul)] }));
const H3 = (judul) => tambah(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(judul)] }));
const P = (teks) => tambah(new Paragraph({ children: runs(teks), spacing: { after: 140, line: 300 } }));
const LI = (items) => items.forEach((t) => tambah(new Paragraph({ numbering: { reference: 'poin', level: 0 }, children: runs(t), spacing: { after: 80, line: 290 } })));
let daftarNomor = 0;
const OL = (items) => { daftarNomor += 1; const ref = `nomor-${daftarNomor}`; nomorRefs.push(ref); items.forEach((t) => tambah(new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 80, line: 290 } }))); };
const nomorRefs = [];

function GAMBAR(file, keterangan, lebarCm = 16) {
  const full = file.startsWith('/') ? file : path.join(IMG, file);
  const { w, h, data } = ukuranPng(full);
  const maxW = Math.round(lebarCm / 2.54 * 96);
  const maxH = Math.round(20 / 2.54 * 96);
  let tw = maxW; let th = Math.round(h * maxW / w);
  if (th > maxH) { th = maxH; tw = Math.round(w * maxH / h); }
  nomorGambar += 1;
  tambah(
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 },
      children: [new ImageRun({ type: 'png', data, transformation: { width: tw, height: th }, altText: { title: keterangan, description: keterangan, name: path.basename(full) } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 },
      children: [new TextRun({ text: `Gambar ${bab}.${nomorGambar}  `, bold: true, size: 18, color: '555555' }), ...runs(keterangan, { italics: true, size: 18, color: '555555' })] }),
  );
}

// kotak catatan: TIPS / PENTING / INGAT
const GAYA = { TIPS: ['E8F5E9', '2E7D32', 'Tips'], PENTING: ['FFF3E0', 'E65100', 'Penting'], INGAT: ['E8F0FB', BIRU, 'Ingat'], CONTOH: ['F3F0FF', '5B3FB4', 'Contoh'] };
function KOTAK(jenis, teks) {
  const [isi, garis, label] = GAYA[jenis];
  const sel = new TableCell({
    width: { size: 9638, type: WidthType.DXA },
    shading: { fill: isi, type: ShadingType.CLEAR, color: 'auto' },
    margins: { top: 100, bottom: 100, left: 180, right: 180 },
    borders: { left: { style: BorderStyle.SINGLE, size: 24, color: garis }, top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
    children: [new Paragraph({ spacing: { after: 0, line: 290 }, children: [new TextRun({ text: `${label}: `, bold: true, color: garis }), ...runs(teks)] })],
  });
  tambah(new Table({ width: { size: 9638, type: WidthType.DXA }, columnWidths: [9638], rows: [new TableRow({ cantSplit: true, children: [sel] })] }), new Paragraph({ spacing: { after: 120 }, children: [] }));
}

function TABEL(kepala, baris, lebar) {
  const total = lebar.reduce((a, b) => a + b, 0);
  const garis = { style: BorderStyle.SINGLE, size: 4, color: 'A6B4C8' };
  const b = { top: garis, bottom: garis, left: garis, right: garis };
  const sel = (t, i, head) => new TableCell({
    width: { size: lebar[i], type: WidthType.DXA }, borders: b, margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: head ? { fill: 'E8EEF7', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: [new Paragraph({ spacing: { after: 0, line: 270 }, children: runs(t, head ? { bold: true } : {}) })],
  });
  tambah(new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: lebar,
    rows: [new TableRow({ tableHeader: true, cantSplit: true, children: kepala.map((t, i) => sel(t, i, true)) }), ...baris.map((r) => new TableRow({ cantSplit: true, children: r.map((t, i) => sel(t, i, false)) }))] }),
  new Paragraph({ spacing: { after: 160 }, children: [] }));
}

// ======================================================================
// SAMPUL
// ======================================================================
const sampul = [
  new Paragraph({ spacing: { before: 2400 }, children: [new TextRun({ text: 'ARKAS WEB', bold: true, color: BIRU, size: 28, characterSpacing: 40 })] }),
  new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text: 'Buku Panduan & Tutorial', bold: true, size: 64, color: '1A1A1A' })] }),
  new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: 'Pengelolaan Dana BOSP di Sekolah, Langkah demi Langkah', size: 32, color: '444444' })] }),
  new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BIRU, space: 1 } }, children: [] }),
  new Paragraph({ spacing: { before: 400, after: 80 }, children: [new TextRun({ text: 'Untuk:', bold: true, size: 26 })] }),
  ...['Operator Sekolah', 'Kepala Sekolah', 'Bendahara', 'Komite Sekolah'].map((t) => new Paragraph({ numbering: { reference: 'poin', level: 0 }, children: [new TextRun({ text: t, size: 26 })] })),
  new Paragraph({ spacing: { before: 2600 }, children: [new TextRun({ text: 'Edisi 2 · November 2026', size: 22, color: '666666' })] }),
  new Paragraph({ children: [new TextRun({ text: 'Berdasarkan aplikasi ARKAS Web versi uji coba. Gambar diambil dari aplikasi yang berjalan dengan data contoh.', size: 20, color: '666666', italics: true })] }),
];

// ======================================================================
// DAFTAR ISI
// ======================================================================
const daftarIsi = [
  new Paragraph({ pageBreakBefore: true, spacing: { after: 240 }, children: [new TextRun({ text: 'Daftar Isi', bold: true, size: 36, color: BIRU })] }),
  new TableOfContents('Daftar Isi', { hyperlink: true, headingStyleRange: '1-2' }),
];

// ======================================================================
// BAB 1 PENDAHULUAN
// ======================================================================
H1('Pendahuluan');
P('Halo, selamat datang! Buku ini nemenin kamu memakai ARKAS Web, aplikasi untuk mengelola dana BOSP sekolah: dari menyusun rencana anggaran (RKAS), mencatat uang masuk dan keluar, menyetor pajak, sampai laporan bulanan yang ditandatangani Kepala Sekolah.');
P('Bukunya sengaja ditulis santai, kayak ngobrol sama teman yang sudah lebih dulu paham aplikasinya. Tiap langkah ada gambarnya, jadi kamu tinggal mencocokkan layar di depanmu dengan gambar di buku.');

H2('1.1 Untuk siapa buku ini?');
P('Buku ini untuk empat peran di sekolah. Kamu nggak harus membaca semuanya: baca Bab 1 dan Bab 2 dulu, lalu loncat ke bab sesuai tugasmu.');
TABEL(['Peran', 'Tugas utama di ARKAS Web', 'Baca bab'], [
  ['Operator Sekolah', 'Menyusun RKAS sampai lolos aturan juknis, mendaftarkan pengguna sekolah', 'Bab 3'],
  ['Kepala Sekolah', 'Mengajukan RKAS ke Dinas, menyetujui/menolak transaksi, menutup buku bulanan, menandatangani laporan', 'Bab 4'],
  ['Bendahara', 'Mencatat penerimaan, tarik tunai, dan belanja; menyetor pajak; mengajukan tutup buku', 'Bab 5'],
  ['Komite Sekolah', 'Memantau RKAS, buku kas, pajak, dan laporan (hanya melihat)', 'Bab 6'],
], [2200, 5638, 1800]);

H2('1.2 ARKAS Web itu apa, sih?');
P('ARKAS Web adalah versi web dari aplikasi RKAS sekolah. Bedanya dengan cara lama: semua orang bekerja di satu tempat yang sama, setiap catatan langsung terlihat oleh Kepala Sekolah untuk disetujui, dan laporan bulanan dibuat otomatis tanpa perlu dicetak manual.');
LI([
  '**Satu akun SSO untuk semua.** Kamu masuk dengan akun SSO yang sama dengan layanan Kemendikdasmen lainnya.',
  '**Dua kunci untuk setiap transaksi.** Bendahara mencatat, Kepala Sekolah menyetujui. Orang yang sama nggak bisa melakukan keduanya.',
  '**Pajak dihitung otomatis.** Tarif PPN, PPh, dan pajak daerah (SSPD) mengikuti kode rekening dan wilayah sekolah.',
  '**Data aman per sekolah.** Kamu hanya bisa melihat data sekolahmu sendiri.',
]);

H2('1.3 Siapa melakukan apa');
P('Gambar berikut merangkum alur kerja setahun. Sekali setahun RKAS disusun dan disahkan; setiap bulan transaksi dicatat, disetujui, lalu buku ditutup dan laporan ditandatangani.');
GAMBAR(ALUR, 'Alur kerja ARKAS Web: siapa melakukan apa', 13);
KOTAK('INGAT', 'Nggak ada langkah yang bisa dilompati. Buku kas baru terbuka setelah RKAS disahkan Dinas, dan laporan baru dibuat setelah buku bulan itu ditutup.');

H2('1.4 Cara membaca buku ini');
LI([
  '**Kotak merah** di gambar menunjukkan tombol atau kolom yang perlu kamu klik atau isi. Label merahnya bilang apa yang harus dilakukan.',
  '**Langkah bernomor** dikerjakan berurutan dari atas ke bawah.',
  '**Kotak Tips** (hijau) berisi cara supaya kerjamu lebih cepat. **Kotak Penting** (oranye) berisi hal yang wajib diperhatikan supaya nggak salah.',
  'Nama tombol dan menu ditulis **tebal**, persis seperti tulisan di layar.',
  'Gambar diambil dari data contoh *SMP Negeri Contoh 1*. Angka dan nama di sekolahmu tentu akan berbeda.',
]);

H2('1.5 Yang baru di edisi ini');
LI([
  '**Pergeseran RKAS langkah demi langkah** (3.5): membuat versi baru, mengurangi baris, menambah baris, sampai siap diajukan lagi.',
  '**Referensi bisa berubah sewaktu-waktu** (3.6): Balai SDSP kini bisa menambah kode rekening, menonaktifkan kode lama, dan mengubah batas komponen langsung dari aplikasi. Perubahannya otomatis sampai ke sekolahmu.',
  '**Kotak transaksi ditolak dan tombol Catat ulang** untuk Bendahara (5.5).',
  '**Pesan baru di Penanganan Masalah**: `PAGU_TERLAMPAUI` dan `KODE_REKENING_TIDAK_DIKENAL`.',
]);

H2('1.6 Yang perlu disiapkan');
TABEL(['Peran', 'Siapkan ini sebelum mulai'], [
  ['Semua', 'Komputer/laptop dengan Chrome, Edge, atau Firefox versi terbaru; koneksi internet; akun SSO yang sudah didaftarkan'],
  ['Operator', 'Data pagu BOSP sekolah dan rencana kegiatan setahun (komponen, kode rekening, volume, harga)'],
  ['Bendahara', 'Rekening koran/mutasi bank, nota dan kuitansi belanja, bukti setor pajak (NTPN), uang tunai di brankas untuk dihitung tiap akhir bulan'],
  ['Kepala Sekolah', 'Waktu rutin untuk memeriksa transaksi (idealnya setiap hari atau dua hari sekali)'],
  ['Komite', 'Akun SSO yang didaftarkan Operator'],
], [2200, 7438]);

// ======================================================================
// BAB 2 MEMULAI
// ======================================================================
H1('Memulai: Masuk dan Mengenal Layar');
P('Bab ini berlaku untuk semua peran. Habis membaca bab ini, kamu sudah bisa masuk, memilih tugas, dan tahu bagian-bagian layar.');

H2('2.1 Masuk ke aplikasi');
H3('Langkah 1: Buka alamat ARKAS Web');
P('Buka browser, lalu ketik alamat ARKAS Web sekolahmu (biasanya dibagikan Operator atau Dinas).');
H3('Langkah 2: Masuk dengan SSO');
P('Klik **Masuk dengan SSO**, lalu masuk dengan email dan kata sandi akun SSO-mu.');
GAMBAR('o01-masuk.png', 'Halaman masuk ARKAS Web');
KOTAK('PENTING', 'Gambar di atas berasal dari lingkungan uji coba, jadi yang tampil daftar akun contoh. Di sekolahmu, halaman ini hanya berisi tombol **Masuk dengan SSO**.');
H3('Langkah 3: Pilih tugas (kalau diminta)');
P('Kalau kamu memegang lebih dari satu tugas, misalnya Bendahara sekaligus Operator, aplikasi menanyakan kamu mau masuk sebagai apa. Klik salah satu.');
GAMBAR('o02-pilih-peran.png', 'Halaman Pilih peran untuk akun yang memegang dua tugas', 12);
P('Kalau tugasmu cuma satu, halaman ini dilewati dan kamu langsung masuk ke halaman kerja.');

H2('2.2 Mengenal bagian-bagian layar');
P('Hampir semua halaman punya susunan yang sama. Coba cocokkan nomor di gambar dengan penjelasan di bawahnya (angka berada tepat di bawah kotak yang dimaksud).');
GAMBAR('a01-layar-bku.png', 'Bagian-bagian layar Penatausahaan (contoh: Bendahara)');
TABEL(['No.', 'Bagian', 'Gunanya'], [
  ['1', 'Menu utama', 'Pindah antarhalaman: **Penganggaran (RKAS)**, **Penatausahaan**, dan **Kelola pengguna** (khusus Operator)'],
  ['2', 'Tugas yang aktif', 'Menunjukkan kamu sedang bekerja sebagai apa. Klik untuk berganti tugas tanpa keluar'],
  ['3', 'Keluar', 'Mengakhiri sesi. Wajib diklik kalau memakai komputer bersama'],
  ['4', 'Ringkasan', 'Saldo tunai, saldo bank, realisasi terhadap pagu, dan status bulan berjalan'],
  ['5', 'Tab buku kas', 'Buku Kas Umum, BKP Tunai, BKP Bank, BKP Pajak, Penutupan Buku Kas, dan Laporan'],
  ['6', 'Tombol pencatatan', 'Hanya muncul untuk Bendahara: Catat penerimaan, Tarik tunai, + Catat belanja'],
], [800, 2300, 6538]);
P('Halaman Penganggaran (RKAS) susunannya mirip: versi dan status RKAS di kiri atas, panel pagu di kiri, dan tabel baris anggaran di kanan.');
GAMBAR('a02-layar-rkas.png', 'Bagian-bagian layar Penganggaran (RKAS): 1 versi & status, 2 pagu & komponen, 3 baris anggaran');

H2('2.3 Berganti tugas dan keluar');
OL([
  'Klik kotak **tugas yang aktif** di pojok kanan atas (nomor 2 pada Gambar 2.3).',
  'Pilih tugas lain. Halaman langsung menyesuaikan.',
  'Selesai bekerja? Klik **Keluar** (nomor 3).',
]);
KOTAK('TIPS', 'Tombol yang muncul selalu mengikuti tugas yang aktif. Kalau tombol yang kamu cari nggak ada, cek dulu kamu sedang masuk sebagai apa.');

// ======================================================================
// BAB 3 OPERATOR
// ======================================================================
H1('Tutorial Operator');
P('Tugas besarmu cuma dua: **menyusun RKAS** sampai lolos aturan juknis, dan **mendaftarkan warga sekolah** yang perlu akses. Ayo mulai.');
KOTAK('INGAT', 'Operator dan Bendahara sama-sama bisa menyusun RKAS, tapi yang mengajukan ke Dinas adalah Kepala Sekolah.');

H2('3.1 Menyusun RKAS');
H3('Langkah 1: Buka menu Penganggaran');
P('Masuk sebagai **Operator Sekolah**. Kamu langsung dibawa ke halaman **Penganggaran (RKAS)**.');
H3('Langkah 2: Aktifkan kertas kerja');
P('Tiap awal tahun anggaran, kertas kerja masih kosong. Klik **Aktifkan kertas kerja**. Cukup sekali setahun, kok.');
GAMBAR('o03-aktifkan.png', 'Tombol Aktifkan kertas kerja');
H3('Langkah 3: Cek pagu, lalu klik + Tambah baris');
P('Setelah aktif, **pagu** sekolahmu tampil di kiri. Pagu adalah batas total anggaran setahun dari Dinas. Klik **+ Tambah baris** untuk mulai mengisi.');
GAMBAR('o04-tambah-baris.png', 'Pagu sekolah dan tombol + Tambah baris');
H3('Langkah 4: Isi baris anggaran');
P('Laci isian muncul di kanan. Isi dari atas ke bawah:');
OL([
  '**Komponen BOSP**: pilih kegiatannya, misalnya *03. Kegiatan pembelajaran dan ekstrakurikuler*.',
  '**Kode rekening**: misalnya `5.1.02.01.01.0024` untuk alat tulis kantor.',
  '**Uraian**: tulis jelas barangnya, misalnya *Kertas HVS A4 & alat tulis kantor*.',
  '**Volume**, **Satuan**, dan **Harga satuan**.',
]);
GAMBAR('o05-laci-kosong.png', 'Laci Tambah baris RKAS sebelum diisi');
P('Kolom **Total** dihitung otomatis. Kalau sudah benar, klik **Simpan baris**.');
GAMBAR('o06-laci-isi.png', 'Laci Tambah baris sudah terisi; total Rp 2.220.000');
KOTAK('TIPS', 'Jadwal kas otomatis dibagi rata ke 12 bulan, jadi kamu nggak perlu mengisinya satu per satu.');
H3('Langkah 5: Perhatikan kotak kuning');
P('Selama pagu belum habis teranggarkan, ada kotak kuning **Belum dapat diajukan** yang memberi tahu sisa pagunya. Ini normal. Tambah terus barisnya sampai sisa pagu jadi Rp 0.');
GAMBAR('o07-sisa-pagu.png', 'Kotak kuning Belum dapat diajukan: masih ada sisa pagu');
H3('Langkah 6: Pastikan kotak hijau muncul');
P('Kalau semua baris lengkap dan sesuai aturan juknis, kotaknya berubah jadi hijau **Memenuhi aturan juknis**. Batas komponen, misalnya honor maksimal 20%, ditandai garis merah di bilahnya.');
GAMBAR('o08-juknis-ok.png', 'RKAS lengkap dengan kotak hijau Memenuhi aturan juknis');
P('Sekarang kabari Kepala Sekolah bahwa RKAS siap diajukan (lihat Bab 4).');

H2('3.2 Arti pesan pemeriksaan RKAS');
TABEL(['Pesan', 'Artinya', 'Yang dilakukan'], [
  ['Total anggaran melebihi pagu', 'Jumlah semua baris lebih besar dari pagu', 'Kurangi volume/harga atau hapus baris'],
  ['Masih ada pagu yang belum dianggarkan', 'Ada sisa pagu', 'Tambah baris sampai sisa Rp 0'],
  ['(Komponen) melebihi batas', 'Komponen dibatasi persentase', 'Kurangi baris di komponen itu'],
  ['Komponen / kode rekening tidak dikenal', 'Kode sudah tidak berlaku di referensi nasional', 'Pilih komponen atau rekening lain'],
], [3000, 3300, 3338]);

H2('3.3 Kalau RKAS dikembalikan Dinas');
P('Kadang Dinas mengembalikan RKAS untuk diperbaiki. Santai, ini biasa. Kamu akan melihat kotak **Dikembalikan Verifikator Dinas** berisi alasannya, plus **Catatan Dinas** di baris yang perlu dibenahi.');
GAMBAR('o09-dikembalikan.png', 'RKAS dikembalikan beserta alasan dan catatan per baris');
H3('Langkah 1: Klik Ubah di baris yang diberi catatan');
GAMBAR('o10-klik-ubah.png', 'Tombol Ubah pada baris yang diberi catatan');
H3('Langkah 2: Perbaiki, lalu simpan');
P('Perbaiki sesuai catatan. Di contoh ini uraiannya dilengkapi jumlah rapat dan peserta. Klik **Simpan baris**, lalu minta Kepala Sekolah mengajukan ulang.');
GAMBAR('o11-laci-ubah.png', 'Laci Ubah baris: uraian diperbaiki sesuai catatan Dinas');

H2('3.4 RKAS disahkan');
P('Kalau Dinas sudah setuju, status versi berubah jadi **Disahkan**. Bagian **Riwayat** mencatat kapan RKAS diajukan, dikembalikan, dan disahkan. Mulai saat ini Bendahara bisa mencatat transaksi.');
GAMBAR('o12-disahkan.png', 'RKAS berstatus Disahkan beserta riwayatnya');
KOTAK('PENTING', 'RKAS yang sudah disahkan nggak bisa diubah langsung. Pakai tombol **Buat pergeseran/perubahan** untuk membuat versi baru (lihat 3.5). Versi lama tetap tersimpan, dan total baris nggak boleh di bawah uang yang sudah dibelanjakan.');

H2('3.5 Membuat pergeseran RKAS');
P('Di tengah tahun, kebutuhan sekolah bisa berubah. Contohnya, sekolah perlu mencetak rapor, dan dananya diambil dari jasa kebersihan. Perubahan seperti ini dilakukan lewat **pergeseran**.');
H3('Langkah 1: Klik Buat pergeseran/perubahan');
P('Buka **Penganggaran (RKAS)**. Pada versi yang sudah disahkan, klik **Buat pergeseran/perubahan**.');
GAMBAR('p01-buat-pergeseran.png', 'Tombol Buat pergeseran/perubahan pada RKAS yang sudah disahkan');
H3('Langkah 2: Versi baru siap diubah');
P('Aplikasi membuat versi baru berstatus **Draf**, isinya salinan versi terakhir. Versi lama tetap berstatus *Disahkan* dan tetap dipakai Bendahara sampai versi baru disahkan.');
GAMBAR('p02-versi-draf.png', 'Versi 3 berstatus Draf; versi 2 tetap Disahkan');
H3('Langkah 3: Kurangi baris lain dulu');
P('Total RKAS nggak boleh melebihi pagu, jadi **kurangi dulu** baris yang dananya mau digeser. Klik **Ubah** di baris itu, ganti volumenya (di contoh ini jasa kebersihan dari 5 menjadi 4 bulan), lalu **Simpan baris**.');
GAMBAR('p04-kurangi-baris.png', 'Mengurangi volume jasa kebersihan dari 5 menjadi 4 bulan');
P('Sekarang muncul sisa pagu yang bisa dipakai untuk baris baru.');
GAMBAR('p05-sisa-pagu.png', 'Muncul sisa pagu Rp 1.110.000 setelah baris dikurangi');
H3('Langkah 4: Tambah baris baru');
P('Klik **+ Tambah baris** dan isi seperti biasa. Di contoh ini dipakai kode rekening baru *5.1.02.01.01.0029 Belanja Bahan Cetak* yang baru saja ditambahkan Balai SDSP.');
GAMBAR('p06-tambah-baris-baru.png', 'Baris baru memakai kode rekening baru; total pas senilai pengurangan');
H3('Langkah 5: Pastikan hijau, lalu minta diajukan');
P('Kalau kotak hijau **Memenuhi aturan juknis** muncul lagi, kabari Kepala Sekolah untuk mengajukan versi baru ke Dinas. Prosesnya sama seperti RKAS awal (3.3 dan 3.4).');
GAMBAR('p07-pergeseran-siap.png', 'Pergeseran siap diajukan: baris baru tersimpan, kotak hijau muncul');
KOTAK('PENTING', 'Baris yang sudah dibelanjakan (ada angka di kolom *Realisasi*) nggak bisa dihapus, dan totalnya nggak boleh dikurangi di bawah realisasinya.');

H2('3.6 Kalau referensi nasional berubah');
P('Daftar komponen, kode rekening, dan batasnya dikelola Balai SDSP. Setiap perubahan dari Balai otomatis sampai ke sekolahmu dalam hitungan detik. Ini yang perlu kamu tahu:');
LI([
  '**Kode rekening baru** langsung bisa dipakai saat menyusun RKAS atau pergeseran.',
  '**Kode rekening yang dinonaktifkan** nggak bisa dipakai untuk baris baru. Aplikasi akan menolaknya dengan pesan *tidak terdaftar atau nonaktif di referensi*.',
  '**Batas komponen** (misalnya honor maksimal 20%) bisa berubah sesuai juknis baru. Batas terbaru langsung tampil di panel pagu.',
  'RKAS yang sudah disahkan tetap berlaku. Aturan baru dipakai saat kamu menyusun atau mengajukan versi berikutnya.',
]);
GAMBAR('p03-kode-nonaktif.png', 'Kode rekening yang dinonaktifkan Balai ditolak saat menyimpan baris');
GAMBAR('p08-batas-berubah.png', 'Batas komponen terbaru dari Balai langsung tampil di panel pagu');
KOTAK('TIPS', 'Kalau kode rekening yang biasa dipakai tiba-tiba ditolak, tanyakan ke Dinas kode penggantinya. Biasanya Balai sudah menyediakan kode baru.');

H2('3.7 Mendaftarkan pengguna sekolah');
H3('Langkah 1: Buka Kelola pengguna');
P('Klik menu **Kelola pengguna**, lalu **+ Tambah pengguna**. Sebagai Operator, kamu bisa memberi tugas Bendahara, Kepala Sekolah, atau Komite Sekolah.');
GAMBAR('o13-pengguna.png', 'Halaman Kelola pengguna dan tombol + Tambah pengguna');
H3('Langkah 2: Isi data dan simpan');
OL([
  '**Email (akun SSO)**: harus persis sama dengan email SSO orangnya.',
  '**Nama lengkap**.',
  '**Peran**: pilih tugasnya. NPSN sekolah terisi otomatis.',
  'Klik **Simpan**.',
]);
GAMBAR('o14-pengguna-isi.png', 'Laci Tambah pengguna untuk anggota Komite');
H3('Langkah 3: Cek daftar pengguna');
P('Pengguna baru langsung muncul di daftar dan bisa masuk memakai SSO. Kalau tugasnya berakhir, klik **Cabut** di samping perannya.');
GAMBAR('o15-pengguna-baru.png', 'Pengguna baru sudah terdaftar sebagai Komite Sekolah');

// ======================================================================
// BAB 4 KEPALA SEKOLAH
// ======================================================================
H1('Tutorial Kepala Sekolah');
P('Bapak/Ibu Kepala Sekolah nggak perlu mencatat apa pun. Tugasnya **memeriksa dan memutuskan**: setuju atau tolak. Setiap keputusan tercatat atas nama Bapak/Ibu dan nggak bisa dibatalkan, jadi cek dulu baik-baik ya.');

H2('4.1 Masuk');
P('Masuk dengan akun SSO Kepala Sekolah. Bapak/Ibu langsung dibawa ke halaman **Penatausahaan** (Buku Kas Umum).');
GAMBAR('k01-masuk.png', 'Masuk dengan akun Kepala Sekolah');

H2('4.2 Mengajukan RKAS ke Dinas');
H3('Langkah 1: Periksa RKAS');
P('Setelah Operator bilang RKAS siap, buka menu **Penganggaran (RKAS)**. Pastikan ada kotak hijau *Memenuhi aturan juknis*.');
H3('Langkah 2: Klik Ajukan ke Dinas');
P('Klik **Ajukan ke Dinas**. Browser akan menampilkan kotak konfirmasi; klik **OK**.');
GAMBAR('k02-ajukan.png', 'Menu Penganggaran (RKAS) dan tombol Ajukan ke Dinas');
H3('Langkah 3: Tunggu hasil telaah');
P('Status berubah jadi **Diajukan ke Dinas** dan RKAS terkunci selama ditelaah. Kalau Dinas mengembalikan, Operator memperbaiki, lalu Bapak/Ibu klik **Ajukan ke Dinas** lagi.');
GAMBAR('k03-diajukan.png', 'Status RKAS: Diajukan ke Dinas');

H2('4.3 Menyetujui transaksi');
P('Setiap kali Bendahara mencatat sesuatu, halaman **Penatausahaan** menampilkan tulisan oranye *N transaksi menunggu persetujuan Anda*.');
OL([
  'Cek uraian, nilai, dan nomor bukti transaksi yang berstatus *Menunggu persetujuan*.',
  'Kalau cocok dengan bukti fisik, klik **Setujui**, lalu **OK** pada kotak konfirmasi.',
  'Uangnya baru masuk ke saldo setelah disetujui.',
]);
GAMBAR('k04-setujui.png', 'Transaksi penerimaan menunggu persetujuan');
P('Untuk belanja, pajak yang dipungut ikut tampil di baris bawahnya (misalnya *Pungut SSPD*). Jadi pajaknya bisa dicek sekalian.');
GAMBAR('k05-belanja.png', 'Belanja beserta baris pungutan pajaknya');
KOTAK('TIPS', 'Setoran pajak di tab **BKP Pajak** disetujui dengan cara yang sama.');

H2('4.4 Menolak transaksi');
P('Nota belum lengkap? Nilainya janggal? Klik **Tolak**, lalu tulis alasannya di kotak yang muncul. Alasan wajib diisi.');
GAMBAR('k06-tolak.png', 'Tombol Tolak pada belanja yang notanya belum lengkap');
P('Transaksi yang ditolak keluar dari Buku Kas Umum dan pindah ke kotak merah **transaksi ditolak** di atas tabel, lengkap dengan alasan yang Bapak/Ibu tulis. Bendahara melihat kotak yang sama, jadi nggak perlu menjelaskan ulang.');
GAMBAR('k06b-ditolak-kepsek.png', 'Kotak transaksi ditolak beserta alasannya');
KOTAK('INGAT', 'Transaksi yang ditolak nggak masuk saldo, dan pajaknya otomatis batal.');

H2('4.5 Menyetujui tutup buku bulanan');
H3('Langkah 1: Periksa berita acara');
P('Tiap akhir bulan Bendahara mengajukan tutup buku. Buka tab **Penutupan Buku Kas**. Di kanan ada **Berita acara pemeriksaan kas** yang membandingkan saldo buku dengan rekening koran dan uang tunai fisik. Idealnya selisihnya Rp 0 (hijau). Kalau ada selisih, pastikan penjelasan Bendahara masuk akal.');
GAMBAR('k07-berita-acara.png', 'Berita acara pemeriksaan kas dengan selisih Rp 0');
H3('Langkah 2: Setujui atau kembalikan');
P('Kalau sudah oke, klik **Setujui & tutup buku**: bulan itu dikunci permanen. Kalau masih ada yang salah, klik **Kembalikan** dan tulis alasannya.');
GAMBAR('k08-tutup-buku.png', 'Tombol Setujui & tutup buku dan Kembalikan');

H2('4.6 Membaca dan menandatangani laporan');
H3('Langkah 1: Buka tab Laporan');
P('Beberapa detik setelah buku ditutup, laporan BKU bulanan jadi otomatis. Buka tab **Laporan** dan klik **Lihat PDF** untuk membacanya.');
GAMBAR('k09-laporan.png', 'Laporan siap ditandatangani');
P('Isi PDF-nya: ringkasan per buku (tunai, bank, pajak) dan seluruh transaksi bulan itu.');
GAMBAR('k09b-pdf.png', 'Halaman pertama PDF Laporan Buku Kas Umum', 15);
H3('Langkah 2: Tandatangani');
P('Klik **Tandatangani**. Statusnya berubah jadi **Ditandatangani**. Beres untuk bulan ini!');
GAMBAR('k10-ditandatangani.png', 'Laporan berstatus Ditandatangani');
KOTAK('PENTING', 'Pada versi saat ini tanda tangannya masih simulasi (tombol bertuliskan *Tandatangani (simulasi)*) dan belum memakai TTE resmi BSrE.');

// ======================================================================
// BAB 5 BENDAHARA
// ======================================================================
H1('Tutorial Bendahara');
P('Nah, ini bab paling panjang, karena kamu yang mencatat semua uang masuk dan keluar. Pegang satu aturan emas: **semua catatanmu baru sah setelah disetujui Kepala Sekolah.** Sebelum itu statusnya *Menunggu persetujuan* dan belum mengubah saldo.');

H2('5.1 Sebelum RKAS disahkan');
P('Masuk sebagai **Bendahara**. Kalau RKAS belum disahkan Dinas, kamu akan melihat kotak *RKAS belum disahkan* dan tombol pencatatan belum muncul. Buku kas otomatis terbuka begitu RKAS disahkan.');
GAMBAR('b01-belum-disahkan.png', 'Kotak RKAS belum disahkan');

H2('5.2 Mencatat penerimaan dana BOSP');
H3('Langkah 1: Klik Catat penerimaan');
P('Saat buku kas baru terbuka, saldo masih Rp 0. Catat dulu dana yang masuk ke rekening sekolah.');
GAMBAR('b02-bku-kosong.png', 'Saldo bank masih nol; tombol Catat penerimaan');
H3('Langkah 2: Isi dan simpan');
OL([
  '**Tanggal**: tanggal dana masuk di rekening koran.',
  '**Uraian**: misalnya *Penerimaan dana BOSP Reguler tahap 2*.',
  '**Nilai (Rp)**: sesuai rekening koran.',
  '**No. bukti** (boleh kosong), lalu klik **Simpan**.',
]);
GAMBAR('b03-penerimaan.png', 'Dialog Catat penerimaan dana');
H3('Langkah 3: Minta persetujuan');
P('Catatanmu muncul dengan status **Menunggu persetujuan**. Minta Kepala Sekolah menyetujuinya.');
GAMBAR('b04-menunggu.png', 'Penerimaan berstatus Menunggu persetujuan');

H2('5.3 Menarik tunai');
P('Mau belanja pakai uang tunai? Tarik dulu dari rekening. Setelah penerimaan disetujui, klik **Tarik tunai**.');
GAMBAR('b05-tarik.png', 'Saldo bank sudah bertambah; tombol Tarik tunai');
P('Isi nilai yang ditarik, lalu **Simpan**. Ini juga perlu disetujui Kepala Sekolah sebelum saldo tunai bertambah.');
GAMBAR('b06-tarik-isi.png', 'Dialog Catat tarik tunai');
KOTAK('PENTING', 'Tarik tunai baru bisa disimpan kalau saldo bank cukup. Pastikan penerimaan sudah disetujui dulu.');

H2('5.4 Mencatat belanja');
P('Ini pekerjaan yang paling sering kamu lakukan. Pencatatan belanja terdiri atas tiga langkah dalam satu laci.');
H3('Langkah 1: Klik + Catat belanja');
GAMBAR('b07-catat-belanja.png', 'Tombol + Catat belanja');
H3('Langkah 2: Detail & saldo');
OL([
  'Isi **Tanggal transaksi**.',
  'Pilih **Cara bayar**: *Non-tunai (bank)* atau *Tunai*.',
  'Isi **No. bukti / nota**, **Nama toko / penyedia**, dan **Uraian belanja**.',
  'Hapus centang **Penyedia memiliki NPWP** kalau toko nggak punya NPWP (tarif PPh-nya lebih tinggi).',
  'Klik **Lanjut →**.',
]);
GAMBAR('b08-belanja-1.png', 'Langkah Detail & saldo');
KOTAK('TIPS', 'Kotak di bagian atas laci selalu menampilkan saldo tersedia dan saldo setelah belanja. Kalau saldo tunai kurang, aplikasi menawarkan tombol **Catat tarik tunai lebih dulu**.');
H3('Langkah 3: Pilih dari RKAS');
P('Ketik kata kunci (misalnya *makan*) di kolom pencarian, lalu klik baris RKAS yang mau dibelanjakan.');
GAMBAR('b09-belanja-2-cari.png', 'Mencari baris RKAS dengan kata kunci');
P('Sesuaikan volume dan harga satuan. Sisa anggaran baris itu tampil di bawah namanya; kalau melebihi sisa, kotaknya berubah merah. Klik **Lanjut →**.');
GAMBAR('b10-belanja-2-isi.png', 'Volume disesuaikan; sisa anggaran terlihat');
H3('Langkah 4: Pajak & simpan');
P('Pajak dihitung otomatis dari kode rekening dan wilayah sekolah. Di contoh ini kena pajak daerah (SSPD) 5% sesuai Perda. Baris **Dibayar ke penyedia** adalah uang yang benar-benar kamu bayarkan ke toko. Klik **Simpan belanja**.');
GAMBAR('b11-belanja-3.png', 'Langkah Pajak & simpan');
KOTAK('INGAT', 'Pajak yang dipotong bukan milik sekolah. Itu titipan yang wajib disetor ke kas negara/daerah (lihat 5.6).');

H2('5.5 Kalau catatanmu ditolak');
P('Nggak usah panik. Transaksi yang ditolak muncul di kotak merah **transaksi ditolak** di atas Buku Kas Umum, lengkap dengan alasan dari Kepala Sekolah, dan nggak masuk saldo.');
OL([
  'Baca alasannya (di contoh: nota servis belum distempel toko).',
  'Bereskan masalahnya dulu, misalnya minta toko menstempel nota.',
  'Klik **Catat ulang**. Formulir yang sesuai langsung terbuka: belanja membuka laci *Catat belanja*, penerimaan atau tarik tunai membuka dialognya dengan nilai yang sama, dan setor pajak membuka tab *BKP Pajak*.',
]);
GAMBAR('b12-ditolak.png', 'Kotak transaksi ditolak: alasan dan tombol Catat ulang');
GAMBAR('b12b-catat-ulang.png', 'Laci Catat belanja terbuka setelah klik Catat ulang');
KOTAK('TIPS', 'Kotak merah ini hilang sendiri setelah buku bulan itu ditutup.');

H2('5.6 Menyetor pajak');
H3('Langkah 1: Pilih pajak yang akan disetor');
P('Buka tab **BKP Pajak**. Di bagian *Pajak belum disetor*, centang pajak yang **sejenis** (misalnya semua SSPD), lalu klik tombol **Catat setor ...** di kanan atas.');
GAMBAR('b13-pilih-pajak.png', 'Centang pajak sejenis lalu klik Catat setor');
H3('Langkah 2: Isi NTPN dan simpan');
P('Salin **NTPN** (16 karakter) dari bukti setor bank atau e-billing, cek tanggal setor dan sumber dananya, lalu klik **Simpan setoran**.');
GAMBAR('b14-setor.png', 'Laci Catat setor pajak');
KOTAK('PENTING', 'Satu NTPN hanya bisa dipakai sekali. Setoran juga perlu disetujui Kepala Sekolah; kalau ditolak, pajaknya kembali terutang.');
H3('Langkah 3: Cek Buku Kas Pembantu Pajak');
GAMBAR('b15-bkp-pajak.png', 'Buku Kas Pembantu Pajak');
P('Mau melihat uang tunai atau bank saja? Pakai tab **BKP Tunai** dan **BKP Bank**.');
GAMBAR('b16-bkp-tunai.png', 'Tab BKP Tunai');

H2('5.7 Menutup buku di akhir bulan');
H3('Langkah 1: Cek daftar periksa');
P('Buka tab **Penutupan Buku Kas**. Semua butir **Daftar periksa penutupan** harus bercentang hijau: semua transaksi sudah diputuskan dan bulan sebelumnya sudah ditutup. Pajak belum disetor cuma muncul sebagai peringatan kuning, tapi sebaiknya disetor dulu.');
GAMBAR('b17-tutup-periksa.png', 'Daftar periksa penutupan');
H3('Langkah 2: Isi rekonsiliasi');
P('Isi **Saldo rekening koran akhir bulan** (lihat mutasi bank) dan **Hasil hitung kas fisik** (hitung uang di brankas). Kalau angkanya beda dengan buku, kolom **Penjelasan selisih** wajib diisi minimal 10 karakter.');
GAMBAR('b18-tutup-selisih.png', 'Ada selisih bank: kolom penjelasan wajib diisi');
H3('Langkah 3: Ajukan penutupan');
P('Kalau angkanya cocok (atau selisih sudah dijelaskan), klik **Ajukan penutupan** (nama bulan).');
GAMBAR('b19-tutup-ajukan.png', 'Rekening koran dan kas fisik cocok; tombol Ajukan penutupan');
P('Sekarang tunggu Kepala Sekolah. Selama menunggu, transaksi bulan itu dikunci.');
GAMBAR('b20-tutup-menunggu.png', 'Menunggu persetujuan Kepala Sekolah');

H2('5.8 Mengunduh laporan');
P('Setelah buku ditutup, laporan BKU bulanan muncul di tab **Laporan**. Klik **Lihat PDF** untuk membuka atau mengunduhnya.');
GAMBAR('b21-laporan.png', 'Tab Laporan untuk Bendahara');

// ======================================================================
// BAB 6 KOMITE
// ======================================================================
H1('Tutorial Komite Sekolah');
P('Sebagai Komite, Bapak/Ibu adalah **mata dan telinga** warga sekolah. Semua catatan keuangan bisa dilihat, tapi nggak ada yang bisa diubah, jadi santai saja: nggak ada tombol yang bisa bikin salah.');
H2('6.1 Minta didaftarkan Operator');
P('Komite masuk memakai akun SSO juga. Minta Operator mendaftarkan email SSO Bapak/Ibu dengan peran **Komite Sekolah** (lihat 3.7), lalu masuk seperti biasa.');
H2('6.2 Memantau ringkasan dan Buku Kas Umum');
P('Begitu masuk, halaman **Penatausahaan** tampil: ringkasan saldo, realisasi terhadap pagu, status bulan berjalan, dan Buku Kas Umum berisi transaksi yang sudah disetujui.');
GAMBAR('m01-beranda.png', 'Halaman Penatausahaan untuk Komite');
H2('6.3 Melihat RKAS');
P('Klik **Penganggaran (RKAS)** untuk melihat pagu, rincian komponen, dan setiap baris belanja beserta realisasinya.');
GAMBAR('m02-rkas.png', 'RKAS dilihat dari akun Komite');
H2('6.4 Mengecek pajak');
P('Di tab **BKP Pajak**, pastikan pajak yang dipotong dari belanja sudah disetor. Kalau ada pajak yang lama di *Pajak belum disetor*, boleh ditanyakan ke Bendahara.');
GAMBAR('m04-pajak.png', 'Tab BKP Pajak untuk Komite');
H2('6.5 Mengunduh laporan bulanan');
P('Buka tab **Laporan** dan klik **Lihat PDF**. Laporannya sama persis dengan yang ditandatangani Kepala Sekolah, jadi bisa langsung dipakai untuk rapat komite.');
GAMBAR('m03-laporan.png', 'Tab Laporan untuk Komite');

// ======================================================================
// BAB 7 PENANGANAN MASALAH
// ======================================================================
H1('Penanganan Masalah');
P('Tenang, hampir semua masalah ada penjelasannya. Bab ini membantu kamu memahami pesan yang muncul dan menyelesaikan masalah yang paling sering terjadi.');

H2('7.1 Cara membaca pesan dari aplikasi');
LI([
  '**Kotak merah** berarti aksi ditolak. Isinya kalimat penjelasan dan sebuah **kode** (misalnya `PERIODE_TERTUTUP`).',
  '**Kotak kuning** berarti peringatan: kamu masih bisa lanjut, tapi ada yang perlu diperhatikan.',
  '**Kotak hijau** berarti semua beres.',
]);
KOTAK('TIPS', 'Kalau perlu bantuan, kirim tangkapan layar kotak merahnya beserta kodenya ke Operator atau Dinas. Kode itu membantu mereka menemukan penyebabnya dengan cepat.');

H2('7.2 Daftar pesan yang sering muncul');
TABEL(['Pesan atau kode', 'Artinya', 'Yang perlu dilakukan'], [
  ['*RKAS belum disahkan*', 'Buku kas belum dibuka', 'Pastikan RKAS sudah diajukan Kepala Sekolah dan disahkan Dinas'],
  ['*Belum dapat diajukan* (kuning, di RKAS)', 'Masih ada sisa pagu atau komponen melebihi batas', 'Lengkapi baris sampai sisa pagu Rp 0 dan semua komponen dalam batas'],
  ['*Saldo tunai belum cukup* / *Saldo bank tidak cukup*', 'Uang di buku yang dipilih kurang', 'Catat penerimaan atau tarik tunai dulu, lalu tunggu disetujui'],
  ['`MELEBIHI_ANGGARAN`', 'Belanja melebihi sisa anggaran baris RKAS', 'Kurangi nilai, atau minta Operator membuat pergeseran RKAS'],
  ['`PEMISAHAN_TUGAS`', 'Orang yang mencatat mencoba menyetujui sendiri', 'Persetujuan harus oleh Kepala Sekolah'],
  ['`PERIODE_TERTUTUP`', 'Bulan itu sudah diajukan atau ditutup', 'Catat di bulan berjalan, atau minta Kepala Sekolah mengembalikan pengajuan tutup buku'],
  ['`PAGU_TERLAMPAUI`', 'Total RKAS akan melebihi pagu', 'Kurangi baris lain dulu, baru tambah atau besarkan baris (lihat 3.5)'],
  ['`KODE_REKENING_TIDAK_DIKENAL`', 'Kode rekening belum ada atau sudah dinonaktifkan Balai', 'Pakai kode rekening yang aktif; tanyakan kode pengganti ke Dinas'],
  ['`PERIODE_SEBELUMNYA_BELUM_DITUTUP`', 'Bulan sebelumnya belum ditutup', 'Tutup bulan sebelumnya lebih dulu'],
  ['`NTPN_TIDAK_VALID` / `NTPN_SUDAH_DIPAKAI`', 'NTPN bukan 16 karakter, atau sudah dipakai', 'Salin ulang NTPN dari bukti setor'],
  ['*Akun Anda belum memiliki peran aktif*', 'Akun SSO belum didaftarkan', 'Minta Operator atau Admin Dinas mendaftarkan emailmu'],
], [3000, 3100, 3538]);

H2('7.3 Masalah yang sering terjadi dan solusinya');
const KASUS = [
  ['Saya nggak bisa masuk', 'Akun SSO belum didaftarkan di sekolah, atau email yang didaftarkan berbeda dengan email SSO.', 'Minta Operator mengecek ejaan email di **Kelola pengguna**. Email harus persis sama dengan email SSO.'],
  ['Tombol yang dicari nggak ada', 'Kamu sedang aktif sebagai tugas lain (misalnya Operator, padahal mau mencatat sebagai Bendahara).', 'Ganti tugas di kotak pojok kanan atas (lihat 2.3).'],
  ['Tombol pencatatan belum muncul', 'RKAS belum disahkan Dinas, sehingga buku kas belum dibuka.', 'Cek status RKAS di menu **Penganggaran (RKAS)**. Kalau masih *Draf*, minta Kepala Sekolah mengajukan.'],
  ['Tarik tunai gagal disimpan', 'Saldo bank belum cukup karena penerimaan belum disetujui.', 'Minta Kepala Sekolah menyetujui penerimaan dulu, lalu ulangi tarik tunai.'],
  ['Baris RKAS baru ditolak: total melebihi pagu', 'Total semua baris akan lebih besar dari pagu.', 'Saat pergeseran, kurangi dulu baris yang dananya digeser, baru tambah baris baru (lihat 3.5).'],
  ['Kode rekening yang biasa dipakai ditolak', 'Kode itu dinonaktifkan Balai SDSP.', 'Pilih kode rekening lain yang aktif, atau tanyakan kode penggantinya ke Dinas (lihat 3.6).'],
  ['Baris belanja jadi merah', 'Nilai belanja melebihi sisa anggaran baris RKAS.', 'Kurangi volume/harga, pilih baris RKAS lain yang sesuai, atau minta Operator membuat pergeseran.'],
  ['Transaksi salah, padahal sudah disetujui', 'Transaksi yang disetujui sengaja dikunci demi jejak audit.', 'Catat transaksi koreksi dengan uraian yang menjelaskan kesalahannya. Jangan berharap bisa menghapus.'],
  ['Catatan saya hilang dari Buku Kas Umum', 'Transaksi itu ditolak Kepala Sekolah.', 'Lihat kotak merah **transaksi ditolak** di atas tabel, baca alasannya, perbaiki, lalu klik **Catat ulang** (lihat 5.5).'],
  ['Saldo rekening koran beda dengan buku', 'Ada mutasi bank yang belum dicatat, misalnya biaya administrasi atau bunga.', 'Catat dulu mutasi yang terlewat. Kalau selisihnya memang wajar, tulis penjelasan minimal 10 karakter.'],
  ['Tombol Ajukan penutupan abu-abu', 'Ada butir daftar periksa yang belum hijau, atau selisih belum dijelaskan.', 'Selesaikan transaksi yang masih menunggu persetujuan, tutup bulan sebelumnya, dan isi penjelasan selisih.'],
  ['Laporan berstatus Gagal dibuat', 'Sistem menemukan ketidakcocokan antara baris BKU dan ringkasan penutupan.', 'Hubungi Operator atau Dinas dengan menyertakan bulan laporan dan tangkapan layarnya.'],
  ['Tarif pajak daerah beda dengan sekolah lain', 'Tarif SSPD mengikuti Perda wilayah masing-masing yang ditetapkan Dinas.', 'Nggak perlu diubah. Kalau ragu, tanyakan ke Dinas wilayahmu.'],
];
KASUS.forEach(([masalah, sebab, solusi], i) => {
  H3(`Masalah ${i + 1}: ${masalah}`);
  tambah(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'Penyebab: ', bold: true, color: 'B23B3B' }), ...runs(sebab)] }));
  tambah(new Paragraph({ spacing: { after: 180 }, children: [new TextRun({ text: 'Solusi: ', bold: true, color: '2E7D32' }), ...runs(solusi)] }));
});

H2('7.4 Kebiasaan baik supaya masalah nggak muncul');
LI([
  '**Bendahara:** catat transaksi di hari yang sama dengan buktinya, dan simpan nota rapi sesuai nomor bukti.',
  '**Kepala Sekolah:** periksa transaksi yang menunggu persetujuan secara rutin, jangan menumpuk sampai akhir bulan.',
  '**Bendahara:** setor pajak sebelum akhir bulan, supaya tutup buku nggak tertahan peringatan.',
  '**Semua:** selalu klik **Keluar** di komputer bersama, dan jangan meminjamkan akun SSO.',
  '**Operator:** cabut peran orang yang sudah nggak bertugas (mutasi, pensiun, ganti bendahara).',
]);

// ======================================================================
// BAB 8 PENUTUP
// ======================================================================
H1('Penutup');
P('Selamat, kamu sudah sampai di akhir buku! Sekarang kamu sudah punya bekal lengkap untuk mengelola dana BOSP di ARKAS Web sesuai tugasmu.');
H2('8.1 Rangkuman rutinitas');
TABEL(['Kapan', 'Operator', 'Kepala Sekolah', 'Bendahara', 'Komite'], [
  ['Awal tahun', 'Aktifkan kertas kerja, susun RKAS', 'Ajukan RKAS ke Dinas', 'Bantu menyusun RKAS', 'Pelajari RKAS'],
  ['Setiap hari', '—', 'Setujui/tolak transaksi', 'Catat penerimaan, tarik tunai, belanja', '—'],
  ['Saat ada pungutan', '—', 'Setujui setoran pajak', 'Setor pajak (NTPN)', 'Cek BKP Pajak'],
  ['Akhir bulan', '—', 'Periksa berita acara, tutup buku, tanda tangani laporan', 'Rekonsiliasi & ajukan tutup buku', 'Unduh laporan'],
  ['Kapan saja perlu', 'Kelola pengguna, buat pergeseran RKAS', '—', 'Catat ulang transaksi yang ditolak', '—'],
], [1700, 2000, 2200, 2200, 1538]);
H2('8.2 Butuh bantuan?');
LI([
  'Pertanyaan soal akun dan peran: hubungi **Operator Sekolah**.',
  'Pertanyaan soal RKAS, pagu, dan tarif pajak daerah: hubungi **Dinas Pendidikan** wilayahmu.',
  'Saat melapor masalah, sertakan nama sekolah (NPSN), tugas yang aktif, langkah yang dilakukan, dan tangkapan layar kotak merah beserta kodenya.',
]);
H2('8.3 Catatan versi');
P('Buku ini (Edisi 2) disusun berdasarkan ARKAS Web versi uji coba (November 2026). Edisi ini menambahkan pergeseran RKAS dan dampak perubahan referensi dari Balai SDSP. Beberapa hal masih bersifat sementara: tanda tangan laporan masih simulasi (belum TTE BSrE), dan halaman masuk di lingkungan uji coba menampilkan akun contoh. Tampilan di sekolahmu bisa sedikit berbeda setelah aplikasi diperbarui.');
P('Terima kasih sudah membaca. Selamat bekerja, dan semoga pengelolaan dana sekolah makin rapi, transparan, dan tenang!');

// ======================================================================
// LAMPIRAN: GLOSARIUM
// ======================================================================
H1('Lampiran: Glosarium', false);
TABEL(['Istilah', 'Arti singkat'], [
  ['BOSP', 'Bantuan Operasional Satuan Pendidikan: dana dari pemerintah untuk operasional sekolah'],
  ['RKAS', 'Rencana Kegiatan dan Anggaran Sekolah: rencana belanja setahun'],
  ['Pagu', 'Batas total anggaran BOSP sekolah untuk satu tahun'],
  ['Komponen BOSP', 'Kelompok kegiatan yang boleh dibiayai BOSP, beberapa dibatasi persentasenya'],
  ['Kode rekening', 'Kode jenis belanja, misalnya 5.1.02.01.01.0024 untuk alat tulis kantor'],
  ['Juknis', 'Petunjuk teknis penggunaan dana BOSP'],
  ['Pergeseran', 'Perubahan RKAS setelah disahkan, disimpan sebagai versi baru'],
  ['BKU', 'Buku Kas Umum: catatan semua uang masuk dan keluar beserta saldonya'],
  ['BKP', 'Buku Kas Pembantu: rincian per jenis kas (tunai, bank, pajak)'],
  ['DPP', 'Dasar Pengenaan Pajak: nilai yang dipakai untuk menghitung pajak'],
  ['PPN / PPh 21 / PPh 23', 'Pajak pusat yang dipungut dari belanja tertentu'],
  ['SSPD', 'Pajak daerah (misalnya pajak restoran) yang tarifnya ditetapkan Perda wilayah'],
  ['NPWP', 'Nomor Pokok Wajib Pajak penyedia; tanpa NPWP, tarif PPh lebih tinggi'],
  ['NTPN', 'Nomor Transaksi Penerimaan Negara: 16 karakter pada bukti setor pajak'],
  ['Rekonsiliasi', 'Mencocokkan saldo buku dengan rekening koran dan uang tunai fisik'],
  ['Berita acara pemeriksaan kas', 'Ringkasan hasil rekonsiliasi yang diperiksa Kepala Sekolah saat tutup buku'],
  ['SSO', 'Single Sign-On: satu akun untuk masuk ke banyak layanan'],
  ['TTE', 'Tanda Tangan Elektronik'],
], [2800, 6838]);

// ======================================================================
// DOKUMEN
// ======================================================================
const doc = new Document({
  creator: 'ARKAS Web',
  title: 'Buku Panduan & Tutorial ARKAS Web',
  description: 'Panduan dan tutorial ARKAS Web untuk Operator, Kepala Sekolah, Bendahara, dan Komite Sekolah',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 36, bold: true, color: BIRU }, paragraph: { spacing: { before: 240, after: 240 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 28, bold: true, color: BIRU }, paragraph: { spacing: { before: 320, after: 120 }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 24, bold: true, color: '333333' }, paragraph: { spacing: { before: 220, after: 80 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'poin', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
      ...nomorRefs.map((reference) => ({ reference, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] })),
    ],
  },
  sections: [
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, children: sampul },
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, pageNumbers: { start: 1 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Buku Panduan & Tutorial ARKAS Web', size: 16, color: '888888' })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Halaman ', PageNumber.CURRENT], size: 18, color: '666666' })] })] }) },
      children: [...daftarIsi, ...anak],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(__dirname, 'Buku-Panduan-ARKAS-Web.docx');
  fs.writeFileSync(out, buf);
  console.log('ditulis', out, buf.length, 'byte;', anak.length, 'blok');
});
