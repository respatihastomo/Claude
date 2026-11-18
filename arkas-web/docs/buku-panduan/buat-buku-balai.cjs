// Membuat "Buku Panduan & Tutorial ARKAS Web untuk Balai SDSP" (DOCX) dengan docx-js.
// Jalankan dari folder ini: node buat-buku-balai.cjs  → Buku-Panduan-ARKAS-Web-Balai.docx
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, PageBreak, TableOfContents, Footer, Header, PageNumber, LevelFormat,
  TabStopType,
} = require('docx');

const IMG = path.join(__dirname, '..', 'tutorial-balai');
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
const GAYA = { TIPS: ['E8F5E9', '2E7D32', 'Tips'], PENTING: ['FFF3E0', 'E65100', 'Penting'], INGAT: ['E8F0FB', BIRU, 'Ingat'], CONTOH: ['F3F0FF', '5B3FB4', 'Contoh'], BAB: ['EEF3FA', '1F4E8C', 'Di bab ini'] };
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
  new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: 'Untuk Balai SDSP: Mengelola Referensi Nasional dan Pengguna Tingkat Pusat', size: 32, color: '444444' })] }),
  new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BIRU, space: 1 } }, children: [] }),
  new Paragraph({ spacing: { before: 400, after: 80 }, children: [new TextRun({ text: 'Untuk:', bold: true, size: 26 })] }),
  ...['Admin Balai SDSP (peran Balai SDSP di aplikasi)', 'Tim pengelola referensi nasional'].map((t) => new Paragraph({ numbering: { reference: 'poin', level: 0 }, children: [new TextRun({ text: t, size: 26 })] })),
  new Paragraph({ spacing: { before: 2800 }, children: [new TextRun({ text: 'Edisi 1 · November 2026', size: 22, color: '666666' })] }),
  new Paragraph({ children: [new TextRun({ text: 'Berdasarkan aplikasi ARKAS Web versi uji coba. Gambar diambil dari aplikasi yang berjalan dengan data contoh.', size: 20, color: '666666', italics: true })] }),
];

// ======================================================================
// BAB 1 PENDAHULUAN
// ======================================================================
H1('Pendahuluan');
KOTAK('BAB', 'peran Balai SDSP di ARKAS Web, data apa saja yang Bapak/Ibu kelola, dan bagaimana satu perubahan kecil di Balai sampai ke ribuan sekolah.');
P('Halo, tim Balai SDSP! Kalau ARKAS Web diibaratkan sebuah gedung, Balai adalah pengelola **fondasinya**. Data referensi nasional yang Bapak/Ibu kelola, mulai dari komponen BOSP, kode rekening, tarif pajak, sampai daftar sekolah dan wilayah, dipakai setiap hari oleh semua Dinas dan sekolah.');
P('Buku ini ditulis santai biar enak dibaca sambil praktik. Setiap langkah ada tangkapan layarnya, dan bagian yang perlu diklik ditandai kotak merah.');

H2('1.1 Untuk siapa buku ini?');
TABEL(['Pembaca', 'Yang dikerjakan di ARKAS Web', 'Baca bab'], [
  ['Admin Balai SDSP', 'Mengelola akun tingkat pusat (Balai, Admin Ditjen, Admin Dinas baru, Pemantau, Auditor)', 'Bab 3'],
  ['Tim referensi nasional', 'Memantau tujuh jenis referensi, mengubah batas komponen BOSP, dan menerbitkan ulang referensi', 'Bab 4, 5, 6'],
], [2600, 5238, 1800]);

