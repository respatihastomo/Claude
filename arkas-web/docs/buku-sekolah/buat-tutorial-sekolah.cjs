// Buku Tutorial ARKAS Web untuk Sekolah — langkah demi langkah. node buat-tutorial-sekolah.cjs
const path = require('path');
const { buatBuku, GLOSARIUM } = require('./lib-buku.cjs');
const B = buatBuku('Buku Tutorial ARKAS Web untuk Sekolah');
const { H1, H2, H3, P, LI, OL, GAMBAR, KOTAK, TABEL } = B;
/** Kepala satu tutorial: siapa yang mengerjakan dan apa hasilnya. */
const TUT = (judul, siapa, tujuan) => { H3(judul); TABEL(['Dikerjakan oleh', 'Hasil akhirnya'], [[siapa, tujuan]], [3000, 6638], 'E6F7F5'); };

// ====================================================================== BAB 1
H1('Pendahuluan');
KOTAK('RINGKAS', ['Cara memakai buku ini, kenalan dengan sekolah cerita, dan daftar latihan yang akan kamu kerjakan.']);
P('Halo! Buku ini bukan untuk dibaca sambil rebahan. 😄');
P('Buku ini teman praktik. Buka ARKAS Web di komputer, taruh buku ini di sebelahnya, lalu kerjakan bareng-bareng. Setiap langkah ada tangkapan layarnya, dan bagian yang perlu kamu klik atau isi sudah dilingkari merah.');
P('Kalau di tengah jalan kamu bertanya "kok harus begini, sih?" — itu pertanyaan bagus, dan jawabannya ada di **Buku Panduan**, bab dengan nomor yang sama.');
H2('1.1 Cara membaca langkah-langkahnya');
LI([
  'Nomor langkah (1, 2, 3, …) sama dengan nomor pada label merah di gambar.',
  'Tombol ditulis begini: [[Simpan]]. Cari tombol bertuliskan sama di layarmu.',
  'Isian yang perlu diketik ditulis **tebal**, misalnya **Nilai (Rp)**.',
  'Tiap tutorial dibuka kotak hijau: siapa yang mengerjakan, dan apa hasilnya nanti.',
  'Gambar yang hanya menampilkan sepotong layar itu sengaja — supaya kamu bisa melihat detailnya tanpa menyipitkan mata.',
]);
KOTAK('TIPS', 'Tidak usah takut salah klik. Hampir semua tindakan di ARKAS Web butuh konfirmasi, dan yang belum disetujui Kepala Sekolah masih bisa dibatalkan.');
H2('1.2 Sekolah cerita kita');
P('Supaya angkanya nyambung dari latihan ke latihan, kita mengikuti satu sekolah dari awal tahun sampai laporan terbit.');
TABEL(['Peran', 'Nama', 'Mengerjakan tutorial'], [
  ['Operator Sekolah', 'Dewi Lestari', '2.1, 3b, 3c, perbaikan 3e, 3f, 3g'],
  ['Bendahara', 'Ahmad Fauzi', '4b, 4c, 4d'],
  ['Kepala Sekolah', 'Hj. Siti Aminah, M.Pd.', '3d, ajukan ulang 3e–3g, persetujuan 4b–4d'],
  ['Komite Sekolah', 'Bambang Wijaya', '4d (melihat laporan)'],
  ['Verifikator Dinas', 'Rudi Setiawan', '3e (telaah & sahkan)'],
], [2600, 2800, 4238]);
P('Sekolahnya **SMP Swasta Contoh 2** (NPSN 20100002), dapat **BOSP Reguler 2026** dengan pagu awal **Rp12.000.000**.');
GAMBAR('d02-siklus-tahunan', 'Urutan latihan di buku ini mengikuti siklus satu tahun anggaran');
H2('1.3 Daftar latihan');
TABEL(['Bab', 'Latihan'], [
  ['2', 'Masuk, memilih peran, mengganti peran, mengenal menu'],
  ['3', 'Mengaktifkan, menyusun, mengajukan, menelaah & mengesahkan kertas kerja; perubahan & pergeseran'],
  ['4', 'Penerimaan, tarik tunai, belanja luring, persetujuan & penolakan, belanja SIPLah, HPP, setor pajak, buku pembantu, tutup buku, laporan'],
  ['5', 'Membereskan masalah yang sering muncul'],
], [1200, 8438]);

// ====================================================================== BAB 2
H1('Memulai Aplikasi');
KOTAK('RINGKAS', ['2.1 Masuk', '2.2 Memilih peran aktif', '2.3 Mengganti peran & keluar', '2.4 Mengenal halaman pertama & menu']);
GAMBAR('d12-mindmap-memulai', 'Peta Bab 2');
H2('2.1 Masuk ke ARKAS Web');
TUT('Tutorial 2.1 — Masuk', 'Semua pengguna', 'Kamu berhasil masuk dan melihat halaman sesuai peranmu');
OL([
  'Buka peramban, ketik alamat ARKAS Web dari Dinas Pendidikan.',
  'Di sekolah: klik [[Masuk dengan SSO]], lalu masuk dengan akun SSO-mu. Di lingkungan uji coba seperti gambar di bawah: klik saja nama akunmu, misalnya **Dewi Lestari**.',
  'Tunggu sebentar. Kamu akan langsung diantar ke halaman sesuai peranmu.',
]);
GAMBAR('01-masuk', 'Halaman masuk (di lingkungan uji coba muncul daftar akun contoh)', 12.5);
KOTAK('PENTING', 'Muncul tulisan “Layanan identitas tidak dapat dihubungi”? Periksa koneksi internet, lalu muat ulang halaman. Bukan akunmu yang bermasalah.');
H2('2.2 Memilih peran aktif');
TUT('Tutorial 2.2 — Memilih peran', 'Pengguna yang punya lebih dari satu peran', 'Peran aktif terpilih dan menu menyesuaikan');
OL(['Setelah masuk, halaman **Halo, (namamu)** menampilkan semua peran yang kamu punya.', 'Klik peran yang mau dipakai, misalnya **Bendahara**. Selesai.']);
GAMBAR('02-pilih-peran', 'Memilih peran aktif', 12);
H2('2.3 Mengganti peran dan keluar');
TUT('Tutorial 2.3 — Ganti peran & keluar', 'Semua pengguna', 'Berpindah peran tanpa keluar, dan keluar dengan aman');
OL(['Klik kotak pilihan peran di pojok kanan atas.', 'Pilih peran lain — halaman otomatis pindah ke beranda peran itu.', 'Sudah selesai bekerja? Klik [[Keluar]].']);
GAMBAR('e20-pemilih-peran', 'Pemilih peran dan tombol Keluar', 12);
H2('2.4 Mengenal halaman pertama dan menu');
P('Operator yang baru masuk di awal tahun akan melihat pesan **Kertas kerja 2026 belum diaktifkan**. Tenang, itu memang tampilan normal — artinya pekerjaanmu baru dimulai.');
GAMBAR('04-beranda-operator', 'Halaman pertama Operator');
P('Di bawah judul ada menu modul. Isinya berbeda untuk tiap peran.');
GAMBAR('e21-menu-modul', 'Menu modul milik Bendahara', 16.5);
GAMBAR('05-menu-kepsek', 'Menu Kepala Sekolah — ada Jejak audit, tidak ada Kelola pengguna');
KOTAK('LATIHAN', ['Masuk dengan akunmu sendiri.', 'Sebutkan menu apa saja yang muncul untuk peranmu.', 'Kalau punya lebih dari satu peran, coba berpindah, lalu keluar.']);

