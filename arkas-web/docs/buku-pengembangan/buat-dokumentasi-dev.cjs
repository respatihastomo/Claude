// Dokumentasi Pengembangan ARKAS Web (DOCX). node buat-dokumentasi-dev.cjs
const path = require('path');
const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle } = require('docx');
const { buatBuku } = require('../buku-sekolah/lib-buku.cjs');

const B = buatBuku('Dokumentasi Pengembangan ARKAS Web', {
  dir: { gambar: path.join(__dirname, 'diagram'), diagram: path.join(__dirname, 'diagram') },
  polaDiagram: /^p\d/,
  dirKeluaran: __dirname,
});
const { H1, H2, H3, P, LI, OL, GAMBAR, KOTAK, TABEL } = B;

/** Blok kode monospace satu sel. */
function KODE(baris, judul) {
  const isi = (Array.isArray(baris) ? baris : [baris]).map((t) => new Paragraph({
    spacing: { after: 0, line: 250 },
    children: [new TextRun({ text: t === '' ? ' ' : t, font: 'Consolas', size: 17, color: t.trimStart().startsWith('#') ? '6B7A8C' : '1B2733' })],
  }));
  if (judul) isi.unshift(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: judul, bold: true, size: 17, color: '475569' })] }));
  const sel = new TableCell({
    width: { size: 9638, type: WidthType.DXA }, shading: { fill: 'F5F7FA', type: ShadingType.CLEAR, color: 'auto' },
    margins: { top: 120, bottom: 120, left: 200, right: 160 },
    borders: { left: { style: BorderStyle.SINGLE, size: 20, color: '94A3B8' }, top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
    children: isi,
  });
  B.tambah(new Table({ width: { size: 9638, type: WidthType.DXA }, columnWidths: [9638], rows: [new TableRow({ cantSplit: true, children: [sel] })] }), new Paragraph({ spacing: { after: 140 }, children: [] }));
}

// ====================================================================== BAB 1
H1('Pendahuluan');
KOTAK('RINGKAS', ['Tujuan dokumen, siapa pembacanya, ruang lingkup, dan status implementasi saat dokumen ini dibuat.']);
H2('1.1 Tujuan dokumen');
P('Dokumen ini menjelaskan **bagaimana ARKAS Web dibangun**: arsitekturnya, model datanya, kontrak antarlayanannya, cara menjalankannya di komputer pengembang, cara mengujinya, dan hal-hal yang perlu diperhatikan saat menambah fitur baru.');
P('Isinya disusun langsung dari kode yang berjalan, bukan dari rancangan di atas kertas. Setiap angka pada dokumen ini — jumlah tabel, endpoint, kebijakan RLS, kasus uji — dihitung dari repositori pada saat penyusunan.');
H2('1.2 Untuk siapa');
TABEL(['Pembaca', 'Bab yang paling relevan'], [
  ['Pengembang baru di tim', 'Bab 2 dan 3 (gambaran), Bab 8 (menjalankan), Bab 11 (kontribusi)'],
  ['Pengembang backend', 'Bab 4 (data), Bab 5 (kontrak), Bab 6 (keamanan), Bab 7 (alur)'],
  ['Pengembang frontend', 'Bab 3.4 (web), Bab 5.1 (REST), Bab 6.1–6.2 (sesi & token)'],
  ['Pengelola basis data', 'Bab 4 seluruhnya, Bab 10.4 (cadangan)'],
  ['Arsitek / reviewer teknis', 'Bab 2.3 (keputusan arsitektur), Bab 5, Bab 12 (peta jalan)'],
  ['Tim operasional', 'Bab 8, Bab 10, Lampiran A'],
], [2900, 6738]);
H2('1.3 Ruang lingkup dan batasan');
LI([
  'Dokumen membahas **implementasi**; aturan kebijakan (juknis BOSP, ketentuan perpajakan) hanya dirujuk seperlunya.',
  'Cara memakai aplikasi dari sisi sekolah ada di **Buku Panduan** dan **Buku Tutorial ARKAS Web untuk Sekolah**.',
  'Rincian per layanan ditulis di berkas `docs/svc-*.md` dan `docs/irisan-*.md`; dokumen ini merangkum dan menghubungkannya.',
  'Konfigurasi produksi (klaster, CI/CD, jaringan) dibahas sebagai arah, bukan sebagai prosedur baku, karena belum ditetapkan.',
]);
H2('1.4 Status implementasi');
P('Sembilan layanan sudah berjalan beserta antarmuka webnya. Ringkasan ukuran sistem pada saat dokumen ini disusun:');
TABEL(['Besaran', 'Jumlah'], [
  ['Layanan backend (NestJS)', '9, ditambah satu aplikasi web Next.js'],
  ['Basis data PostgreSQL', '9 (satu per layanan) · 98 tabel · 1 materialized view'],
  ['Endpoint HTTP', '136 pada 25 controller'],
  ['Topik event', '16 topik CloudEvents 1.0'],
  ['Kebijakan Row Level Security', '66'],
  ['Trigger basis data', '92'],
  ['Kasus uji', '227 — 214 dijalankan `pnpm test` (85 unit aturan, 129 integrasi layanan) ditambah 13 e2e peramban'],
  ['Baris kode', '± 13.500 (apps) + 2.500 (packages) + 2.800 (SQL)'],
], [3600, 6038]);
KOTAK('INGAT', 'Angka di atas berubah seiring pengembangan. Cara menghitung ulangnya ada di Lampiran D.');

