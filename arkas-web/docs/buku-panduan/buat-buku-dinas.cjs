// Membuat "Buku Panduan & Tutorial ARKAS Web untuk Dinas Pendidikan" (DOCX) dengan docx-js.
// Jalankan dari folder ini: node buat-buku-dinas.cjs  → Buku-Panduan-ARKAS-Web-Dinas.docx
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, PageBreak, TableOfContents, Footer, Header, PageNumber, LevelFormat,
  TabStopType,
} = require('docx');

const IMG = path.join(__dirname, '..', 'tutorial-dinas');
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
// DAFTAR ISI
// ======================================================================
const daftarIsi = [
  new Paragraph({ pageBreakBefore: true, spacing: { after: 240 }, children: [new TextRun({ text: 'Daftar Isi', bold: true, size: 36, color: BIRU })] }),
  new TableOfContents('Daftar Isi', { hyperlink: true, headingStyleRange: '1-2' }),
];


// ======================================================================
// SAMPUL
// ======================================================================
const sampul = [
  new Paragraph({ spacing: { before: 2400 }, children: [new TextRun({ text: 'ARKAS WEB', bold: true, color: BIRU, size: 28, characterSpacing: 40 })] }),
  new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text: 'Buku Panduan & Tutorial', bold: true, size: 64, color: '1A1A1A' })] }),
  new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: 'Untuk Dinas Pendidikan: Menelaah RKAS, Mengelola Pengguna, dan Menetapkan Pajak Daerah', size: 32, color: '444444' })] }),
  new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BIRU, space: 1 } }, children: [] }),
  new Paragraph({ spacing: { before: 400, after: 80 }, children: [new TextRun({ text: 'Untuk:', bold: true, size: 26 })] }),
  ...['Verifikator Dinas (penelaah RKAS)', 'Admin Dinas (pengelola pengguna & pajak daerah)'].map((t) => new Paragraph({ numbering: { reference: 'poin', level: 0 }, children: [new TextRun({ text: t, size: 26 })] })),
  new Paragraph({ spacing: { before: 2800 }, children: [new TextRun({ text: 'Edisi 1 · November 2026', size: 22, color: '666666' })] }),
  new Paragraph({ children: [new TextRun({ text: 'Berdasarkan aplikasi ARKAS Web versi uji coba. Gambar diambil dari aplikasi yang berjalan dengan data contoh Dinas wilayah 3201.', size: 20, color: '666666', italics: true })] }),
];

// ======================================================================
// BAB 1 PENDAHULUAN
// ======================================================================
H1('Pendahuluan');
P('Halo, Bapak/Ibu di Dinas Pendidikan! Buku ini nemenin Bapak/Ibu memakai ARKAS Web dari sisi Dinas: menelaah dan mengesahkan RKAS sekolah, mengelola akun pegawai dan operator sekolah, serta menetapkan tarif pajak daerah sesuai Perda.');
P('Gaya bahasanya sengaja santai, biar enak dibaca sambil praktik. Setiap langkah ada tangkapan layarnya, jadi tinggal dicocokkan dengan layar di depan Bapak/Ibu.');

H2('1.1 Untuk siapa buku ini?');
TABEL(['Peran', 'Tugas utama di ARKAS Web', 'Baca bab'], [
  ['Verifikator Dinas', 'Menelaah RKAS yang diajukan sekolah di wilayahnya, memberi catatan per baris, mengembalikan atau mengesahkan', 'Bab 3'],
  ['Admin Dinas', 'Mendaftarkan dan mencabut akun Verifikator, Admin Dinas, dan Operator sekolah; menetapkan atau membebaskan pajak daerah (SSPD)', 'Bab 4 dan Bab 5'],
], [2400, 5438, 1800]);
P('Semua peran sebaiknya membaca Bab 1, Bab 2, Bab 6 (Penanganan Masalah), dan Bab 7 (Penutup).');

H2('1.2 Peran Dinas dalam ARKAS Web');
P('Di ARKAS Web, Dinas adalah **gerbang mutu** sebelum dana sekolah dipakai. Ada tiga hal yang dipegang Dinas:');
LI([
  '**Penelaahan RKAS.** Rencana anggaran sekolah baru bisa dipakai untuk belanja setelah disahkan Verifikator Dinas. Begitu disahkan, buku kas sekolah otomatis terbuka.',
  '**Pengelolaan akun.** Admin Dinas mendaftarkan pegawai Dinas dan Operator setiap sekolah. Operator sekolah lalu mendaftarkan Bendahara, Kepala Sekolah, dan Komite.',
  '**Pajak daerah.** Admin Dinas menetapkan tarif pajak daerah (SSPD) sesuai Perda wilayahnya. Tarif ini otomatis dipakai saat sekolah mencatat belanja.',
]);
KOTAK('INGAT', 'Semua yang Bapak/Ibu lihat dan kerjakan dibatasi pada **wilayah** tugas Bapak/Ibu (misalnya kabupaten 3201). Sekolah di wilayah lain nggak akan muncul, dan memang nggak bisa diubah.');