H2('1.2 Apa saja yang dikelola Balai?');
TABEL(['Referensi', 'Contoh isi', 'Dipakai oleh'], [
  ['Komponen BOSP', '12. Pembayaran honor (maks 20%)', 'Sekolah saat menyusun RKAS; Verifikator saat menelaah'],
  ['Tarif pajak', 'PPN 11%, PPh 23 2%, SSPD 10% (nasional) + tarif daerah dari Dinas', 'Bendahara saat mencatat belanja'],
  ['Kode rekening', '5.1.02.01.01.0024 Belanja Alat Tulis Kantor', 'Sekolah saat menyusun RKAS'],
  ['Satuan pendidikan', 'SMP Negeri Contoh 1 (20100001), wilayah 3201', 'Semua modul: akun, RKAS, buku kas'],
  ['Wilayah', '32 Jawa Barat; 3201 Kab. Contoh', 'Cakupan Dinas dan pajak daerah'],
  ['Direktorat', 'Direktorat SMP, Ditjen PAUD Dikdasmen', 'Cakupan pengguna tingkat pusat'],
  ['Sumber dana', 'BOSP_REG (BOSP Reguler)', 'Pagu dan buku kas sekolah'],
], [2200, 4000, 3438]);

H2('1.3 Bagaimana perubahan Balai sampai ke sekolah?');
P('Setiap kali referensi berubah, aplikasi otomatis mengabari semua modul lain. Bapak/Ibu nggak perlu mengirim surat atau berkas ke Dinas dan sekolah.');
GAMBAR('s00-alur-referensi.png', 'Perjalanan sebuah perubahan referensi dari Balai ke sekolah');
LI([
  '**Setiap perubahan punya nomor versi.** Nomor ini selalu naik, jadi modul lain tahu mana data yang paling baru.',
  '**Referensi nggak pernah dihapus.** Data yang sudah nggak berlaku cukup dinonaktifkan, supaya transaksi lama tetap bisa dirujuk.',
  '**Terbitkan ulang** mengirim ulang semua referensi tanpa menaikkan versi. Aman diulang kapan saja.',
]);
KOTAK('INGAT', 'Referensi Balai berlaku **nasional**. Satu klik bisa memengaruhi semua sekolah, jadi biasakan memeriksa dua kali sebelum menyimpan.');

H2('1.4 Cara membaca buku ini');
LI([
  '**Kotak merah** di gambar menunjukkan tombol atau kolom yang perlu diklik atau diisi.',
  'Setiap bab dibuka dengan kotak **Di bab ini** yang merangkum isinya.',
  '**Tips** (hijau) berisi cara supaya lebih cepat, **Penting** (oranye) berisi hal yang wajib diperhatikan, dan **Ingat** (biru) berisi aturan main.',
  'Nama tombol dan menu ditulis **tebal**, persis seperti di layar.',
]);

H2('1.5 Yang perlu disiapkan');
TABEL(['Untuk', 'Siapkan ini'], [
  ['Semua', 'Komputer dengan browser terbaru, koneksi internet, dan akun SSO berperan Balai SDSP'],
  ['Mengelola akun', 'SK penugasan Admin Dinas, Admin Ditjen, Pemantau, atau surat tugas Auditor, beserta email SSO masing-masing'],
  ['Mengubah komponen', 'Juknis BOSP terbaru yang menjadi dasar perubahan batas'],
  ['Memantau referensi', 'Peraturan kode rekening, data satuan pendidikan dan wilayah terbaru'],
], [2600, 7038]);

// ======================================================================
// BAB 2 MEMULAI
// ======================================================================
H1('Memulai: Masuk dan Mengenal Layar');
KOTAK('BAB', 'cara masuk, menu yang dimiliki Balai, dan bagian-bagian halaman Referensi.');
H2('2.1 Masuk ke aplikasi');
OL([
  'Buka alamat ARKAS Web di browser.',
  'Klik **Masuk dengan SSO**, lalu masuk dengan akun SSO Bapak/Ibu.',
  'Aplikasi langsung membuka halaman **Kelola pengguna**.',
]);
GAMBAR('s01-masuk.png', 'Halaman masuk; contoh akun Admin Balai SDSP');
KOTAK('PENTING', 'Gambar di atas berasal dari lingkungan uji coba, jadi yang tampil daftar akun contoh. Di lingkungan resmi, halaman ini hanya berisi tombol **Masuk dengan SSO**.');