// ====================================================================== BAB 2
H1('Gambaran Sistem');
KOTAK('RINGKAS', ['Konteks sistem, prinsip rancangan yang dipegang, dan keputusan arsitektur beserta alasannya.']);
H2('2.1 Konteks');
P('ARKAS Web adalah aplikasi pengelolaan dana sekolah: merencanakan anggaran (RKAS), mencatat penggunaannya (BKU), memungut dan menyetor pajak, menutup buku tiap bulan, lalu menerbitkan laporan. Pemakainya berjenjang, dari sekolah sampai pusat, masing-masing dengan cakupan data yang berbeda.');
GAMBAR('p01-konteks', 'Diagram konteks sistem');
H2('2.2 Prinsip rancangan');
TABEL(['Prinsip', 'Wujudnya di kode'], [
  ['**Satu layanan, satu basis data**', 'Tidak ada layanan yang membaca tabel milik layanan lain. Data yang dibutuhkan lintas layanan disalin lewat event ke tabel proyeksi `*_lokal`.'],
  ['**Aturan bisnis sebagai fungsi murni**', 'Paket `aturan` tidak menyentuh basis data maupun jaringan, sehingga bisa diuji cepat dan dipakai ulang oleh layanan mana pun.'],
  ['**Basis data ikut menjaga aturan**', 'Batasan penting ditegakkan trigger dan constraint, bukan hanya kode aplikasi — supaya tetap aman walau ada jalur masuk lain.'],
  ['**Keamanan berlapis**', 'Sesi, token, penjaga endpoint, dan Row Level Security. Satu lapis jebol tidak langsung membuka data.'],
  ['**Jejak yang tidak bisa dihapus**', 'Perubahan data penting dicatat ke jejak audit berantai hash.'],
  ['**Bahasa Indonesia di seluruh kode**', 'Nama berkas, kelas, fungsi, tabel, dan pesan galat memakai bahasa Indonesia agar sejajar dengan istilah domainnya.'],
], [2600, 7038]);
H2('2.3 Keputusan arsitektur');
P('Beberapa keputusan yang paling memengaruhi bentuk kode, beserta alasan dan konsekuensinya.');
TABEL(['Keputusan', 'Alasan', 'Konsekuensi'], [
  ['Microservices, bukan monolit', 'Modul berkembang dengan kecepatan berbeda dan dikelola tim berbeda', 'Butuh kontrak event yang disiplin dan penanganan konsistensi akhir (*eventual consistency*)'],
  ['Database-per-service', 'Mencegah kopling diam-diam lewat tabel bersama', 'Data lintas layanan harus disalin; ada jeda sesaat sampai proyeksi menyusul'],
  ['SQL langsung (node-postgres), tanpa ORM', 'Kontrol penuh atas kueri, RLS, partisi, dan trigger', 'Kueri ditulis manual; tidak ada migrasi otomatis dari model'],
  ['Outbox–Inbox', 'Menulis data dan menerbitkan event harus atomik', 'Perlu worker relay dan tabel tambahan di tiap layanan'],
  ['CloudEvents 1.0', 'Format baku, mudah dipindah dari HTTP ke Kafka', 'Semua penerbit harus mengisi metadata yang sama'],
  ['RLS di PostgreSQL', 'Pembatasan data ikut berlaku untuk akses di luar jalur aplikasi', 'Setiap transaksi wajib menyuntikkan klaim lewat `set_config`'],
  ['BFF di Next.js sebagai pengganti gateway', 'Mempercepat pengembangan sebelum gateway produksi tersedia', 'Logika perutean sementara ada di `app/api/v1/[...path]/route.ts`'],
], [2300, 3600, 3738]);
H2('2.4 Peta layanan');
TABEL(['Layanan', 'Port', 'Basis data', 'Tanggung jawab'], [
  ['svc-referensi', '3103', 'db_ref', 'Data induk nasional: wilayah, sekolah, jenjang, sumber dana, komponen, kode rekening, tarif pajak daerah'],
  ['svc-identitas', '3104', 'db_auth', 'SSO OIDC, sesi, peran & cakupan, penerbitan JWT internal dan JWKS'],
  ['svc-penatausahaan', '3105', 'db_tatausaha', 'BKU, buku pembantu, pajak, periode, rekonsiliasi dan penutupan'],
  ['svc-pelaporan', '3106', 'db_pelaporan', 'Laporan BKU bulanan dalam PDF dan penandatanganan'],
  ['svc-perencanaan', '3107', 'db_perencanaan', 'Pagu, kertas kerja RKAS, validasi juknis, penelaahan & pengesahan'],
  ['svc-audit', '3108', 'db_audit', 'Jejak audit append-only berantai hash SHA-256 dan verifikasinya'],
  ['svc-integrasi', '3109', 'db_integrasi', 'API Mitra SIPLah dua sisi, pembukaan sumber dana, transaksi Mitra'],
  ['svc-pemantauan', '3110', 'db_pemantauan', 'HPP (rencana vs belanja Mitra), serapan dan kepatuhan berjenjang'],
  ['svc-bantuan', '3111', 'db_banper', 'Bantuan Pemerintah: juknis, penerima, pengesahan, penyaluran, pengajuan sekolah'],
  ['web', '3000', '—', 'Antarmuka pengguna dan BFF/gateway sementara'],
], [2200, 900, 1900, 4638]);

// ====================================================================== BAB 3
H1('Arsitektur Aplikasi');
KOTAK('RINGKAS', ['Susunan monorepo, lapisan di dalam satu layanan, isi paket bersama, dan konvensi penulisan kode.']);
GAMBAR('p02-arsitektur', 'Arsitektur aplikasi');
H2('3.1 Susunan monorepo');
P('Repositori dikelola dengan **pnpm workspaces** dan **Turborepo**. Paket berada di `apps/*` dan `packages/*`.');
KODE([
  'arkas-web/',
  '├── apps/',
  '│   ├── svc-referensi/      NestJS — :3103 — db_ref',
  '│   ├── svc-identitas/      NestJS — :3104 — db_auth',
  '│   ├── svc-penatausahaan/  NestJS — :3105 — db_tatausaha',
  '│   ├── svc-pelaporan/      NestJS — :3106 — db_pelaporan',
  '│   ├── svc-perencanaan/    NestJS — :3107 — db_perencanaan',
  '│   ├── svc-audit/          NestJS — :3108 — db_audit',
  '│   ├── svc-integrasi/      NestJS — :3109 — db_integrasi',
  '│   ├── svc-pemantauan/     NestJS — :3110 — db_pemantauan',
  '│   ├── svc-bantuan/        NestJS — :3111 — db_banper',
  '│   └── web/                Next.js App Router — :3000',
  '├── packages/',
  '│   ├── aturan/             fungsi murni aturan bisnis',
  '│   ├── kontrak/            skema Zod, CloudEvents, daftar topik',
  '│   └── common-ms/          infrastruktur bersama antar-layanan',
  '├── db/<layanan>/migrations/  SQL bernomor per basis data',
  '├── db/_bersama/              templat SQL lintas layanan',
  '├── scripts/                  migrate, dev-keys, dev-token, mitra-tiruan, …',
  '└── docs/                     dokumen teknis & buku pengguna',
], 'Struktur direktori');
H2('3.2 Lapisan di dalam satu layanan');
P('Setiap layanan NestJS memakai susunan yang sama, sehingga berpindah antarlayanan tidak perlu belajar ulang.');
TABEL(['Lapisan', 'Berkas', 'Tanggung jawab'], [
  ['Controller', '`*.controller.ts`', 'Menerima HTTP, memvalidasi masukan dengan skema Zod, memanggil service. Tidak berisi aturan bisnis.'],
  ['Service', '`*.service.ts`', 'Mengatur alur satu kasus penggunaan: membuka transaksi lewat `DbContextService`, memanggil paket `aturan`, menulis SQL, menitipkan event ke outbox.'],
  ['Konsumen event', '`events/konsumen.ts`', 'Menerima event dari layanan lain dan memperbarui tabel proyeksi lokal.'],
  ['Modul', '`*.module.ts`', 'Perakitan dependensi NestJS, termasuk pool basis data dan broker.'],
  ['Migrasi', '`db/<svc>/migrations/*.sql`', 'Skema, grant, RLS, trigger, dan data awal.'],
], [1900, 2400, 5338]);
KOTAK('PENTING', 'Aturan bisnis tidak ditulis di controller maupun di service. Tempatnya di `packages/aturan` sebagai fungsi murni, supaya bisa diuji tanpa basis data dan dipakai ulang lintas layanan.');
H2('3.3 Paket bersama');
H3('packages/aturan');
P('Fungsi murni tanpa I/O. Dipanggil service sebelum menulis ke basis data.');
TABEL(['Berkas', 'Isi'], [
  ['`hitung-pajak.ts`', 'Menentukan jenis pajak dari kode rekening, menghitung DPP, PPN, PPh 21/23, dan pajak daerah'],
  ['`tarif-efektif.ts`', 'Memilih tarif yang berlaku pada tanggal transaksi, termasuk tarif daerah'],
  ['`validasi-kertas-kerja.ts`', 'Total terhadap pagu, batas persentase komponen, nilai positif, batas realisasi'],
  ['`transaksi.ts`', 'Transisi status transaksi dan aturan pemisahan tugas'],
  ['`penutupan.ts`', 'Syarat penutupan periode dan perhitungan selisih rekonsiliasi'],
  ['`peran.ts`', 'Daftar peran, cakupan, dan matriks pemberian peran berjenjang'],
  ['`setor-pajak.ts`', 'Validasi NTPN dan pengelompokan pungutan sejenis'],
  ['`kategori-hpp.ts`', 'Klasifikasi HPP: sesuai rencana, melebihi, di luar rencana, belum dibelanjakan'],
  ['`bantuan.ts`, `status-pembukaan.ts`, `uang.ts`', 'Aturan Bantuan Pemerintah, status pembukaan Mitra, pembulatan rupiah'],
], [2900, 6738]);
H3('packages/kontrak');
P('Sumber kebenaran bentuk data yang dipertukarkan: skema **Zod** untuk permintaan/tanggapan HTTP, definisi **CloudEvents 1.0**, dan konstanta `TOPIK`. Dipakai sisi penerbit maupun penerima, sehingga perubahan bentuk data langsung terlihat saat `typecheck`.');
H3('packages/common-ms');
TABEL(['Berkas', 'Fungsi'], [
  ['`db/db-context.service.ts`', 'Menjalankan satu unit kerja dalam satu transaksi dan menyuntikkan klaim JWT ke variabel sesi untuk RLS'],
  ['`db/galat-pg.ts`', 'Menerjemahkan galat PostgreSQL (termasuk pesan dari trigger) menjadi galat aplikasi yang rapi'],
  ['`auth/jwt.ts`, `auth/scope.guard.ts`, `auth/izinkan.decorator.ts`', 'Verifikasi JWT lewat JWKS dan penjagaan peran serta cakupan per endpoint'],
  ['`events/outbox.ts`, `outbox-relay.ts`', 'Menitipkan event dalam transaksi yang sama, lalu mengirimkannya dengan `FOR UPDATE SKIP LOCKED`'],
  ['`events/inbox-consumer.ts`', 'Memastikan event yang sama tidak diproses dua kali'],
  ['`events/http-broker.ts`, `kafka-broker.ts`', 'Dua implementasi broker dengan antarmuka sama; dipilih lewat variabel `BROKER`'],
  ['`http/problem.filter.ts`', 'Format galat seragam mengikuti RFC 9457 (*Problem Details*)'],
  ['`http/zod.pipe.ts`', 'Validasi badan permintaan dengan skema dari paket `kontrak`'],
], [3100, 6538]);
H2('3.4 Aplikasi web');
P('`apps/web` memakai **Next.js App Router** dengan Tailwind dan TanStack Query. Tiga berkas yang paling penting untuk dipahami lebih dulu:');
TABEL(['Berkas', 'Peran'], [
  ['`middleware.ts`', 'Menolak halaman aplikasi tanpa cookie sesi dan mengarahkannya ke `/masuk`'],
  ['`app/api/v1/[...path]/route.ts`', 'BFF: menukar cookie sesi menjadi JWT internal berumur pendek lalu meneruskan permintaan ke layanan yang sesuai'],
  ['`lib/api.ts`', 'Pembungkus pemanggilan API di sisi klien beserta penanganan galat RFC 9457'],
], [3400, 6238]);
P('Komponen antarmuka yang berisi logika tampilan khusus domain berada di `components/`, misalnya `wizard-belanja.tsx` (wizard belanja tiga langkah), `tabel-bku.tsx`, `panel-pajak.tsx`, `panel-penutupan.tsx`, `panel-siplah.tsx`, dan `hpp.tsx`.');
H2('3.5 Konvensi penulisan kode');
LI([
  '**Bahasa Indonesia** untuk nama berkas, kelas, fungsi, variabel, tabel, kolom, dan pesan galat.',
  '**Komentar menjelaskan alasan**, bukan mengulang kode; acuan nomor bab dokumen rancangan ditulis bila relevan.',
  '**Satu berkas satu tanggung jawab**; service panjang dipecah per kasus penggunaan.',
  '**Uang** disimpan sebagai `numeric(18,2)` dan dibulatkan ke bawah ke rupiah penuh lewat helper di `aturan/uang.ts`.',
  '**Tanggal** disimpan sebagai `date` untuk tanggal transaksi dan `timestamptz` untuk waktu kejadian sistem.',
  '**Identitas** memakai `uuid`; kunci alami seperti NPSN disimpan sebagai `character(8)`.',
]);

