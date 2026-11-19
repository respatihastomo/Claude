// Buku Tutorial ARKAS Web untuk Sekolah — langkah demi langkah dengan tangkapan layar bertanda. node buat-tutorial-sekolah.cjs
const path = require('path');
const { buatBuku, GLOSARIUM } = require('./lib-buku.cjs');
const B = buatBuku('Buku Tutorial ARKAS Web untuk Sekolah');
const { H1, H2, H3, P, LI, OL, GAMBAR, KOTAK, TABEL } = B;
/** Satu tutorial: judul, siapa, tujuan, lalu langkah & gambar. */
const TUT = (judul, siapa, tujuan) => { H3(judul); TABEL(['Dikerjakan oleh', 'Hasilnya'], [[siapa, tujuan]], [3000, 6638], 'E6F7F5'); };

// ====================================================================== BAB 1
H1('Pendahuluan');
KOTAK('RINGKAS', ['Cara memakai buku tutorial ini, sekolah cerita yang akan kita ikuti, dan daftar latihannya.']);
P('Halo! Buku ini adalah **teman praktik**. Buka ARKAS Web di komputer, letakkan buku ini di sampingnya, lalu ikuti langkahnya satu per satu. Setiap langkah punya tangkapan layar asli dari aplikasi, dan bagian yang perlu kamu klik atau isi diberi **kotak merah dengan nomor atau keterangan**.');
H2('1.1 Cara membaca langkah');
LI([
  'Nomor langkah (1, 2, 3, …) sama dengan nomor pada label merah di gambar.',
  'Tombol ditulis seperti ini: [[Simpan]]. Cari tombol dengan tulisan yang sama di layar.',
  'Isian (kolom ketik) ditulis **tebal**, misalnya **Nilai (Rp)**.',
  'Setiap tutorial diawali kotak hijau: **siapa** yang mengerjakan dan **hasil** yang akan kamu dapat.',
]);
KOTAK('TIPS', 'Belum paham kenapa sebuah langkah dilakukan? Buka bab yang sama di **Buku Panduan**. Nomor babnya sama.');
H2('1.2 Sekolah cerita');
P('Kita akan mengikuti satu sekolah dari awal sampai akhir, sehingga angka di setiap tutorial nyambung dengan tutorial sebelumnya.');
TABEL(['Peran', 'Nama', 'Mengerjakan tutorial'], [
  ['Operator Sekolah', 'Dewi Lestari', '2.1, 3b, 3c, perbaikan 3e, 3f, 3g'],
  ['Bendahara', 'Ahmad Fauzi', '4b, 4c, 4d'],
  ['Kepala Sekolah', 'Hj. Siti Aminah, M.Pd.', '3d, ajukan ulang 3e–3g, persetujuan 4b–4d'],
  ['Komite Sekolah', 'Bambang Wijaya', '4d (melihat laporan)'],
  ['Verifikator Dinas', 'Rudi Setiawan', '3e (telaah & sahkan)'],
], [2600, 2800, 4238]);
P('Sekolahnya **SMP Swasta Contoh 2** (NPSN 20100002), menerima **BOSP Reguler 2026** dengan pagu awal **Rp12.000.000**.');
GAMBAR('d02-siklus-tahunan', 'Urutan latihan di buku ini mengikuti siklus satu tahun anggaran');
H2('1.3 Daftar latihan');
TABEL(['Bab', 'Latihan'], [
  ['2', 'Masuk, memilih peran, mengganti peran, mengenal menu'],
  ['3', 'Mengaktifkan, menyusun, mengajukan, menelaah & mengesahkan kertas kerja; perubahan & pergeseran'],
  ['4', 'Penerimaan, tarik tunai, belanja luring, persetujuan & penolakan, belanja SIPLah, HPP, setor pajak, buku pembantu, tutup buku, laporan'],
  ['5', 'Memperbaiki masalah yang sering terjadi'],
], [1200, 8438]);

// ====================================================================== BAB 2
H1('Memulai Aplikasi');
KOTAK('RINGKAS', ['Tutorial 2.1 Masuk ke ARKAS Web', 'Tutorial 2.2 Memilih peran aktif', 'Tutorial 2.3 Mengganti peran & keluar', 'Tutorial 2.4 Mengenal halaman pertama & menu']);
H2('2.1 Masuk ke ARKAS Web');
TUT('Tutorial 2.1 — Masuk', 'Semua pengguna', 'Kamu berhasil masuk dan melihat halaman sesuai peranmu');
OL([
  'Buka peramban (Chrome/Edge/Firefox), ketik alamat ARKAS Web dari Dinas Pendidikan.',
  'Di sekolah, klik [[Masuk dengan SSO]] lalu masuk dengan akun SSO-mu. Di lingkungan uji coba seperti gambar, cukup klik nama akunmu, misalnya **Dewi Lestari**.',
  'Tunggu sebentar. Kamu akan diarahkan ke halaman pertama sesuai peranmu.',
]);
GAMBAR('01-masuk', 'Halaman masuk (lingkungan uji coba menampilkan akun contoh)', 12.5);
KOTAK('PENTING', 'Kalau muncul tulisan “Layanan identitas tidak dapat dihubungi”, periksa koneksi internet lalu muat ulang halaman.');
H2('2.2 Memilih peran aktif');
TUT('Tutorial 2.2 — Memilih peran', 'Pengguna yang punya lebih dari satu peran', 'Peran aktif terpilih, menu menyesuaikan');
OL(['Setelah masuk, halaman **Halo, (namamu)** menampilkan semua peranmu.', 'Klik peran yang ingin dipakai, misalnya **Bendahara**.']);
GAMBAR('02-pilih-peran', 'Memilih peran aktif', 12);
H2('2.3 Mengganti peran dan keluar');
TUT('Tutorial 2.3 — Ganti peran & keluar', 'Semua pengguna', 'Berpindah peran tanpa keluar; keluar dengan aman');
OL(['Klik kotak pilihan peran di pojok kanan atas.', 'Pilih peran lain. Halaman otomatis berpindah ke beranda peran itu.', 'Selesai bekerja? Klik [[Keluar]].']);
GAMBAR('03-ganti-peran', 'Pemilih peran dan tombol Keluar');
H2('2.4 Mengenal halaman pertama dan menu');
P('Operator yang baru pertama kali masuk di awal tahun akan melihat halaman Penganggaran dengan pesan **Kertas kerja 2026 belum diaktifkan**. Di bawah judul ada **menu modul**: klik untuk berpindah antarbagian.');
GAMBAR('04-beranda-operator', 'Halaman pertama Operator: menu dan pesan kertas kerja belum aktif');
P('Kepala Sekolah melihat menu yang sedikit berbeda: ada **Jejak audit**, tetapi tidak ada **Kelola pengguna**.');
GAMBAR('05-menu-kepsek', 'Menu Kepala Sekolah');
KOTAK('LATIHAN', ['Masuk sebagai akunmu sendiri.', 'Sebutkan menu apa saja yang muncul untuk peranmu.', 'Coba ganti peran (jika punya lebih dari satu), lalu keluar.']);