H2('2.2 Menu milik Balai');
TABEL(['Menu', 'Isinya', 'Dibahas di'], [
  ['Kelola pengguna', 'Mendaftarkan dan mencabut akun tingkat pusat dan Admin Dinas', 'Bab 3'],
  ['Referensi', 'Tujuh tab referensi nasional, ubah batas komponen, terbitkan ulang', 'Bab 4, 5, 6'],
], [2400, 5238, 2000]);

H2('2.3 Mengenal halaman Referensi');
P('Cocokkan nomor di gambar dengan tabel di bawahnya (angka berada tepat di bawah kotak yang dimaksud).');
GAMBAR('s07-referensi.png', 'Bagian-bagian halaman Referensi nasional');
TABEL(['No.', 'Bagian', 'Gunanya'], [
  ['1', 'Tab referensi', 'Pindah antarjenis referensi: Komponen BOSP, Tarif pajak, Kode rekening, Satuan pendidikan, Wilayah, Direktorat, Sumber dana'],
  ['2', 'Terbitkan ulang ke semua layanan', 'Mengirim ulang seluruh referensi ke semua modul (Bab 6)'],
  ['3', 'Tabel referensi', 'Isi referensi, dengan kolom **Versi** (nomor perubahan terakhir) dan **Aktif** (masih berlaku atau sudah dinonaktifkan)'],
], [800, 3200, 5638]);

// ======================================================================
// BAB 3 PENGGUNA
// ======================================================================
H1('Mengelola Pengguna Tingkat Pusat');
KOTAK('BAB', 'peran apa saja yang bisa diberikan Balai, cara mendaftarkan Admin Dinas untuk wilayah baru, mendaftarkan Auditor bermasa tugas, dan mencabut peran.');
H2('3.1 Peran yang bisa diberikan Balai');
TABEL(['Peran (di layar)', 'Untuk siapa', 'Cakupan yang diisi'], [
  ['Balai SDSP', 'Rekan sesama admin Balai', 'Nasional (tanpa kode)'],
  ['Admin Ditjen', 'Pengelola di tingkat Direktorat Jenderal', 'Kode ditjen'],
  ['Admin Dinas', 'Pengelola akun dan pajak daerah di Dinas Pendidikan', 'Kode wilayah (2 atau 4 digit)'],
  ['Pemantau Pusat', 'Pejabat yang perlu memantau tanpa mengubah data', 'Nasional'],
  ['Auditor', 'Pemeriksa (misalnya Itjen/BPK) selama masa tugas', 'Nasional + tanggal **berlaku sampai** (wajib)'],
], [2400, 4400, 2838]);
P('Rantai pendaftarannya berjenjang: Balai mendaftarkan **Admin Dinas** → Admin Dinas mendaftarkan Verifikator dan Operator sekolah → Operator mendaftarkan Bendahara, Kepala Sekolah, dan Komite.');

H2('3.2 Halaman Kelola pengguna');
P('Di bagian atas tertulis peran yang bisa Bapak/Ibu berikan. Tabel di bawahnya berisi pengguna beserta perannya.');
GAMBAR('s02-pengguna.png', 'Halaman Kelola pengguna untuk Balai SDSP');

H2('3.3 Mendaftarkan Admin Dinas untuk wilayah baru');
P('Setiap Dinas yang mulai memakai ARKAS Web butuh minimal satu Admin Dinas. Contoh berikut mendaftarkan Admin Dinas untuk wilayah 3202.');
H3('Langkah 1: Klik + Tambah pengguna');
H3('Langkah 2: Isi data');
OL([
  '**Email (akun SSO)** pegawai Dinas tersebut, persis seperti akun SSO-nya.',
  '**Nama lengkap**.',
  '**Peran**: pilih *Admin Dinas*.',
  '**Kode wilayah**: isi kode kabupaten/kota (4 digit) atau provinsi (2 digit) Dinas itu, misalnya `3202`.',
  'Klik **Simpan**.',
]);
GAMBAR('s03-tambah-admin-dinas.png', 'Laci Tambah pengguna untuk Admin Dinas wilayah 3202');
H3('Langkah 3: Cek daftar');
GAMBAR('s04-admin-dinas-baru.png', 'Admin Dinas wilayah 3202 sudah terdaftar');
KOTAK('TIPS', 'Setelah itu, bagikan *Buku Panduan & Tutorial untuk Dinas Pendidikan* kepada Admin Dinas baru, supaya mereka bisa langsung mendaftarkan Verifikator dan Operator sekolah.');