// ====================================================================== BAB 3
H1('Penganggaran');
KOTAK('RINGKAS', ['3a Kenali kertas kerja & RKAS', '3b Aktifkan', '3c Susun sampai lolos juknis', '3d Ajukan', '3e Telaah, dikembalikan, perbaiki, sahkan', '3f Perubahan anggaran', '3g Pergeseran anggaran']);
GAMBAR('d13-mindmap-penganggaran', 'Peta Bab 3');
H2('3a. Apa itu Kertas Kerja dan RKAS');
P('Singkatnya: **kertas kerja** masih boleh diubah-ubah, **RKAS** sudah disahkan Dinas dan jadi patokan belanja. Setiap versi selalu ada di salah satu status berikut.');
GAMBAR('d05-status-kk', 'Status kertas kerja');
P('Sebelum mulai mengetik, kenali dulu empat bagian layar ini — nanti kamu akan bolak-balik melihatnya.');
GAMBAR('e01-kartu-pagu', 'Kartu Pagu: jatah, yang sudah dianggarkan, dan sisanya (target: Rp0)', 12.5);
GAMBAR('e02-bilah-komponen', 'Bilah per komponen beserta batas juknisnya', 9.5);
GAMBAR('e03-kotak-juknis', 'Kotak kepatuhan — hijau berarti siap diajukan', 12.5);
GAMBAR('e04-tab-versi', 'Tab versi untuk berpindah antarversi', 15);

H2('3b. Pengaktifan Kertas Kerja');
TUT('Tutorial 3b — Mengaktifkan kertas kerja', 'Operator Sekolah (atau Bendahara)', 'Versi 1 berstatus Draf, siap diisi');
OL(['Klik menu **Penganggaran (RKAS)**.', 'Pada pesan **Kertas kerja 2026 belum diaktifkan**, klik [[Aktifkan kertas kerja]].', 'Kertas kerja Versi 1 muncul berstatus **Draf**. Lihat kartu Pagu di kiri: Rp12.000.000.']);
GAMBAR('06-kk-aktif', 'Kertas kerja aktif, siap diisi');
KOTAK('INGAT', 'Tombol ini cuma muncul untuk Operator dan Bendahara. Kepala Sekolah dan Komite hanya melihat pesannya saja.');

H2('3c. Penyusunan Kertas Kerja');
TUT('Tutorial 3c-1 — Menambah baris pertama', 'Operator Sekolah', 'Satu baris belanja tersimpan');
P('Klik [[+ Tambah baris]] di kanan atas. Laci akan terbuka dari sisi kanan layar.');
GAMBAR('07-laci-kosong', 'Laci Tambah baris RKAS, masih kosong', 15);
P('Sekarang isi enam isiannya. Kita lihat satu per satu supaya tidak ada yang bikin ragu.');
P('**Langkah 1 — Komponen BOSP.** Pilih **03. Kegiatan pembelajaran dan ekstrakurikuler**.');
GAMBAR('e07-isian-komponen', 'Langkah 1: pilih komponen', 14);
P('**Langkah 2 — Kode rekening.** Ketik `5.1.02.01.01.0024` atau cukup ketik "alat tulis", lalu pilih dari daftar yang muncul.');
GAMBAR('e08-isian-rekening', 'Langkah 2: kode rekening', 14);
P('**Langkah 3 — Uraian.** Ketik "Alat tulis kantor untuk pembelajaran".');
GAMBAR('e09-isian-uraian', 'Langkah 3: uraian yang jelas', 14);
P('**Langkah 4, 5, 6 — Volume, satuan, harga satuan.** Isi `40`, `pak`, dan `25000`.');
GAMBAR('e10-isian-volume-harga', 'Langkah 4–6: volume, satuan, harga', 14);
P('**Langkah 7 — Simpan.** Totalnya sudah dihitung aplikasi (Rp1.000.000). Klik [[Simpan baris]].');
GAMBAR('e11-total-simpan', 'Langkah 7: total otomatis, lalu simpan', 11);
GAMBAR('09-baris-pertama', 'Baris tersimpan dan dikelompokkan per kegiatan; sisa pagu berkurang');