// ====================================================================== BAB 4
H1('Model dan Struktur Data');
KOTAK('RINGKAS', ['Pola database-per-service, isi setiap basis data, model inti perencanaan dan penatausahaan, serta cara migrasi dijalankan.']);
H2('4.1 Satu basis data per layanan');
P('Setiap layanan punya basis data sendiri dengan skema dan peran login sendiri. Tidak ada kueri lintas basis data; data yang dibutuhkan disalin lewat event.');
TABEL(['Basis data', 'Skema', 'Tabel', 'Trigger', 'Indeks'], [
  ['db_ref', 'ref', '11', '25', '13'], ['db_auth', 'auth', '8', '4', '16'], ['db_perencanaan', 'perencanaan', '12', '9', '21'],
  ['db_tatausaha', 'tatausaha', '18', '32', '54'], ['db_pelaporan', 'pelaporan', '5', '2', '12'], ['db_audit', 'audit', '7', '6', '27'],
  ['db_integrasi', 'integrasi', '11', '5', '21'], ['db_pemantauan', 'pemantauan', '13 + 1 matview', '0', '20'], ['db_banper', 'banper', '13', '9', '19'],
], [2400, 2000, 2000, 1600, 1638]);
P('Setiap basis data punya dua peran login: `api_<nama>_login` untuk permintaan pengguna dan `worker_<nama>_login` untuk relay serta konsumen event. Keduanya punya hak akses berbeda, sehingga worker tidak bisa dipakai membaca data lewat jalur API.');
H2('4.2 Tabel yang selalu ada');
TABEL(['Tabel', 'Fungsi'], [
  ['`outbox`', 'Event yang menunggu dikirim; ditulis dalam transaksi yang sama dengan perubahan datanya'],
  ['`inbox_processed`', 'Daftar `event_id` yang sudah diproses, penjaga idempotensi'],
  ['`ref_*_lokal`', 'Proyeksi data referensi dari layanan lain (sekolah, wilayah, komponen, rekening, direktorat)'],
], [2600, 7038]);
H2('4.3 Model inti: perencanaan');
GAMBAR('p05-erd-perencanaan', 'Model data svc-perencanaan');
P('Dua hal yang perlu dipahami sebelum menyentuh kode perencanaan:');
OL([
  '**Versi disimpan utuh.** Perubahan dan pergeseran tidak menimpa RKAS lama; aplikasi membuat versi baru dan menandai versi lama sebagai `DIGANTI`. Riwayat anggaran jadi bisa ditelusuri.',
  '**`akar_baris_id` menautkan baris lintas versi.** Realisasi belanja menempel pada akar ini, bukan pada baris versi tertentu. Karena itu belanja yang sudah tercatat tetap terhubung setelah pergeseran.',
]);
KOTAK('PENTING', 'Trigger `cek_pagu` menolak penyimpanan baris yang membuat total melebihi pagu. Validasi yang sama juga ada di `packages/aturan`, tetapi trigger adalah penjaga terakhirnya.');
H2('4.4 Model inti: penatausahaan');
GAMBAR('p06-erd-penatausahaan', 'Model data svc-penatausahaan');
LI([
  '**Partisi per tahun.** `transaksi` dan `item_transaksi` dipartisi RANGE berdasarkan tanggal (`_2025`, `_2026`, `_2027`), menjaga kueri tetap ringan saat data bertahun-tahun menumpuk.',
  '**Periode sebagai gerbang.** Tabel `periode` menentukan bulan mana yang boleh menerima pencatatan; di luar status `BUKA`, penyimpanan ditolak.',
  '**Pajak sebagai baris tersendiri.** Setiap pungutan tercatat di tabel `pajak` dan ditautkan ke transaksi setoran ketika sudah disetor; NTPN bersifat unik.',
  '**Antrean dari luar.** `transaksi_mitra_masuk` dan `penyaluran_masuk` menampung kiriman dari svc-integrasi dan svc-bantuan sebelum diproses menjadi transaksi.',
]);
H2('4.5 Migrasi basis data');
P('Migrasi berupa berkas SQL bernomor di `db/<layanan>/migrations`, dijalankan berurutan oleh `scripts/migrate.mjs`. Penomorannya mengelompokkan isi: `10_` tabel, `20_` grant dan RLS, `30_`+ fitur tambahan.');
KODE([
  '# membuat basis data, peran, menjalankan semua migrasi, lalu mengisi data contoh',
  'node scripts/migrate.mjs svc-penatausahaan --seed',
  '',
  '# membangun ulang dari nol (menghapus basis datanya lebih dulu)',
  'node scripts/migrate.mjs svc-perencanaan --fresh --seed',
], 'Menjalankan migrasi');
P('Migrasi bisa memuat berkas bersama lewat penanda khusus. Contohnya trigger audit yang dipakai semua layanan:');
KODE(['-- #sertakan _bersama/audit.sql tatausaha'], 'Di dalam berkas migrasi');
P('Penanda itu diganti isi `db/_bersama/audit.sql` dengan `{{skema}}` ditukar menjadi nama skema layanan. Dengan begitu perbaikan pada trigger audit cukup dilakukan di satu tempat.');
KOTAK('TIPS', 'Migrasi ditulis idempoten (`create table if not exists`, `create or replace`), sehingga aman dijalankan ulang pada basis data yang sudah ada.');