H2('3.4 Mendaftarkan Auditor dengan masa tugas');
P('Auditor hanya boleh punya akses selama masa pemeriksaan. Karena itu kolom **Berlaku sampai** wajib diisi sesuai surat tugas.');
OL([
  'Klik **+ Tambah pengguna**, isi email SSO dan nama lengkap.',
  'Pilih peran **Auditor**.',
  'Isi **Berlaku sampai (sesuai surat tugas)**, misalnya 31 Desember 2026.',
  'Klik **Simpan**.',
]);
GAMBAR('s05-tambah-auditor.png', 'Laci Tambah pengguna untuk Auditor; kolom Berlaku sampai wajib');
GAMBAR('s06-auditor-baru.png', 'Auditor sudah terdaftar');
KOTAK('INGAT', 'Setelah tanggal *berlaku sampai* lewat, Auditor otomatis nggak bisa memakai perannya lagi. Bapak/Ibu nggak perlu mencabutnya secara manual.');

H2('3.5 Mencabut peran');
P('Klik **Cabut** di samping peran yang dimaksud, tulis alasannya (wajib) di kotak yang muncul, lalu klik **OK**. Peran yang dicabut tampil dicoret dan langsung nggak bisa dipakai. Jejak pekerjaan orang tersebut tetap tersimpan untuk audit.');
KOTAK('PENTING', 'Bapak/Ibu nggak bisa memberi atau mencabut peran untuk akun sendiri. Minta rekan sesama admin Balai melakukannya.');

// ======================================================================
// BAB 4 MENJELAJAH REFERENSI
// ======================================================================
H1('Menjelajah Referensi Nasional');
KOTAK('BAB', 'isi ketujuh tab referensi, cara membacanya, dan apa yang perlu Balai pantau di setiap tab.');
P('Klik menu **Referensi**. Setiap tab menampilkan satu jenis referensi, lengkap dengan kolom **Versi** dan **Aktif**.');

H2('4.1 Komponen BOSP');
P('Daftar komponen per sumber dana, beserta batas **Maks** dan **Min** (persentase dari pagu). Batas inilah yang dipakai aplikasi untuk memeriksa RKAS sekolah. Cara mengubah batas dibahas di Bab 5.');
GAMBAR('s14-ubah-batas.png', 'Tab Komponen BOSP; honor dibatasi maksimal 20%');

H2('4.2 Tarif pajak');
P('Berisi tarif nasional (kolom **Wilayah** = *Nasional*) dan tarif daerah yang ditetapkan Dinas (kolom Wilayah berisi kode wilayah). Balai bisa memantau Dinas mana saja yang sudah menetapkan Perda, beserta dasar hukumnya.');
GAMBAR('s08-tarif-pajak.png', 'Tab Tarif pajak; baris 3201 adalah tarif daerah dari Dinas');
KOTAK('INGAT', 'Tarif daerah (SSPD) diatur oleh Dinas masing-masing lewat menu *Pajak daerah*. Balai cukup memantau di tab ini.');

H2('4.3 Kode rekening');
P('Daftar kode rekening belanja beserta namanya. Sekolah hanya bisa memakai kode yang **aktif** saat menyusun RKAS.');
GAMBAR('s09-kode-rekening.png', 'Tab Kode rekening');

H2('4.4 Satuan pendidikan');
P('Daftar sekolah dengan NPSN, jenjang, wilayah, dan status (negeri/swasta). Wilayah sekolah menentukan Dinas mana yang menelaah RKAS-nya dan tarif pajak daerah mana yang berlaku.');
GAMBAR('s10-sekolah.png', 'Tab Satuan pendidikan');

