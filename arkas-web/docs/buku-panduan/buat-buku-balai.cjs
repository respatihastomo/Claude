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
  ['Tim referensi nasional', 'Memantau, menambah, mengubah, dan menonaktifkan delapan jenis referensi, serta menerbitkan ulang referensi', 'Bab 4, 5, 6'],
], [2600, 5238, 1800]);

H2('1.2 Apa saja yang dikelola Balai?');
P('Ada delapan jenis referensi nasional, dan semuanya bisa ditambah, diubah, dan dinonaktifkan langsung dari halaman **Referensi**.');
TABEL(['Referensi', 'Contoh isi', 'Dipakai oleh'], [
  ['Komponen BOSP', '12. Pembayaran honor (maks 20%)', 'Sekolah saat menyusun RKAS; Verifikator saat menelaah'],
  ['Jenjang', 'SD, SMP, SMA, SMK', 'Data satuan pendidikan'],
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
  ['Mengubah referensi', 'Juknis BOSP, peraturan kode rekening dan pajak, serta data sekolah dan wilayah terbaru yang menjadi dasar perubahan'],
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
  ['Referensi', 'Delapan tab referensi nasional dengan formulir tambah/ubah/nonaktifkan, dan terbitkan ulang', 'Bab 4, 5, 6'],
], [2400, 5238, 2000]);