TUT('Tutorial 3c-2 — Menambah baris lainnya', 'Operator Sekolah', 'Semua kebutuhan sekolah masuk ke kertas kerja');
P('Ulangi cara di atas untuk baris-baris berikut. Untuk honor, isi dulu dengan angka yang **sengaja kelewat batas** — supaya kamu bisa melihat sendiri cara aplikasi memperingatkan.');
TABEL(['Komponen', 'Kode rekening', 'Uraian', 'Volume', 'Satuan', 'Harga'], [
  ['03', '5.1.02.01.01.0025', 'Kertas HVS A4 untuk pembelajaran', '30', 'rim', '55.000'],
  ['04', '5.1.02.01.01.0029', 'Cetak soal penilaian akhir semester', '300', 'eksemplar', '3.500'],
  ['04', '5.1.02.01.01.0052', 'Makan minum rapat penilaian', '40', 'kotak', '25.000'],
  ['07', '5.1.02.01.01.0001', 'Langganan listrik sekolah', '12', 'bulan', '200.000'],
  ['07', '5.1.02.02.01.0061', 'Langganan internet sekolah', '12', 'bulan', '150.000'],
  ['08', '5.1.02.02.01.0013', 'Servis AC dan printer', '2', 'kali', '250.000'],
  ['12', '5.1.02.02.01.0003', 'Honor narasumber in house training', '2', 'orang', '1.250.000'],
], [1400, 2100, 2938, 1000, 1000, 1200]);
TUT('Tutorial 3c-3 — Membaca peringatan juknis', 'Operator Sekolah', 'Kamu tahu persis apa yang harus diperbaiki');
OL(['Lihat bilah **12. Pembayaran honor**: merah, 20,83%, melewati batas 20%.', 'Baca kotak **Belum dapat diajukan**. Isinya daftar pekerjaan rumahmu: sisa pagu Rp100.000 dan honor yang kelebihan.']);
GAMBAR('10-komponen-melebihi', '① bilah honor berubah merah, ② kotak kepatuhan menuliskan daftar perbaikannya', 8.6);
TUT('Tutorial 3c-4 — Mengubah baris', 'Operator Sekolah', 'Honor kembali di bawah batas');
OL(['Pada baris **Honor narasumber in house training**, klik **Ubah**.', 'Ganti **Volume** jadi `2` dan **Harga satuan** jadi `600000`.', 'Klik [[Simpan baris]].']);
GAMBAR('11-ubah-baris', 'Mengubah volume dan harga', 15);
P('Honor sekarang 10%. Tinggal menghabiskan sisa pagunya.');
GAMBAR('12-sisa-pagu', 'Honor aman, sisa pagu masih ada');
TUT('Tutorial 3c-5 — Menghabiskan sisa pagu', 'Operator Sekolah', 'Kertas kerja lolos semua aturan juknis');
OL([
  'Tambahkan baris **05** · `5.1.02.01.01.0029` · "Cetak rapor dan sertifikat" · 160 lembar × 5.000.',
  'Tambahkan baris **08** · `5.1.02.02.01.0026` · "Jasa kebersihan sekolah" · 12 bulan × 50.000.',
  'Pastikan muncul **✓ Memenuhi aturan juknis** dan sisa pagu **Rp0**.',
]);
GAMBAR('13-juknis-ok', 'Kertas kerja lolos aturan juknis');
GAMBAR('e05-anatomi-tabel', 'Hasil akhirnya: tabel kertas kerja yang rapi per komponen', 16.5, 19);
KOTAK('PENTING', 'Selagi belum disahkan, kamu bebas mengubah dan menghapus. Nanti setelah ada belanja, baris yang sudah dipakai tidak bisa dihapus lagi.');

H2('3d. Pengajuan Kertas Kerja');
TUT('Tutorial 3d — Mengajukan ke Dinas', 'Kepala Sekolah', 'Kertas kerja berstatus Diajukan ke Dinas');
OL(['Masuk sebagai Kepala Sekolah, buka **Penganggaran (RKAS)**.', 'Periksa isinya bersama Operator — lebih baik lima menit sekarang daripada seminggu menunggu dikembalikan.', 'Klik [[Ajukan ke Dinas]], lalu jawab **OK**.']);
GAMBAR('14-ajukan', 'Tombol Ajukan ke Dinas (hanya untuk Kepala Sekolah)');
P('Status berubah jadi **Diajukan ke Dinas**, dan kertas kerja terkunci sampai ada keputusan.');
GAMBAR('15-diajukan', 'Kertas kerja sudah diajukan');

H2('3e. Pengesahan Kertas Kerja (RKAS)');
P('Bagian ini dikerjakan **Verifikator Dinas**. Kami tampilkan supaya kamu tahu apa yang terjadi di seberang sana — dan tahu harus apa kalau dikembalikan.');
TUT('Tutorial 3e-1 — Dinas menelaah dan memberi catatan', 'Verifikator Dinas', 'Kertas kerja dikembalikan dengan catatan');
OL(['Verifikator membuka **Penelaahan** dan melihat antrean dari wilayahnya.']);
GAMBAR('16-antrean-dinas', 'Antrean penelaahan');
OL(['Pada baris yang perlu diperbaiki (kertas HVS), Verifikator klik **Catatan** dan menuliskan pesannya.', 'Lalu klik [[Kembalikan]] dengan alasan umum.']);
GAMBAR('17-dinas-catatan', 'Catatan per baris, lalu dikembalikan');
TUT('Tutorial 3e-2 — Memperbaiki kertas kerja yang dikembalikan', 'Operator Sekolah, lalu Kepala Sekolah', 'Kertas kerja diajukan kembali');
OL(['Buka **Penganggaran (RKAS)**. Baca alasan di kotak oranye dan catatan di bawah baris yang bersangkutan.']);
GAMBAR('18-dikembalikan', 'Alasan pengembalian dan catatan per baris');
OL([
  'Pada **Kertas HVS A4**, klik **Ubah**, ganti **Harga satuan** jadi `50000`, simpan. Totalnya turun Rp150.000.',
  'Pada **Alat tulis kantor**, ubah **Volume** dari 40 jadi `46` supaya total kembali pas dengan pagu.',
  'Pastikan **✓ Memenuhi aturan juknis**, lalu minta Kepala Sekolah klik [[Ajukan ke Dinas]] lagi.',
]);
TUT('Tutorial 3e-3 — Dinas mengesahkan', 'Verifikator Dinas', 'Kertas kerja resmi jadi RKAS');
OL(['Verifikator membuka kertas kerja yang diajukan ulang, memeriksanya, lalu klik [[Sahkan]].']);
GAMBAR('19-dinas-sahkan', 'Tombol Sahkan di sisi Dinas');
OL(['Di sekolah, Versi 1 kini **Disahkan**. Seluruh prosesnya tercatat di Riwayat.']);
GAMBAR('20-disahkan', 'RKAS disahkan');
GAMBAR('e06-riwayat', 'Riwayat: siapa mengajukan, siapa mengesahkan, dan kapan', 16.5);
KOTAK('INGAT', 'Sejak detik RKAS disahkan: periode BKU bulan berjalan terbuka, baris RKAS siap dipakai belanja, dan Mitra SIPLah boleh melayani sekolahmu.');