H2('4.5 Wilayah');
P('Daftar provinsi dan kabupaten/kota beserta induknya. Kode wilayah dipakai sebagai cakupan Admin Dinas dan Verifikator.');
GAMBAR('s11-wilayah.png', 'Tab Wilayah');

H2('4.6 Direktorat');
P('Daftar direktorat dan direktorat jenderal, yang dipakai sebagai cakupan pengguna tingkat pusat.');
GAMBAR('s12-direktorat.png', 'Tab Direktorat');

H2('4.7 Sumber dana');
P('Daftar sumber dana (misalnya BOSP Reguler) beserta kategorinya. Sumber dana menentukan pagu dan buku kas sekolah.');
GAMBAR('s13-sumber-dana.png', 'Tab Sumber dana');

// ======================================================================
// BAB 5 UBAH BATAS KOMPONEN
// ======================================================================
H1('Mengubah Batas Komponen BOSP');
KOTAK('BAB', 'cara mengubah batas maksimal komponen sesuai juknis baru, dan bukti perubahannya langsung terlihat di sekolah.');
P('Juknis BOSP bisa mengubah batas persentase komponen, misalnya batas honor. Contoh berikut menaikkan batas honor dari 20% menjadi 25%.');
H2('5.1 Langkah mengubah batas');
H3('Langkah 1: Klik Ubah batas');
P('Di tab **Komponen BOSP**, cari komponennya (misalnya *12. Pembayaran honor*), lalu klik **Ubah batas** di ujung kanan barisnya.');
GAMBAR('s14-ubah-batas.png', 'Tombol Ubah batas pada komponen Pembayaran honor');
H3('Langkah 2: Isi batas baru');
P('Kotak isian dari browser akan muncul. Ketik angka batas maksimal dalam persen (misalnya `25`), lalu klik **OK**.');
LI([
  'Kosongkan isian lalu klik **OK** untuk menghapus batas (komponen tanpa batas maksimal).',
  'Klik **Cancel** untuk membatalkan. Tidak ada yang berubah.',
]);
H3('Langkah 3: Cek hasilnya');
P('Kolom **Maks** berubah menjadi 25%, dan nomor **Versi** baris itu naik. Artinya perubahan sudah tersimpan dan dikabarkan ke modul lain.');
GAMBAR('s15-batas-baru.png', 'Batas honor menjadi 25%; versi naik');

H2('5.2 Bukti perubahan sampai ke sekolah');
P('Beberapa detik kemudian, panel pagu di halaman RKAS sekolah sudah menampilkan batas baru.');
GAMBAR('s16-efek-sekolah.png', 'Halaman RKAS sekolah: batas honor tampil maks 25%');
KOTAK('PENTING', 'Batas baru dipakai saat sekolah menyusun atau mengajukan RKAS, termasuk pergeseran. RKAS yang sudah disahkan tetap berlaku seperti saat disahkan.');
KOTAK('TIPS', 'Umumkan perubahan batas ke Dinas sebelum menyimpannya, terutama di tengah tahun, supaya Verifikator siap saat sekolah mengajukan pergeseran.');

// ======================================================================
// BAB 6 TERBITKAN ULANG
// ======================================================================
H1('Menerbitkan Ulang Referensi');
KOTAK('BAB', 'kapan perlu menerbitkan ulang referensi, cara melakukannya, dan kenapa aman diulang.');
H2('6.1 Kapan perlu menerbitkan ulang?');
LI([
  'Ada **modul atau layanan baru** yang perlu diisi semua referensi dari awal.',
  'Ada laporan bahwa sekolah atau Dinas **belum melihat** perubahan referensi, misalnya setelah gangguan jaringan.',
  'Setelah pemeliharaan sistem, untuk memastikan semua modul memakai data yang sama.',
]);
H2('6.2 Langkah menerbitkan ulang');
OL([
  'Buka menu **Referensi**.',
  'Klik **Terbitkan ulang ke semua layanan**.',
  'Klik **OK** pada kotak konfirmasi.',
]);
GAMBAR('s17-terbit-ulang.png', 'Tombol Terbitkan ulang ke semua layanan');
P('Kotak hijau memberi tahu berapa baris referensi yang diantrekan untuk dikirim ke modul lain.');
GAMBAR('s18-terbit-berhasil.png', 'Referensi berhasil diantrekan ke semua layanan');
KOTAK('INGAT', 'Terbitkan ulang **nggak menaikkan versi**. Modul lain otomatis mengabaikan data yang sama atau lebih lama, jadi tombol ini aman diklik berulang kali.');