H2('1.3 Posisi Dinas dalam alur kerja');
P('Gambar berikut menunjukkan alur setahun. Kolom paling kanan adalah bagian Dinas: menelaah RKAS, lalu mengembalikan atau mengesahkannya.');
GAMBAR(ALUR, 'Alur kerja ARKAS Web; Dinas berada di kolom paling kanan', 13);

H2('1.4 Cara membaca buku ini');
LI([
  '**Kotak merah** di gambar menunjukkan tombol atau kolom yang perlu diklik atau diisi. Label merahnya menjelaskan apa yang harus dilakukan.',
  '**Langkah bernomor** dikerjakan berurutan.',
  '**Kotak Tips** (hijau) berisi cara supaya lebih cepat, **kotak Penting** (oranye) berisi hal yang wajib diperhatikan, dan **kotak Ingat** (biru) berisi aturan main yang perlu diingat.',
  'Nama tombol dan menu ditulis **tebal**, persis seperti di layar.',
  'Contoh di buku memakai Dinas wilayah **3201** dan sekolah *SMP Negeri Contoh 1*. Data di wilayah Bapak/Ibu tentu berbeda.',
]);

H2('1.5 Yang perlu disiapkan');
TABEL(['Peran', 'Siapkan ini sebelum mulai'], [
  ['Semua', 'Komputer/laptop dengan Chrome, Edge, atau Firefox terbaru; koneksi internet; akun SSO yang sudah diberi peran'],
  ['Verifikator Dinas', 'Juknis BOSP terbaru, daftar sekolah di wilayah, dan pedoman penelaahan internal Dinas'],
  ['Admin Dinas (akun)', 'SK penugasan pegawai Dinas dan Operator sekolah, beserta email SSO masing-masing'],
  ['Admin Dinas (pajak)', 'Perda/Perkada pajak daerah yang berlaku (nomor dan tahun), termasuk aturan pembebasan bila ada'],
], [2600, 7038]);

// ======================================================================
// BAB 2 MEMULAI
// ======================================================================
H1('Memulai: Masuk dan Mengenal Layar');
H2('2.1 Masuk ke aplikasi');
H3('Langkah 1: Buka alamat ARKAS Web');
P('Buka browser dan ketik alamat ARKAS Web yang dibagikan tim teknis.');
H3('Langkah 2: Masuk dengan SSO');
P('Klik **Masuk dengan SSO**, lalu masuk dengan email dan kata sandi akun SSO Bapak/Ibu.');
GAMBAR('v01-masuk.png', 'Halaman masuk; contoh akun Verifikator Dinas');
KOTAK('PENTING', 'Gambar di atas berasal dari lingkungan uji coba, jadi yang tampil daftar akun contoh. Di lingkungan resmi, halaman ini hanya berisi tombol **Masuk dengan SSO**.');
H3('Langkah 3: Halaman awal sesuai peran');
TABEL(['Peran', 'Halaman awal', 'Menu di bagian atas'], [
  ['Verifikator Dinas', 'Penelaahan (antrean RKAS)', 'Penganggaran (RKAS), Penelaahan'],
  ['Admin Dinas', 'Kelola pengguna', 'Kelola pengguna, Pajak daerah'],
], [2400, 3200, 4038]);
P('Kalau satu akun memegang lebih dari satu peran, aplikasi akan menanyakan Bapak/Ibu mau masuk sebagai apa. Peran bisa diganti kapan saja lewat kotak pilihan di pojok kanan atas, dan tombol **Keluar** ada di sebelahnya.');