H2('3f. Perubahan Anggaran');
P('Ceritanya: pemerintah menetapkan ulang pagu sekolah dari Rp12.000.000 jadi **Rp13.500.000**. RKAS harus menyesuaikan.');
GAMBAR('d16-pilih-perubahan-pergeseran', 'Ragu memilih? Jawab satu pertanyaan ini dulu');
TUT('Tutorial 3f — Membuat perubahan anggaran', 'Operator, Kepala Sekolah, Verifikator Dinas', 'RKAS Versi 2 senilai Rp13.500.000 disahkan');
OL(['Buka **Penganggaran (RKAS)**. Kartu Pagu sudah menampilkan angka baru.', 'Klik [[Buat pergeseran/perubahan]].']);
GAMBAR('57-pagu-berubah', 'Pagu baru dan tombolnya');
OL(['Versi 2 berstatus Draf dibuat berisi salinan RKAS yang berlaku. Klik tab **Versi 2**. Kotak kuning menunjukkan sisa Rp1.500.000.']);
GAMBAR('58-versi2-draf', 'Versi 2 dengan sisa Rp1.500.000');
OL(['Klik [[+ Tambah baris]]: komponen **06**, rekening `5.1.02.01.01.0052`, uraian "Makan minum workshop KKG guru", volume `60` kotak, harga `25000`.', 'Klik [[Simpan baris]].']);
GAMBAR('59-perubahan-tambah', 'Menambah kegiatan dari tambahan pagu', 15);
OL(['Pastikan **✓ Memenuhi aturan juknis** muncul.']);
GAMBAR('60-perubahan-siap', 'Versi 2 siap diajukan');
OL(['Kepala Sekolah klik [[Ajukan ke Dinas]], Verifikator klik [[Sahkan]] — sama persis seperti 3d dan 3e.', 'Versi 2 jadi **Disahkan**, Versi 1 otomatis **Diganti**.']);
GAMBAR('61-perubahan-disahkan', 'Versi 2 berlaku');

H2('3g. Pergeseran Anggaran');
P('Ceritanya: cetak soal ternyata cukup 240 eksemplar, sementara servis AC naik harga. Pagu **tetap** Rp13.500.000, jadi tinggal memindahkan uangnya.');
TUT('Tutorial 3g — Membuat pergeseran anggaran', 'Operator, Kepala Sekolah, Verifikator Dinas', 'RKAS Versi 3 disahkan dengan nilai yang sudah digeser');
OL(['Klik [[Buat pergeseran/perubahan]], lalu buka tab **Versi 3**. Perhatikan kolom **Realisasi** — itu yang sudah terlanjur dibelanjakan.']);
GAMBAR('62-pergeseran-draf', 'Versi 3 Draf; kolom Realisasi jadi rambu-rambu');
P('Mari sengaja melakukan kesalahan yang paling sering terjadi: mengurangi **Alat tulis kantor** jadi 10 pak (Rp250.000), padahal realisasinya sudah Rp500.000.');
GAMBAR('63-di-bawah-realisasi', 'Ditolak — dan untungnya ditolak', 15);
OL(['Klik [[Batal]]. Pada **Cetak soal penilaian akhir semester**, klik **Ubah**, ganti **Volume** jadi `240` (berkurang Rp210.000). Simpan.']);
GAMBAR('64-geser-kurangi', 'Mengurangi volume cetak soal', 15);
GAMBAR('65-geser-sisa', 'Muncul sisa Rp210.000 yang harus dipindahkan');
OL(['Pada **Servis AC dan printer**, klik **Ubah**, ganti **Harga satuan** jadi `355000` (bertambah Rp210.000). Simpan.']);
GAMBAR('66-geser-tambah', 'Menambah nilai di baris servis AC', 15);
OL(['Pastikan **✓ Memenuhi aturan juknis** — totalnya harus tetap Rp13.500.000.']);
GAMBAR('67-pergeseran-siap', 'Pergeseran siap diajukan');
OL(['Kepala Sekolah mengajukan, Verifikator mengesahkan. Versi 3 berlaku.']);
GAMBAR('68-pergeseran-disahkan', 'Pergeseran disahkan');
KOTAK('LATIHAN', ['Buat kertas kerja latihan dengan honor di atas 20%, lalu perbaiki sampai hijau.', 'Jelaskan dengan kata-katamu sendiri: kapan pakai perubahan, kapan pakai pergeseran?']);

// ====================================================================== BAB 4
H1('Penatausahaan');
KOTAK('RINGKAS', ['4a BKU & buku pembantu', '4b Mencatat: penerimaan, tarik tunai, belanja luring, persetujuan, SIPLah, HPP', '4c Pajak', '4d Tutup buku & laporan']);
H2('4a. Apa itu BKU dan Buku Kas Penunjang');
P('Buka menu **Penatausahaan**. Inilah **Buku Kas Umum (BKU)**. Tab di bawah kartu ringkasan membuka buku pembantunya: BKP Tunai, BKP Bank, BKP Pajak, plus tab Penutupan dan Laporan.');
GAMBAR('21-bku-awal', 'Halaman Penatausahaan setelah RKAS disahkan');
P('Tiga kartu di atas yang paling sering kamu lirik:');
GAMBAR('e12-kartu-saldo', 'Kartu saldo, realisasi, dan periode', 16.5);
GAMBAR('e22-kartu-periode', 'Kartu periode: bulan terbuka, antrean persetujuan, sisa pajak', 8.5);
P('Dan beginilah cara membaca tabelnya:');
GAMBAR('e23-anatomi-baris-bku', 'Anatomi tabel BKU', 16.5);
TABEL(['Tombol', 'Untuk apa', 'Siapa'], [
  ['[[Catat penerimaan]]', 'Dana masuk ke rekening', 'Bendahara'],
  ['[[Tarik tunai]]', 'Memindahkan uang bank ke kas tunai', 'Bendahara'],
  ['[[+ Catat belanja]]', 'Belanja luring, lewat wizard 3 langkah', 'Bendahara'],
  ['[[Setujui]] / [[Tolak]]', 'Memutuskan transaksi yang menunggu', 'Kepala Sekolah'],
], [3000, 4638, 2000]);
GAMBAR('d11-mindmap-bku', 'BKU dan buku kas pembantunya');