H2('6.3 Bagaimana dengan perubahan referensi lainnya?');
P('Pada versi aplikasi saat ini, perubahan yang bisa dilakukan langsung dari halaman Referensi adalah **batas komponen** dan **terbitkan ulang**. Penambahan atau perubahan referensi lain, seperti kode rekening baru, sekolah baru, wilayah, atau tarif pajak nasional, dilakukan tim teknis melalui layanan referensi berdasarkan permintaan resmi Balai.');
P('Apa pun caranya, setiap perubahan tetap mendapat nomor versi, tetap tidak menghapus data lama, dan tetap disebarkan otomatis ke semua modul seperti pada Gambar 1.1.');

// ======================================================================
// BAB 7 PENANGANAN MASALAH
// ======================================================================
H1('Penanganan Masalah');
KOTAK('BAB', 'arti pesan yang mungkin muncul, masalah yang paling sering dilaporkan, dan cara menyelesaikannya.');
H2('7.1 Cara membaca pesan dari aplikasi');
LI([
  '**Kotak merah**: aksi ditolak. Isinya kalimat penjelasan dan **kode**.',
  '**Kotak hijau**: aksi berhasil, misalnya referensi berhasil diantrekan.',
  '**Tombol abu-abu**: syarat belum terpenuhi.',
]);
H2('7.2 Daftar pesan yang sering muncul');
TABEL(['Pesan atau kode', 'Artinya', 'Yang perlu dilakukan'], [
  ['`PERAN_TIDAK_DIIZINKAN`', 'Aksi hanya untuk peran Balai SDSP', 'Pastikan peran aktif di pojok kanan atas adalah Balai SDSP'],
  ['`MASA_BERLAKU_WAJIB`', 'Peran Auditor belum diberi tanggal berlaku', 'Isi kolom Berlaku sampai sesuai surat tugas'],
  ['`MASA_BERLAKU_TIDAK_VALID`', 'Tanggal berlaku sudah lewat atau tidak valid', 'Isi tanggal di masa depan'],
  ['`CAKUPAN_TIDAK_SESUAI`', 'Kode wilayah/ditjen kosong atau formatnya salah', 'Admin Dinas: kode wilayah 2/4 digit; Admin Ditjen: kode ditjen'],
  ['`PEMISAHAN_TUGAS`', 'Mencoba memberi atau mencabut peran untuk diri sendiri', 'Minta rekan admin Balai lain'],
  ['`EMAIL_SUDAH_TERDAFTAR`', 'Email itu sudah dipakai pengguna di luar cakupan Bapak/Ibu', 'Gunakan akun yang sama melalui pengelolanya, atau email lain'],
  ['`RUJUKAN_TIDAK_DIKENAL`', 'Referensi merujuk data yang belum ada (misalnya sekolah di wilayah yang belum terdaftar)', 'Daftarkan data induknya lebih dulu (misalnya wilayah)'],
  ['`DATA_TIDAK_VALID`', 'Isian melanggar aturan data (misalnya tarif di luar 0–100%)', 'Periksa kembali angka atau format isian'],
  ['`HAPUS_DILARANG`', 'Referensi tidak boleh dihapus', 'Nonaktifkan referensi tersebut'],
], [3000, 3400, 3238]);