// ====================================================================== BAB 3
H1('Penganggaran');
KOTAK('RINGKAS', ['3a Kenali kertas kerja & RKAS', '3b Tutorial aktifkan', '3c Tutorial susun baris, perbaiki, sampai lolos juknis', '3d Tutorial ajukan', '3e Tutorial telaah, dikembalikan, perbaiki, sahkan', '3f Tutorial perubahan anggaran', '3g Tutorial pergeseran anggaran']);
H2('3a. Apa itu Kertas Kerja dan RKAS');
P('**Kertas kerja** = rancangan anggaran yang masih kamu susun. Setelah **disahkan Dinas**, kertas kerja menjadi **RKAS** yang berlaku dan menjadi patokan belanja. Setiap versi selalu berada di salah satu status ini:');
GAMBAR('d05-status-kk', 'Status kertas kerja');
TABEL(['Di layar', 'Artinya'], [
  ['Kartu **Pagu** (kiri atas)', 'Pagu, jumlah yang sudah dianggarkan, dan sisa pagu'],
  ['Bilah per komponen', 'Persentase setiap komponen terhadap pagu; merah = melewati batas'],
  ['Kotak hijau/kuning', '✓ Memenuhi aturan juknis, atau daftar yang masih harus diperbaiki'],
  ['Tabel kanan', 'Baris-baris dikelompokkan per kegiatan/komponen, kolom Realisasi = yang sudah dibelanjakan'],
  ['Tab **Versi**', 'Berpindah antarversi beserta statusnya'],
  ['**Riwayat**', 'Siapa mengajukan, mengembalikan, atau mengesahkan, dan kapan'],
], [3000, 6638]);

H2('3b. Pengaktifan Kertas Kerja');
TUT('Tutorial 3b — Mengaktifkan kertas kerja', 'Operator Sekolah (atau Bendahara)', 'Versi 1 berstatus Draf siap diisi');
OL(['Klik menu **Penganggaran (RKAS)**.', 'Pada pesan **Kertas kerja 2026 belum diaktifkan**, klik [[Aktifkan kertas kerja]] (lihat Gambar 2.4).', 'Kertas kerja Versi 1 muncul berstatus **Draf**. Periksa pagu di kartu kiri: Rp12.000.000.']);
GAMBAR('06-kk-aktif', 'Kertas kerja aktif: Versi 1 Draf, pagu, dan tombol Tambah baris');
KOTAK('INGAT', 'Tombol aktifkan hanya muncul untuk Operator dan Bendahara. Kepala Sekolah dan Komite hanya melihat pesannya.');

