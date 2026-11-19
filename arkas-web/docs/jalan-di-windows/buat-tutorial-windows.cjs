// Tutorial menjalankan ARKAS Web di komputer Windows (DOCX). node buat-tutorial-windows.cjs
const path = require('path');
const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle } = require('docx');
const { buatBuku } = require('../buku-sekolah/lib-buku.cjs');

const B = buatBuku('Menjalankan ARKAS Web di Komputer Windows', {
  dir: { gambar: path.join(__dirname, '..', 'buku-sekolah', 'gambar'), diagram: path.join(__dirname, 'diagram') },
  polaDiagram: /^w\d/,
  dirKeluaran: __dirname,
});
const { H1, H2, H3, P, LI, OL, GAMBAR, KOTAK, TABEL } = B;

function KODE(baris, judul) {
  const isi = (Array.isArray(baris) ? baris : [baris]).map((t) => new Paragraph({
    spacing: { after: 0, line: 250 },
    children: [new TextRun({ text: t === '' ? ' ' : t, font: 'Consolas', size: 18, color: t.trimStart().startsWith('#') ? '6B7A8C' : '1B2733' })],
  }));
  if (judul) isi.unshift(new Paragraph({ spacing: { after: 70 }, children: [new TextRun({ text: judul, bold: true, size: 18, color: '475569' })] }));
  const sel = new TableCell({
    width: { size: 9638, type: WidthType.DXA }, shading: { fill: 'F4F7FA', type: ShadingType.CLEAR, color: 'auto' },
    margins: { top: 130, bottom: 130, left: 200, right: 160 },
    borders: { left: { style: BorderStyle.SINGLE, size: 22, color: '0078D4' }, top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
    children: isi,
  });
  B.tambah(new Table({ width: { size: 9638, type: WidthType.DXA }, columnWidths: [9638], rows: [new TableRow({ cantSplit: true, children: [sel] })] }), new Paragraph({ spacing: { after: 150 }, children: [] }));
}

// ====================================================================== BAB 1
H1('Sebelum Mulai');
KOTAK('RINGKAS', ['Apa yang akan kamu pasang, berapa lama kira-kira, dan apa hasil akhirnya.']);
P('Panduan ini membawa komputer Windows-mu dari keadaan kosong sampai ARKAS Web terbuka di peramban, berjalan sepenuhnya di komputer sendiri tanpa internet (kecuali saat memasang).');
H2('1.1 Yang akan berjalan di komputermu');
TABEL(['Bagian', 'Jumlah', 'Keterangan'], [
  ['Layanan backend', '9 proses Node.js', 'Port 3103 sampai 3111'],
  ['Aplikasi web', '1 proses Next.js', 'Port 3000 — ini yang kamu buka di peramban'],
  ['Mitra SIPLah tiruan', '1 proses Node.js', 'Port 3190 — supaya belanja daring bisa dicoba'],
  ['Basis data', '9 basis data PostgreSQL', 'Satu per layanan, dalam satu server PostgreSQL'],
], [2500, 2600, 4538]);
H2('1.2 Kebutuhan komputer');
LI([
  'Windows 10 atau 11, 64-bit.',
  'RAM 8 GB masih cukup; 16 GB lebih lega karena ada sebelas proses Node berjalan bersamaan.',
  'Ruang kosong sekitar 3 GB: dependensi `node_modules` saja memakan ± 1,5 GB.',
  'Hak administrator, hanya saat memasang Node dan PostgreSQL.',
]);
H2('1.3 Perkiraan waktu');
TABEL(['Tahap', 'Perkiraan'], [
  ['Memasang Node, pnpm, dan PostgreSQL (Bab 2)', '15–25 menit, tergantung kecepatan internet'],
  ['Mengambil kode dan menjalankan skrip pemasangan (Bab 3–4)', '10–15 menit'],
  ['Menjalankan dan membuka aplikasi (Bab 5)', '1–2 menit'],
], [4800, 4838]);
KOTAK('INGAT', 'Bab 2 sampai 4 hanya dilakukan **sekali**. Setelah itu, menjalankan aplikasi cukup satu perintah di Bab 5.');

// ====================================================================== BAB 2
H1('Memasang Prasyarat');
KOTAK('RINGKAS', ['Node.js 22, pnpm 10, PostgreSQL 16, dan Git. Semuanya bisa dipasang lewat satu perintah winget.']);
H2('2.1 Membuka PowerShell');
P('Tekan tombol **Windows**, ketik `PowerShell`, lalu pilih **Windows PowerShell**. Untuk memasang, klik kanan dan pilih **Run as administrator**.');
KOTAK('TIPS', 'Pastikan yang terbuka adalah PowerShell, bukan Command Prompt (`cmd`). Semua perintah di panduan ini ditulis untuk PowerShell.');
H2('2.2 Memasang lewat winget');
P('`winget` sudah tersedia di Windows 10 versi baru dan Windows 11. Jalankan empat perintah berikut satu per satu di PowerShell **sebagai administrator**:');
KODE([
  'winget install OpenJS.NodeJS.LTS',
  'winget install PostgreSQL.PostgreSQL.16',
  'winget install Git.Git',
], 'PowerShell (administrator)');
P('Saat memasang PostgreSQL, pemasang akan meminta **kata sandi untuk pengguna `postgres`**. Catat kata sandi itu — nanti dibutuhkan skrip pemasangan. Panduan ini memakai contoh `postgres`.');
KOTAK('PENTING', 'Setelah semua pemasangan selesai, **tutup PowerShell lalu buka lagi**. Tanpa itu, perintah baru seperti `node` dan `psql` belum dikenali karena PATH belum dimuat ulang.');
H2('2.3 Mengaktifkan pnpm');
P('pnpm tidak perlu diunduh terpisah; ia sudah ikut Node.js lewat Corepack. Jalankan sekali:');
KODE(['corepack enable'], 'PowerShell');
H2('2.4 Menambahkan psql ke PATH');
P('Pemasang PostgreSQL kadang tidak menambahkan perkakas barisnya ke PATH. Periksa dengan `psql --version`. Kalau muncul pesan "not recognized", tambahkan foldernya:');
KODE([
  '# menambahkan untuk pengguna saat ini (ganti 16 bila versimu berbeda)',
  '$bin = "C:\\Program Files\\PostgreSQL\\16\\bin"',
  '[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$bin", "User")',
], 'PowerShell');
P('Tutup PowerShell, buka lagi, lalu periksa ulang.');
H2('2.5 Memastikan semuanya terpasang');
KODE([
  'node --version      # harus v22.x atau lebih baru',
  'pnpm --version      # harus 10.x',
  'psql --version      # harus 16.x',
  'git --version',
], 'PowerShell');
KOTAK('PENTING', 'Kalau `node --version` menunjukkan versi di bawah 22, pasang ulang dengan `winget install OpenJS.NodeJS.LTS` lalu buka PowerShell baru. Versi di bawah 22 akan gagal saat membangun.');

// ====================================================================== BAB 3
H1('Mengambil Kode');
P('Pilih folder tempat menyimpan kode, misalnya `C:\\kerja`, lalu salin repositorinya:');
KODE([
  'mkdir C:\\kerja -Force',
  'cd C:\\kerja',
  'git clone https://github.com/respatihastomo/Claude.git arkas-web',
  'cd arkas-web',
], 'PowerShell');
KOTAK('TIPS', 'Hindari folder yang disinkronkan OneDrive atau yang namanya mengandung spasi dan tanda baca. Keduanya sering menimbulkan galat saat memasang dependensi.');
P('Semua perintah pada bab-bab berikutnya dijalankan dari dalam folder `arkas-web` ini.');

// ====================================================================== BAB 4
H1('Pemasangan Sekali Jalan');
KOTAK('RINGKAS', ['Satu skrip menyiapkan dependensi, kunci pengembangan, berkas konfigurasi, hasil build, dan sembilan basis data beserta data contoh.']);
H2('4.1 Mengizinkan skrip berjalan');
P('Secara bawaan Windows menolak menjalankan berkas `.ps1`. Izinkan untuk pengguna saat ini — ini aman dan hanya berlaku untuk skrip yang kamu jalankan sendiri:');
KODE(['Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned'], 'PowerShell');
P('Jawab **Y** saat ditanya. Cukup sekali seumur pemakaian komputer.');
H2('4.2 Menjalankan skrip pemasangan');
KODE([
  '.\\scripts\\windows\\pasang-lokal.ps1',
  '',
  '# bila kata sandi postgres-mu bukan "postgres":',
  '.\\scripts\\windows\\pasang-lokal.ps1 -SandiPostgres "sandimu"',
], 'PowerShell, dari folder arkas-web');
H2('4.3 Apa yang dikerjakan skrip itu');
TABEL(['Tahap', 'Isinya'], [
  ['Memeriksa prasyarat', 'Memastikan Node ≥ 22, pnpm, dan PostgreSQL dapat dihubungi. Berhenti dengan pesan jelas bila ada yang kurang.'],
  ['`pnpm install`', 'Memasang seluruh dependensi monorepo (± 1,5 GB, paling lama di tahap ini).'],
  ['Kunci pengembangan', 'Membuat pasangan kunci EdDSA di `.dev-keys\\` untuk menandatangani token internal. Dilewati bila sudah ada.'],
  ['Berkas konfigurasi', 'Menyalin tiap `.env.*.example` menjadi `.env.*` bila belum ada. Berkas yang sudah ada tidak ditimpa.'],
  ['`pnpm build`', 'Membangun sembilan layanan, tiga paket bersama, dan aplikasi web.'],
  ['Migrasi basis data', 'Membuat sembilan basis data beserta peran login, menjalankan seluruh migrasi SQL, lalu mengisi data contoh.'],
], [2400, 7238]);
P('Bila berhasil, baris terakhirnya berbunyi **Pemasangan selesai**.');
KOTAK('PENTING', 'Skrip ini membuat basis data `db_ref`, `db_auth`, `db_perencanaan`, `db_tatausaha`, `db_pelaporan`, `db_audit`, `db_integrasi`, `db_pemantauan`, dan `db_banper`. Bila nama-nama itu sudah dipakai di PostgreSQL-mu untuk hal lain, pindahkan dulu sebelum menjalankan skrip.');

// ====================================================================== BAB 5
H1('Menjalankan Aplikasi');
KOTAK('RINGKAS', ['Satu perintah menyalakan sebelas proses, lalu aplikasi dibuka di localhost:3000.']);
H2('5.1 Menyalakan');
KODE(['.\\scripts\\windows\\jalankan-semua.ps1'], 'PowerShell, dari folder arkas-web');
P('Skrip menyalakan sembilan layanan, Mitra tiruan, dan aplikasi web; lalu menunggu sampai setiap port menyahut dan menampilkan ringkasannya:');
KODE([
  '  [ok] svc-referensi        :3103',
  '  [ok] svc-identitas        :3104',
  '  [ok] svc-penatausahaan    :3105',
  '  [ok] svc-pelaporan        :3106',
  '  [ok] svc-perencanaan      :3107',
  '  [ok] svc-audit            :3108',
  '  [ok] svc-integrasi        :3109',
  '  [ok] svc-pemantauan       :3110',
  '  [ok] svc-bantuan          :3111',
  '  [ok] mitra-tiruan         :3190',
  '  [ok] web                  :3000',
], 'Keluaran yang diharapkan');
KOTAK('TIPS', 'Saat pertama kali dijalankan, Windows Defender Firewall mungkin menanyakan izin jaringan untuk Node.js. Pilih **Private networks** saja; aplikasi hanya perlu berbicara dengan dirinya sendiri.');
H2('5.2 Membuka aplikasi');
P('Buka peramban ke alamat **http://localhost:3000**. Karena SSO tidak dikonfigurasi di komputer lokal, halaman masuk menampilkan daftar akun contoh — klik salah satunya untuk langsung masuk.');
GAMBAR('01-masuk', 'Halaman masuk di lingkungan lokal: daftar akun contoh', 12.5);
H2('5.3 Akun contoh yang tersedia');
TABEL(['Nama', 'Peran', 'Cocok untuk mencoba'], [
  ['Dewi Lestari', 'Operator — SMP Swasta Contoh 2', 'Menyusun kertas kerja RKAS'],
  ['Ahmad Fauzi', 'Bendahara — SMP Swasta Contoh 2', 'Mencatat penerimaan, belanja, dan pajak'],
  ['Hj. Siti Aminah, M.Pd.', 'Kepala Sekolah — SMP Swasta Contoh 2', 'Menyetujui transaksi dan menutup buku'],
  ['Bambang Wijaya', 'Komite Sekolah', 'Melihat BKU dan laporan'],
  ['Rudi Setiawan', 'Verifikator Dinas wilayah 3202', 'Menelaah dan mengesahkan RKAS'],
  ['Admin Balai SDSP', 'Balai SDSP — nasional', 'Referensi nasional, Bantuan Pemerintah, Mitra SIPLah'],
  ['Ir. Dimas Pratama', 'Pemantau Pusat', 'Dasbor serapan nasional'],
  ['Dra. Lestari W.', 'Auditor', 'Jejak audit'],
], [2800, 3400, 3438]);
KOTAK('INGAT', 'Data contoh sudah berisi satu sekolah yang RKAS-nya disahkan sampai versi 3, beserta transaksi, pajak yang sudah disetor, dan buku November yang sudah ditutup. Jadi kamu bisa langsung melihat aplikasinya dalam keadaan terisi.');
H2('5.4 Menghentikan');
KODE(['.\\scripts\\windows\\hentikan-semua.ps1'], 'PowerShell');
P('Skrip menghentikan seluruh proses beserta anak-anaknya berdasarkan PID yang dicatat saat dijalankan.');
H2('5.5 Menjalankan ulang berikutnya');
P('Untuk pemakaian sehari-hari berikutnya, cukup dua perintah:');
KODE([
  'cd C:\\kerja\\arkas-web',
  '.\\scripts\\windows\\jalankan-semua.ps1',
], 'PowerShell');
P('Pemasangan tidak perlu diulang kecuali kamu menarik perubahan kode baru — lihat Bab 7.');

// ====================================================================== BAB 6
H1('Saat Ada yang Tidak Beres');
KOTAK('RINGKAS', ['Membaca log, menjalankan satu layanan untuk menelusuri galat, dan sepuluh masalah yang paling sering muncul di Windows.']);
H2('6.1 Membaca log');
P('Setiap proses menulis keluarannya ke folder `logs\\`. Untuk mengikuti log sebuah layanan secara langsung:');
KODE([
  'Get-Content .\\logs\\svc-penatausahaan.log -Wait -Tail 40',
  '',
  '# galat biasanya ada di berkas .err.log',
  'Get-Content .\\logs\\svc-penatausahaan.err.log -Tail 40',
], 'PowerShell');
H2('6.2 Menjalankan satu layanan di jendela sendiri');
P('Cara tercepat menelusuri galat sebuah layanan: hentikan semuanya, lalu jalankan layanan itu sendirian dengan log tampil langsung di layar.');
KODE(['.\\scripts\\windows\\jalankan-svc.ps1 svc-penatausahaan'], 'PowerShell');
H2('6.3 Masalah yang sering muncul');
const KASUS = (gejala, sebab, solusi) => TABEL(['Gejala', 'Sebab & solusi'], [[gejala, sebab + '\n\n' + solusi]], [3000, 6638], 'FDECEA');
H3('“… cannot be loaded because running scripts is disabled”');
KASUS('Skrip .ps1 ditolak saat dijalankan', 'Kebijakan eksekusi PowerShell masih Restricted.', 'Jalankan `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, jawab Y, lalu coba lagi.');
H3('“node / pnpm / psql is not recognized”');
KASUS('Perintah tidak dikenali padahal sudah dipasang', 'PATH belum dimuat ulang, atau folder bin PostgreSQL belum masuk PATH.', 'Tutup PowerShell dan buka lagi. Untuk psql, ikuti Bab 2.4.');
H3('“SASL: client password must be a string”');
KASUS('Migrasi gagal menyambung ke PostgreSQL', 'Kata sandi pengguna `postgres` tidak diberikan atau salah.', 'Jalankan ulang dengan `-SandiPostgres "sandimu"`. Uji dulu dengan `psql -U postgres -h localhost -c "select 1"`.');
H3('“password authentication failed for user postgres”');
KASUS('Kata sandi ditolak', 'Sandi yang dipakai berbeda dengan yang diisi saat memasang PostgreSQL.', 'Coba ingat sandi saat pemasangan. Bila lupa, cara tercepat adalah memasang ulang PostgreSQL dan menetapkan sandi baru.');
H3('Port sudah dipakai (EADDRINUSE)');
KASUS('Layanan mati sesaat setelah dijalankan; log berisi EADDRINUSE', 'Proses lama masih hidup, atau aplikasi lain memakai port tersebut.', 'Jalankan `.\\scripts\\windows\\hentikan-semua.ps1`. Bila masih ada, cari pemakainya: `Get-NetTCPConnection -LocalPort 3105 | Select-Object OwningProcess` lalu `Stop-Process -Id <id>`.');
H3('Layanan menyala tapi web menampilkan galat');
KASUS('Halaman terbuka tetapi datanya gagal dimuat', 'Satu atau beberapa layanan belum siap, biasanya svc-identitas.', 'Periksa ringkasan port pada keluaran `jalankan-semua.ps1`. Yang bertanda [!] lihat log-nya di `logs\\`.');
H3('“belum dibangun. Jalankan pnpm build”');
KASUS('Skrip menolak menjalankan sebuah layanan', 'Folder `dist` belum ada karena build belum dijalankan atau gagal.', 'Jalankan `pnpm build` dan perhatikan pesan galatnya.');
H3('pnpm install sangat lambat atau gagal di tengah');
KASUS('Pemasangan dependensi tersendat', 'Antivirus memindai ribuan berkas kecil di `node_modules`.', 'Tambahkan folder `C:\\kerja\\arkas-web` ke daftar pengecualian Windows Security, lalu ulangi `pnpm install`.');
H3('Build gagal dengan pesan tentang panjang path');
KASUS('“path too long” saat memasang atau membangun', 'Batas 260 karakter pada Windows.', 'Pindahkan repositori ke folder yang lebih pendek seperti `C:\\kerja\\arkas-web`, atau aktifkan dukungan path panjang lewat Group Policy.');
H3('Data contoh ingin dikembalikan seperti semula');
KASUS('Data sudah terlanjur diubah-ubah saat mencoba', 'Basis data berisi hasil percobaanmu.', 'Jalankan ulang migrasi dengan membuang basis data lama: `node scripts/migrate.mjs svc-penatausahaan --fresh --seed` (ganti nama layanan sesuai kebutuhan).');

// ====================================================================== BAB 7
H1('Pemakaian Sehari-hari');
H2('7.1 Menarik perubahan kode terbaru');
KODE([
  'git pull',
  'pnpm install           # bila ada dependensi baru',
  'pnpm build',
  '',
  '# bila ada migrasi basis data baru, jalankan untuk layanan yang berubah',
  '$env:DATABASE_ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres"',
  'node scripts/migrate.mjs svc-penatausahaan',
], 'PowerShell');
H2('7.2 Mengubah kode sambil berjalan');
P('Untuk mengerjakan tampilan, jalankan web dalam mode pengembangan supaya perubahan langsung terlihat tanpa membangun ulang:');
KODE(['.\\scripts\\windows\\jalankan-semua.ps1 -Mode dev'], 'PowerShell');
P('Untuk mengerjakan sebuah layanan, hentikan semuanya, lalu jalankan layanan itu sendiri (Bab 6.2) setelah `pnpm build`.');
H2('7.3 Menjalankan pengujian');
KODE([
  '$env:DATABASE_ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres"',
  '$env:API_DB_PASSWORD = "api_dev"',
  '$env:WORKER_DB_PASSWORD = "worker_dev"',
  'pnpm test',
], 'PowerShell');
P('Seluruhnya 214 kasus uji. Uji integrasi membuat basis data `*_uji` tersendiri, jadi data contohmu tidak terganggu.');
H2('7.4 Perintah yang sering dipakai');
TABEL(['Perintah', 'Kegunaan'], [
  ['`.\\scripts\\windows\\jalankan-semua.ps1`', 'Menyalakan semuanya'],
  ['`.\\scripts\\windows\\hentikan-semua.ps1`', 'Mematikan semuanya'],
  ['`.\\scripts\\windows\\jalankan-svc.ps1 <layanan>`', 'Menjalankan satu layanan dengan log di layar'],
  ['`.\\scripts\\windows\\pasang-lokal.ps1 -LewatiMigrasi`', 'Memasang ulang dependensi tanpa menyentuh basis data'],
  ['`pnpm build`', 'Membangun ulang setelah mengubah kode layanan'],
  ['`pnpm test`', 'Menjalankan seluruh pengujian'],
  ['`Get-Content .\\logs\\<nama>.log -Wait`', 'Mengikuti log sebuah proses'],
], [4400, 5238]);

// ====================================================================== LAMPIRAN
H1('Lampiran', false);
H2('A. Daftar port');
TABEL(['Port', 'Proses', 'Basis data'], [
  ['3000', 'Aplikasi web (Next.js)', '—'],
  ['3103', 'svc-referensi', 'db_ref'],
  ['3104', 'svc-identitas', 'db_auth'],
  ['3105', 'svc-penatausahaan', 'db_tatausaha'],
  ['3106', 'svc-pelaporan', 'db_pelaporan'],
  ['3107', 'svc-perencanaan', 'db_perencanaan'],
  ['3108', 'svc-audit', 'db_audit'],
  ['3109', 'svc-integrasi', 'db_integrasi'],
  ['3110', 'svc-pemantauan', 'db_pemantauan'],
  ['3111', 'svc-bantuan', 'db_banper'],
  ['3190', 'Mitra SIPLah tiruan', '—'],
  ['5432', 'PostgreSQL', 'seluruhnya'],
], [1400, 4600, 3638]);
H2('B. Berkas pendukung di repositori');
TABEL(['Berkas', 'Isi'], [
  ['`scripts\\windows\\pasang-lokal.ps1`', 'Pemasangan sekali jalan: prasyarat, dependensi, kunci, konfigurasi, build, migrasi'],
  ['`scripts\\windows\\jalankan-semua.ps1`', 'Menyalakan sembilan layanan, Mitra tiruan, dan web; menunggu port siap'],
  ['`scripts\\windows\\hentikan-semua.ps1`', 'Menghentikan seluruh proses beserta anak-anaknya'],
  ['`scripts\\windows\\jalankan-svc.ps1`', 'Menjalankan satu layanan dengan log langsung di layar'],
  ['`scripts\\windows\\env-lokal.ps1`', 'Fungsi bersama: daftar layanan, pembaca berkas .env, pemeriksa port'],
  ['`docs\\jalan-di-windows\\README.md`', 'Versi ringkas panduan ini dalam Markdown'],
], [3400, 6238]);
H2('C. Langkah manual bila skrip gagal');
P('Bila karena suatu hal skrip PowerShell tidak bisa dipakai, seluruh tahapannya dapat dijalankan manual:');
KODE([
  '# 1. dependensi',
  'corepack enable',
  'pnpm install',
  '',
  '# 2. kunci pengembangan',
  'node scripts/dev-keys.mjs',
  '',
  '# 3. berkas konfigurasi (ulangi untuk tiap layanan)',
  'Copy-Item .env.example .env',
  'Copy-Item .env.referensi.example .env.referensi',
  '# ... .env.identitas, .env.perencanaan, .env.pelaporan, .env.audit,',
  '#     .env.integrasi, .env.pemantauan, .env.bantuan',
  '',
  '# 4. build',
  'pnpm build',
  '',
  '# 5. basis data',
  '$env:DATABASE_ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres"',
  'foreach ($s in @("svc-referensi","svc-identitas","svc-perencanaan","svc-penatausahaan",',
  '                 "svc-pelaporan","svc-audit","svc-integrasi","svc-pemantauan","svc-bantuan")) {',
  '  node scripts/migrate.mjs $s --seed',
  '}',
  '',
  '# 6. menjalankan satu layanan (ulangi di jendela terpisah untuk tiap layanan)',
  '.\\scripts\\windows\\jalankan-svc.ps1 svc-penatausahaan',
  '',
  '# 7. web',
  'pnpm --filter @arkas/web start',
], 'PowerShell');
H2('D. Bacaan lanjutan');
TABEL(['Dokumen', 'Isi'], [
  ['Dokumentasi Pengembangan ARKAS Web', 'Arsitektur, model data, kontrak antarlayanan, keamanan, pengujian'],
  ['Kode Sumber per unit', 'Seluruh kode sumber dicetak beserta nomor baris'],
  ['Buku Panduan & Tutorial untuk Sekolah', 'Cara memakai aplikasinya dari sisi pengguna'],
], [3800, 5838]);

B.simpan('Tutorial-Menjalankan-ARKAS-Web-di-Windows.docx', {
  judul: 'Menjalankan ARKAS Web di Komputer Windows',
  deskripsi: 'Panduan pemasangan dan menjalankan ARKAS Web di komputer Windows',
  sampulPng: path.join(__dirname, 'diagram', 'sampul-windows.png'),
});