H2('7.3 Masalah yang sering terjadi dan solusinya');
const KASUS = [
  ['Sekolah belum melihat batas komponen yang baru', 'Kabar perubahan belum sampai, misalnya karena gangguan jaringan di salah satu modul.', 'Tunggu beberapa saat. Bila masih, klik **Terbitkan ulang ke semua layanan** (Bab 6).'],
  ['Salah mengetik batas komponen', 'Angka keliru saat mengisi kotak Ubah batas.', 'Klik **Ubah batas** lagi dan isi angka yang benar. Versi akan naik lagi dan modul lain mengikuti angka terbaru.'],
  ['Kotak isian batas tertutup tanpa perubahan', 'Tombol **Cancel** terklik atau isian bukan angka.', 'Ulangi dan ketik angka saja, tanpa tanda %.'],
  ['Dinas melapor "kode rekening tidak dikenal"', 'Kode rekening itu nonaktif atau belum ada di referensi.', 'Cek tab **Kode rekening**. Bila memang perlu ditambahkan, ajukan permintaan resmi ke tim teknis (lihat 6.3).'],
  ['Ingin menghapus referensi yang sudah tidak berlaku', 'Referensi tidak boleh dihapus demi jejak transaksi lama.', 'Nonaktifkan referensi tersebut melalui tim teknis. Data lama tetap terbaca, tapi tidak bisa dipakai untuk transaksi baru.'],
  ['Admin Dinas wilayah baru tidak bisa didaftarkan', 'Kode wilayah belum ada di referensi Wilayah.', 'Cek tab **Wilayah**. Daftarkan wilayahnya lebih dulu, lalu ulangi pendaftaran Admin Dinas.'],
  ['Auditor tiba-tiba tidak bisa masuk', 'Tanggal *berlaku sampai* sudah lewat.', 'Bila masa tugas diperpanjang, berikan peran Auditor baru dengan tanggal berlaku yang baru.'],
  ['Tab Tarif pajak menampilkan tarif daerah yang janggal', 'Tarif daerah diatur oleh Dinas masing-masing.', 'Hubungi Admin Dinas wilayah tersebut. Dasar hukumnya tercantum di kolom Dasar hukum.'],
];
KASUS.forEach(([masalah, sebab, solusi], i) => {
  H3(`Masalah ${i + 1}: ${masalah}`);
  tambah(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'Penyebab: ', bold: true, color: 'B23B3B' }), ...runs(sebab)] }));
  tambah(new Paragraph({ spacing: { after: 180 }, children: [new TextRun({ text: 'Solusi: ', bold: true, color: '2E7D32' }), ...runs(solusi)] }));
});
H2('7.4 Kebiasaan baik');
LI([
  'Simpan perubahan referensi hanya berdasarkan dasar hukum atau juknis yang jelas, dan catat nomor dokumennya.',
  'Umumkan perubahan penting ke Dinas sebelum disimpan.',
  'Tinjau daftar Admin Dinas, Pemantau, dan Auditor setiap semester; cabut yang sudah tidak bertugas.',
  'Jangan berbagi akun Balai. Setiap admin memakai akun SSO masing-masing.',
]);