H2('2.2 Mengenal layar penelaahan');
P('Layar yang paling sering dibuka Verifikator adalah halaman RKAS sekolah. Cocokkan nomor di gambar dengan tabel di bawahnya (angka berada tepat di bawah kotak yang dimaksud).');
GAMBAR('v03-rkas-diajukan.png', 'Bagian-bagian layar RKAS yang sedang ditelaah');
TABEL(['No.', 'Bagian', 'Gunanya'], [
  ['1', 'Versi & status', 'Versi RKAS beserta statusnya (*Diajukan ke Dinas*, *Disahkan*, *Diganti*). Klik versi lain untuk membandingkan'],
  ['2', 'Hasil pemeriksaan juknis', 'Hijau *Memenuhi aturan juknis* berarti pagu habis teranggarkan dan semua komponen dalam batas'],
  ['3', 'Tombol keputusan', '**Kembalikan** (dengan alasan) atau **Sahkan**'],
], [800, 2800, 6038]);
P('Di atasnya ada kotak **Antrean penelaahan wilayah Anda**, panel pagu dan komponen di kiri, tabel baris anggaran di kanan, dan **Riwayat** di bawah.');

// ======================================================================
// BAB 3 VERIFIKATOR
// ======================================================================
H1('Tutorial Verifikator Dinas');
P('Tugas Bapak/Ibu adalah memastikan RKAS sekolah layak dipakai: sesuai juknis, uraiannya jelas, dan masuk akal. Keputusannya cuma dua: **Sahkan** atau **Kembalikan** dengan alasan. Yuk, kita praktikkan dengan contoh pergeseran RKAS versi 2 dari SMP Negeri Contoh 1.');
KOTAK('INGAT', 'Verifikator nggak bisa mengubah isi RKAS. Kalau ada yang perlu diperbaiki, beri catatan dan kembalikan; sekolah yang memperbaikinya.');

H2('3.1 Melihat antrean penelaahan');
P('Setelah masuk, Bapak/Ibu langsung melihat halaman **Penelaahan**: daftar RKAS yang diajukan sekolah di wilayah Bapak/Ibu, lengkap dengan versi dan waktu pengajuan. Klik RKAS yang mau ditelaah.');
GAMBAR('v02-antrean.png', 'Antrean penelaahan: satu RKAS menunggu');
KOTAK('TIPS', 'Telaah yang paling lama diajukan lebih dulu, supaya sekolah nggak menunggu terlalu lama untuk mulai belanja.');

H2('3.2 Memeriksa RKAS');
P('Halaman RKAS sekolah terbuka dengan versi yang diajukan terpilih. Periksa hal-hal berikut:');
OL([
  '**Kotak pemeriksaan juknis** harus hijau. Kalau merah, tombol **Sahkan** nggak bisa diklik.',
  '**Panel pagu**: dianggarkan sama dengan pagu (*sisa Rp 0*) dan persentase tiap komponen dalam batas (garis merah = batas maksimal).',
  '**Tabel baris**: komponen dan kode rekening sesuai jenis belanja, uraian jelas, volume dan harga satuan wajar.',
  '**Kolom Realisasi** (untuk pergeseran): baris yang sudah dibelanjakan nggak boleh dikurangi di bawah realisasinya. Aplikasi menjaga ini otomatis.',
]);
GAMBAR('v03-rkas-diajukan.png', 'RKAS versi 2 berstatus Diajukan ke Dinas');

H2('3.3 Membandingkan dengan versi sebelumnya');
P('Untuk pergeseran atau perubahan, klik tab versi sebelumnya (misalnya **Versi 1**) untuk melihat apa yang berubah. Di contoh ini, jasa kebersihan dikurangi dari 6 menjadi 5 bulan, dan alat tulis kantor ditambah dari 40 menjadi 60 rim dengan nilai yang sama.');
GAMBAR('v04-versi-lama.png', 'Versi 1 (disahkan sebelumnya) dibuka untuk perbandingan');
KOTAK('TIPS', 'Fokuskan penelaahan pergeseran pada baris yang berubah. Baris lain sudah disahkan di versi sebelumnya.');

H2('3.4 Memberi catatan per baris');
H3('Langkah 1: Klik Catatan di baris yang dimaksud');
P('Setiap baris punya tombol **Catatan** di ujung kanan. Gunakan untuk menunjuk baris spesifik yang perlu dibenahi.');
GAMBAR('v05-klik-catatan.png', 'Tombol Catatan pada baris penambahan ATK');
H3('Langkah 2: Tulis catatannya');
P('Tulis catatan singkat dan jelas di kotak yang muncul, lalu klik **OK**. Catatan langsung tampil di bawah uraian baris, dan sekolah melihat catatan yang sama.');
GAMBAR('v06-catatan.png', 'Catatan Dinas tersimpan di bawah uraian baris');
KOTAK('TIPS', 'Tulis catatan yang bisa langsung dikerjakan, misalnya "Lampirkan jadwal ujian akhir sebagai dasar penambahan", bukan sekadar "Kurang jelas".');