H2('3c. Penyusunan Kertas Kerja');
TUT('Tutorial 3c-1 — Menambah baris pertama', 'Operator Sekolah', 'Satu baris belanja tersimpan');
OL(['Klik [[+ Tambah baris]] di kanan atas. Laci **Tambah baris RKAS** terbuka dari kanan.']);
GAMBAR('07-laci-kosong', 'Laci Tambah baris RKAS masih kosong', 15);
OL([
  '**Komponen BOSP**: pilih **03. Kegiatan pembelajaran dan ekstrakurikuler**.',
  '**Kode rekening**: ketik `5.1.02.01.01.0024` (Alat Tulis Kantor).',
  '**Uraian**: ketik “Alat tulis kantor untuk pembelajaran”.',
  '**Volume**: `40`, **Satuan**: `pak`.',
  '**Harga satuan**: `25000`. Total otomatis menjadi Rp1.000.000.',
  'Klik [[Simpan baris]].',
]);
GAMBAR('08-laci-isi', 'Isian baris pertama; nomor 1–6 sesuai langkah', 15);
GAMBAR('09-baris-pertama', 'Baris tersimpan dan dikelompokkan per kegiatan; sisa pagu berkurang');
TUT('Tutorial 3c-2 — Menambah baris lainnya', 'Operator Sekolah', 'Semua kebutuhan sekolah masuk ke kertas kerja');
P('Ulangi Tutorial 3c-1 untuk baris-baris berikut. Untuk latihan, isi honor dulu dengan angka yang **sengaja melewati batas** supaya kamu bisa melihat cara aplikasi memperingatkan.');
TABEL(['Komponen', 'Kode rekening', 'Uraian', 'Volume', 'Satuan', 'Harga'], [
  ['03', '5.1.02.01.01.0025', 'Kertas HVS A4 untuk pembelajaran', '30', 'rim', '55.000'],
  ['04', '5.1.02.01.01.0029', 'Cetak soal penilaian akhir semester', '300', 'eksemplar', '3.500'],
  ['04', '5.1.02.01.01.0052', 'Makan minum rapat penilaian', '40', 'kotak', '25.000'],
  ['07', '5.1.02.01.01.0001', 'Langganan listrik sekolah', '12', 'bulan', '200.000'],
  ['07', '5.1.02.02.01.0061', 'Langganan internet sekolah', '12', 'bulan', '150.000'],
  ['08', '5.1.02.02.01.0013', 'Servis AC dan printer', '2', 'kali', '250.000'],
  ['12', '5.1.02.02.01.0003', 'Honor narasumber in house training', '2', 'orang', '1.250.000'],
], [1100, 2000, 3138, 900, 1200, 1300]);
TUT('Tutorial 3c-3 — Membaca peringatan juknis', 'Operator Sekolah', 'Tahu apa yang harus diperbaiki');
OL(['Lihat bilah **12. Pembayaran honor**: berwarna **merah**, 20,83%, melewati batas 20%.', 'Baca kotak **Belum dapat diajukan**: ada sisa pagu Rp100.000 dan honor melebihi batas.']);
GAMBAR('10-komponen-melebihi', 'Bilah honor merah dan daftar yang harus diperbaiki');
TUT('Tutorial 3c-4 — Mengubah baris', 'Operator Sekolah', 'Honor kembali di bawah batas');
OL(['Pada baris **Honor narasumber in house training**, klik **Ubah**.', 'Ganti **Volume** menjadi `2` dan **Harga satuan** menjadi `600000`.', 'Klik [[Simpan baris]].']);
GAMBAR('11-ubah-baris', 'Mengubah volume dan harga pada laci Ubah baris RKAS', 15);
P('Honor kini 10%. Masih ada sisa pagu yang belum dianggarkan.');
GAMBAR('12-sisa-pagu', 'Honor sudah aman; sisa pagu masih ada');
TUT('Tutorial 3c-5 — Menghabiskan sisa pagu', 'Operator Sekolah', 'Kertas kerja memenuhi aturan juknis');
OL(['Tambahkan baris **05** · `5.1.02.01.01.0029` · “Cetak rapor dan sertifikat” · 160 lembar × 5.000.', 'Tambahkan baris **08** · `5.1.02.02.01.0026` · “Jasa kebersihan sekolah” · 12 bulan × 50.000.', 'Pastikan muncul **✓ Memenuhi aturan juknis** dan sisa pagu **Rp0**.']);
GAMBAR('13-juknis-ok', 'Kertas kerja lolos aturan juknis');
KOTAK('PENTING', 'Baris yang sudah dibelanjakan nanti tidak bisa dihapus. Sebelum pengesahan, kamu bebas mengubah dan menghapus.');

H2('3d. Pengajuan Kertas Kerja');
TUT('Tutorial 3d — Mengajukan ke Dinas', 'Kepala Sekolah', 'Kertas kerja berstatus Diajukan ke Dinas');
OL(['Masuk sebagai Kepala Sekolah, buka **Penganggaran (RKAS)**.', 'Periksa isi kertas kerja bersama Operator.', 'Klik [[Ajukan ke Dinas]], lalu jawab **OK** pada pertanyaan konfirmasi.']);
GAMBAR('14-ajukan', 'Tombol Ajukan ke Dinas (hanya untuk Kepala Sekolah)');
OL(['Status Versi 1 berubah menjadi **Diajukan ke Dinas**. Kertas kerja terkunci sampai ada keputusan Dinas.']);
GAMBAR('15-diajukan', 'Kertas kerja sudah diajukan');

H2('3e. Pengesahan Kertas Kerja (RKAS)');
P('Bagian ini dikerjakan oleh **Verifikator Dinas**. Kami tampilkan supaya sekolah tahu apa yang terjadi di sisi Dinas, sekaligus cara memperbaiki bila dikembalikan.');
TUT('Tutorial 3e-1 — Dinas menelaah dan memberi catatan', 'Verifikator Dinas', 'Kertas kerja dikembalikan dengan catatan');
OL(['Verifikator membuka **Penelaahan** dan melihat antrean kertas kerja dari wilayahnya.']);
GAMBAR('16-antrean-dinas', 'Antrean penelaahan Verifikator Dinas');
OL(['Pada baris yang perlu diperbaiki (kertas HVS), Verifikator klik **Catatan** dan menulis catatannya.', 'Verifikator klik [[Kembalikan]] dan menulis alasan umum.']);
GAMBAR('17-dinas-catatan', 'Verifikator memberi catatan per baris lalu mengembalikan');
TUT('Tutorial 3e-2 — Memperbaiki kertas kerja yang dikembalikan', 'Operator Sekolah, lalu Kepala Sekolah', 'Kertas kerja diajukan kembali');
OL(['Buka **Penganggaran (RKAS)**. Baca alasan pada kotak **Dikembalikan Verifikator Dinas** dan catatan oranye di bawah baris.']);
GAMBAR('18-dikembalikan', 'Alasan pengembalian dan catatan per baris');
OL([
  'Pada **Kertas HVS A4**, klik **Ubah**, ganti **Harga satuan** menjadi `50000`, lalu simpan. Total turun Rp150.000.',
  'Pada **Alat tulis kantor**, ubah **Volume** dari 40 menjadi `46` supaya total kembali sama dengan pagu.',
  'Pastikan **✓ Memenuhi aturan juknis**, lalu minta Kepala Sekolah klik [[Ajukan ke Dinas]] lagi.',
]);
TUT('Tutorial 3e-3 — Dinas mengesahkan', 'Verifikator Dinas', 'Kertas kerja menjadi RKAS yang berlaku');
OL(['Verifikator membuka kertas kerja yang diajukan ulang dan memeriksanya.', 'Verifikator klik [[Sahkan]] dan mengonfirmasi.']);
GAMBAR('19-dinas-sahkan', 'Tombol Sahkan pada sisi Verifikator Dinas');
OL(['Di sekolah, Versi 1 berstatus **Disahkan**. Bagian **Riwayat** mencatat seluruh prosesnya.']);
GAMBAR('20-disahkan', 'RKAS disahkan beserta riwayatnya');
KOTAK('INGAT', 'Sejak RKAS disahkan: periode BKU bulan berjalan terbuka, baris RKAS bisa dipakai untuk belanja, dan Mitra SIPLah bisa melayani belanja sekolah.');