// ====================================================================== BAB 5
H1('Kontrak Antarlayanan');
KOTAK('RINGKAS', ['Dua jalur komunikasi: REST untuk permintaan langsung, event untuk perubahan yang perlu diketahui layanan lain.']);
H2('5.1 REST');
LI([
  'Awalan `/api/v1` untuk pemakaian lewat web; layanan juga menyediakan `/internal/v1/events` untuk penerimaan event.',
  'Masukan divalidasi dengan skema Zod dari paket `kontrak`, lewat `ZodPipe`.',
  'Galat dikembalikan dalam format **RFC 9457** (`type`, `title`, `status`, `detail`), dibentuk oleh `ProblemFilter`.',
  'Otorisasi per endpoint memakai dekorator `@Izinkan(...)` yang diperiksa `ScopeGuard`.',
]);
KODE([
  'HTTP/1.1 422 Unprocessable Content',
  'content-type: application/problem+json',
  '',
  '{',
  '  "type": "https://arkas/galat/pagu-terlampaui",',
  '  "title": "Total anggaran melebihi pagu",',
  '  "status": 422,',
  '  "detail": "Total baris Rp12.100.000 melebihi pagu Rp12.000.000"',
  '}',
], 'Contoh tanggapan galat');
H2('5.2 Event');
GAMBAR('p03-alur-event', 'Pola Outbox–Inbox');
P('Semua event berformat **CloudEvents 1.0** (structured mode, JSON) dengan tambahan `correlationid` dan `traceparent` untuk penelusuran lintas layanan.');
KODE([
  '{',
  '  "specversion": "1.0",',
  '  "id": "7f1c…",',
  '  "source": "svc-perencanaan",',
  '  "type": "arkas.perencanaan.kk-disahkan",',
  '  "subject": "20100002/2026/BOSP_REG",',
  '  "time": "2026-11-19T03:46:08Z",',
  '  "datacontenttype": "application/json",',
  '  "data": { "kertasKerjaId": "…", "npsn": "20100002", "versi": 3, "baris": [ … ] }',
  '}',
], 'Bentuk event');
H2('5.3 Daftar topik');
GAMBAR('p04-topik', 'Peta topik event');
TABEL(['Topik', 'Penerbit', 'Penerima'], [
  ['`arkas.perencanaan.kk-diajukan`', 'perencanaan', 'audit'],
  ['`arkas.perencanaan.kk-disahkan`', 'perencanaan', 'penatausahaan, integrasi, pemantauan'],
  ['`arkas.tatausaha.transaksi-disetujui`', 'penatausahaan', 'pelaporan, perencanaan, pemantauan'],
  ['`arkas.tatausaha.periode-ditutup`', 'penatausahaan', 'pelaporan, pemantauan'],
  ['`arkas.pelaporan.laporan-ditandatangani`', 'pelaporan', 'audit'],
  ['`arkas.ref.referensi-diubah`', 'referensi', 'identitas, penatausahaan, perencanaan, integrasi, pemantauan, bantuan'],
  ['`arkas.identitas.pengguna-dibuat` · `peran-diubah`', 'identitas', 'audit'],
  ['`arkas.integrasi.transaksi-mitra-diterima` · `-dibatalkan`', 'integrasi', 'penatausahaan, pemantauan'],
  ['`arkas.integrasi.pembukaan-dikonfirmasi`', 'integrasi', 'pemantauan'],
  ['`arkas.banper.sumber-dana-disahkan`', 'bantuan', 'referensi, perencanaan, integrasi'],
  ['`arkas.banper.penyaluran-dicatat`', 'bantuan', 'penatausahaan'],
  ['`arkas.banper.pengajuan-sekolah-diputuskan`', 'bantuan', 'audit'],
  ['`arkas.pemantauan.hpp-dihitung`', 'pemantauan', '— (konsumsi internal)'],
  ['`arkas.audit.dicatat`', 'semua layanan', 'audit'],
], [3700, 2000, 3938]);
H2('5.4 Jaminan pengiriman');
TABEL(['Risiko', 'Penanganan'], [
  ['Data tersimpan tetapi event gagal terkirim', 'Keduanya ditulis dalam satu transaksi; relay mengirim belakangan'],
  ['Event terkirim dua kali', '`inbox_processed` membuat pemrosesan kedua tidak berefek'],
  ['Penerima sedang mati', 'Baris outbox tetap `MENUNGGU`, dicoba lagi dengan backoff eksponensial'],
  ['Gagal terus-menerus', 'Setelah melewati batas percobaan, status menjadi `MATI` dan harus ditangani operator'],
  ['Banyak pod relay berjalan bersamaan', '`FOR UPDATE SKIP LOCKED` mencegah satu baris diambil dua pod'],
  ['Urutan event', 'Konsumen ditulis idempoten dan tidak bergantung pada urutan antar-topik'],
], [3200, 6438]);
KOTAK('PENTING', 'Konsistensi bersifat *eventual*. Antarmuka tidak boleh menganggap proyeksi di layanan lain langsung tersedia sesaat setelah sebuah aksi berhasil.');