H2('4b. Pencatatan ke BKU: realisasi luring dan daring');
P('Semua laporan sekolah berawal dari sini. Satu transaksi yang dicatat dan disetujui akan mengalir ke buku pembantu, mengurangi sisa RKAS, muncul di HPP, dan masuk laporan bulanan.');
GAMBAR('d07-alur-transaksi', 'Perjalanan satu transaksi');
TUT('Tutorial 4b-1 — Mencatat penerimaan dana BOSP', 'Bendahara', 'Penerimaan Rp6.000.000 menunggu persetujuan');
OL(['Klik [[Catat penerimaan]].', 'Isi **Tanggal** sesuai bukti transfer.', '**Uraian**: "Penerimaan dana BOSP Reguler tahap 1".', '**Nilai (Rp)**: `6000000`.', '**No. bukti**: `TRF-BOSP-01` (boleh dikosongkan), lalu [[Simpan]].']);
GAMBAR('22-penerimaan', 'Formulir penerimaan; nomor sesuai langkah 2–5', 15);
P('Transaksinya muncul di BKU berstatus **Menunggu persetujuan**. Saldo belum bergerak — memang begitu.');
GAMBAR('23-menunggu', 'Menunggu persetujuan Kepala Sekolah');
TUT('Tutorial 4b-2 — Menyetujui transaksi', 'Kepala Sekolah', 'Transaksi masuk BKU dan saldo bertambah');
OL(['Buka **Penatausahaan**. Lihat pemberitahuan di kartu periode.']);
GAMBAR('e25-pemberitahuan-kepsek', 'Pemberitahuan antrean persetujuan', 16);
OL(['Cocokkan transaksi dengan buktinya.', 'Klik [[Setujui]]. Kalau tidak sesuai, klik [[Tolak]] dan tulis alasannya.']);
GAMBAR('e24-tombol-putusan', 'Dua tombol keputusan di baris yang menunggu', 16.5);
GAMBAR('25-saldo-bank', 'Setelah disetujui, saldo bank jadi Rp6.000.000');
TUT('Tutorial 4b-3 — Tarik tunai', 'Bendahara (disetujui Kepala Sekolah)', 'Saldo tunai Rp1.500.000 untuk belanja kecil');
OL(['Klik [[Tarik tunai]].', 'Isi uraian "Tarik tunai untuk belanja operasional" dan **Nilai (Rp)** `1500000`.', '[[Simpan]], lalu minta persetujuan Kepala Sekolah.']);
GAMBAR('26-tarik-tunai', 'Formulir tarik tunai', 15);
H3('Realisasi luring: belanja di toko');
TUT('Tutorial 4b-4 — Mencatat belanja luring', 'Bendahara', 'Belanja ATK Rp250.000 tercatat lengkap dengan PPN');
P('Klik [[+ Catat belanja]]. Wizard-nya tiga langkah, dan penandanya selalu kelihatan di atas.');
GAMBAR('27-catat-belanja', 'Tombol Catat belanja');
GAMBAR('e13-langkah-wizard', 'Tiga langkah wizard', 16.5);
P('**Langkah 1 — Detail & saldo.**');
OL(['Isi **Tanggal transaksi** sesuai nota.', 'Pilih cara bayar: **Non-tunai (bank)** atau **Tunai**. Kartu saldo di atasnya menunjukkan sisa masing-masing.']);
GAMBAR('e14-cara-bayar', 'Pilih cara bayar', 9);
OL(['Isi **No. bukti / nota** (`NOTA-ATK-001`), **Nama toko / penyedia** ("Toko Sinar Pelajar"), dan **Uraian belanja**.', 'Centang **Penyedia memiliki NPWP** bila tokonya ber-NPWP. Centangan ini menentukan tarif PPh, jadi jangan asal.', 'Klik [[Lanjut →]].']);
GAMBAR('e15-npwp-penyedia', 'Isian langkah 1 beserta centang NPWP', 14);
GAMBAR('28-belanja-langkah1', 'Tampilan utuh langkah 1', 15);
P('**Langkah 2 — Pilih dari RKAS.**');
OL(['Ketik kata kunci, misalnya "alat tulis". Tidak perlu hafal kode rekening.']);
GAMBAR('e16-cari-rkas', 'Mencari baris RKAS', 14);
OL(['Klik baris **Alat tulis kantor untuk pembelajaran**, lalu isi **Volume** `10` dan **Harga satuan** `25000` sesuai nota.', 'Lirik angka **sisa** di baris itu — belanja tidak boleh melebihinya.', 'Klik [[Lanjut →]].']);
GAMBAR('e17-sisa-anggaran-baris', 'Mengisi volume dan harga; sisa anggaran terlihat', 14);
P('**Langkah 3 — Pajak & simpan.** Bagian ini sudah dihitungkan aplikasi.');
OL(['Periksa pajaknya: PPN 11% × DPP Rp225.225,23 = Rp24.774.']);
GAMBAR('e18-rincian-pajak', 'Rincian pajak', 13.5);
OL(['Lihat **Dibayar ke penyedia**: Rp225.226. Itulah uang yang berpindah ke toko; PPN-nya kamu pegang untuk disetor.']);
GAMBAR('e19-dibayar-penyedia', 'Angka yang dibayarkan ke toko', 16);
OL(['Klik [[Simpan belanja]].']);
GAMBAR('32-bku-belanja', 'Belanja beserta baris pungutan pajaknya di BKU', 16.5, 18);
P('Dengan cara yang sama, sekolah cerita juga mencatat konsumsi rapat Rp1.000.000 (pajak daerah 10%) dan servis AC Rp250.000.');
TUT('Tutorial 4b-5 — Menolak transaksi dan mencatat ulang', 'Kepala Sekolah, lalu Bendahara', 'Transaksi bermasalah tidak masuk BKU, lalu diperbaiki');
OL(['Kepala Sekolah melihat nota servis AC belum distempel. Pada baris **NOTA-SRV-09**, klik [[Tolak]].', 'Tulis alasannya: "Nota servis belum distempel toko dan belum ada tanda terima", lalu OK.']);
GAMBAR('33-kepsek-tolak', 'Menolak transaksi yang buktinya kurang', 16.5, 18);
OL(['Bendahara membuka **Penatausahaan** dan melihat panel merah berisi alasannya.', 'Setelah bukti dilengkapi, klik [[Catat ulang]]. Formulirnya sudah terisi data lama — tinggal diperbaiki dan disimpan.']);
GAMBAR('34-ditolak', 'Panel transaksi ditolak dan tombol Catat ulang');
H3('Realisasi daring: belanja lewat SIPLah');
P('Sebelum mencatat, pastikan dulu jalurnya — supaya tidak dobel.');
GAMBAR('d17-pilih-cara-catat', 'Luring atau daring?');
GAMBAR('d08-luring-daring', 'Bedanya pencatatan luring dan daring');
TUT('Tutorial 4b-6 — Mencatat belanja SIPLah', 'Bendahara (disetujui Kepala Sekolah)', 'Pesanan SIPLah masuk BKU tanpa diketik ulang');
OL([
  'Sekolah memesan di aplikasi Mitra SIPLah seperti biasa. Setelah pesanan selesai, Mitra mengirim transaksinya ke ARKAS sendiri.',
  'Buka **Penatausahaan**. Panel biru **Transaksi SIPLah** muncul di atas BKU.',
  'Barang yang sudah membawa baris RKAS dari Mitra bertanda ✓. Untuk barang lain, pilih baris RKAS di kotak **Pilih baris RKAS…** (★ menandai kode rekening yang sama).',
]);
GAMBAR('35-siplah-masuk', 'Pesanan masuk; satu barang perlu dipetakan');
OL(['Setelah semua barang terpetakan, klik [[Catat ke BKU]].']);
GAMBAR('36-siplah-petakan', 'Tombol Catat ke BKU sudah aktif');
OL(['Belanja tercatat sebagai non-tunai dengan nomor bukti = nomor transaksi SIPLah, pajaknya ikut terhitung. Minta persetujuan Kepala Sekolah.']);
GAMBAR('37-siplah-bku', 'Belanja SIPLah menunggu persetujuan', 16.5, 18);
KOTAK('PENTING', 'Kalau Mitra membatalkan atau meretur pesanan, muncul peringatan kuning. Belum disetujui? Kepala Sekolah tinggal menolak. Sudah disetujui? Catat pengembalian dananya sebagai penerimaan setelah uang benar-benar kembali.');
TUT('Tutorial 4b-7 — Melihat HPP', 'Semua peran sekolah', 'Tahu baris mana yang sudah dan belum dibelanjakan lewat SIPLah');
OL(['Klik menu **HPP**.', 'Baca empat kartunya.']);
GAMBAR('e29-kartu-hpp', 'Empat kartu HPP', 16.5);
OL(['Klik "1 belanja" pada sebuah baris untuk melihat rincian pesanannya.']);
GAMBAR('38-hpp', 'Halaman HPP', 16.5, 18);