H2('2.3 Mengenal halaman Referensi');
P('Cocokkan nomor di gambar dengan tabel di bawahnya (angka berada tepat di bawah kotak yang dimaksud).');
GAMBAR('s07-referensi.png', 'Bagian-bagian halaman Referensi nasional');
TABEL(['No.', 'Bagian', 'Gunanya'], [
  ['1', 'Tab referensi', 'Pindah antarjenis referensi: Komponen BOSP, Tarif pajak, Kode rekening, Satuan pendidikan, Wilayah, Jenjang, Direktorat, Sumber dana'],
  ['2', 'Terbitkan ulang ke semua layanan', 'Mengirim ulang seluruh referensi ke semua modul (Bab 6)'],
  ['3', '+ Tambah ...', 'Membuka formulir untuk menambah data baru di tab yang aktif (Bab 5)'],
  ['4', 'Ubah', 'Membuka formulir untuk mengubah atau menonaktifkan baris itu (Bab 5). Tabel juga menampilkan kolom **Versi** dan **Aktif**'],
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
KOTAK('BAB', 'isi kedelapan tab referensi, cara membacanya, dan apa yang perlu Balai pantau di setiap tab.');
P('Klik menu **Referensi**. Setiap tab menampilkan satu jenis referensi, lengkap dengan kolom **Versi** dan **Aktif**, tombol **Ubah** di setiap baris, dan tombol **+ Tambah** di kanan atas.');

H2('4.1 Komponen BOSP');
P('Daftar komponen per sumber dana, beserta batas **Maks** dan **Min** (persentase dari pagu). Batas inilah yang dipakai aplikasi untuk memeriksa RKAS sekolah.');
GAMBAR('f09-ubah-komponen.png', 'Tab Komponen BOSP; honor dibatasi maksimal 20%');
H2('4.2 Tarif pajak');
P('Berisi tarif nasional (kolom **Wilayah** = *Nasional*) dan tarif daerah yang ditetapkan Dinas (kolom Wilayah berisi kode wilayah). Balai bisa memantau Dinas mana saja yang sudah menetapkan Perda, beserta dasar hukumnya.');
GAMBAR('s08-tarif-pajak.png', 'Tab Tarif pajak; baris 3201 adalah tarif daerah dari Dinas');
KOTAK('INGAT', 'Balai mengelola tarif **nasional**. Tarif daerah (SSPD) diatur Dinas masing-masing lewat menu *Pajak daerah*; Balai cukup memantaunya di tab ini.');
H2('4.3 Kode rekening');
P('Daftar kode rekening belanja beserta namanya. Sekolah hanya bisa memakai kode yang **aktif** saat menyusun RKAS.');
GAMBAR('s09-kode-rekening.png', 'Tab Kode rekening');
H2('4.4 Satuan pendidikan');
P('Daftar sekolah dengan NPSN, jenjang, wilayah, dan status (negeri/swasta). Wilayah sekolah menentukan Dinas mana yang menelaah RKAS-nya dan tarif pajak daerah mana yang berlaku.');
GAMBAR('s10-sekolah.png', 'Tab Satuan pendidikan');
H2('4.5 Wilayah');
P('Daftar provinsi dan kabupaten/kota beserta induknya. Kode wilayah dipakai sebagai cakupan Admin Dinas dan Verifikator.');
GAMBAR('s11-wilayah.png', 'Tab Wilayah');
H2('4.6 Jenjang');
P('Daftar jenjang pendidikan (SD, SMP, SMA, SMK, dan seterusnya) yang dipilih saat menambah satuan pendidikan.');
GAMBAR('s11b-jenjang.png', 'Tab Jenjang');
H2('4.7 Direktorat');
P('Daftar direktorat beserta direktorat jenderalnya, yang dipakai sebagai cakupan pengguna tingkat pusat.');
GAMBAR('s12-direktorat.png', 'Tab Direktorat');
H2('4.8 Sumber dana');
P('Daftar sumber dana (misalnya BOSP Reguler) beserta kategorinya. Sumber dana menentukan pagu dan buku kas sekolah.');
GAMBAR('s13-sumber-dana.png', 'Tab Sumber dana');

// ======================================================================
// BAB 5 FORMULIR REFERENSI
// ======================================================================
H1('Menambah, Mengubah, dan Menonaktifkan Referensi');
KOTAK('BAB', 'cara memakai formulir referensi: menambah kode rekening, tarif pajak, dan sekolah baru; mengubah batas komponen; menonaktifkan referensi; serta arti setiap pesan yang muncul.');
P('Semua jenis referensi memakai formulir yang sama: sebuah laci yang muncul di kanan layar. Polanya selalu begini:');
OL([
  'Pilih tab referensi yang mau diolah.',
  'Klik **+ Tambah ...** untuk data baru, atau **Ubah** di baris yang sudah ada.',
  'Isi kolomnya. Kolom bertanda *(opsional)* boleh dikosongkan.',
  'Klik **Simpan**. Kotak hijau memberi tahu nomor versi baru, dan perubahan langsung dikirim ke semua layanan.',
]);
KOTAK('TIPS', 'Pesan di kiri bawah laci memberi tahu kalau ada isian yang belum lengkap atau formatnya salah. Selama masih ada pesan, tombol **Simpan** belum bisa diklik.');

H2('5.1 Menambah kode rekening');
H3('Langkah 1: Klik + Tambah kode rekening');
P('Buka tab **Kode rekening**, lalu klik **+ Tambah kode rekening** di kanan atas.');
GAMBAR('f01-tambah-rekening.png', 'Tombol + Tambah kode rekening');
H3('Langkah 2: Isi kode dan nama');
OL([
  '**Kode rekening**: angka bertitik sesuai peraturan, misalnya `5.1.02.01.01.0029`.',
  '**Nama rekening**: misalnya *Belanja Bahan Cetak*.',
  'Biarkan **Aktif** tercentang, lalu klik **Simpan**.',
]);
GAMBAR('f02-laci-rekening.png', 'Laci Tambah kode rekening');
H3('Langkah 3: Cek hasilnya');
P('Kotak hijau menampilkan nomor versi baru, dan baris baru langsung muncul di tabel. Sekolah sudah bisa memakai kode ini saat menyusun RKAS.');
GAMBAR('f03-rekening-baru.png', 'Kode rekening baru tersimpan dan dikirim ke semua layanan');

H2('5.2 Menambah tarif pajak nasional');
P('Kode rekening baru biasanya perlu tarif pajak. Buka tab **Tarif pajak**, lalu klik **+ Tambah tarif pajak**.');
OL([
  '**Kode rekening**: pilih dari daftar (hanya kode yang aktif yang muncul).',
  '**Jenis pajak**: PPN, PPh 21, PPh 23, atau SSPD.',
  '**Wilayah**: biarkan *Nasional (semua wilayah)*. Tarif daerah diatur Dinas.',
  '**Tarif (%)**: ketik dalam persen, misalnya `11`.',
  '**Tarif bila penyedia tanpa NPWP (%)** (khusus PPh) dan **Dasar hukum** bila ada.',
  'Klik **Simpan**.',
]);
GAMBAR('f04-laci-tarif.png', 'Laci Tambah tarif pajak: rekening, jenis, wilayah, tarif');
GAMBAR('f05-tarif-baru.png', 'Tarif PPN 11% untuk kode rekening baru');
KOTAK('INGAT', 'Tarif diketik dalam **persen** (11 untuk 11%). Aplikasi mengubahnya sendiri ke bentuk pecahan saat menyimpan.');

H2('5.3 Menambah satuan pendidikan');
P('Saat ada sekolah baru, buka tab **Satuan pendidikan** dan klik **+ Tambah satuan pendidikan**.');
OL([
  '**NPSN**: 8 digit angka.',
  '**Nama sekolah**.',
  '**Jenjang**, **Wilayah (kabupaten/kota)**, dan **Status**: pilih dari daftar.',
  'Klik **Simpan**.',
]);
GAMBAR('f06-laci-sekolah.png', 'Laci Tambah satuan pendidikan dengan pilihan jenjang, wilayah, dan status');
P('Sekolah baru langsung terkirim ke modul akun, perencanaan, dan penatausahaan. Admin Dinas wilayah itu sudah bisa mendaftarkan Operator untuk sekolah tersebut.');
GAMBAR('f07-sekolah-baru.png', 'Sekolah baru SD Negeri Contoh 3 tersimpan');
P('Kalau formatnya salah, misalnya NPSN baru 7 digit, pesan langsung muncul di kiri bawah dan **Simpan** belum bisa diklik.');
GAMBAR('f08-galat-npsn.png', 'NPSN 7 digit: pesan muncul dan Simpan dinonaktifkan');

H2('5.4 Mengubah batas komponen BOSP');
H3('Langkah 1: Klik Ubah di baris komponen');
P('Di tab **Komponen BOSP**, klik **Ubah** di baris komponen yang dimaksud, misalnya *12. Pembayaran honor*.');
GAMBAR('f09-ubah-komponen.png', 'Tombol Ubah pada komponen Pembayaran honor (batas sekarang 20%)');
H3('Langkah 2: Isi batas baru');
P('Isi **Batas maksimal (% dari pagu)**, misalnya `25`. Kosongkan bila komponen tidak dibatasi. Kolom *Sumber dana* dan *Kode komponen* terkunci karena keduanya adalah kunci referensi. Klik **Simpan**.');
GAMBAR('f10-laci-komponen.png', 'Laci Ubah komponen; kode terkunci, batas maksimal diisi 25');
H3('Langkah 3: Cek hasil dan dampaknya di sekolah');
P('Kolom **Maks** berubah menjadi 25% dan nomor **Versi** naik. Beberapa detik kemudian panel pagu di RKAS sekolah sudah menampilkan batas baru.');
GAMBAR('f11-komponen-baru.png', 'Batas honor menjadi 25%; versi naik');
GAMBAR('s16-efek-sekolah.png', 'Halaman RKAS sekolah: batas honor tampil maks 25%');
KOTAK('PENTING', 'Batas baru dipakai saat sekolah menyusun atau mengajukan RKAS, termasuk pergeseran. RKAS yang sudah disahkan tetap berlaku seperti saat disahkan. Umumkan perubahan ke Dinas lebih dulu.');

H2('5.5 Menonaktifkan referensi');
P('Referensi nggak pernah dihapus, karena transaksi lama masih merujuknya. Kalau sudah nggak berlaku, nonaktifkan saja:');
OL([
  'Klik **Ubah** di baris yang dimaksud.',
  'Hapus centang **Aktif (bisa dipakai)**.',
  'Klik **Simpan**.',
]);
GAMBAR('f12-nonaktifkan.png', 'Hapus centang Aktif untuk menonaktifkan');
P('Baris itu tampil abu-abu dengan label *Nonaktif*. Data lama tetap terbaca, tapi tidak muncul lagi di pilihan untuk transaksi baru. Untuk mengaktifkannya kembali, centang lagi **Aktif** dan simpan.');
GAMBAR('f13-nonaktif.png', 'Kode rekening berstatus Nonaktif');

H2('5.6 Aturan main formulir');
TABEL(['Situasi', 'Yang terjadi'], [
  ['Kolom kunci (kode, NPSN, kombinasi rekening+jenis+wilayah) saat **Ubah**', 'Terkunci. Untuk kode lain, tambahkan baris baru lalu nonaktifkan yang lama'],
  ['Simpan tanpa mengubah apa pun', 'Muncul pesan *Tidak ada perubahan*; versi tidak naik dan tidak ada kiriman baru'],
  ['Isian kosong atau format salah', 'Pesan muncul di kiri bawah laci; **Simpan** dinonaktifkan'],
  ['Data merujuk referensi lain (misalnya wilayah sekolah)', 'Pilihan hanya berisi referensi yang aktif'],
  ['Setiap simpan yang berhasil', 'Versi naik dan perubahan dikirim otomatis ke semua layanan'],
], [4200, 5438]);
GAMBAR('f14-tanpa-perubahan.png', 'Pesan Tidak ada perubahan; versi tetap');

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
OL(['Buka menu **Referensi**.', 'Klik **Terbitkan ulang ke semua layanan**.', 'Klik **OK** pada kotak konfirmasi.']);
GAMBAR('s17-terbit-ulang.png', 'Tombol Terbitkan ulang ke semua layanan');
P('Kotak hijau memberi tahu berapa baris referensi yang diantrekan untuk dikirim ke modul lain.');
GAMBAR('s18-terbit-berhasil.png', 'Referensi berhasil diantrekan ke semua layanan');
KOTAK('INGAT', 'Terbitkan ulang **nggak menaikkan versi**. Modul lain otomatis mengabaikan data yang sama atau lebih lama, jadi tombol ini aman diklik berulang kali.');

// ======================================================================
// BAB 7 PENANGANAN MASALAH
// ======================================================================
H1('Memantau Serapan Nasional');
KOTAK('INGAT', 'Dasbor Balai memperlihatkan seluruh provinsi. Angkanya berasal dari transaksi yang sudah disetujui Kepala Sekolah di tiap sekolah, dikumpulkan lewat event antarlayanan, jadi tidak perlu meminta laporan manual ke daerah.');
P('Setelah referensi ditetapkan dan RKAS sekolah berjalan, Balai memantau pelaksanaannya secara nasional. Satu halaman merangkum berapa sekolah yang sudah punya RKAS berlaku, seberapa jauh dananya terserap, dan daerah mana yang tertinggal.');
GAMBAR('bl01-dasbor-nasional.png', 'Dasbor nasional: ringkasan dan rincian per provinsi');
TABEL(['Bagian', 'Isinya'], [
  ['Kartu ringkasan', 'Jumlah sekolah dengan RKAS disahkan, serapan anggaran, belanja disetujui, dan jumlah sekolah yang terlambat menutup buku'],
  ['Serapan & kepatuhan per provinsi', 'Satu baris per provinsi; klik untuk turun ke kabupaten/kota, lalu ke sekolah'],
  ['Pemetaan belanja SIPLah per jenjang', 'Perbandingan rencana dengan belanja daring, dikelompokkan menurut jenjang pendidikan'],
], [2600, 7038]);
KOTAK('TIPS', 'Serapan yang rendah di awal tahun itu wajar karena RKAS baru disahkan. Yang perlu diperhatikan adalah provinsi yang serapannya tetap jauh tertinggal menjelang akhir semester.');

H1('Bantuan Pemerintah');
KOTAK('INGAT', 'Alurnya berjenjang: **Direktorat** menyusun dan mengajukan, **Ditjen** menyetujui juknis, lalu **Balai SDSP** memverifikasi dan mengesahkan. Sekolah baru bisa mengajukan setelah sumber dana berstatus Disahkan.');
H2('Daftar sumber dana bantuan');
GAMBAR('bl02-bantuan-daftar.png', 'Daftar sumber dana Bantuan Pemerintah beserta statusnya');
P('Kolom **Penerima**, **Nilai**, dan **Disalurkan** memperlihatkan sejauh mana bantuan sudah sampai ke sekolah. Statusnya menunjukkan tahap mana yang sedang berjalan.');
H2('Memeriksa satu bantuan sebelum disahkan');
P('Klik salah satu baris untuk membuka rinciannya. Halaman ini memuat seluruh berkas yang perlu Bapak/Ibu periksa sebelum menekan tombol pengesahan.');
GAMBAR('bl03-bantuan-detail.png', 'Rincian bantuan: kelengkapan, dokumen, komponen, penerima, PKS bank, penyaluran, dan pengajuan sekolah');
TABEL(['Bagian', 'Yang diperiksa'], [
  ['Kelengkapan', 'Penanda hijau berarti seluruh syarat terpenuhi; selama masih merah, tombol pengesahan tidak aktif'],
  ['Dokumen', 'Petunjuk teknis dan panduan pelaksanaan — unduh dan baca sebelum mengesahkan'],
  ['Komponen bantuan', 'Rincian barang atau kegiatan yang dibiayai beserta porsinya'],
  ['Penerima', 'Daftar sekolah penerima beserta nilainya; diimpor dari berkas Excel oleh Direktorat'],
  ['PKS bank & penyaluran', 'Perjanjian kerja sama penyalur dan catatan dana yang sudah disalurkan'],
  ['Pengajuan sekolah', 'Permohonan dari sekolah penerima yang perlu diputuskan'],
], [2600, 7038]);
KOTAK('PENTING', 'Setelah disahkan, sumber dana otomatis dibuka di seluruh Mitra SIPLah dan pagunya mengalir ke perencanaan sekolah. Karena itu pastikan daftar penerima dan nilainya sudah benar sebelum pengesahan.');

H1('Mitra SIPLah');
P('Sekolah berbelanja daring melalui Mitra SIPLah. Halaman **Mitra SIPLah** memperlihatkan siapa saja mitra yang terdaftar dan apakah sumber dana sudah benar-benar terbuka di sistem mereka.');
GAMBAR('bl04-mitra.png', 'Pembukaan sumber dana di Mitra, daftar Mitra terdaftar, dan transaksi terbaru');
TABEL(['Bagian', 'Isinya'], [
  ['Pembukaan sumber dana di Mitra', 'Setiap sumber dana yang disahkan dibuka otomatis di semua Mitra aktif; sekolah baru bisa belanja setelah statusnya **Dibuka**'],
  ['Mitra terdaftar', 'Alamat IP yang diizinkan dan status tiap Mitra; dari sini Mitra baru didaftarkan'],
  ['Transaksi dari Mitra terbaru', 'Transaksi belanja yang dikirim Mitra, beserta sekolah dan nilainya'],
], [2900, 6738]);
KOTAK('PENTING', 'Bila sebuah sumber dana berstatus belum dibuka padahal sudah disahkan, sekolah akan melapor tidak bisa berbelanja. Periksa status Mitra di halaman ini lebih dulu sebelum menelusuri lebih jauh.');

H1('Jejak Audit');
P('Setiap perubahan data penting di seluruh layanan dicatat dan tidak bisa dihapus. Lencana **Terverifikasi utuh** berarti rantai catatan masih utuh — tidak ada entri yang disunting diam-diam.');
GAMBAR('bl05-jejak-audit.png', 'Jejak audit nasional dengan penyaring tahun, rantai, layanan, dan jenis perubahan');
LI([
  'Gunakan penyaring **Layanan** untuk memisahkan perubahan referensi dari perubahan transaksi sekolah.',
  'Tombol **Lihat isi** pada sebuah entri memperlihatkan nilai sebelum dan sesudah perubahan.',
  'Tombol **Periksa ulang** menghitung ulang rantai hash; lakukan bila ada dugaan data berubah di luar aplikasi.',
]);
KOTAK('INGAT', 'Jejak audit melengkapi, bukan menggantikan, pemeriksaan biasa. Ia menjawab pertanyaan "siapa mengubah apa dan kapan", bukan "apakah keputusannya tepat".');

H1('Penanganan Masalah');
KOTAK('BAB', 'arti pesan yang mungkin muncul, masalah yang paling sering dilaporkan, dan cara menyelesaikannya.');
H2('7.1 Cara membaca pesan dari aplikasi');
LI([
  '**Pesan di kiri bawah laci**: isian belum lengkap atau formatnya salah. Perbaiki dulu, baru **Simpan** bisa diklik.',
  '**Kotak merah**: aksi ditolak. Isinya penjelasan, kolom yang bermasalah, dan **kode**.',
  '**Kotak biru**: informasi, misalnya *Tidak ada perubahan*.',
  '**Kotak hijau**: berhasil, lengkap dengan nomor versi baru.',
]);
H2('7.2 Daftar pesan yang sering muncul');
TABEL(['Pesan atau kode', 'Artinya', 'Yang perlu dilakukan'], [
  ['*(nama kolom) wajib diisi*', 'Kolom wajib masih kosong', 'Isi kolom tersebut'],
  ['*NPSN harus 8 digit angka* (dan pesan format lain)', 'Format isian tidak sesuai', 'Ikuti contoh di bawah kolom'],
  ['`VALIDASI`', 'Server menolak format isian; kolom yang bermasalah disebutkan', 'Perbaiki kolom yang disebut'],
  ['`RUJUKAN_TIDAK_DIKENAL`', 'Data merujuk referensi yang belum ada', 'Tambahkan dulu data induknya (misalnya wilayah atau jenjang)'],
  ['`DATA_TIDAK_VALID`', 'Isian melanggar aturan data (misalnya tarif daerah untuk jenis selain SSPD)', 'Periksa kembali kombinasi isian'],
  ['`HAPUS_DILARANG`', 'Referensi tidak boleh dihapus', 'Nonaktifkan dengan menghapus centang Aktif'],
  ['`PERAN_TIDAK_DIIZINKAN`', 'Aksi hanya untuk peran Balai SDSP', 'Pastikan peran aktif di pojok kanan atas adalah Balai SDSP'],
  ['`MASA_BERLAKU_WAJIB` / `MASA_BERLAKU_TIDAK_VALID`', 'Auditor tanpa tanggal berlaku, atau tanggalnya sudah lewat', 'Isi tanggal berlaku di masa depan'],
  ['`CAKUPAN_TIDAK_SESUAI`', 'Kode wilayah/ditjen kosong atau formatnya salah', 'Admin Dinas: kode wilayah 2/4 digit; Admin Ditjen: kode ditjen'],
  ['`PEMISAHAN_TUGAS`', 'Mencoba memberi atau mencabut peran untuk diri sendiri', 'Minta rekan admin Balai lain'],
], [3200, 3300, 3138]);
H2('7.3 Masalah yang sering terjadi dan solusinya');
const KASUS = [
  ['Sekolah belum melihat perubahan referensi', 'Kabar perubahan belum sampai, misalnya karena gangguan jaringan di salah satu modul.', 'Tunggu beberapa saat. Bila masih, klik **Terbitkan ulang ke semua layanan** (Bab 6).'],
  ['Salah mengisi referensi', 'Angka atau nama keliru saat menyimpan.', 'Klik **Ubah** dan simpan isian yang benar. Versi naik lagi dan semua modul mengikuti data terbaru.'],
  ['Salah mengetik kode (kunci)', 'Kolom kunci tidak bisa diubah setelah disimpan.', 'Tambahkan baris baru dengan kode yang benar, lalu nonaktifkan baris yang salah.'],
  ['Tombol Simpan abu-abu', 'Ada kolom wajib yang kosong atau format yang salah.', 'Baca pesan di kiri bawah laci dan perbaiki isiannya.'],
  ['Pilihan wilayah/jenjang/kode rekening tidak muncul di formulir', 'Referensi induknya belum ada atau sedang nonaktif.', 'Tambahkan atau aktifkan dulu referensi induknya di tab masing-masing.'],
  ['Dinas melapor "kode rekening tidak dikenal"', 'Kode rekening itu nonaktif atau belum ada.', 'Cek tab **Kode rekening**; tambahkan atau aktifkan kembali kodenya.'],
  ['Admin Dinas wilayah baru tidak bisa didaftarkan', 'Kode wilayah belum ada di referensi.', 'Tambahkan wilayahnya di tab **Wilayah**, lalu ulangi pendaftaran Admin Dinas.'],
  ['Muncul "Tidak ada perubahan" padahal merasa sudah mengubah', 'Isian yang disimpan sama persis dengan data tersimpan (misalnya hanya mengetik ulang angka yang sama).', 'Periksa kembali kolom yang ingin diubah, lalu simpan lagi.'],
  ['Auditor tiba-tiba tidak bisa masuk', 'Tanggal *berlaku sampai* sudah lewat.', 'Bila masa tugas diperpanjang, berikan peran Auditor baru dengan tanggal berlaku yang baru.'],
];
KASUS.forEach(([masalah, sebab, solusi], i) => {
  H3(`Masalah ${i + 1}: ${masalah}`);
  tambah(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'Penyebab: ', bold: true, color: 'B23B3B' }), ...runs(sebab)] }));
  tambah(new Paragraph({ spacing: { after: 180 }, children: [new TextRun({ text: 'Solusi: ', bold: true, color: '2E7D32' }), ...runs(solusi)] }));
});
H2('7.4 Kebiasaan baik');
LI([
  'Simpan perubahan referensi hanya berdasarkan dasar hukum atau juknis yang jelas, dan isi kolom **Dasar hukum** bila tersedia.',
  'Periksa dua kali sebelum menyimpan: referensi berlaku nasional.',
  'Umumkan perubahan penting ke Dinas sebelum disimpan.',
  'Nonaktifkan, jangan menimpa: untuk kode yang berganti, tambahkan kode baru lalu nonaktifkan yang lama.',
  'Tinjau daftar Admin Dinas, Pemantau, dan Auditor setiap semester; cabut yang sudah tidak bertugas.',
]);