// ======================================================================
// BAB 8 PENUTUP
// ======================================================================
H1('Penutup');
KOTAK('BAB', 'rangkuman rutinitas Balai sepanjang tahun, ke mana mencari bantuan, dan catatan versi.');
P('Terima kasih sudah membaca sampai akhir! Referensi yang rapi membuat penyusunan RKAS di sekolah lebih mudah, penelaahan di Dinas lebih cepat, dan laporan di semua tingkat lebih bisa dipercaya.');
H2('8.1 Rangkuman rutinitas Balai');
TABEL(['Kapan', 'Yang dilakukan Balai'], [
  ['Awal tahun anggaran', 'Sesuaikan batas komponen dengan juknis terbaru; pastikan sumber dana dan kode rekening aktif'],
  ['Saat ada Dinas baru bergabung', 'Daftarkan Admin Dinas dengan kode wilayahnya'],
  ['Saat peraturan kode rekening berubah', 'Ajukan perubahan kode rekening ke tim teknis, lalu pantau di tab Kode rekening'],
  ['Saat ada pemeriksaan', 'Daftarkan Auditor dengan masa berlaku sesuai surat tugas'],
  ['Setelah gangguan atau pemeliharaan', 'Terbitkan ulang referensi ke semua layanan'],
  ['Setiap semester', 'Tinjau daftar pengguna tingkat pusat dan Admin Dinas'],
], [3200, 6438]);
H2('8.2 Butuh bantuan?');
LI([
  'Masalah teknis aplikasi atau permintaan perubahan referensi selain batas komponen: hubungi **tim teknis ARKAS Web**.',
  'Pertanyaan soal tarif daerah atau akun di wilayah: hubungi **Admin Dinas** wilayah terkait.',
  'Saat melapor, sertakan menu yang dibuka, langkah yang dilakukan, dan tangkapan layar kotak merah beserta kodenya.',
]);
H2('8.3 Catatan versi');
P('Buku ini disusun berdasarkan ARKAS Web versi uji coba (November 2026). Halaman masuk di lingkungan uji coba masih menampilkan akun contoh, dan fitur pengubahan referensi dari halaman Referensi saat ini terbatas pada batas komponen dan terbitkan ulang.');
P('Selamat bertugas, dan terima kasih sudah menjaga fondasi data pendidikan tetap kokoh!');

// ======================================================================
// LAMPIRAN
// ======================================================================
H1('Lampiran: Glosarium', false);
TABEL(['Istilah', 'Arti singkat'], [
  ['Referensi nasional', 'Data induk yang dipakai bersama semua modul: komponen, kode rekening, tarif, sekolah, wilayah, direktorat, sumber dana'],
  ['Versi', 'Nomor perubahan yang selalu naik setiap kali referensi berubah'],
  ['Aktif / nonaktif', 'Status berlakunya referensi; referensi tidak dihapus, hanya dinonaktifkan'],
  ['Terbitkan ulang', 'Mengirim ulang semua referensi ke modul lain tanpa menaikkan versi'],
  ['Komponen BOSP', 'Kelompok kegiatan yang boleh dibiayai BOSP; sebagian dibatasi persentasenya'],
  ['Batas maks/min', 'Persentase maksimal/minimal komponen terhadap pagu sekolah'],
  ['Juknis', 'Petunjuk teknis penggunaan dana BOSP'],
  ['SSPD', 'Pajak daerah yang tarifnya ditetapkan Perda dan diatur Dinas'],
  ['NPSN', 'Nomor Pokok Sekolah Nasional (8 digit)'],
  ['Kode wilayah', 'Kode provinsi (2 digit) atau kabupaten/kota (4 digit)'],
  ['Admin Ditjen', 'Pengelola pengguna di tingkat Direktorat Jenderal'],
  ['Pemantau Pusat', 'Peran untuk memantau data tanpa mengubahnya'],
  ['Auditor', 'Peran pemeriksa dengan masa berlaku terbatas'],
  ['SSO', 'Single Sign-On: satu akun untuk masuk ke banyak layanan'],
], [2800, 6838]);

// ======================================================================
// DOKUMEN
// ======================================================================
const doc = new Document({
  creator: 'ARKAS Web',
  title: 'Buku Panduan & Tutorial ARKAS Web untuk Balai SDSP',
  description: 'Panduan dan tutorial ARKAS Web untuk Balai SDSP',
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
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Buku Panduan & Tutorial ARKAS Web · Balai SDSP', size: 16, color: '888888' })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Halaman ', PageNumber.CURRENT], size: 18, color: '666666' })] })] }) },
      children: [...daftarIsi, ...anak],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(__dirname, 'Buku-Panduan-ARKAS-Web-Balai.docx');
  fs.writeFileSync(out, buf);
  console.log('ditulis', out, buf.length, 'byte;', anak.length, 'blok');
});