H2('3.5 Mengembalikan RKAS');
H3('Langkah 1: Klik Kembalikan');
P('Kalau RKAS perlu diperbaiki, klik **Kembalikan**.');
GAMBAR('v07-kembalikan.png', 'Tombol Kembalikan');
H3('Langkah 2: Tulis alasan');
P('Tulis alasan pengembaliannya (wajib, minimal 3 karakter), lalu klik **OK**. Status RKAS kembali menjadi *Draf*, sekolah melihat kotak *Dikembalikan Verifikator Dinas* beserta alasan Bapak/Ibu, dan semua tercatat di **Riwayat**.');
GAMBAR('v08-dikembalikan.png', 'RKAS dikembalikan; alasan tercatat di Riwayat');
P('RKAS yang dikembalikan keluar dari antrean, jadi antrean Bapak/Ibu kosong lagi sampai sekolah mengajukan ulang.');
GAMBAR('v09-antrean-kosong.png', 'Antrean penelaahan kosong setelah RKAS dikembalikan');

H2('3.6 Mengesahkan RKAS');
H3('Langkah 1: Buka RKAS yang diajukan ulang');
P('Setelah sekolah memperbaiki dan Kepala Sekolah mengajukan ulang, RKAS muncul lagi di antrean. Buka dan cek perbaikannya; di contoh ini uraiannya sudah dilengkapi jumlah peserta dan jadwal.');
H3('Langkah 2: Klik Sahkan');
P('Kalau semua sudah sesuai, klik **Sahkan**, lalu **OK** pada kotak konfirmasi.');
GAMBAR('v10-sahkan.png', 'Baris sudah diperbaiki sekolah; tombol Sahkan');
H3('Langkah 3: Cek status dan riwayat');
P('Status versi berubah menjadi **Disahkan**, versi lama berubah menjadi *Diganti*, dan **Riwayat** mencatat seluruh perjalanan penelaahan: diajukan, dikembalikan beserta alasan, diajukan ulang, dan disahkan.');
GAMBAR('v11-disahkan.png', 'RKAS versi 2 Disahkan beserta riwayat lengkap');

H2('3.7 Apa yang terjadi setelah disahkan?');
LI([
  'RKAS yang disahkan otomatis dikirim ke modul penatausahaan sekolah. Untuk RKAS pertama, buku kas sekolah langsung terbuka dan Bendahara bisa mulai mencatat.',
  'Untuk pergeseran, realisasi yang sudah ada terbawa ke versi baru, jadi sisa anggaran tiap baris tetap akurat.',
  'Catatan Dinas tetap tersimpan di baris sebagai jejak audit.',
]);
KOTAK('PENTING', 'Pengesahan nggak bisa dibatalkan. Kalau ternyata ada yang keliru, sekolah perlu membuat pergeseran baru untuk ditelaah lagi.');

// ======================================================================
// BAB 4 ADMIN DINAS: PENGGUNA
// ======================================================================
H1('Tutorial Admin Dinas: Mengelola Pengguna');
P('Akun yang rapi adalah fondasi keamanan. Sebagai Admin Dinas, Bapak/Ibu memegang kunci siapa saja yang boleh bekerja di ARKAS Web wilayah Bapak/Ibu.');

H2('4.1 Siapa boleh memberi peran apa');
TABEL(['Pemberi', 'Boleh memberikan peran', 'Cakupan'], [
  ['Admin Dinas', 'Admin Dinas, Verifikator Dinas, Operator Sekolah', 'Wilayahnya sendiri (dan sekolah di dalamnya)'],
  ['Operator Sekolah', 'Bendahara, Kepala Sekolah, Komite Sekolah', 'Sekolahnya sendiri'],
], [2400, 4200, 3038]);
KOTAK('INGAT', 'Bapak/Ibu nggak bisa memberi atau mencabut peran untuk diri sendiri. Itu bagian dari pemisahan tugas.');

H2('4.2 Mengenal halaman Kelola pengguna');
P('Setelah masuk, Admin Dinas langsung melihat halaman **Kelola pengguna**. Di atas tertulis peran apa saja yang bisa Bapak/Ibu berikan. Tabel di bawahnya berisi semua pengguna dalam cakupan Bapak/Ibu beserta perannya.');
GAMBAR('d01-masuk.png', 'Masuk dengan akun Admin Dinas');
GAMBAR('d02-pengguna.png', 'Halaman Kelola pengguna Admin Dinas');