// ======================================================================
// BAB 8 PENUTUP
// ======================================================================
H1('Penutup');
KOTAK('BAB', 'rangkuman rutinitas Balai sepanjang tahun, ke mana mencari bantuan, dan catatan versi.');
P('Terima kasih sudah membaca sampai akhir! Referensi yang rapi membuat penyusunan RKAS di sekolah lebih mudah, penelaahan di Dinas lebih cepat, dan laporan di semua tingkat lebih bisa dipercaya.');
H2('8.1 Rangkuman rutinitas Balai');
TABEL(['Kapan', 'Yang dilakukan Balai'], [
  ['Awal tahun anggaran', 'Sesuaikan batas komponen dengan juknis terbaru; pastikan sumber dana, kode rekening, dan tarif nasional aktif'],
  ['Saat peraturan kode rekening atau pajak berubah', 'Tambahkan kode/tarif baru, lalu nonaktifkan yang lama'],
  ['Saat ada sekolah atau wilayah baru', 'Tambahkan di tab Satuan pendidikan atau Wilayah'],
  ['Saat ada Dinas baru bergabung', 'Daftarkan Admin Dinas dengan kode wilayahnya'],
  ['Saat ada pemeriksaan', 'Daftarkan Auditor dengan masa berlaku sesuai surat tugas'],
  ['Setelah gangguan atau pemeliharaan', 'Terbitkan ulang referensi ke semua layanan'],
  ['Setiap semester', 'Tinjau pengguna tingkat pusat dan referensi yang sudah tidak berlaku'],
], [3400, 6238]);
H2('8.2 Butuh bantuan?');
LI([
  'Masalah teknis aplikasi: hubungi **tim teknis ARKAS Web**.',
  'Pertanyaan soal tarif daerah atau akun di wilayah: hubungi **Admin Dinas** wilayah terkait.',
  'Saat melapor, sertakan menu dan tab yang dibuka, langkah yang dilakukan, dan tangkapan layar kotak merah beserta kodenya.',
]);
H2('8.3 Catatan versi');
P('Buku ini disusun berdasarkan ARKAS Web versi uji coba (November 2026). Halaman masuk di lingkungan uji coba masih menampilkan akun contoh. Formulir referensi mencakup tambah, ubah, dan nonaktifkan untuk delapan jenis referensi.');
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