H2('4c. Pencatatan Perpajakan');
GAMBAR('d14-mindmap-pajak', 'Peta perpajakan');
TUT('Tutorial 4c-1 — Melihat pajak yang harus disetor', 'Bendahara', 'Tahu pajak apa saja yang belum disetor');
OL(['Klik tab **BKP Pajak**.', 'Bagian **Pajak belum disetor** memuat semua pungutan dari belanja yang sudah disetujui.']);
GAMBAR('39-pajak-terutang', 'Daftar pajak belum disetor', 16.5, 18);
TUT('Tutorial 4c-2 — Mencatat setoran pajak', 'Bendahara (disetujui Kepala Sekolah)', 'PPN tersetor lengkap dengan NTPN');
OL(['Setor PPN ke kas negara (bank, kantor pos, atau e-billing), simpan bukti setornya.', 'Centang **semua PPN** — satu setoran untuk satu jenis pajak.', 'Klik tombol [[Catat setor PPN · Rp…]].']);
GAMBAR('40-pajak-pilih', 'Mencentang pajak sejenis', 16.5, 18);
OL(['Isi **Tanggal setor** dan **NTPN** persis seperti di bukti setor (16 karakter). Pilih **Dibayar dari**.', 'Klik [[Simpan setoran]].', 'Ulangi untuk **Pajak daerah (SSPD)** dengan NTPN-nya sendiri.']);
GAMBAR('41-pajak-ntpn', 'Formulir setor pajak', 15);
OL(['Kepala Sekolah menyetujui setoran di BKU seperti transaksi lain.']);
GAMBAR('42-kepsek-setor', 'Setoran menunggu persetujuan', 16.5, 18);
P('Setelah disetujui, pungutan dan setoran berdampingan rapi, dan saldo pajak kembali Rp0.');
GAMBAR('e26-ntpn', 'Setoran tercatat dengan NTPN-nya', 16.5);
GAMBAR('43-bkp-pajak', 'BKP Pajak setelah setoran disetujui', 16.5, 18);
TUT('Tutorial 4c-3 — Membaca BKP Tunai dan BKP Bank', 'Semua peran sekolah', 'Memeriksa saldo per jenis kas');
OL(['Tab **BKP Tunai** untuk mutasi uang tunai.', 'Tab **BKP Bank** untuk mutasi rekening — cocokkan dengan rekening koran.']);
GAMBAR('44-bkp-tunai', 'BKP Tunai', 16.5, 14);
GAMBAR('45-bkp-bank', 'BKP Bank', 16.5, 18);