H2('4.3 Menambah Verifikator Dinas');
H3('Langkah 1: Klik + Tambah pengguna');
H3('Langkah 2: Isi data');
OL([
  '**Email (akun SSO)**: harus persis sama dengan email SSO pegawai tersebut.',
  '**Nama lengkap**.',
  '**Peran**: pilih *Verifikator Dinas*.',
  '**Kode wilayah**: terisi otomatis dengan wilayah Bapak/Ibu (misalnya 3201). Bisa diisi kode yang lebih sempit di dalam wilayah Bapak/Ibu.',
  'Klik **Simpan**.',
]);
GAMBAR('d03-tambah-verifikator.png', 'Laci Tambah pengguna untuk Verifikator Dinas');
H3('Langkah 3: Cek daftar');
P('Pengguna baru langsung muncul di tabel dan bisa masuk memakai SSO.');
GAMBAR('d04-verifikator-baru.png', 'Verifikator baru sudah terdaftar');
KOTAK('TIPS', 'Kalau email itu sudah terdaftar di wilayah Bapak/Ibu, peran baru cukup ditambahkan ke akun yang sama. Nggak perlu membuat akun dobel.');

H2('4.4 Menambah Operator sekolah');
P('Setiap sekolah butuh minimal satu Operator. Operator inilah yang nanti mendaftarkan Bendahara, Kepala Sekolah, dan Komite di sekolahnya.');
OL([
  'Klik **+ Tambah pengguna**.',
  'Isi email SSO dan nama lengkap Operator.',
  'Pilih peran **Operator Sekolah**.',
  'Isi **NPSN sekolah** (8 digit). Sekolah harus berada di wilayah Bapak/Ibu.',
  'Klik **Simpan**.',
]);
GAMBAR('d05-tambah-operator.png', 'Laci Tambah pengguna untuk Operator Sekolah; isi NPSN');

H2('4.5 Mencabut peran');
P('Kalau pegawai mutasi, pensiun, atau tugasnya berakhir, segera cabut perannya. Klik **Cabut** di samping peran yang dimaksud.');
GAMBAR('d06-cabut.png', 'Tombol Cabut di samping peran Operator Sekolah');
P('Tulis alasan pencabutan (wajib) di kotak yang muncul, lalu klik **OK**. Peran yang dicabut tampil dicoret dan langsung nggak bisa dipakai lagi.');
GAMBAR('d07-setelah-cabut.png', 'Peran yang dicabut tampil dicoret');
KOTAK('PENTING', 'Mencabut peran nggak menghapus jejak pekerjaan orang itu. Semua transaksi dan keputusan yang pernah dibuatnya tetap tercatat untuk audit.');

// ======================================================================
// BAB 5 ADMIN DINAS: PAJAK DAERAH
// ======================================================================
H1('Tutorial Admin Dinas: Pajak Daerah');
P('Tarif pajak daerah (SSPD), misalnya pajak restoran untuk belanja makan minum, bisa berbeda di tiap kabupaten/kota sesuai Perda. Di bab ini Bapak/Ibu belajar menetapkan dan membebaskan tarif itu.');

H2('5.1 Cara tarif dipilih');
LI([
  'Pusat menetapkan **tarif nasional** sebagai bawaan.',
  'Dinas boleh menetapkan **tarif wilayah** sesuai Perda. Tarif ini menggantikan tarif nasional untuk sekolah di wilayah itu.',
  'Kalau ada tarif provinsi dan kabupaten sekaligus, yang dipakai adalah wilayah **paling spesifik** (kabupaten mengalahkan provinsi).',
  'Dinas juga bisa menyatakan pajak **tidak dipungut** di wilayahnya (pembebasan).',
  'Hanya pajak daerah (SSPD) yang bisa diatur Dinas. PPN dan PPh tetap tarif nasional.',
]);

H2('5.2 Mengenal halaman Pajak daerah');
P('Klik menu **Pajak daerah**. Setiap baris berisi satu kode rekening yang dikenai SSPD, dengan empat informasi penting:');
GAMBAR('d08-pajak-daerah.png', 'Halaman Pajak daerah (SSPD)');
TABEL(['Kolom', 'Artinya'], [
  ['Kode rekening', 'Jenis belanja yang dikenai pajak daerah, misalnya Belanja Makanan dan Minuman Rapat'],
  ['Tarif nasional', 'Tarif bawaan dari pusat'],
  ['Wilayah (kode Bapak/Ibu)', 'Tarif yang Bapak/Ibu tetapkan beserta dasar hukumnya, atau *ikut nasional* bila belum diatur'],
  ['Berlaku di sekolah', 'Tarif yang benar-benar dipakai sekolah di wilayah Bapak/Ibu'],
], [3000, 6638]);