// ====================================================================== BAB 6
H1('Keamanan');
KOTAK('RINGKAS', ['Empat lapis pengamanan, pemisahan tugas, jejak audit berantai hash, dan pengamanan API Mitra.']);
GAMBAR('p07-keamanan', 'Lapisan keamanan');
H2('6.1 Identitas dan sesi');
P('Pengguna masuk lewat **SSO OIDC** (Authorization Code + PKCE) yang ditangani svc-identitas. Hasilnya cookie sesi `arkas_sesi` bersifat HttpOnly. ARKAS Web tidak menyimpan kata sandi.');
P('Satu pengguna bisa memegang beberapa peran. Peran yang sedang dipakai disimpan sebagai **peran aktif** pada sesi dan menentukan isi token berikutnya.');
H2('6.2 Token internal');
P('BFF menukar cookie sesi menjadi **JWT internal** berumur pendek (algoritma EdDSA) yang diterbitkan svc-identitas. Layanan memverifikasinya lewat **JWKS**, sehingga tidak ada kunci rahasia bersama yang perlu disebar.');
P('Klaim yang dibawa: identitas pengguna, peran aktif, dan cakupan (`npsn`, `wilayah`, `direktorat`, `ditjen`).');
H2('6.3 Penjagaan endpoint');
P('Dekorator `@Izinkan(...)` menyatakan peran yang boleh mengakses sebuah endpoint; `ScopeGuard` memeriksa peran sekaligus kecocokan cakupan — misalnya memastikan NPSN pada alamat memang sekolah yang menjadi cakupan pengguna.');
H2('6.4 Row Level Security');
P('Lapis terakhir ada di basis data. Setiap unit kerja berjalan dalam satu transaksi, dan `DbContextService` menyuntikkan klaim sebagai variabel sesi sebelum kueri dijalankan:');
KODE([
  "SELECT set_config('app.pengguna_id', $1, true),",
  "       set_config('app.peran',       $2, true),",
  "       set_config('app.npsn',        $3, true),",
  "       set_config('app.wilayah',     $4, true), …",
], 'Penyuntikan klaim per transaksi');
P('Argumen ketiga `true` membuat nilainya berlaku hanya selama transaksi berjalan. Kebijakan RLS pada tabel kemudian membandingkan nilai tersebut dengan kolom datanya. Saat ini ada **66 kebijakan** di sembilan basis data.');
H2('6.5 Pemisahan tugas');
TABEL(['Aturan', 'Penegakan'], [
  ['Pembuat transaksi tidak boleh menyetujui transaksinya sendiri', 'Fungsi di `aturan/transaksi.ts` dan pemeriksaan di service'],
  ['Hanya Kepala Sekolah yang boleh mengajukan RKAS', '`@Izinkan("KEPSEK")` pada endpoint pengajuan'],
  ['Pemberian peran mengikuti matriks berjenjang', '`MATRIKS_PEMBERIAN` di `aturan/peran.ts`'],
  ['Auditor wajib punya masa berlaku', 'Validasi cakupan pada pemberian peran'],
], [4400, 5238]);
H2('6.6 Jejak audit');
P('Trigger `catat_audit()` dipasang pada tabel penting di seluruh layanan lewat templat `db/_bersama/audit.sql`. Setiap perubahan diterbitkan sebagai event `arkas.audit.dicatat` dan disimpan svc-audit secara **append-only**.');
P('Tiap entri menyimpan hash SHA-256 dari entri sebelumnya digabung bentuk kanonik entri itu sendiri:');
KODE(["encode(sha256(convert_to(hash_sebelum || E'\\n' || kanonik(j), 'UTF8')), 'hex')"], 'Rantai hash di db_audit');
P('Akibatnya, menyunting satu entri lama akan memutus rantai dan langsung terdeteksi saat verifikasi. Tabel `jejak` juga dipartisi per tahun, dengan `kepala_rantai` menyimpan ujung rantai tiap sekolah.');
H2('6.7 API Mitra SIPLah');
P('Mitra mengakses `/mitra/v1` pada svc-integrasi dengan tiga lapis pengamanan sekaligus: **OAuth2 client credentials**, **daftar IP yang diizinkan**, dan **tanda tangan HMAC** per permintaan. Pengamanan ini dijaga `MitraGuard`.');

// ====================================================================== BAB 7
H1('Alur Proses Utama');
KOTAK('RINGKAS', ['Jalur teknis empat proses terpenting: RKAS, transaksi, perpajakan, dan penutupan buku.']);
H2('7.1 Kertas kerja sampai RKAS berlaku');
GAMBAR('p08-alur-rkas-teknis', 'Alur teknis penyusunan sampai pengesahan RKAS');
P('Perlu diperhatikan saat mengubah bagian ini: pengesahan menerbitkan **snapshot seluruh baris** di dalam event, bukan sekadar identitas kertas kerjanya. Layanan hilir tidak perlu memanggil balik svc-perencanaan.');
H2('7.2 Belanja sampai laporan');
GAMBAR('p09-alur-transaksi-teknis', 'Alur teknis belanja luring dan daring');
P('Dua jalur masuk bertemu pada tabel `transaksi` yang sama, sehingga perhitungan saldo, pajak, dan laporan tidak perlu dibedakan.');
H2('7.3 Perpajakan');
OL([
  'Service memanggil `pilihTarifEfektif` untuk mendapatkan tarif yang berlaku pada tanggal transaksi, termasuk tarif pajak daerah dari proyeksi `ref_rekening_pajak_lokal`.',
  '`hitungPajak` menentukan jenis pungutan dari kode rekening dan status NPWP penyedia, lalu menghitung DPP dan nilainya. PPN dianggap sudah termasuk dalam harga: DPP = bruto ÷ 1,11.',
  'Setiap pungutan disimpan sebagai baris `pajak` sekaligus muncul di BKU sebagai penerimaan pajak.',
  'Saat disetor, Bendahara mencatat NTPN; baris pungutan ditautkan ke transaksi setoran dan saldo pajak kembali nol.',
]);
KOTAK('INGAT', 'Semua nilai pajak dibulatkan **ke bawah** ke rupiah penuh lewat helper di `aturan/uang.ts`, agar hasil perhitungan selalu sama di setiap lapisan.');
H2('7.4 Penutupan periode');
OL([
  'Service memeriksa daftar syarat: bulan sudah berakhir, tidak ada transaksi berstatus `DICATAT`, dan periode sebelumnya sudah `TUTUP`.',
  'Bendahara mengisi saldo rekening koran dan hasil hitung kas fisik; selisih yang tidak nol wajib dijelaskan.',
  'Pengajuan mengubah status periode menjadi `DIAJUKAN_TUTUP`.',
  'Persetujuan Kepala Sekolah mengubahnya menjadi `TUTUP`, menerbitkan event `periode-ditutup`, dan membuka periode berikutnya.',
  'svc-pelaporan menerima event tersebut lalu membuat laporan BKU bulanan dalam PDF untuk ditandatangani.',
]);
H2('7.5 Integrasi Mitra SIPLah');
P('Arahnya dua sisi. **ARKAS → Mitra**: pembukaan sumber dana dan pengiriman anggaran RKAS, sehingga Mitra tahu sisa anggaran sekolah. **Mitra → ARKAS**: pengiriman transaksi belanja beserta rinciannya, yang masuk ke antrean `transaksi_mitra_masuk` untuk dipetakan Bendahara ke baris RKAS.');
P('Untuk pengembangan lokal tersedia Mitra tiruan: `node scripts/mitra-tiruan.mjs server` pada port 3190.');