H2('3f. Perubahan Anggaran');
P('Contoh situasi: pemerintah menetapkan ulang pagu sekolah dari Rp12.000.000 menjadi **Rp13.500.000**. RKAS harus diubah supaya totalnya sama dengan pagu baru.');
TUT('Tutorial 3f — Membuat perubahan anggaran', 'Operator Sekolah, Kepala Sekolah, Verifikator Dinas', 'RKAS Versi 2 dengan total Rp13.500.000 disahkan');
OL(['Buka **Penganggaran (RKAS)**. Kartu Pagu kini menampilkan pagu baru.', 'Klik [[Buat pergeseran/perubahan]].']);
GAMBAR('57-pagu-berubah', 'Pagu baru dan tombol Buat pergeseran/perubahan');
OL(['Versi 2 berstatus **Draf** dibuat, berisi salinan RKAS yang berlaku. Klik tab **Versi 2**. Kotak kuning menunjukkan sisa pagu Rp1.500.000.']);
GAMBAR('58-versi2-draf', 'Versi 2 Draf dengan sisa pagu Rp1.500.000');
OL(['Klik [[+ Tambah baris]]. Pilih komponen **06. Pengembangan profesi pendidik dan tenaga kependidikan**, rekening `5.1.02.01.01.0052`, uraian “Makan minum workshop KKG guru”, volume `60` kotak, harga `25000`.', 'Klik [[Simpan baris]].']);
GAMBAR('59-perubahan-tambah', 'Menambah kegiatan baru dari tambahan pagu', 15);
OL(['Pastikan **✓ Memenuhi aturan juknis** muncul.']);
GAMBAR('60-perubahan-siap', 'Versi 2 siap diajukan');
OL(['Kepala Sekolah klik [[Ajukan ke Dinas]], lalu Verifikator Dinas klik [[Sahkan]] (sama seperti 3d–3e).', 'Versi 2 menjadi **Disahkan**, dan Versi 1 otomatis **Diganti**.']);
GAMBAR('61-perubahan-disahkan', 'Versi 2 berlaku, Versi 1 diganti');

H2('3g. Pergeseran Anggaran');
P('Contoh situasi: cetak soal ternyata cukup 240 eksemplar, sementara biaya servis AC naik. Pagu **tetap** Rp13.500.000, jadi nilai dipindahkan antarbaris.');
TUT('Tutorial 3g — Membuat pergeseran anggaran', 'Operator Sekolah, Kepala Sekolah, Verifikator Dinas', 'RKAS Versi 3 dengan nilai yang sudah digeser disahkan');
OL(['Klik [[Buat pergeseran/perubahan]], lalu klik tab **Versi 3**. Perhatikan kolom **Realisasi**: itu yang sudah dibelanjakan.']);
GAMBAR('62-pergeseran-draf', 'Versi 3 Draf; kolom Realisasi menunjukkan yang sudah dibelanjakan');
P('Coba dulu kesalahan yang umum: mengurangi **Alat tulis kantor** menjadi 10 pak (Rp250.000), padahal realisasinya sudah Rp500.000. Aplikasi menolak:');
GAMBAR('63-di-bawah-realisasi', 'Ditolak: total baris tidak boleh di bawah realisasinya', 15);
OL(['Klik [[Batal]]. Pada **Cetak soal penilaian akhir semester**, klik **Ubah** dan ganti **Volume** menjadi `240` (berkurang Rp210.000). Simpan.']);
GAMBAR('64-geser-kurangi', 'Mengurangi volume cetak soal', 15);
GAMBAR('65-geser-sisa', 'Muncul sisa Rp210.000 yang harus digeser ke baris lain');
OL(['Pada **Servis AC dan printer**, klik **Ubah** dan ganti **Harga satuan** menjadi `355000` (bertambah Rp210.000). Simpan.']);
GAMBAR('66-geser-tambah', 'Menambah nilai pada baris servis AC', 15);
OL(['Pastikan **✓ Memenuhi aturan juknis**: total tetap Rp13.500.000.']);
GAMBAR('67-pergeseran-siap', 'Pergeseran siap diajukan');
OL(['Kepala Sekolah mengajukan, Verifikator mengesahkan. Versi 3 menjadi RKAS yang berlaku.']);
GAMBAR('68-pergeseran-disahkan', 'Pergeseran disahkan; riwayat versi tercatat');
KOTAK('LATIHAN', ['Buat kertas kerja latihan dengan honor melebihi 20%, lalu perbaiki.', 'Jelaskan dengan kata-katamu: kapan memilih perubahan, kapan pergeseran?']);

// ====================================================================== BAB 4
H1('Penatausahaan');
KOTAK('RINGKAS', ['4a Mengenal BKU & buku pembantu', '4b Mencatat ke BKU: penerimaan, tarik tunai, belanja luring, persetujuan/penolakan, belanja daring SIPLah, HPP', '4c Mencatat & menyetor pajak', '4d Menutup BKU & laporan']);
H2('4a. Apa itu BKU dan Buku Kas Penunjang');
P('Buka menu **Penatausahaan**. Halaman ini adalah **Buku Kas Umum (BKU)**: catatan semua uang masuk dan keluar. Tab di bawah kartu ringkasan membuka **buku kas penunjang/pembantu**: BKP Tunai, BKP Bank, dan BKP Pajak, ditambah tab Penutupan Buku Kas dan Laporan.');
GAMBAR('21-bku-awal', 'BKU awal setelah RKAS disahkan: periode November terbuka');
TABEL(['Tombol', 'Untuk', 'Peran'], [
  ['[[Catat penerimaan]]', 'Dana masuk ke rekening (BOSP, bantuan, pengembalian)', 'Bendahara'],
  ['[[Tarik tunai]]', 'Memindahkan uang dari bank ke kas tunai', 'Bendahara'],
  ['[[+ Catat belanja]]', 'Belanja luring lewat wizard 3 langkah', 'Bendahara'],
  ['[[Setujui]] / [[Tolak]]', 'Memutuskan transaksi yang menunggu', 'Kepala Sekolah'],
], [3000, 4638, 2000]);
GAMBAR('d11-mindmap-bku', 'BKU dan buku kas pembantunya');