H2('5.3 Menetapkan tarif sesuai Perda');
H3('Langkah 1: Klik Atur');
P('Klik **Atur** di baris kode rekening yang dimaksud.');
H3('Langkah 2: Isi tarif dan dasar hukum');
OL([
  'Isi **Tarif (%)**, misalnya `7.5` untuk 7,5%.',
  'Isi **Dasar hukum (Perda/Perkada)**, misalnya *Perda Kab. 3201 No. 12/2026 tentang Pajak Daerah*. Kolom ini wajib, untuk jejak audit.',
  'Klik **Simpan**.',
]);
GAMBAR('d09-atur-tarif.png', 'Laci Atur pajak daerah: tarif 7,5% dan dasar hukum');
H3('Langkah 3: Cek tabel');
P('Kolom wilayah dan kolom *Berlaku di sekolah* langsung berubah.');
GAMBAR('d10-tarif-baru.png', 'Tarif wilayah berubah menjadi 7,5%');

H2('5.4 Bukti tarif langsung dipakai sekolah');
P('Begitu disimpan, tarif baru dikirim otomatis ke semua sekolah di wilayah Bapak/Ibu. Saat Bendahara mencatat belanja makan minum, pajak daerah langsung dihitung dengan tarif baru.');
GAMBAR('d11-efek-bendahara.png', 'Layar Bendahara sekolah: SSPD dihitung 7,5% sesuai Perda baru');
KOTAK('PENTING', 'Tarif baru berlaku untuk belanja yang dicatat **setelah** perubahan. Belanja yang sudah tercatat sebelumnya nggak ikut berubah.');

H2('5.5 Membebaskan pajak daerah');
OL([
  'Klik **Atur** di baris yang dimaksud.',
  'Centang **Tidak dipungut di wilayah (kode Bapak/Ibu)**.',
  'Isi dasar hukum pembebasannya, misalnya *Perkada 3201 No. 3/2026*.',
  'Klik **Simpan**.',
]);
GAMBAR('d12-bebaskan.png', 'Centang Tidak dipungut dan isi dasar hukum pembebasan');
P('Kolom wilayah menampilkan *Dibebaskan*, dan *Berlaku di sekolah* menjadi *Tidak dipungut*. Sekolah nggak akan dipotong SSPD untuk rekening itu.');
GAMBAR('d13-dibebaskan.png', 'Pajak daerah dibebaskan di wilayah 3201');
KOTAK('TIPS', 'Mau kembali memungut pajak? Klik **Atur** lagi, hapus centang *Tidak dipungut*, lalu isi tarif dan dasar hukum yang berlaku.');

// ======================================================================
// BAB 6 PENANGANAN MASALAH
// ======================================================================
H1('Penanganan Masalah');
P('Kalau ada yang nggak berjalan sesuai harapan, jangan khawatir. Bab ini berisi arti pesan yang muncul dan solusi untuk masalah yang paling sering terjadi.');

H2('6.1 Cara membaca pesan dari aplikasi');
LI([
  '**Kotak merah**: aksi ditolak. Isinya kalimat penjelasan dan **kode** (misalnya `DI_LUAR_CAKUPAN`).',
  '**Kotak kuning**: peringatan. Bapak/Ibu masih bisa lanjut, tapi ada yang perlu diperhatikan.',
  '**Kotak hijau**: semua beres.',
  '**Tombol abu-abu** (nggak bisa diklik): ada syarat yang belum terpenuhi, misalnya pemeriksaan juknis belum hijau atau dasar hukum belum diisi.',
]);

H2('6.2 Daftar pesan yang sering muncul');
TABEL(['Pesan atau kode', 'Artinya', 'Yang perlu dilakukan'], [
  ['`DI_LUAR_CAKUPAN`', 'Sekolah, wilayah, atau pengguna berada di luar wilayah tugas Bapak/Ibu', 'Pastikan NPSN atau kode wilayah benar dan berada di wilayah Bapak/Ibu'],
  ['`PERAN_DI_LUAR_KEWENANGAN`', 'Peran yang dipilih nggak boleh diberikan oleh peran Bapak/Ibu', 'Lihat tabel 4.1; minta pihak yang berwenang'],
  ['`PEMISAHAN_TUGAS`', 'Mencoba memberi atau mencabut peran untuk diri sendiri', 'Minta Admin Dinas lain melakukannya'],
  ['`CAKUPAN_TIDAK_SESUAI`', 'NPSN bukan 8 digit atau kode wilayah bukan 2/4/6 digit', 'Periksa ulang NPSN atau kode wilayah'],
  ['`EMAIL_SUDAH_TERDAFTAR`', 'Email itu sudah dipakai pengguna di luar cakupan Bapak/Ibu', 'Minta pengelola wilayah lain menambahkan perannya, atau pakai email lain'],
  ['`PERAN_SUDAH_DICABUT`', 'Peran itu sudah dicabut sebelumnya', 'Tidak perlu dicabut lagi; tambahkan peran baru bila perlu'],
  ['`KODE_REKENING_TIDAK_DIKENAL`', 'Kode rekening tidak aktif di referensi nasional', 'Hubungi pengelola referensi nasional (Balai SDSP)'],
  ['`PERAN_TIDAK_DIIZINKAN`', 'Halaman atau aksi bukan untuk peran yang sedang aktif', 'Ganti peran di pojok kanan atas'],
], [3100, 3300, 3238]);