// ====================================================================== BAB 8
H1('Lingkungan Pengembangan');
KOTAK('RINGKAS', ['Prasyarat, pemasangan, penyiapan basis data dan kunci, menjalankan seluruh sistem, serta data contoh.']);
GAMBAR('p10-pengembangan', 'Alur kerja pengembangan');
H2('8.1 Prasyarat');
LI(['**Node.js 22**', '**pnpm 10**', '**PostgreSQL 16** — lokal, atau `docker compose up -d postgres`', 'Opsional: **Redpanda** bila ingin mencoba broker Kafka (`docker compose up -d redpanda`)']);
H2('8.2 Pemasangan');
KODE(['pnpm install', 'node scripts/dev-keys.mjs   # membuat pasangan kunci EdDSA di .dev-keys/'], 'Sekali di awal');
KOTAK('PENTING', 'Direktori `.dev-keys/` dan berkas `.env*` (kecuali `*.example`) tidak boleh ikut masuk ke repositori.');
H2('8.3 Menyiapkan basis data');
KODE([
  'for s in svc-referensi svc-identitas svc-perencanaan svc-penatausahaan \\',
  '         svc-pelaporan svc-audit svc-integrasi svc-pemantauan svc-bantuan; do',
  '  node scripts/migrate.mjs $s --seed',
  'done',
], 'Membuat sembilan basis data beserta data contoh');
H2('8.4 Konfigurasi');
P('Setiap layanan membaca berkas env-nya sendiri. Salin dari contoh yang tersedia, lalu sesuaikan bila perlu.');
TABEL(['Layanan', 'Berkas env'], [
  ['svc-penatausahaan', '`.env`'], ['svc-pelaporan', '`.env.pelaporan`'], ['svc-perencanaan', '`.env.perencanaan`'],
  ['svc-identitas', '`.env.identitas`'], ['svc-referensi', '`.env.referensi`'], ['svc-audit', '`.env.audit`'],
  ['svc-integrasi', '`.env.integrasi`'], ['svc-pemantauan', '`.env.pemantauan`'], ['svc-bantuan', '`.env.bantuan`'],
], [3400, 6238]);
TABEL(['Variabel', 'Arti'], [
  ['`PORT`', 'Port layanan (3103–3111)'],
  ['`DATABASE_URL`', 'Koneksi peran API'],
  ['`DATABASE_WORKER_URL`', 'Koneksi peran worker untuk relay dan konsumen'],
  ['`BROKER`', '`http` (bawaan pengembangan) atau `kafka`'],
  ['`BROKER_HTTP_TARGETS`', 'Pemetaan topik ke alamat penerima, dipisah `;` antar-topik dan `,` antar-tujuan'],
  ['`JWT_PUBLIC_KEY_FILE` / `JWT_PRIVATE_KEY_FILE`', 'Kunci verifikasi (semua layanan) dan kunci penerbit (svc-identitas)'],
  ['`JWT_ISSUER`, `JWT_AUDIENCE`', '`arkas-identitas` dan `arkas-api`'],
], [3400, 6238]);
H2('8.5 Menjalankan');
KODE([
  '# satu layanan',
  './scripts/jalankan-svc.sh svc-penatausahaan',
  '',
  '# seluruh layanan di latar belakang',
  'for s in svc-referensi svc-identitas svc-penatausahaan svc-pelaporan svc-perencanaan \\',
  '         svc-audit svc-integrasi svc-pemantauan svc-bantuan; do',
  '  setsid nohup ./scripts/jalankan-svc.sh $s > /tmp/$s.log 2>&1 &',
  'done',
  '',
  '# Mitra SIPLah tiruan dan antarmuka web',
  'node scripts/mitra-tiruan.mjs server       # :3190',
  'pnpm --filter web dev                      # :3000',
], 'Menjalankan sistem');
H2('8.6 Masuk tanpa SSO');
P('Di lingkungan pengembangan, halaman `/masuk` menampilkan daftar akun contoh dari `db/svc-identitas/migrations/90_seed_dev.sql`. Klik salah satu untuk masuk tanpa penyedia SSO. Untuk memanggil API langsung, token bisa dibuat dengan `node scripts/dev-token.mjs`.');
H2('8.7 Skrip pembantu');
TABEL(['Skrip', 'Kegunaan'], [
  ['`scripts/migrate.mjs`', 'Membuat basis data & peran, menjalankan migrasi, mengisi data contoh (`--seed`, `--fresh`)'],
  ['`scripts/dev-keys.mjs`', 'Membuat pasangan kunci EdDSA untuk JWT pengembangan'],
  ['`scripts/dev-token.mjs`', 'Menerbitkan JWT internal untuk pengujian manual'],
  ['`scripts/jalankan-svc.sh`', 'Menjalankan satu layanan dengan berkas env yang sesuai'],
  ['`scripts/mitra-tiruan.mjs`', 'Mitra SIPLah tiruan untuk mencoba integrasi dua sisi'],
  ['`scripts/isi-demo.mjs`', 'Mengisi data contoh lintas layanan'],
  ['`scripts/terbit-kk-disahkan.mjs`', 'Menerbitkan ulang event pengesahan RKAS saat menguji konsumen'],
  ['`scripts/uji-kafka.mjs`', 'Membuktikan adapter Kafka terhadap broker sungguhan (dipakai juga oleh CI)'],
], [3100, 6538]);

// ====================================================================== BAB 9
H1('Pengujian dan Kualitas');
KOTAK('RINGKAS', ['Susunan pengujian, cara menjalankannya, dan kebiasaan yang dijaga agar perubahan tetap aman.']);
GAMBAR('p11-pengujian', 'Piramida pengujian');
H2('9.1 Tiga lapis pengujian');
TABEL(['Lapis', 'Lokasi', 'Jumlah', 'Sifat'], [
  ['Unit aturan', '`packages/aturan/test`', '85', 'Fungsi murni, tanpa basis data; seluruh `pnpm test` selesai dalam ± 40 detik'],
  ['Integrasi layanan', '`apps/svc-*/test`', '129', 'Basis data uji sungguhan (`*_uji`), migrasi dijalankan ulang, endpoint diuji lewat HTTP'],
  ['End-to-end peramban', '`apps/web/e2e`', '13', 'Vitest + Playwright pada sistem yang hidup'],
], [2000, 2400, 1200, 4038]);
H2('9.2 Menjalankan');
KODE([
  'pnpm test                                  # seluruh monorepo, berurutan',
  'pnpm --filter svc-penatausahaan test       # satu layanan',
  'pnpm --filter aturan test                  # unit aturan saja',
  'pnpm typecheck                             # pemeriksaan tipe seluruh paket',
], 'Perintah pengujian');
P('Uji integrasi membutuhkan `DATABASE_ADMIN_URL`, `API_DB_PASSWORD`, dan `WORKER_DB_PASSWORD`; ketiganya diteruskan Turborepo lewat `passThroughEnv`.');
P('Sebaran kasus uji yang dijalankan `pnpm test`: aturan 85, svc-penatausahaan 44, svc-perencanaan 17, svc-identitas 14, svc-pelaporan 13, svc-integrasi 12, svc-referensi 10, svc-bantuan 9, svc-audit 5, svc-pemantauan 5.');
H2('9.3 Integrasi berkelanjutan');
P('Berkas `.github/workflows/ci.yml` menjalankan empat jenis pekerjaan pada setiap push dan pull request.');
TABEL(['Job', 'Isi', 'Layanan pendukung'], [
  ['`uji`', '`pnpm build`, `pnpm typecheck`, migrasi sembilan basis data, lalu `pnpm test`', 'PostgreSQL 16'],
  ['`kafka`', '`scripts/uji-kafka.mjs`: menerbitkan dan mengonsumsi CloudEvent lewat `KafkaBroker` yang sama dengan yang dipakai layanan, lalu memeriksa kelengkapan isi, fan-out dua grup, dan urutan per `subject`', 'Redpanda'],
  ['`kontainer`', 'Membangun citra sembilan layanan dari `Dockerfile` secara matriks, dengan cache GitHub Actions', '—'],
  ['`kontainer-web`', 'Membangun citra Next.js dari `Dockerfile.web`', '—'],
], [1700, 6238, 1700]);
KOTAK('INGAT', 'Job `kafka` adalah satu-satunya tempat adapter Kafka diuji terhadap broker sungguhan. Pengembangan lokal memakai `BROKER=http`, jadi perubahan pada `kafka-broker.ts` baru terbukti setelah CI berjalan.');
H2('9.4 Kebiasaan yang dijaga');
LI([
  '**Aturan bisnis diuji sebagai fungsi murni.** Kasus batas (pembulatan, tarif tanpa NPWP, honor tepat 20%) diuji di lapis unit, bukan lewat antarmuka.',
  '**Basis data diuji dengan SQL asli**, termasuk trigger dan kebijakan RLS — bukan dengan tiruan.',
  '**Setiap perbaikan galat disertai satu uji** yang gagal sebelum perbaikan.',
  '**Uji e2e dipakai untuk alur, bukan untuk detail.** Perhitungan rinci diuji di lapis bawah yang jauh lebih cepat.',
]);