H2('4d. Penutupan BKU');
GAMBAR('d10-alur-tutup-buku', 'Alur penutupan BKU');
TUT('Tutorial 4d-1 — Memeriksa daftar periksa', 'Bendahara', 'Yakin bulan ini memang siap ditutup');
OL(['Klik tab **Penutupan Buku Kas**.', 'Lihat **Daftar periksa penutupan** — semuanya harus hijau.']);
GAMBAR('e27-daftar-periksa', 'Daftar periksa penutupan', 14);
GAMBAR('46-tutup-periksa', 'Tampilan utuh tab penutupan', 16.5, 18);
TUT('Tutorial 4d-2 — Rekonsiliasi dan mengajukan penutupan', 'Bendahara', 'Penutupan November diajukan');
OL([
  'Isi **Saldo rekening koran akhir bulan** dari rekening koran bank.',
  'Isi **Hasil hitung kas fisik** dari menghitung uang di brankas (betulan dihitung, ya).',
  'Kalau muncul **selisih**, cari dulu penyebabnya. Kalau memang tidak bisa dihilangkan, tulis penjelasannya — misalnya "biaya administrasi bank belum dicatat".',
]);
GAMBAR('47-tutup-selisih', 'Contoh selisih Rp6.500 yang wajib dijelaskan', 16.5, 18);
OL(['Kalau selisihnya Rp0, klik [[Ajukan penutupan November 2026]].']);
GAMBAR('48-tutup-ajukan', 'Saldo cocok, penutupan siap diajukan', 16.5, 18);
GAMBAR('49-tutup-menunggu', 'Menunggu persetujuan Kepala Sekolah', 16.5, 14);
TUT('Tutorial 4d-3 — Memeriksa berita acara dan menutup buku', 'Kepala Sekolah', 'Buku November ditutup, Desember terbuka');
OL(['Buka tab **Penutupan Buku Kas**, periksa **Berita acara pemeriksaan kas**.', 'Cocok? Klik [[Setujui & tutup buku]]. Tidak cocok? Klik [[Kembalikan]] dengan alasannya.']);
GAMBAR('50-kepsek-berita-acara', 'Berita acara pemeriksaan kas', 16.5, 18);
GAMBAR('51-buku-ditutup', 'November ditutup, Desember terbuka otomatis', 16.5, 14);
TUT('Tutorial 4d-4 — Membuka dan menandatangani laporan', 'Kepala Sekolah', 'Laporan BKU November final bertanda tangan');
OL(['Klik tab **Laporan**. Laporannya sudah dibuat otomatis.']);
GAMBAR('e28-kartu-laporan', 'Kartu laporan: Lihat PDF dan Tandatangani', 16.5);
OL(['Klik **Lihat PDF** dan periksa isinya.']);
GAMBAR('56-laporan-pdf', 'Isi laporan BKU November 2026', 13);
OL(['Sudah benar? Klik [[Tandatangani (simulasi)]]. Di sekolah, tombol ini memakai TTE resmi.']);
GAMBAR('53-laporan-ttd', 'Laporan sudah ditandatangani', 16.5, 14);
TUT('Tutorial 4d-5 — Komite melihat BKU dan laporan', 'Komite Sekolah', 'Memantau penggunaan dana');
OL(['Masuk sebagai Komite, buka **Penatausahaan**. Semua bisa dibaca, tapi tidak ada tombol untuk mengubah.']);
GAMBAR('54-komite', 'Tampilan Komite Sekolah (hanya membaca)', 16.5, 18);
TUT('Tutorial 4d-6 — Memeriksa jejak audit', 'Kepala Sekolah', 'Tahu siapa mengubah apa dan kapan');
OL(['Klik menu **Jejak audit**. Lencana **Terverifikasi utuh** artinya catatan tidak pernah diubah diam-diam.']);
GAMBAR('e30-jejak-audit', 'Lencana keutuhan jejak audit', 16.5);
OL(['Klik **Lihat perubahan** pada sebuah entri untuk melihat nilai sebelum dan sesudahnya.']);
GAMBAR('55-jejak-audit', 'Jejak audit sekolah');
KOTAK('LATIHAN', ['Catat satu penerimaan, satu tarik tunai, dan dua belanja (tunai dan non-tunai).', 'Setor pajaknya dengan NTPN latihan.', 'Tutup buku bulan latihan, lalu buka laporannya.']);