H2('6.3 Masalah yang sering terjadi dan solusinya');
const KASUS = [
  ['Antrean penelaahan kosong, padahal sekolah bilang sudah mengajukan', 'Sekolah baru menyimpan RKAS (status *Draf*) tanpa diajukan Kepala Sekolah, atau sekolah berada di wilayah lain.', 'Minta Kepala Sekolah mengklik **Ajukan ke Dinas**. Pastikan juga NPSN sekolah memang berada di wilayah Bapak/Ibu.'],
  ['Tombol Sahkan nggak bisa diklik', 'Pemeriksaan juknis belum hijau (masih ada sisa pagu atau komponen melebihi batas).', 'Kembalikan RKAS dengan alasan yang jelas agar sekolah memperbaikinya.'],
  ['Salah mengesahkan RKAS', 'Pengesahan bersifat final.', 'Minta sekolah membuat pergeseran/perubahan baru, lalu telaah versi barunya.'],
  ['Pegawai baru nggak bisa masuk', 'Email yang didaftarkan berbeda dengan email SSO, atau perannya belum ditambahkan.', 'Cek ejaan email di **Kelola pengguna**. Email harus persis sama dengan akun SSO.'],
  ['Operator baru nggak melihat sekolahnya', 'NPSN yang diisi salah.', 'Cabut peran yang salah, lalu tambahkan lagi dengan NPSN yang benar.'],
  ['Tombol Simpan di laci pajak daerah abu-abu', 'Dasar hukum belum diisi (minimal 3 karakter), atau tarif di luar 0–100%.', 'Lengkapi dasar hukum dan pastikan tarif berupa angka, misalnya 7.5.'],
  ['Sekolah masih dipotong tarif lama', 'Belanja itu dicatat sebelum tarif diubah, atau perubahan belum sampai karena gangguan jaringan.', 'Belanja lama memang tetap. Untuk belanja baru, tunggu beberapa saat lalu minta sekolah mencoba lagi; bila masih, hubungi tim teknis.'],
  ['Pegawai pindah tugas ke wilayah lain', 'Peran lama masih aktif.', 'Cabut peran di wilayah Bapak/Ibu. Admin Dinas wilayah baru yang menambahkan peran barunya.'],
];
KASUS.forEach(([masalah, sebab, solusi], i) => {
  H3(`Masalah ${i + 1}: ${masalah}`);
  tambah(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'Penyebab: ', bold: true, color: 'B23B3B' }), ...runs(sebab)] }));
  tambah(new Paragraph({ spacing: { after: 180 }, children: [new TextRun({ text: 'Solusi: ', bold: true, color: '2E7D32' }), ...runs(solusi)] }));
});

H2('6.4 Kebiasaan baik');
LI([
  '**Verifikator:** telaah RKAS paling lama 3 hari kerja sejak diajukan, dan tulis alasan pengembalian yang bisa langsung dikerjakan sekolah.',
  '**Verifikator:** gunakan catatan per baris untuk menunjuk masalah spesifik, dan alasan pengembalian untuk ringkasannya.',
  '**Admin Dinas:** daftarkan Operator untuk setiap sekolah sejak awal tahun, dan cabut peran yang nggak lagi bertugas.',
  '**Admin Dinas:** perbarui tarif pajak daerah begitu Perda baru berlaku, dan selalu isi dasar hukum lengkap dengan nomor dan tahunnya.',
  '**Semua:** jangan meminjamkan akun SSO, dan klik **Keluar** di komputer bersama.',
]);