// ====================================================================== BAB 10
H1('Operasional dan Penyebaran');
KOTAK('RINGKAS', ['Bentuk lingkungan saat ini, arah produksi, hal yang perlu dipantau, dan pencadangan.']);
GAMBAR('p12-penyebaran', 'Penyebaran dan operasional');
H2('10.1 Lingkungan saat ini');
P('Semua proses dijalankan langsung dengan Node pada satu mesin: sembilan layanan, aplikasi web, dan Mitra tiruan. PostgreSQL menampung sembilan basis data. Broker memakai mode `http`, yaitu pengiriman event langsung antar-proses.');
H2('10.2 Arah produksi');
TABEL(['Aspek', 'Rencana', 'Kesiapan kode'], [
  ['Kemasan', 'Satu kontainer per layanan', '`Dockerfile` multi-stage (argumen `LAYANAN`) dan `Dockerfile.web` sudah ada; CI membangun seluruh citra pada tiap push'],
  ['Broker', 'Kafka atau Redpanda', '`kafka-broker.ts` diperiksa terhadap Redpanda sungguhan oleh job `kafka` di CI; peralihan cukup dengan `BROKER=kafka`'],
  ['Penskalaan', 'Beberapa pod per layanan', 'Relay aman berkat `FOR UPDATE SKIP LOCKED`'],
  ['Gateway', 'API Gateway menggantikan BFF', 'Pola penukaran sesi → JWT tetap sama'],
  ['Rahasia', 'Pengelola rahasia terpusat', 'Semua konfigurasi sudah lewat variabel lingkungan; citra berjalan sebagai pengguna tak-root'],
], [1900, 3300, 4438]);
H2('10.3 Yang perlu dipantau');
TABEL(['Sinyal', 'Arti', 'Tindakan'], [
  ['Baris `outbox` berstatus `MATI`', 'Event gagal terkirim melewati batas percobaan', 'Periksa penerima, perbaiki, lalu kirim ulang'],
  ['`outbox` menumpuk berstatus `MENUNGGU`', 'Relay berhenti atau broker tidak tersedia', 'Periksa proses worker dan koneksi broker'],
  ['Verifikasi rantai audit gagal', 'Data jejak berubah di luar jalur aplikasi', 'Perlakukan sebagai insiden keamanan'],
  ['Periode tidak kunjung ditutup', 'Transaksi menggantung menunggu persetujuan', 'Tindak lanjut ke sekolah bersangkutan'],
  ['Galat 422 melonjak', 'Perubahan referensi atau aturan yang tidak tersosialisasi', 'Periksa event referensi terakhir'],
], [2800, 3400, 3438]);
H2('10.4 Pencadangan dan pemulihan');
LI([
  'Cadangkan kesembilan basis data; jangan hanya basis data transaksi, karena proyeksi lokal tidak bisa dibangun ulang tanpa riwayat event.',
  'Jejak audit bersifat append-only dan dipartisi per tahun; partisi lama bisa diarsipkan tanpa mengganggu rantai berjalan.',
  'Saat memulihkan ke titik waktu tertentu, periksa ulang baris `outbox` yang belum terkirim agar tidak ada event ganda maupun hilang.',
]);

// ====================================================================== BAB 11
H1('Panduan Kontribusi');
KOTAK('RINGKAS', ['Alur kerja git, bentuk perubahan yang diharapkan, dan langkah menambah layanan atau fitur baru.']);
H2('11.1 Alur kerja');
OL([
  'Buat cabang dari cabang utama dengan nama bermakna, misalnya `claude/irisan-1-penatausahaan`.',
  'Kerjakan satu irisan fitur yang utuh: migrasi, aturan, endpoint, antarmuka, dan ujinya sekaligus.',
  'Jalankan `pnpm test` dan `pnpm typecheck` sebelum mengirim.',
  'Tulis pesan commit yang menjelaskan **apa** dan **kenapa**, bukan daftar berkas yang disentuh.',
  'Buka pull request dengan ringkasan perubahan dan cara mengujinya.',
]);
H2('11.2 Menambah endpoint baru');
OL([
  'Tulis atau perbarui skema Zod di `packages/kontrak`.',
  'Bila ada aturan bisnis baru, tulis sebagai fungsi murni di `packages/aturan` beserta uji unitnya.',
  'Tambahkan migrasi SQL bila skema berubah; jangan mengubah berkas migrasi yang sudah pernah dijalankan.',
  'Tambahkan method pada service, lalu endpoint pada controller dengan `@Izinkan(...)` yang sesuai.',
  'Tambahkan uji integrasi yang memastikan otorisasi dan RLS ikut teruji.',
  'Baru sesudah itu sambungkan ke antarmuka web.',
]);
H2('11.3 Menambah event baru');
OL([
  'Daftarkan topik pada konstanta `TOPIK` di `packages/kontrak/src/events.ts` beserta skema datanya.',
  'Penerbit menitipkan event ke `outbox` dalam transaksi yang sama dengan perubahan datanya.',
  'Tambahkan tujuan topik pada `BROKER_HTTP_TARGETS` di berkas env penerbit.',
  'Penerima menambahkan penanganan di `events/konsumen.ts` dan memastikan pemrosesannya idempoten.',
  'Tambahkan uji integrasi yang mengirim event dua kali untuk membuktikan idempotensinya.',
]);
H2('11.4 Menambah layanan baru');
OL([
  'Buat `apps/svc-<nama>` mengikuti susunan layanan yang sudah ada.',
  'Buat `db/svc-<nama>/migrations` dengan `10_tabel.sql` dan `20_grants_rls.sql`, lalu daftarkan pada `LAYANAN` di `scripts/migrate.mjs`.',
  'Sertakan trigger audit lewat `-- #sertakan _bersama/audit.sql <skema>`.',
  'Tambahkan berkas `.env.<nama>.example` beserta portnya.',
  'Tambahkan perutean di BFF `apps/web/app/api/v1/[...path]/route.ts`.',
  'Tulis `docs/svc-<nama>.md` dan perbarui README.',
]);
KOTAK('PENTING', 'Jangan pernah menambahkan koneksi langsung ke basis data milik layanan lain. Bila sebuah layanan butuh data layanan lain, jalurnya adalah event dan tabel proyeksi lokal.');

// ====================================================================== BAB 12
H1('Penutup');
P('ARKAS Web dibangun dengan satu gagasan utama: **setiap angka harus bisa ditelusuri dari rencana sampai laporan**. Pemisahan layanan, pola outbox–inbox, penyimpanan versi RKAS, dan jejak audit berantai hash semuanya mengabdi pada gagasan itu.');
P('Bila kamu baru bergabung, urutan paling cepat untuk memahami sistem ini:');
OL([
  'Jalankan sistemnya sampai hidup (Bab 8), lalu pakai sebentar sebagai Operator dan Bendahara.',
  'Baca `packages/aturan` — di sana aturan bisnisnya paling terang karena tidak bercampur I/O.',
  'Telusuri satu alur utuh di kode, misalnya persetujuan transaksi: controller → service → SQL → outbox → konsumen.',
  'Baru sesudah itu baca migrasi SQL layanan yang akan kamu sentuh.',
]);
H2('12.1 Pekerjaan lanjutan');
TABEL(['Bidang', 'Rencana'], [
  ['Penyebaran', 'Mendorong citra ke registry dan menyiapkan API Gateway produksi (kemasan kontainer dan CI sudah ada)'],
  ['Broker', 'Menjalankan lingkungan dengan `BROKER=kafka` beserta pemantauan lag konsumen'],
  ['Observabilitas', 'Log terstruktur, metrik, dan penelusuran terdistribusi memakai `traceparent` yang sudah dibawa setiap event'],
  ['Tanda tangan', 'Mengganti tanda tangan simulasi dengan TTE resmi'],
  ['Kinerja', 'Evaluasi indeks pada tabel partisi saat data lintas tahun bertambah'],
], [2400, 7238]);