// ====================================================================== BAB 5
H1('Permasalahan dan Solusi');
KOTAK('RINGKAS', ['Pola setiap kasus: **Gejala** → **Kenapa** → **Langkah memperbaiki**.']);
P('Pesan merah di ARKAS Web hampir selalu berarti "aplikasi sedang menyelamatkanmu", bukan "aplikasi rusak". Jadi jangan buru-buru menelepon siapa pun — baca dulu, biasanya jawabannya sudah di layar.');
GAMBAR('d15-mindmap-masalah', 'Peta masalah yang sering muncul');
const KASUS = (judul, gejala, kenapa, langkah, gambar) => {
  H3(judul); TABEL(['Gejala', 'Kenapa'], [[gejala, kenapa]], [4819, 4819], 'FDECEA'); OL(langkah);
  if (gambar) GAMBAR(gambar[0], gambar[1], gambar[2] ?? 14);
};
H2('5.1 Penganggaran');
KASUS('Kasus 1 — Tombol Ajukan ke Dinas tidak bisa diklik', 'Tombolnya abu-abu', 'Kertas kerja belum lolos juknis, atau kamu bukan Kepala Sekolah', ['Baca kotak **Belum dapat diajukan** di kiri.', 'Beresin satu per satu (sisa pagu, batas komponen).', 'Minta Kepala Sekolah yang menekan tombolnya.'], ['10-komponen-melebihi', 'Daftar yang harus diperbaiki ada di kotak ②', 8.6]);
KASUS('Kasus 2 — Baris tidak tersimpan: total melebihi pagu', 'Pesan merah saat menyimpan', 'Total semua baris jadi lebih besar dari pagu', ['Kurangi volume/harga baris yang sedang diisi.', 'Atau kurangi baris lain dulu, baru simpan lagi.']);
KASUS('Kasus 3 — Kertas kerja dikembalikan Dinas', 'Status balik ke Draf, ada kotak oranye', 'Verifikator menemukan yang perlu diperbaiki', ['Baca alasan umum dan catatan per baris.', 'Perbaiki baris terkait (Tutorial 3e-2).', 'Ajukan kembali — tidak perlu mengulang dari nol.'], ['18-dikembalikan', 'Alasan & catatan dari Dinas']);
KASUS('Kasus 4 — Pergeseran ditolak karena realisasi', '“Total baris tidak boleh di bawah realisasinya”', 'Baris itu sudah dibelanjakan lebih besar dari nilai barunya', ['Lihat kolom **Realisasi** dulu.', 'Kurangi baris lain yang sisanya masih ada.'], ['63-di-bawah-realisasi', 'Pesan di bawah realisasi', 15]);
H2('5.2 Penatausahaan');
KASUS('Kasus 5 — Tidak bisa mencatat: urusan periode', '“Periode bulan … belum dibuka” atau “sudah ditutup”', 'RKAS belum disahkan, atau tanggalnya di bulan yang sudah ditutup', ['Pastikan RKAS sudah **Disahkan** (Bab 3e).', 'Pakai tanggal di bulan yang statusnya **Periode buka**.'], ['e22-kartu-periode', 'Cek dulu bulan mana yang terbuka', 8.5]);
KASUS('Kasus 6 — Saldo tunai tidak cukup', '“Saldo tunai tidak cukup” di langkah 1', 'Belanja tunai melebihi saldo tunai yang tersedia', ['Klik **Catat tarik tunai lebih dulu** pada spanduk kuning.', 'Minta persetujuan Kepala Sekolah, lalu ulangi belanjanya.']);
KASUS('Kasus 7 — Belanja melebihi sisa anggaran', '“Belanja … melebihi sisa anggaran”', 'Nilainya lebih besar dari sisa baris RKAS', ['Pilih baris lain yang sesuai, atau', 'Lakukan pergeseran anggaran (Bab 3g) kalau kebutuhannya memang bertambah.'], ['e17-sisa-anggaran-baris', 'Sisa baris terlihat sebelum disimpan', 14]);
KASUS('Kasus 8 — Transaksi ditolak Kepala Sekolah', 'Panel merah “Transaksi ditolak”', 'Bukti tidak lengkap atau isian salah', ['Baca alasannya.', 'Lengkapi bukti, klik **Catat ulang**, perbaiki, simpan.'], ['34-ditolak', 'Panel transaksi ditolak']);
KASUS('Kasus 9 — Transaksi SIPLah tidak bisa dicatat', '“1 barang belum dipetakan”', 'Ada barang dari Mitra yang belum punya baris RKAS', ['Pilih baris RKAS untuk setiap barang (★ = kode rekening sama).', 'Klik **Catat ke BKU**.'], ['35-siplah-masuk', 'Barang yang perlu dipetakan']);
H2('5.3 Pajak dan penutupan');
KASUS('Kasus 10 — NTPN ditolak', 'Tombol simpan tidak aktif atau muncul pesan NTPN', 'Bukan 16 karakter, salah ketik, atau sudah dipakai', ['Salin NTPN persis dari bukti setor.', 'Satu NTPN hanya untuk satu setoran.'], ['e26-ntpn', 'Contoh NTPN yang sudah tercatat', 16.5]);
KASUS('Kasus 11 — Pajak terasa tidak wajar', 'PPh lebih besar dari seharusnya', 'Centang **Penyedia memiliki NPWP** keliru', ['Minta Kepala Sekolah menolak transaksinya.', 'Catat ulang dengan isian NPWP yang benar.'], ['e15-npwp-penyedia', 'Centangan kecil, pengaruhnya besar', 14]);
KASUS('Kasus 12 — Tidak bisa mengajukan penutupan', 'Daftar periksa belum hijau semua, atau selisih belum dijelaskan', 'Masih ada transaksi menunggu, bulan sebelumnya belum ditutup, atau ada selisih', ['Minta Kepala Sekolah menuntaskan antrean persetujuan.', 'Tutup bulan sebelumnya dulu.', 'Cocokkan saldo dengan rekening koran dan kas fisik, atau isi penjelasan selisihnya.'], ['e27-daftar-periksa', 'Semua harus hijau dulu', 14]);
KOTAK('TIPS', 'Mau bertanya ke Operator atau Dinas? Sertakan: nama sekolah & NPSN, peranmu, menu yang dibuka, langkah yang sedang dikerjakan, dan tangkapan layar pesannya. Empat hal itu memangkas waktu bolak-balik.');

// ====================================================================== BAB 6
H1('Penutup');
P('Selesai! Kalau kamu mengikuti buku ini dari depan sampai sini, kamu sudah mempraktikkan satu siklus penuh: mengaktifkan dan menyusun kertas kerja, mengajukan sampai disahkan, membuat perubahan dan pergeseran, mencatat belanja luring maupun SIPLah, menyetor pajak, menutup buku, dan menandatangani laporan.');
P('Itu bukan pencapaian kecil. 🎉');
TABEL(['Sudah bisa?', ''], [
  ['Masuk, memilih & mengganti peran', '☐'], ['Mengaktifkan & menyusun kertas kerja sampai hijau', '☐'], ['Mengajukan & memperbaiki kertas kerja yang dikembalikan', '☐'],
  ['Membuat perubahan & pergeseran anggaran', '☐'], ['Mencatat penerimaan, tarik tunai, belanja luring', '☐'], ['Memetakan & mencatat belanja SIPLah', '☐'],
  ['Menyetor pajak dengan NTPN', '☐'], ['Rekonsiliasi & menutup buku', '☐'], ['Membuka & menandatangani laporan', '☐'],
], [8238, 1400]);
P('Yang masih ada tanda ☐, ulangi saja latihannya — tidak ada yang menghitung berapa kali kamu mencoba. Simpan buku ini di dekat komputer sekolah, dan buka **Buku Panduan** kalau ingin tahu alasan di balik setiap aturan.');
KOTAK('INGAT', 'Tangkapan layar di buku ini diambil dari ARKAS Web versi uji coba (November 2026) dengan data contoh. Tampilan di sekolahmu bisa sedikit berbeda setelah pembaruan, tapi langkah-langkahnya sama.');
P('Selamat bekerja, semoga dana sekolah makin tertib, transparan, dan betul-betul terasa manfaatnya bagi siswa!');

// ====================================================================== BAB 7
H1('Glosarium');
P('Ada istilah yang asing? Cari di sini dulu.');
TABEL(['Istilah', 'Arti'], GLOSARIUM, [2900, 6738]);

B.simpan('Buku-Tutorial-ARKAS-Web-Sekolah.docx', { judul: 'Buku Tutorial ARKAS Web untuk Sekolah', deskripsi: 'Langkah demi langkah penganggaran & penatausahaan ARKAS Web untuk sekolah', sampulPng: path.join(__dirname, 'diagram', 'sampul-tutorial.png') });