// ======================================================================
// BAB 7 PENUTUP
// ======================================================================
H1('Penutup');
P('Terima kasih sudah menemani sampai halaman ini! Dengan Dinas yang sigap menelaah, rapi mengelola akun, dan tepat menetapkan pajak daerah, sekolah bisa mengelola dana BOSP dengan tenang dan transparan.');
H2('7.1 Rangkuman rutinitas Dinas');
TABEL(['Kapan', 'Verifikator Dinas', 'Admin Dinas'], [
  ['Awal tahun anggaran', 'Siap menelaah RKAS awal semua sekolah', 'Pastikan setiap sekolah punya Operator; cek tarif pajak daerah'],
  ['Saat ada pengajuan', 'Telaah, beri catatan, kembalikan atau sahkan', '—'],
  ['Saat Perda/Perkada berubah', '—', 'Perbarui tarif atau pembebasan SSPD'],
  ['Saat ada mutasi pegawai', '—', 'Cabut peran lama, tambahkan peran baru'],
  ['Pertengahan tahun', 'Telaah pergeseran RKAS', 'Tinjau daftar pengguna aktif'],
], [2400, 3600, 3638]);
H2('7.2 Butuh bantuan?');
LI([
  'Masalah akun dan peran di wilayah: hubungi **Admin Dinas** wilayah Bapak/Ibu.',
  'Masalah referensi nasional (kode rekening, komponen, tarif nasional): hubungi **Balai SDSP** selaku pengelola referensi nasional.',
  'Masalah teknis aplikasi: hubungi tim teknis ARKAS Web. Sertakan wilayah, peran yang aktif, langkah yang dilakukan, dan tangkapan layar kotak merah beserta kodenya.',
]);
H2('7.3 Catatan versi');
P('Buku ini disusun berdasarkan ARKAS Web versi uji coba (November 2026). Halaman masuk di lingkungan uji coba masih menampilkan akun contoh, dan tampilan bisa sedikit berbeda setelah aplikasi diperbarui.');
P('Selamat bertugas, dan semoga penelaahan serta pengelolaan di wilayah Bapak/Ibu makin lancar!');

// ======================================================================
// LAMPIRAN
// ======================================================================
H1('Lampiran: Glosarium', false);
TABEL(['Istilah', 'Arti singkat'], [
  ['BOSP', 'Bantuan Operasional Satuan Pendidikan'],
  ['RKAS / kertas kerja', 'Rencana Kegiatan dan Anggaran Sekolah untuk satu tahun'],
  ['Pagu', 'Batas total anggaran BOSP sekolah setahun'],
  ['Komponen BOSP', 'Kelompok kegiatan yang boleh dibiayai BOSP; sebagian dibatasi persentasenya'],
  ['Juknis', 'Petunjuk teknis penggunaan dana BOSP'],
  ['Penelaahan', 'Pemeriksaan RKAS oleh Verifikator Dinas sebelum disahkan'],
  ['Pergeseran / perubahan', 'Revisi RKAS setelah disahkan, disimpan sebagai versi baru'],
  ['Realisasi', 'Bagian anggaran yang sudah dibelanjakan sekolah'],
  ['Catatan Dinas', 'Catatan Verifikator pada baris RKAS tertentu'],
  ['Cakupan', 'Batas data yang bisa diakses: wilayah untuk Dinas, NPSN untuk sekolah'],
  ['NPSN', 'Nomor Pokok Sekolah Nasional (8 digit)'],
  ['Kode wilayah', 'Kode provinsi (2 digit), kabupaten/kota (4 digit), atau kecamatan (6 digit)'],
  ['SSPD', 'Pajak daerah, misalnya pajak restoran, yang tarifnya ditetapkan Perda'],
  ['Perda / Perkada', 'Peraturan Daerah / Peraturan Kepala Daerah'],
  ['Balai SDSP', 'Pengelola referensi nasional (kode rekening, komponen, tarif nasional)'],
  ['SSO', 'Single Sign-On: satu akun untuk masuk ke banyak layanan'],
], [2800, 6838]);

// ======================================================================
// DOKUMEN
// ======================================================================
const doc = new Document({
  creator: 'ARKAS Web',
  title: 'Buku Panduan & Tutorial ARKAS Web untuk Dinas Pendidikan',
  description: 'Panduan dan tutorial ARKAS Web untuk Verifikator Dinas dan Admin Dinas',
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
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Buku Panduan & Tutorial ARKAS Web · Dinas Pendidikan', size: 16, color: '888888' })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Halaman ', PageNumber.CURRENT], size: 18, color: '666666' })] })] }) },
      children: [...daftarIsi, ...anak],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(__dirname, 'Buku-Panduan-ARKAS-Web-Dinas.docx');
  fs.writeFileSync(out, buf);
  console.log('ditulis', out, buf.length, 'byte;', anak.length, 'blok');
});