H2('4b. Pencatatan ke BKU: realisasi luring dan daring');
P('Semua laporan sekolah berawal dari sini: setiap transaksi yang dicatat dan disetujui akan mengalir ke buku pembantu, mengurangi sisa RKAS, muncul di HPP, dan dirangkum dalam laporan bulanan.');
GAMBAR('d07-alur-transaksi', 'Perjalanan satu transaksi');
TUT('Tutorial 4b-1 — Mencatat penerimaan dana BOSP', 'Bendahara', 'Penerimaan Rp6.000.000 menunggu persetujuan');
OL(['Klik [[Catat penerimaan]].', 'Isi **Tanggal** sesuai bukti transfer.', '**Uraian**: “Penerimaan dana BOSP Reguler tahap 1”.', '**Nilai (Rp)**: `6000000`.', '**No. bukti**: `TRF-BOSP-01` (opsional), lalu klik [[Simpan]].']);
GAMBAR('22-penerimaan', 'Formulir penerimaan; nomor sesuai langkah 2–5', 15);
P('Transaksi tampil di BKU dengan status **Menunggu persetujuan**. Saldo belum berubah.');
GAMBAR('23-menunggu', 'Penerimaan menunggu persetujuan Kepala Sekolah');
TUT('Tutorial 4b-2 — Menyetujui transaksi', 'Kepala Sekolah', 'Transaksi masuk BKU dan saldo bertambah');
OL(['Buka **Penatausahaan**. Perhatikan pemberitahuan “… transaksi menunggu persetujuan Anda”.', 'Cocokkan transaksi dengan buktinya.', 'Klik [[Setujui]] dan konfirmasi. Bila tidak sesuai, klik [[Tolak]] dan tulis alasannya.']);
GAMBAR('24-kepsek-setujui', 'Kepala Sekolah menyetujui atau menolak');
GAMBAR('25-saldo-bank', 'Setelah disetujui, saldo bank menjadi Rp6.000.000');
TUT('Tutorial 4b-3 — Tarik tunai', 'Bendahara (disetujui Kepala Sekolah)', 'Saldo tunai Rp1.500.000 untuk belanja kecil');
OL(['Klik [[Tarik tunai]].', 'Isi uraian “Tarik tunai untuk belanja operasional” dan **Nilai (Rp)** `1500000`.', 'Klik [[Simpan]], lalu minta Kepala Sekolah menyetujuinya.']);
GAMBAR('26-tarik-tunai', 'Formulir tarik tunai', 15);
H3('Realisasi luring: belanja di toko');
TUT('Tutorial 4b-4 — Mencatat belanja luring (wizard 3 langkah)', 'Bendahara', 'Belanja ATK Rp250.000 tercatat lengkap dengan PPN');
OL(['Klik [[+ Catat belanja]].']);
GAMBAR('27-catat-belanja', 'Tombol Catat belanja');
P('**Langkah 1 — Detail & saldo.**');
OL(['**Tanggal transaksi** sesuai nota.', 'Pilih cara bayar: **Non-tunai (bank)** atau **Tunai**. Kartu saldo di atas menunjukkan sisa saldonya.', '**No. bukti / nota**: `NOTA-ATK-001`.', '**Nama toko / penyedia**: “Toko Sinar Pelajar”, lalu isi **Uraian belanja**.', 'Centang **Penyedia memiliki NPWP** bila toko punya NPWP. Ini memengaruhi tarif PPh.', 'Klik [[Lanjut →]].']);
GAMBAR('28-belanja-langkah1', 'Langkah 1: detail transaksi', 15);
P('**Langkah 2 — Pilih dari RKAS.**');
OL(['Ketik kata kunci di kolom pencarian, misalnya “alat tulis”.', 'Klik baris RKAS **Alat tulis kantor untuk pembelajaran**.']);
GAMBAR('29-belanja-langkah2-cari', 'Mencari baris RKAS', 15);
OL(['Isi **Volume** `10` dan **Harga satuan** `25000` sesuai nota. Perhatikan **sisa** anggaran baris di bawahnya.', 'Klik [[Lanjut →]].']);
GAMBAR('30-belanja-langkah2-isi', 'Mengisi volume dan harga; sisa anggaran baris terlihat', 15);
P('**Langkah 3 — Pajak & simpan.**');
OL(['Periksa pajak yang dihitung otomatis: PPN 11% × DPP Rp225.225,23 = Rp24.774.', 'Perhatikan **Dibayar ke penyedia**: Rp225.226. Inilah uang yang kamu bayarkan ke toko; PPN-nya kamu simpan untuk disetor.', 'Klik [[Simpan belanja]].']);
GAMBAR('31-belanja-langkah3-pajak', 'Langkah 3: pajak dihitung otomatis', 15);
P('Belanja muncul di BKU **bersama baris pungutan pajaknya**. Dengan cara yang sama, sekolah cerita juga mencatat konsumsi rapat Rp1.000.000 di RM Sederhana Rasa (pajak daerah 10%) dan servis AC Rp250.000 di Bengkel AC Maju Jaya.');
GAMBAR('32-bku-belanja', 'Belanja dan pungutan pajaknya di BKU', 16.5, 18);
TUT('Tutorial 4b-5 — Menolak transaksi dan mencatat ulang', 'Kepala Sekolah, lalu Bendahara', 'Transaksi bermasalah tidak masuk BKU; Bendahara memperbaikinya');
OL(['Kepala Sekolah menemukan nota servis AC belum distempel. Pada baris **NOTA-SRV-09**, klik [[Tolak]].', 'Tulis alasan: “Nota servis belum distempel toko dan belum ada tanda terima”, lalu OK. Transaksi lain disetujui seperti biasa.']);
GAMBAR('33-kepsek-tolak', 'Kepala Sekolah menolak transaksi yang buktinya kurang', 16.5, 18);
OL(['Bendahara membuka **Penatausahaan**. Panel merah **Transaksi ditolak** menampilkan alasannya.', 'Lengkapi buktinya, lalu klik [[Catat ulang]]. Formulir terbuka berisi data sebelumnya; perbaiki dan simpan.']);
GAMBAR('34-ditolak', 'Panel transaksi ditolak dan tombol Catat ulang');
H3('Realisasi daring: belanja lewat SIPLah');
GAMBAR('d08-luring-daring', 'Bedanya pencatatan luring dan daring');
TUT('Tutorial 4b-6 — Mencatat belanja SIPLah', 'Bendahara (disetujui Kepala Sekolah)', 'Pesanan SIPLah tercatat di BKU tanpa diketik ulang');
OL(['Sekolah memesan barang di aplikasi Mitra SIPLah seperti biasa. Setelah pesanan selesai, Mitra mengirim transaksinya ke ARKAS secara otomatis.', 'Buka **Penatausahaan**. Panel biru **Transaksi SIPLah** muncul di atas BKU.', 'Barang yang sudah membawa baris RKAS dari Mitra bertanda ✓. Untuk barang lain, pilih baris RKAS di kotak **Pilih baris RKAS…**. Baris dengan kode rekening yang sama ditandai ★.']);
GAMBAR('35-siplah-masuk', 'Pesanan SIPLah masuk; satu barang perlu dipetakan');
OL(['Setelah semua barang terpetakan, klik [[Catat ke BKU]].']);
GAMBAR('36-siplah-petakan', 'Barang sudah dipetakan; tombol Catat ke BKU aktif');
OL(['Belanja SIPLah tercatat sebagai belanja **non-tunai** dengan nomor bukti = nomor transaksi SIPLah, lengkap dengan pajaknya. Minta Kepala Sekolah menyetujuinya.']);
GAMBAR('37-siplah-bku', 'Belanja SIPLah di BKU menunggu persetujuan', 16.5, 18);
KOTAK('PENTING', 'Bila Mitra membatalkan atau meretur pesanan, panel SIPLah menampilkan peringatan kuning. Kalau belanjanya belum disetujui, Kepala Sekolah menolaknya. Kalau sudah disetujui, catat pengembalian dana sebagai penerimaan setelah uang kembali.');
TUT('Tutorial 4b-7 — Melihat HPP', 'Semua peran sekolah', 'Tahu baris RKAS mana yang sudah/ belum dibelanjakan lewat SIPLah');
OL(['Klik menu **HPP**.', 'Baca empat kartu: Sesuai rencana, Melebihi rencana, Di luar rencana, Belum dibelanjakan.', 'Klik “1 belanja” pada sebuah baris untuk melihat rincian pesanan SIPLah-nya.']);
GAMBAR('38-hpp', 'Halaman HPP sekolah', 16.5, 18);