// ====================================================================== LAMPIRAN
H1('Lampiran', false);
H2('A. Port, basis data, dan peran login');
TABEL(['Layanan', 'Port', 'Basis data', 'Peran API', 'Peran worker'], [
  ['svc-referensi', '3103', 'db_ref', '`api_ref_login`', '`worker_ref_login`'],
  ['svc-identitas', '3104', 'db_auth', '`api_auth_login`', '`worker_auth_login`'],
  ['svc-penatausahaan', '3105', 'db_tatausaha', '`api_tatausaha_login`', '`worker_tatausaha_login`'],
  ['svc-pelaporan', '3106', 'db_pelaporan', '`api_pelaporan_login`', '`worker_pelaporan_login`'],
  ['svc-perencanaan', '3107', 'db_perencanaan', '`api_perencanaan_login`', '`worker_perencanaan_login`'],
  ['svc-audit', '3108', 'db_audit', '`api_audit_login`', '`worker_audit_login`'],
  ['svc-integrasi', '3109', 'db_integrasi', '`api_integrasi_login`', '`worker_integrasi_login`'],
  ['svc-pemantauan', '3110', 'db_pemantauan', '`api_pemantauan_login`', '`worker_pemantauan_login`'],
  ['svc-bantuan', '3111', 'db_banper', '`api_banper_login`', '`worker_banper_login`'],
], [2200, 800, 1800, 2400, 2438]);
H2('B. Sebaran endpoint dan pengujian');
TABEL(['Layanan', 'Endpoint', 'Controller', 'Berkas uji'], [
  ['svc-bantuan', '30', '2', '1'], ['svc-penatausahaan', '23', '7', '5'], ['svc-integrasi', '20', '3', '1'],
  ['svc-perencanaan', '17', '2', '2'], ['svc-identitas', '16', '3', '1'], ['svc-referensi', '11', '2', '1'],
  ['svc-pelaporan', '7', '2', '2'], ['svc-audit', '6', '2', '1'], ['svc-pemantauan', '6', '2', '1'],
  ['**Jumlah**', '**136**', '**25**', '**15**'],
], [3200, 2200, 2200, 2038]);
H2('C. Tabel utama per basis data');
TABEL(['Basis data', 'Tabel'], [
  ['db_ref', '`wilayah`, `satuan_pendidikan`, `jenjang`, `sumber_dana`, `sumber_dana_jenjang`, `komponen`, `kode_rekening`, `tarif_pajak`, `direktorat`'],
  ['db_auth', '`pengguna`, `peran_pengguna`, `sesi`, `ref_sekolah_lokal`, `ref_wilayah_lokal`, `ref_direktorat_lokal`'],
  ['db_perencanaan', '`pagu`, `kertas_kerja`, `baris_kertas_kerja`, `jadwal_kas`, `verifikasi`, `catatan_baris`, `realisasi_baris_lokal`'],
  ['db_tatausaha', '`periode`, `transaksi` (+partisi), `item_transaksi` (+partisi), `pajak`, `rekonsiliasi`, `rkas_baris_sah`, `transaksi_mitra_masuk`, `penyaluran_masuk`'],
  ['db_pelaporan', '`laporan`, `bku_periode_ringkas`, `bku_transaksi_lokal`'],
  ['db_audit', '`jejak` (+partisi per tahun), `jejak_lain`, `kepala_rantai`'],
  ['db_integrasi', '`mitra_siplah`, `transaksi_mitra`, `item_mitra`, `pembukaan_sumber_dana`, `pembukaan_riwayat`, `rkas_anggaran_mitra`, `sekolah_berhak_lokal`'],
  ['db_pemantauan', '`hpp_antrean`, `hpp_baris`, `hpp_cocok`, `hpp_ringkas` (+matview), `rencana_sah_lokal`, `realisasi_lokal`, `belanja_mitra_lokal`'],
  ['db_banper', '`sumber_dana_bantuan`, `komponen_bantuan`, `dokumen`, `penerima`, `impor_penerima`, `pks_bank`, `penyaluran`, `pengajuan_sekolah`'],
], [2200, 7438]);
P('Setiap basis data juga memiliki `outbox` dan `inbox_processed`.');
H2('D. Menghitung ulang angka pada dokumen ini');
KODE([
  '# jumlah endpoint per layanan',
  'for s in apps/svc-*; do echo "$s $(grep -rhoE \'@(Get|Post|Put|Patch|Delete)\\(\' $s/src | wc -l)"; done',
  '',
  '# jumlah kasus uji — hitung dari hasil eksekusi, bukan dari grep,',
  '# karena satu baris it.each menghasilkan banyak kasus',
  'pnpm test 2>&1 | grep -oE "Tests  [0-9]+ passed" | grep -oE "[0-9]+" | paste -sd+ | bc',
  '',
  '# jumlah kebijakan RLS',
  'grep -rho "CREATE POLICY" db | wc -l',
  '',
  '# jumlah tabel sebuah basis data',
  "psql -d db_tatausaha -tAc \"select count(*) from information_schema.tables where table_schema='tatausaha'\"",
], 'Perintah pemeriksaan');
H2('E. Dokumen terkait');
TABEL(['Berkas', 'Isi'], [
  ['`README.md`', 'Ringkasan repositori dan cara menjalankan secara singkat'],
  ['`docs/svc-*.md`', 'Rincian rancangan dan kasus penggunaan setiap layanan'],
  ['`docs/irisan-*.md`', 'Catatan per irisan pengembangan: penatausahaan, setor pajak, penutupan buku kas'],
  ['`docs/buku-sekolah/`', 'Buku Panduan dan Buku Tutorial untuk pengguna sekolah'],
  ['`docs/buku-panduan/`, `docs/tutorial-*/`', 'Buku untuk peran Dinas, Balai, dan pusat'],
], [3000, 6638]);
H2('F. Glosarium teknis');
TABEL(['Istilah', 'Arti'], [
  ['BFF', '*Backend for Frontend* — lapisan tipis yang melayani antarmuka; di sini diperankan Next.js'],
  ['CloudEvents', 'Format baku pembungkus event lintas sistem, versi 1.0'],
  ['DPP', 'Dasar Pengenaan Pajak — nilai sebelum PPN'],
  ['Idempoten', 'Operasi yang bila dijalankan berulang hasilnya tetap sama'],
  ['Inbox', 'Tabel pencatat event yang sudah diproses, penjaga idempotensi'],
  ['JWKS', '*JSON Web Key Set* — kumpulan kunci publik untuk memverifikasi JWT'],
  ['NTPN', 'Nomor Transaksi Penerimaan Negara, 16 karakter, bukti setor pajak'],
  ['Outbox', 'Tabel penampung event yang menunggu dikirim, ditulis satu transaksi dengan datanya'],
  ['Partisi', 'Pemecahan satu tabel besar menjadi beberapa bagian, di sini berdasarkan tahun'],
  ['Proyeksi lokal', 'Salinan data milik layanan lain yang dibentuk dari event'],
  ['RLS', '*Row Level Security* — pembatasan akses per baris di PostgreSQL'],
  ['RFC 9457', 'Standar format tanggapan galat HTTP (*Problem Details*)'],
  ['SKIP LOCKED', 'Klausa SQL agar beberapa pekerja bisa mengambil antrean tanpa saling tunggu'],
  ['SSO / OIDC', 'Masuk sekali lewat penyedia identitas, dengan protokol OpenID Connect'],
  ['TTE', 'Tanda Tangan Elektronik resmi'],
  ['Zod', 'Pustaka validasi skema TypeScript yang dipakai di paket `kontrak`'],
], [2200, 7438]);

B.simpan('Dokumentasi-Pengembangan-ARKAS-Web.docx', {
  judul: 'Dokumentasi Pengembangan ARKAS Web',
  deskripsi: 'Arsitektur, model data, kontrak antarlayanan, keamanan, pengujian, dan operasional',
  sampulPng: path.join(__dirname, 'diagram', 'sampul-pengembangan.png'),
});