H2('4c. Pencatatan Perpajakan');
GAMBAR('d09-alur-pajak', 'Alur perpajakan');
TUT('Tutorial 4c-1 — Melihat pajak yang harus disetor', 'Bendahara', 'Tahu pajak apa saja yang belum disetor');
OL(['Klik tab **BKP Pajak**.', 'Bagian **Pajak belum disetor** berisi semua pungutan dari belanja yang sudah disetujui: jenis, nomor bukti, DPP, dan nilainya.']);
GAMBAR('39-pajak-terutang', 'Daftar pajak belum disetor', 16.5, 18);
TUT('Tutorial 4c-2 — Mencatat setoran pajak', 'Bendahara (disetujui Kepala Sekolah)', 'PPN tersetor dengan NTPN');
OL(['Setor PPN ke kas negara (bank, kantor pos, atau e-billing) dan simpan bukti setornya.', 'Di **Pajak belum disetor**, centang **semua PPN** (satu setoran untuk satu jenis pajak).', 'Klik tombol [[Catat setor PPN · Rp…]].']);
GAMBAR('40-pajak-pilih', 'Mencentang pajak sejenis', 16.5, 18);
OL(['Isi **Tanggal setor** dan **NTPN** (16 karakter) persis seperti bukti setor. Pilih **Dibayar dari** (rekening bank atau kas tunai).', 'Klik [[Simpan setoran]].', 'Ulangi untuk **Pajak daerah (SSPD)** dengan NTPN-nya sendiri.']);
GAMBAR('41-pajak-ntpn', 'Formulir setor pajak dengan NTPN', 15);
OL(['Kepala Sekolah menyetujui setoran di BKU, sama seperti transaksi lain.']);
GAMBAR('42-kepsek-setor', 'Setoran pajak menunggu persetujuan Kepala Sekolah', 16.5, 18);
P('Setelah disetujui, BKP Pajak menampilkan pungutan dan setoran berdampingan, dan saldo pajak kembali Rp0.');
GAMBAR('43-bkp-pajak', 'BKP Pajak setelah setoran disetujui', 16.5, 18);
TUT('Tutorial 4c-3 — Membaca BKP Tunai dan BKP Bank', 'Semua peran sekolah', 'Memeriksa saldo per jenis kas');
OL(['Klik tab **BKP Tunai** untuk melihat mutasi uang tunai.', 'Klik tab **BKP Bank** untuk melihat mutasi rekening; cocokkan dengan rekening koran.']);
GAMBAR('44-bkp-tunai', 'BKP Tunai', 16.5, 14);
GAMBAR('45-bkp-bank', 'BKP Bank', 16.5, 18);

H2('4d. Penutupan BKU');
GAMBAR('d10-alur-tutup-buku', 'Alur penutupan BKU');
TUT('Tutorial 4d-1 — Memeriksa daftar periksa', 'Bendahara', 'Yakin bulan ini siap ditutup');
OL(['Klik tab **Penutupan Buku Kas**.', 'Lihat **Daftar periksa penutupan**: semua harus bercentang hijau (tidak ada transaksi menunggu, periode sebelumnya sudah ditutup).']);
GAMBAR('46-tutup-periksa', 'Daftar periksa penutupan', 16.5, 18);
TUT('Tutorial 4d-2 — Rekonsiliasi dan mengajukan penutupan', 'Bendahara', 'Penutupan November diajukan');
OL(['Isi **Saldo rekening koran akhir bulan** dari rekening koran bank.', 'Isi **Hasil hitung kas fisik** dari menghitung uang di brankas.', 'Bila muncul **selisih**, cari penyebabnya. Kalau tidak bisa dibetulkan, tulis penjelasannya (misalnya “biaya administrasi bank belum dicatat”).']);
GAMBAR('47-tutup-selisih', 'Contoh selisih bank Rp6.500 yang wajib dijelaskan', 16.5, 18);
OL(['Bila saldo sudah cocok (selisih Rp0), klik [[Ajukan penutupan November 2026]].']);
GAMBAR('48-tutup-ajukan', 'Saldo cocok; penutupan siap diajukan', 16.5, 18);
GAMBAR('49-tutup-menunggu', 'Penutupan menunggu persetujuan Kepala Sekolah', 16.5, 14);
TUT('Tutorial 4d-3 — Memeriksa berita acara dan menutup buku', 'Kepala Sekolah', 'Buku November ditutup, Desember terbuka');
OL(['Buka tab **Penutupan Buku Kas**. Periksa **Berita acara pemeriksaan kas**: saldo buku, rekening koran, kas fisik, dan selisihnya.', 'Bila sesuai, klik [[Setujui & tutup buku]]. Bila tidak, klik [[Kembalikan]] dan tulis alasannya.']);
GAMBAR('50-kepsek-berita-acara', 'Berita acara pemeriksaan kas', 16.5, 18);
GAMBAR('51-buku-ditutup', 'Buku November ditutup; periode Desember otomatis terbuka', 16.5, 14);
TUT('Tutorial 4d-4 — Membuka dan menandatangani laporan', 'Kepala Sekolah', 'Laporan BKU November final bertanda tangan');
OL(['Klik tab **Laporan**. Laporan BKU bulan yang ditutup sudah dibuat otomatis.', 'Klik **Lihat PDF** untuk memeriksa isinya.']);
GAMBAR('52-laporan', 'Daftar laporan: Lihat PDF dan Tandatangani', 16.5, 14);
GAMBAR('56-laporan-pdf', 'Isi laporan BKU November 2026 (PDF)', 14);
OL(['Bila sudah benar, klik [[Tandatangani (simulasi)]]. Di sekolah, tombol ini memakai TTE resmi.']);
GAMBAR('53-laporan-ttd', 'Laporan sudah ditandatangani', 16.5, 14);
TUT('Tutorial 4d-5 — Komite melihat BKU dan laporan', 'Komite Sekolah', 'Memantau penggunaan dana secara transparan');
OL(['Masuk sebagai Komite, buka **Penatausahaan**. Semua buku dan laporan bisa dibaca, tetapi tidak ada tombol untuk mengubah.']);
GAMBAR('54-komite', 'Tampilan Komite Sekolah (hanya membaca)', 16.5, 18);
TUT('Tutorial 4d-6 — Memeriksa jejak audit', 'Kepala Sekolah', 'Tahu siapa mengubah apa dan kapan');
OL(['Klik menu **Jejak audit**. Lencana **Terverifikasi utuh** berarti catatan tidak pernah diubah.', 'Klik **Lihat perubahan** pada sebuah entri untuk melihat nilai sebelum dan sesudahnya.']);
GAMBAR('55-jejak-audit', 'Jejak audit sekolah');
KOTAK('LATIHAN', ['Catat satu penerimaan, satu tarik tunai, dan dua belanja (tunai & non-tunai).', 'Setor pajaknya dengan NTPN latihan.', 'Tutup buku bulan latihan dan buka laporannya.']);

// ====================================================================== BAB 5
H1('Permasalahan dan Solusi');
KOTAK('RINGKAS', ['Setiap kartu di bawah: **Gejala** → **Kenapa** → **Langkah memperbaiki**. Nomor gambar merujuk tutorial sebelumnya.']);
const KASUS = (judul, gejala, kenapa, langkah, gambar) => {
  H3(judul); TABEL(['Gejala', 'Kenapa'], [[gejala, kenapa]], [4819, 4819], 'FDECEA'); OL(langkah);
  if (gambar) GAMBAR(gambar[0], gambar[1], gambar[2] ?? 14);
};
H2('5.1 Penganggaran');
KASUS('Kasus 1 — Tombol Ajukan ke Dinas tidak bisa diklik', 'Tombol abu-abu', 'Kertas kerja belum memenuhi aturan juknis, atau kamu bukan Kepala Sekolah', ['Baca kotak **Belum dapat diajukan** di kiri.', 'Perbaiki satu per satu (sisa pagu, batas komponen).', 'Minta Kepala Sekolah yang mengajukan.'], ['10-komponen-melebihi', 'Daftar yang harus diperbaiki']);
KASUS('Kasus 2 — Baris tidak tersimpan: total melebihi pagu', 'Pesan merah di laci saat menyimpan', 'Total semua baris jadi lebih besar dari pagu', ['Kurangi volume/harga baris yang sedang diisi.', 'Atau kurangi baris lain dulu, lalu simpan lagi.']);
KASUS('Kasus 3 — Kertas kerja dikembalikan Dinas', 'Status kembali Draf dengan kotak oranye', 'Verifikator menemukan hal yang perlu diperbaiki', ['Baca alasan umum dan catatan per baris.', 'Perbaiki baris terkait (Tutorial 3e-2).', 'Ajukan kembali.'], ['18-dikembalikan', 'Alasan & catatan dari Dinas']);
KASUS('Kasus 4 — Pergeseran ditolak karena realisasi', '“Total baris tidak boleh di bawah realisasinya”', 'Baris itu sudah dibelanjakan lebih besar dari nilai barunya', ['Lihat kolom **Realisasi**.', 'Kurangi baris lain yang belum/masih bersisa.'], ['63-di-bawah-realisasi', 'Pesan di bawah realisasi', 15]);
H2('5.2 Penatausahaan');
KASUS('Kasus 5 — Tidak bisa mencatat: periode belum dibuka/ditutup', '“Periode bulan … belum dibuka” atau “Periode buku kas sudah ditutup”', 'RKAS belum disahkan, atau tanggal di bulan yang sudah ditutup', ['Pastikan RKAS sudah **Disahkan** (Bab 3e).', 'Gunakan tanggal di bulan yang statusnya **Periode buka**.']);
KASUS('Kasus 6 — Saldo tunai tidak cukup', '“Saldo tunai tidak cukup” di langkah 1 wizard', 'Belanja tunai melebihi saldo tunai tersedia', ['Klik **Catat tarik tunai lebih dulu** pada spanduk kuning.', 'Minta Kepala Sekolah menyetujui tarik tunai, lalu ulangi belanja.']);
KASUS('Kasus 7 — Belanja melebihi sisa anggaran', '“Belanja … melebihi sisa anggaran”', 'Nilai belanja lebih besar dari sisa baris RKAS', ['Pilih baris lain yang sesuai, atau', 'Buat pergeseran anggaran (Bab 3g) bila memang kebutuhannya bertambah.']);
KASUS('Kasus 8 — Transaksi ditolak Kepala Sekolah', 'Panel merah “Transaksi ditolak”', 'Bukti tidak lengkap atau isian salah', ['Baca alasannya.', 'Lengkapi bukti, klik **Catat ulang**, perbaiki, simpan.'], ['34-ditolak', 'Panel transaksi ditolak']);
KASUS('Kasus 9 — Transaksi SIPLah tidak bisa dicatat', '“1 barang belum dipetakan”, tombol Catat ke BKU abu-abu', 'Ada barang dari Mitra tanpa baris RKAS', ['Pilih baris RKAS untuk setiap barang (★ = kode rekening sama).', 'Klik **Catat ke BKU**.'], ['35-siplah-masuk', 'Barang yang perlu dipetakan']);
H2('5.3 Pajak dan penutupan');
KASUS('Kasus 10 — NTPN ditolak', 'Tombol Simpan setoran tidak aktif atau muncul pesan NTPN', 'NTPN bukan 16 karakter, salah ketik, atau sudah dipakai', ['Salin NTPN persis dari bukti setor (huruf besar/angka).', 'Satu NTPN hanya untuk satu setoran.']);
KASUS('Kasus 11 — Pajak salah karena NPWP penyedia', 'PPh lebih besar dari seharusnya', 'Centang **Penyedia memiliki NPWP** salah', ['Minta Kepala Sekolah menolak transaksi itu.', 'Catat ulang dengan isian NPWP yang benar.']);
KASUS('Kasus 12 — Tidak bisa mengajukan penutupan', 'Daftar periksa ada yang belum hijau / selisih belum dijelaskan', 'Masih ada transaksi menunggu, periode sebelumnya belum ditutup, atau ada selisih', ['Minta Kepala Sekolah memutuskan semua transaksi.', 'Tutup bulan sebelumnya dulu.', 'Cocokkan saldo dengan rekening koran/kas fisik, atau isi penjelasan selisih.'], ['47-tutup-selisih', 'Selisih wajib dijelaskan', 16.5]);
KOTAK('TIPS', 'Saat minta bantuan, sertakan: nama sekolah & NPSN, peranmu, menu yang dibuka, langkah yang dikerjakan, dan tangkapan layar pesan yang muncul.');

// ====================================================================== BAB 6
H1('Penutup');
P('Hebat! Kamu sudah mempraktikkan seluruh siklus ARKAS Web untuk sekolah: mengaktifkan dan menyusun kertas kerja, mengajukan sampai disahkan, membuat perubahan dan pergeseran, mencatat belanja luring maupun SIPLah, menyetor pajak, menutup buku, dan menandatangani laporan.');
TABEL(['Sudah bisa?', ''], [
  ['Masuk, memilih & mengganti peran', '☐'], ['Mengaktifkan & menyusun kertas kerja sampai lolos juknis', '☐'], ['Mengajukan & memperbaiki kertas kerja yang dikembalikan', '☐'],
  ['Membuat perubahan & pergeseran anggaran', '☐'], ['Mencatat penerimaan, tarik tunai, belanja luring', '☐'], ['Memetakan & mencatat belanja SIPLah', '☐'],
  ['Menyetor pajak dengan NTPN', '☐'], ['Rekonsiliasi & menutup buku', '☐'], ['Membuka & menandatangani laporan', '☐'],
], [8238, 1400]);
P('Ulangi latihan yang belum lancar, dan simpan buku ini di dekat komputer sekolah. Untuk memahami alasan di balik setiap aturan, baca **Buku Panduan ARKAS Web untuk Sekolah**.');
KOTAK('INGAT', 'Tangkapan layar diambil dari ARKAS Web versi uji coba (November 2026) dengan data contoh. Tampilan di sekolahmu bisa sedikit berbeda setelah pembaruan, tetapi langkah-langkahnya sama.');
P('Selamat bekerja, semoga dana sekolah makin tertib, transparan, dan bermanfaat bagi siswa!');

// ====================================================================== BAB 7
H1('Glosarium');
TABEL(['Istilah', 'Arti'], GLOSARIUM, [2900, 6738]);

B.simpan('Buku-Tutorial-ARKAS-Web-Sekolah.docx', { judul: 'Buku Tutorial ARKAS Web untuk Sekolah', deskripsi: 'Langkah demi langkah penganggaran & penatausahaan ARKAS Web untuk sekolah', sampulPng: path.join(__dirname, 'diagram', 'sampul-tutorial.png') });
