// Buku Panduan ARKAS Web untuk Sekolah — fokus memahami konsep, aturan, dan alur. node buat-panduan-sekolah.cjs
const path = require('path');
const { buatBuku, GLOSARIUM } = require('./lib-buku.cjs');
const B = buatBuku('Buku Panduan ARKAS Web untuk Sekolah');
const { H1, H2, H3, P, LI, OL, GAMBAR, KOTAK, TABEL } = B;

// ====================================================================== BAB 1
H1('Pendahuluan');
KOTAK('RINGKAS', ['Bab ini menjelaskan buku apa yang sedang kamu pegang, apa itu ARKAS Web, siapa saja penggunanya, dan gambaran besar pekerjaan sekolah selama satu tahun anggaran.']);
P('Halo! Selamat datang di **Buku Panduan ARKAS Web untuk Sekolah**. Buku ini menemanimu memahami cara sekolah merencanakan dan mencatat penggunaan dana BOSP lewat ARKAS Web: mulai dari menyusun kertas kerja sampai menutup Buku Kas Umum setiap bulan.');
P('Kami sengaja menulisnya dengan bahasa santai. Bayangkan sedang ngobrol dengan rekan yang sudah lebih dulu memakai aplikasinya: ia menjelaskan *kenapa* sesuatu dilakukan, bukan hanya *tombol mana* yang diklik.');

H2('1.1 Panduan dan tutorial: dua buku yang saling melengkapi');
P('ARKAS Web untuk sekolah punya dua buku pendamping dengan kerangka bab yang sama persis:');
TABEL(['', 'Buku Panduan (buku ini)', 'Buku Tutorial'], [
  ['Tujuan', 'Memahami konsep, aturan, dan alur kerja', 'Bisa mengerjakan langkah demi langkah'],
  ['Isi utama', 'Penjelasan, diagram alur, mind map, tabel aturan, tangkapan layar kunci', 'Urutan klik bernomor dengan tangkapan layar bertanda di setiap langkah'],
  ['Cocok dibaca', 'Sebelum mulai, saat rapat sosialisasi, atau saat bingung “kenapa begini?”', 'Sambil membuka aplikasi di depan komputer'],
], [1800, 3919, 3919]);
KOTAK('TIPS', 'Baca dulu bab yang sama di Buku Panduan, lalu praktikkan dengan Buku Tutorial. Nomor bab di kedua buku sama, jadi gampang berpindah.');

H2('1.2 Apa itu ARKAS Web?');
P('**ARKAS Web** (Aplikasi Rencana Kegiatan dan Anggaran Sekolah berbasis web) adalah aplikasi untuk mengelola dana sekolah dalam satu tempat. Karena berbasis web, kamu cukup membuka peramban (Chrome, Edge, Firefox) tanpa memasang aplikasi.');
P('Hal-hal yang membuat ARKAS Web berbeda dari cara lama:');
LI([
  '**Satu data untuk semua.** Operator, Bendahara, Kepala Sekolah, Komite, sampai Dinas melihat data yang sama secara langsung, tanpa kirim-kirim berkas.',
  '**Aturan juknis dicek otomatis.** Total anggaran, batas persentase komponen, dan perhitungan volume × harga diperiksa saat kamu mengetik.',
  '**Pajak dihitung otomatis** dari kode rekening belanja.',
  '**Setiap transaksi disetujui Kepala Sekolah** sebelum masuk saldo (pemisahan tugas).',
  '**Terhubung dengan SIPLah.** Belanja daring otomatis masuk ke ARKAS, tidak perlu diketik ulang.',
  '**Laporan dibuat otomatis** setelah buku ditutup, lalu ditandatangani Kepala Sekolah.',
  '**Semua perubahan tercatat** di jejak audit yang tidak bisa diubah.',
]);

H2('1.3 Siapa saja penggunanya?');
P('Setiap orang masuk dengan akunnya sendiri dan hanya melihat menu sesuai perannya. Gambar berikut merangkum siapa mengerjakan apa.');
GAMBAR('d01-peta-peran', 'Peran-peran di ARKAS Web dan tugas utamanya');
TABEL(['Peran', 'Bab yang paling penting'], [
  ['Operator Sekolah', 'Bab 2, Bab 3 (penganggaran)'],
  ['Bendahara', 'Bab 2, Bab 3c, Bab 4 (penatausahaan & pajak)'],
  ['Kepala Sekolah', 'Bab 2, Bab 3d–3g, Bab 4 (persetujuan & penutupan)'],
  ['Komite Sekolah', 'Bab 2, Bab 4a (membaca BKU & laporan)'],
], [3200, 6438]);

H2('1.4 Gambaran besar satu tahun anggaran');
P('Sebelum masuk ke detail, lihat dulu “peta besarnya”. Pekerjaan sekolah di ARKAS Web mengikuti urutan berikut, dan urutan bab di buku ini juga mengikuti peta ini.');
GAMBAR('d02-siklus-tahunan', 'Siklus satu tahun anggaran di ARKAS Web');
H2('1.5 Peta isi aplikasi (mind map)');
P('Mind map ini memperlihatkan menu dan pekerjaan utama di ARKAS Web. Simpan halaman ini sebagai “peta jalan”: kalau bingung sedang berada di bagian mana, kembali ke sini.');
GAMBAR('d03-mindmap-aplikasi', 'Mind map menu dan pekerjaan utama ARKAS Web untuk sekolah');

H2('1.6 Sekolah contoh di buku ini');
P('Semua contoh dan tangkapan layar diambil dari aplikasi yang berjalan sungguhan dengan satu “sekolah cerita”, supaya angka-angkanya nyambung dari bab ke bab.');
TABEL(['Data', 'Isi'], [
  ['Sekolah', 'SMP Swasta Contoh 2 · NPSN 20100002 · Kabupaten Contoh 2'],
  ['Dana', 'BOSP Reguler tahun 2026, pagu awal Rp12.000.000 (lalu ditetapkan ulang menjadi Rp13.500.000)'],
  ['Operator Sekolah', 'Dewi Lestari'],
  ['Bendahara', 'Ahmad Fauzi'],
  ['Kepala Sekolah', 'Hj. Siti Aminah, M.Pd.'],
  ['Komite Sekolah', 'Bambang Wijaya'],
  ['Verifikator Dinas', 'Rudi Setiawan (Dinas Pendidikan Kabupaten Contoh 2)'],
], [2600, 7038]);
H2('1.7 Cara membaca kotak-kotak di buku ini');
TABEL(['Kotak', 'Artinya'], [
  ['🧭 Di bab ini', 'Ringkasan isi bab'], ['💡 Tips', 'Cara lebih cepat atau kebiasaan baik'], ['⚠️ Penting', 'Hal yang bisa membuat pekerjaanmu ditolak bila terlewat'],
  ['📌 Ingat', 'Aturan yang sering terlupa'], ['✏️ Contoh', 'Contoh angka dari sekolah cerita'], ['✅ Cek pemahaman', 'Pertanyaan singkat untuk menguji diri'],
], [2600, 7038]);

// ====================================================================== BAB 2
H1('Memulai Aplikasi');
KOTAK('RINGKAS', ['Cara masuk, memilih peran, mengenali tampilan, dan menjaga keamanan akun.']);
H2('2.1 Yang perlu disiapkan');
LI([
  'Komputer atau laptop dengan peramban terbaru (Chrome, Edge, atau Firefox) dan koneksi internet.',
  'Akun SSO (Single Sign-On) dari pengelola akun. Peran dan sekolahmu sudah didaftarkan oleh Operator Sekolah atau Admin Dinas.',
  'Alamat ARKAS Web dari Dinas Pendidikan setempat.',
]);
H2('2.2 Masuk ke aplikasi');
P('Di sekolah, kamu cukup menekan [[Masuk dengan SSO]] lalu memakai akun SSO-mu. Kamu tidak perlu membuat kata sandi baru di ARKAS Web.');
GAMBAR('01-masuk', 'Halaman masuk. Di lingkungan uji coba muncul daftar akun contoh; di sekolah, tombolnya “Masuk dengan SSO”.', 13);
KOTAK('INGAT', 'Peran dan cakupan datamu (sekolah mana, wilayah mana) ditentukan oleh pengelola akun, bukan dipilih sendiri. Kalau menu yang kamu butuhkan tidak muncul, hubungi Operator Sekolah.');
H2('2.3 Peran aktif dan cara menggantinya');
P('Satu orang bisa memegang lebih dari satu peran, misalnya Bendahara sekaligus Operator di sekolah kecil. Setelah masuk, kamu memilih **peran aktif**. Menu dan tombol yang muncul mengikuti peran aktif tersebut.');
GAMBAR('02-pilih-peran', 'Memilih peran aktif setelah masuk', 13);
P('Peran bisa diganti kapan saja lewat kotak pilihan di pojok kanan atas, tanpa keluar dari aplikasi.');
GAMBAR('03-ganti-peran', 'Pemilih peran dan tombol Keluar di bagian atas setiap halaman');
H2('2.4 Mengenal tampilan');
P('Setiap halaman punya susunan yang sama: **kepala halaman** (nama aplikasi, judul, sekolah), **pemilih peran**, dan **menu modul** di bawahnya. Menu yang muncul berbeda untuk setiap peran.');
GAMBAR('04-beranda-operator', 'Tampilan pertama Operator saat kertas kerja tahun ini belum diaktifkan');
TABEL(['Menu', 'Isi', 'Terlihat oleh'], [
  ['Penganggaran (RKAS)', 'Kertas kerja, versi, kepatuhan juknis, riwayat', 'Semua peran sekolah'],
  ['Penatausahaan', 'BKU, BKP Tunai/Bank/Pajak, penutupan, laporan', 'Semua peran sekolah (Operator: lihat)'],
  ['HPP', 'Perbandingan rencana dengan belanja SIPLah', 'Semua peran sekolah'],
  ['Bantuan', 'Bantuan pemerintah yang diterima sekolah', 'Semua peran sekolah'],
  ['Kelola pengguna', 'Mendaftarkan akun warga sekolah', 'Operator'],
  ['Jejak audit', 'Riwayat perubahan data yang tidak bisa diubah', 'Kepala Sekolah'],
], [2600, 4438, 2600]);
GAMBAR('05-menu-kepsek', 'Menu yang dilihat Kepala Sekolah');
H2('2.5 Menjaga keamanan akun');
LI([
  'Jangan pernah meminjamkan akun. Setiap klik tercatat atas namamu di jejak audit.',
  'Selalu tekan [[Keluar]] bila memakai komputer bersama.',
  'Bendahara dan Kepala Sekolah **tidak boleh** dipegang orang yang sama: aplikasi menolak persetujuan oleh pembuat transaksinya sendiri.',
]);
KOTAK('CEK', ['Apa bedanya akun dan peran?', 'Di mana tempat mengganti peran aktif?', 'Mengapa akun tidak boleh dipinjamkan?']);

// ====================================================================== BAB 3
H1('Penganggaran');
KOTAK('RINGKAS', ['3a Apa itu kertas kerja & RKAS', '3b Pengaktifan', '3c Penyusunan', '3d Pengajuan', '3e Pengesahan', '3f Perubahan anggaran', '3g Pergeseran anggaran']);
H2('3a. Apa itu Kertas Kerja dan RKAS');
P('**Kertas kerja** adalah rancangan anggaran yang sedang kamu susun: daftar kegiatan, kode rekening, volume, harga, dan total. Selama masih disusun, kertas kerja boleh diubah-ubah.');
P('Begitu kertas kerja **disahkan oleh Dinas**, ia menjadi **RKAS** (Rencana Kegiatan dan Anggaran Sekolah) yang berlaku. RKAS menjadi “pagar” belanja: setiap belanja di BKU harus merujuk ke salah satu baris RKAS dan tidak boleh melebihi sisa anggarannya.');
H3('Istilah penting');
TABEL(['Istilah', 'Penjelasan', 'Contoh di sekolah cerita'], [
  ['Pagu', 'Total dana yang ditetapkan pemerintah untuk sekolah. Tidak bisa diubah sekolah.', 'Rp12.000.000'],
  ['Komponen BOSP', 'Kelompok kegiatan menurut juknis, diberi kode 2 digit', '03 Kegiatan pembelajaran'],
  ['Kode rekening', 'Jenis belanja; juga menentukan pajak', '5.1.02.01.01.0024 Alat Tulis Kantor'],
  ['Baris', 'Satu rincian belanja: uraian, volume, satuan, harga satuan', 'ATK 40 pak × Rp25.000'],
  ['Versi', 'Setiap perubahan setelah disahkan dibuat sebagai versi baru', 'Versi 1, Versi 2, Versi 3'],
], [2000, 4638, 3000]);
H3('Aturan juknis yang dicek otomatis');
TABEL(['Aturan', 'Arti', 'Pesan bila dilanggar'], [
  ['Total = pagu', 'Seluruh pagu harus dianggarkan, tidak kurang dan tidak lebih', '“Masih ada pagu yang belum dianggarkan” / “Total anggaran melebihi pagu”'],
  ['Batas komponen', 'Beberapa komponen dibatasi, mis. Pembayaran honor maksimal 20% pagu', '“Pembayaran honor: 20,83% melebihi batas 20% pagu”'],
  ['Volume × harga', 'Total baris harus sama dengan volume × harga satuan', 'Dihitung otomatis oleh aplikasi'],
  ['Nilai positif', 'Volume dan harga harus lebih dari nol', '“Volume dan harga satuan harus lebih dari nol”'],
  ['Tidak di bawah realisasi', 'Saat perubahan/pergeseran, baris tidak boleh lebih kecil dari yang sudah dibelanjakan', '“Total baris tidak boleh di bawah realisasinya”'],
], [2200, 4038, 3400]);
H3('Status kertas kerja');
P('Setiap versi kertas kerja selalu berada di salah satu status berikut. Status menentukan siapa boleh berbuat apa.');
GAMBAR('d05-status-kk', 'Status kertas kerja dan siapa yang memindahkannya');

H2('3b. Pengaktifan Kertas Kerja');
P('Setiap awal tahun anggaran, kertas kerja harus **diaktifkan** dulu. Pengaktifan membuat **Versi 1** berstatus **Draf**, terhubung dengan pagu sekolah tahun itu. Pengaktifan dilakukan oleh **Operator** atau **Bendahara**.');
LI([
  'Pengaktifan hanya bisa dilakukan bila pagu sekolah untuk tahun dan sumber dana tersebut sudah ditetapkan.',
  'Tombol [[Aktifkan kertas kerja]] muncul di halaman Penganggaran selama kertas kerja tahun itu belum ada.',
  'Setelah aktif, kartu **Pagu** di sisi kiri menunjukkan pagu, jumlah yang sudah dianggarkan, dan sisanya.',
]);
GAMBAR('06-kk-aktif', 'Kertas kerja Versi 1 setelah diaktifkan: pagu, sisa, dan tombol Tambah baris');

H2('3c. Penyusunan Kertas Kerja');
P('Menyusun kertas kerja berarti menambahkan **baris-baris belanja** sampai seluruh pagu habis dan semua aturan juknis terpenuhi. Setiap baris berisi enam isian: komponen BOSP, kode rekening, uraian, volume, satuan, dan harga satuan.');
GAMBAR('08-laci-isi', 'Isian satu baris kertas kerja (laci “Tambah baris RKAS”)', 15);
H3('Bilah kepatuhan juknis');
P('Di sisi kiri halaman ada **bilah kepatuhan**, satu untuk setiap komponen yang dipakai, lengkap dengan persentasenya terhadap pagu. Bilah berubah **merah** bila melewati batas, dan kotak **Belum dapat diajukan** menjelaskan apa yang harus diperbaiki.');
GAMBAR('10-komponen-melebihi', 'Komponen honor 20,83% melewati batas 20%: bilah merah dan daftar perbaikan');
KOTAK('CONTOH', 'Sekolah cerita sempat menganggarkan honor narasumber 2 × Rp1.250.000 = Rp2.500.000 (20,83% dari Rp12 juta). Setelah diubah menjadi 2 × Rp600.000, honor tinggal 10% dan bilahnya kembali biru.');
P('Kertas kerja siap diajukan bila muncul tanda **✓ Memenuhi aturan juknis** dan sisa pagu Rp0.');
GAMBAR('13-juknis-ok', 'Kertas kerja yang memenuhi semua aturan juknis');
H3('Rincian kertas kerja sekolah cerita (Versi 1)');
TABEL(['Komponen', 'Uraian', 'Rekening', 'Volume × harga', 'Total'], [
  ['03 Pembelajaran', 'Alat tulis kantor', '…0024', '46 pak × 25.000', '1.150.000'],
  ['03 Pembelajaran', 'Kertas HVS A4', '…0025', '30 rim × 50.000', '1.500.000'],
  ['04 Asesmen', 'Cetak soal PAS', '…0029', '300 eks × 3.500', '1.050.000'],
  ['04 Asesmen', 'Makan minum rapat penilaian', '…0052', '40 kotak × 25.000', '1.000.000'],
  ['05 Administrasi', 'Cetak rapor & sertifikat', '…0029', '160 lbr × 5.000', '800.000'],
  ['07 Daya & jasa', 'Langganan listrik', '…0001', '12 bln × 200.000', '2.400.000'],
  ['07 Daya & jasa', 'Langganan internet', '…0061', '12 bln × 150.000', '1.800.000'],
  ['08 Pemeliharaan', 'Servis AC & printer', '…0013', '2 kali × 250.000', '500.000'],
  ['08 Pemeliharaan', 'Jasa kebersihan', '…0026', '12 bln × 50.000', '600.000'],
  ['12 Honor', 'Narasumber in house training', '…0003', '2 org × 600.000', '1.200.000'],
  ['', '**Total = pagu**', '', '', '**12.000.000**'],
], [1900, 2700, 1100, 2100, 1838]);
KOTAK('TIPS', ['Susun per komponen, mulai dari kebutuhan rutin (listrik, internet), baru kegiatan.', 'Pakai harga yang sesuai standar harga daerah agar tidak dikembalikan Dinas.', 'Uraian yang jelas (“Kertas HVS A4 untuk pembelajaran”) memudahkan Bendahara mencari baris saat belanja.']);

H2('3d. Pengajuan Kertas Kerja');
P('Kertas kerja yang sudah lolos aturan juknis diajukan ke Dinas oleh **Kepala Sekolah**. Inilah bentuk tanggung jawab Kepala Sekolah atas rencana sekolah. Tombol [[Ajukan ke Dinas]] hanya aktif bila kertas kerja sudah memenuhi aturan.');
GAMBAR('14-ajukan', 'Kepala Sekolah mengajukan kertas kerja ke Dinas');
LI([
  'Setelah diajukan, status berubah menjadi **Diajukan ke Dinas** dan kertas kerja **terkunci**: tidak ada yang bisa mengubahnya.',
  'Kertas kerja masuk ke antrean penelaahan Verifikator Dinas di wilayahmu.',
  'Setiap aksi tercatat di bagian **Riwayat** (siapa, kapan, apa).',
]);

H2('3e. Pengesahan Kertas Kerja (RKAS)');
P('Verifikator Dinas menelaah kertas kerja. Ada dua kemungkinan hasilnya:');
TABEL(['Hasil', 'Yang terjadi', 'Yang harus dilakukan sekolah'], [
  ['**Dikembalikan**', 'Status kembali ke Draf, dengan alasan umum dan catatan per baris', 'Operator memperbaiki baris yang diberi catatan, lalu Kepala Sekolah mengajukan lagi'],
  ['**Disahkan**', 'Versi menjadi RKAS yang berlaku', 'Mulai mencatat transaksi di Penatausahaan'],
], [1800, 3919, 3919]);
GAMBAR('d04-alur-rkas', 'Alur penyusunan sampai pengesahan RKAS lintas peran');
GAMBAR('18-dikembalikan', 'Kertas kerja yang dikembalikan: alasan dari Dinas dan catatan per baris');
H3('Apa yang terjadi setelah RKAS disahkan?');
LI([
  'Periode Buku Kas Umum bulan berjalan **dibuka otomatis**, jadi Bendahara bisa mulai mencatat.',
  'Baris-baris RKAS menjadi pilihan saat mencatat belanja, lengkap dengan sisa anggarannya.',
  'Rencana dikirim ke **Mitra SIPLah**, sehingga sekolah bisa berbelanja daring sesuai sisa anggaran.',
  'Rencana dipakai sebagai pembanding di halaman **HPP**.',
]);
GAMBAR('20-disahkan', 'RKAS Versi 1 berstatus Disahkan beserta riwayat prosesnya');

H2('3f. Perubahan Anggaran');
P('**Perubahan anggaran** dilakukan bila **pagu sekolah berubah**, misalnya ada penetapan ulang, tambahan dana, atau SiLPA. Karena pagu berubah, total RKAS pun harus menyesuaikan dengan pagu baru.');
GAMBAR('d06-perubahan-pergeseran', 'Perbedaan perubahan anggaran dan pergeseran anggaran');
P('Caranya: Operator menekan [[Buat pergeseran/perubahan]]. Aplikasi menyalin RKAS yang berlaku menjadi **versi baru** berstatus Draf. Selisih pagu muncul sebagai “sisa pagu” yang harus dianggarkan, misalnya dengan menambah kegiatan baru. Setelah itu versi baru diajukan Kepala Sekolah dan disahkan Dinas. Versi lama otomatis berstatus **Diganti**.');
GAMBAR('58-versi2-draf', 'Pagu naik menjadi Rp13.500.000: versi 2 masih punya sisa Rp1.500.000');
KOTAK('CONTOH', 'Pagu sekolah cerita ditetapkan ulang dari Rp12.000.000 menjadi Rp13.500.000. Operator menambah kegiatan baru “Makan minum workshop KKG guru” (komponen 06) 60 kotak × Rp25.000 = Rp1.500.000, lalu versi 2 diajukan dan disahkan.');
GAMBAR('61-perubahan-disahkan', 'Versi 2 berlaku, Versi 1 berstatus Diganti');
KOTAK('INGAT', ['Selama ada versi Draf atau Diajukan, tombol perubahan tidak muncul. Selesaikan dulu versi yang sedang berjalan.', 'Transaksi yang sudah tercatat tidak hilang. Realisasinya ikut “pindah” ke baris yang sama di versi baru.']);

H2('3g. Pergeseran Anggaran');
P('**Pergeseran anggaran** adalah memindahkan nilai dari satu baris ke baris lain **tanpa mengubah pagu dan total RKAS**. Contohnya, kebutuhan cetak soal ternyata lebih sedikit, sementara biaya servis AC lebih besar dari perkiraan.');
TABEL(['Aturan pergeseran', 'Penjelasan'], [
  ['Total tetap = pagu', 'Jumlah yang dikurangi di satu baris harus ditambahkan di baris lain'],
  ['Tidak di bawah realisasi', 'Baris tidak boleh dikurangi lebih kecil dari yang sudah dibelanjakan dan disetujui'],
  ['Baris yang sudah dibelanjakan tidak bisa dihapus', 'Tombol Hapus hanya muncul untuk baris tanpa realisasi'],
  ['Batas komponen berlaku', 'Pergeseran tidak boleh membuat komponen melewati batasnya'],
  ['Tetap disahkan Dinas', 'Versi pergeseran diajukan Kepala Sekolah dan disahkan Verifikator'],
], [3300, 6338]);
GAMBAR('63-di-bawah-realisasi', 'Aplikasi menolak pengurangan baris di bawah realisasinya');
KOTAK('CONTOH', 'Cetak soal dikurangi dari 300 menjadi 240 eksemplar (−Rp210.000), lalu harga servis AC dinaikkan dari Rp250.000 menjadi Rp355.000 per kali (+Rp210.000). Totalnya tetap Rp13.500.000.');
GAMBAR('68-pergeseran-disahkan', 'Pergeseran (Versi 3) disahkan; kolom Realisasi menunjukkan yang sudah dibelanjakan');
KOTAK('CEK', ['Apa beda kertas kerja dengan RKAS?', 'Siapa yang mengajukan kertas kerja ke Dinas?', 'Kapan kamu membuat perubahan, dan kapan pergeseran?', 'Kenapa sebuah baris tidak bisa dikurangi saat pergeseran?']);

// ====================================================================== BAB 4
H1('Penatausahaan');
KOTAK('RINGKAS', ['4a BKU dan buku kas pembantu', '4b Pencatatan ke BKU: realisasi luring dan daring (SIPLah) sampai menjadi laporan', '4c Pencatatan perpajakan', '4d Penutupan BKU']);
H2('4a. Apa itu BKU dan Buku Kas Pembantu');
P('**Buku Kas Umum (BKU)** adalah catatan seluruh uang masuk dan keluar sekolah dari satu sumber dana, beserta saldonya. Agar lebih mudah diperiksa, BKU dirinci ke **Buku Kas Pembantu (BKP)**. Di ARKAS Web kamu cukup mencatat sekali; isi BKP terbentuk otomatis.');
GAMBAR('d11-mindmap-bku', 'BKU dan buku kas pembantunya');
TABEL(['Buku', 'Isi', 'Contoh'], [
  ['BKU', 'Semua transaksi dalam urutan tanggal, dengan saldo berjalan', 'Seluruh contoh di bawah'],
  ['BKP Tunai', 'Uang tunai di brankas sekolah', 'Tarik tunai Rp1.500.000'],
  ['BKP Bank', 'Uang di rekening sekolah', 'Penerimaan BOSP Rp6.000.000, belanja non-tunai'],
  ['BKP Pajak', 'Pajak yang dipungut dan disetor', 'PPN Rp24.774 dipungut lalu disetor'],
], [1600, 4519, 3519]);
GAMBAR('21-bku-awal', 'Halaman Penatausahaan: kartu ringkasan, tab buku, dan tombol pencatatan');
H3('Kartu ringkasan');
LI([
  '**Saldo tunai / Saldo bank**: saldo buku, beserta “tersedia” (sudah dikurangi transaksi yang menunggu persetujuan).',
  '**Realisasi terhadap pagu**: persentase belanja yang sudah disetujui dibanding pagu.',
  '**Periode berjalan**: bulan yang sedang terbuka untuk pencatatan, jumlah transaksi yang menunggu persetujuan, dan pajak yang belum disetor.',
]);
H3('Status transaksi');
GAMBAR('d07-alur-transaksi', 'Perjalanan satu transaksi: dicatat Bendahara, disetujui Kepala Sekolah');
KOTAK('PENTING', 'Transaksi yang **Menunggu persetujuan** belum mengubah saldo buku. Yang sudah **Disetujui** bersifat final dan tidak bisa diubah. Kesalahan dibetulkan dengan transaksi koreksi, bukan dengan mengedit.');

H2('4b. Dari pencatatan BKU sampai laporan sekolah');
P('Laporan keuangan sekolah **dimulai dari pencatatan di BKU**. Setiap transaksi yang dicatat dan disetujui akan mengalir ke BKP, mengurangi sisa anggaran RKAS, dibandingkan di HPP, lalu dirangkum dalam laporan BKU bulanan saat buku ditutup. Jadi, kualitas laporan sangat ditentukan oleh ketelitian pencatatan sehari-hari.');
H3('Prinsip pencatatan');
LI([
  '**Ada bukti, baru dicatat.** Nota, kuitansi, bukti transfer, atau invoice SIPLah.',
  '**Tanggal sesuai bukti** dan masih di periode yang terbuka (tidak boleh tanggal masa depan).',
  '**Belanja harus merujuk baris RKAS** dan tidak melebihi sisa anggarannya.',
  '**Saldo harus cukup.** Belanja tunai butuh saldo tunai; kalau kurang, catat tarik tunai lebih dulu.',
]);
H3('Uang masuk: penerimaan dan tarik tunai');
P('Dana BOSP masuk ke rekening sekolah dicatat sebagai **penerimaan** (masuk BKP Bank). Bila butuh uang tunai, catat **tarik tunai**: saldo bank berkurang dan saldo tunai bertambah. Untuk kebalikannya, gunakan **setor tunai**.');
GAMBAR('25-saldo-bank', 'Setelah penerimaan disetujui, saldo bank bertambah');
H3('Realisasi luring dan daring');
P('Belanja bisa dilakukan dengan dua cara. Keduanya berakhir di BKU yang sama.');
GAMBAR('d08-luring-daring', 'Pencatatan realisasi luring (wizard belanja) dan daring (SIPLah)');
TABEL(['', 'Luring', 'Daring (SIPLah)'], [
  ['Tempat belanja', 'Toko/penyedia langsung', 'Aplikasi Mitra SIPLah'],
  ['Siapa mengetik data', 'Bendahara (wizard 3 langkah)', 'Dikirim otomatis oleh Mitra'],
  ['Cara bayar', 'Tunai atau non-tunai', 'Non-tunai'],
  ['Baris RKAS', 'Dipilih Bendahara di langkah 2', 'Dari Mitra; barang tanpa kode dipetakan Bendahara'],
  ['Pajak', 'Dihitung otomatis di langkah 3', 'Dihitung otomatis oleh ARKAS'],
  ['Persetujuan', 'Kepala Sekolah', 'Kepala Sekolah'],
  ['Bila batal', 'Kepala Sekolah menolak', 'Pembatalan/retur dari Mitra tampil sebagai peringatan'],
], [2200, 3719, 3719]);
GAMBAR('31-belanja-langkah3-pajak', 'Belanja luring, langkah 3: pajak dihitung otomatis', 15);
GAMBAR('35-siplah-masuk', 'Belanja daring dari SIPLah masuk sendiri ke panel “Transaksi SIPLah”');
KOTAK('INGAT', ['Mitra SIPLah hanya bisa menerima pesanan bila RKAS sekolah sudah disahkan dan sumber dananya dibuka di Mitra.', 'Sisa anggaran yang dilihat Mitra mengikuti RKAS, jadi sekolah tidak bisa berbelanja melebihi rencananya.']);
H3('Persetujuan dan penolakan oleh Kepala Sekolah');
P('Kepala Sekolah memeriksa setiap transaksi, dengan bukti fisik di tangan, sebelum menekan [[Setujui]]. Bila bukti kurang lengkap, Kepala Sekolah menekan [[Tolak]] dan menuliskan alasannya. Transaksi yang ditolak tidak masuk BKU dan muncul di panel **Transaksi ditolak** milik Bendahara, lengkap dengan tombol [[Catat ulang]].');
GAMBAR('34-ditolak', 'Transaksi ditolak beserta alasannya; Bendahara bisa mencatat ulang');
H3('HPP: rencana dibanding belanja SIPLah');
P('Halaman **HPP** (Halaman Pemetaan Pembelanjaan) membandingkan setiap baris RKAS dengan belanja SIPLah dalam empat kategori: **Sesuai rencana**, **Melebihi rencana**, **Di luar rencana** (barang tidak ada di RKAS), dan **Belum dibelanjakan**. Dinas dan pusat juga memantau halaman ini.');
GAMBAR('38-hpp', 'Halaman HPP sekolah');

H2('4c. Pencatatan Perpajakan');
P('Sekolah berperan sebagai **pemungut/pemotong pajak** untuk belanja tertentu. Kabar baiknya, Bendahara tidak perlu menghitung sendiri: ARKAS Web menghitung pajak dari **kode rekening** baris RKAS yang dipilih dan dari status **NPWP** penyedia.');
GAMBAR('d09-alur-pajak', 'Alur perpajakan: dipungut otomatis, disetor dengan NTPN');
TABEL(['Jenis pajak', 'Dikenakan pada (contoh rekening)', 'Tarif', 'Cara hitung'], [
  ['PPN', 'Barang/jasa kena pajak: ATK (0024), bahan cetak (0029), jasa kebersihan (0026)', '11%', 'Harga dianggap sudah termasuk PPN: DPP = harga ÷ 1,11; PPN = DPP × 11%'],
  ['PPh 23', 'Jasa: servis (0013), kebersihan (0026)', '2% (4% tanpa NPWP)', 'Dari DPP (bila juga kena PPN) atau dari harga'],
  ['PPh 21', 'Honor orang pribadi, mis. narasumber (0003)', '5% (6% tanpa NPWP)', 'Dari nilai honor'],
  ['Pajak daerah (SSPD)', 'Makan minum (0052)', 'Sesuai Perda; nasional 10%', 'Dari harga'],
], [1700, 3700, 1700, 2538]);
KOTAK('CONTOH', 'Belanja ATK Rp250.000 di Toko Sinar Pelajar: DPP = 250.000 ÷ 1,11 = Rp225.225,23, PPN = Rp24.774 (dibulatkan ke bawah). Yang dibayar ke toko Rp225.226, dan PPN Rp24.774 disetor sekolah ke kas negara.');
P('Pajak yang sudah dipungut tampil di tab **BKP Pajak**, bagian **Pajak belum disetor**. Setelah menyetor lewat bank, kantor pos, atau e-billing, Bendahara mencatat setoran dengan **NTPN** (16 karakter dari bukti setor). Setoran juga disetujui Kepala Sekolah, lalu saldo pajak kembali Rp0.');
GAMBAR('43-bkp-pajak', 'BKP Pajak: pungutan dan setoran tercatat berdampingan');
KOTAK('PENTING', ['Setor pajak sesuai batas waktu ketentuan perpajakan yang berlaku (umumnya paling lambat pertengahan bulan berikutnya). Tanyakan ke KPP setempat bila ragu.', 'Satu setoran untuk satu jenis pajak. Centang hanya pajak yang sejenis.', 'NTPN harus 16 karakter huruf/angka dan tidak boleh dipakai dua kali.']);

H2('4d. Penutupan BKU');
P('Setiap akhir bulan, BKU **ditutup**. Penutupan memastikan catatan di aplikasi sama dengan kenyataan: saldo bank sama dengan rekening koran, dan saldo tunai sama dengan uang di brankas. Setelah ditutup, transaksi bulan itu tidak bisa diubah lagi, laporan PDF dibuat otomatis, dan bulan berikutnya terbuka.');
GAMBAR('d10-alur-tutup-buku', 'Alur penutupan BKU setiap bulan');
TABEL(['Syarat penutupan', 'Penjelasan'], [
  ['Bulan sudah berakhir', 'Penutupan dilakukan setelah akhir bulan (di lingkungan uji coba boleh lebih awal)'],
  ['Semua transaksi sudah diputuskan', 'Tidak ada yang menunggu persetujuan Kepala Sekolah'],
  ['Periode sebelumnya sudah ditutup', 'Penutupan berurutan bulan demi bulan'],
  ['Rekonsiliasi diisi', 'Saldo rekening koran akhir bulan dan hasil hitung kas fisik'],
  ['Selisih dijelaskan', 'Bila ada selisih bank atau kas, penjelasannya wajib diisi'],
], [3300, 6338]);
GAMBAR('47-tutup-selisih', 'Ada selisih bank Rp6.500: penjelasan wajib diisi sebelum mengajukan');
P('Bendahara **mengajukan** penutupan, lalu **Kepala Sekolah** memeriksa **berita acara pemeriksaan kas** dan menekan [[Setujui & tutup buku]]. Bila ada yang janggal, Kepala Sekolah bisa mengembalikannya ke Bendahara.');
GAMBAR('50-kepsek-berita-acara', 'Kepala Sekolah memeriksa berita acara sebelum menutup buku');
H3('Laporan BKU bulanan');
P('Begitu buku ditutup, ARKAS Web membuat **Laporan BKU** dalam format PDF: ringkasan per buku (tunai, bank, pajak) dan rincian transaksi. Kepala Sekolah menandatangani laporan, dan setelah itu laporan menjadi final. Komite Sekolah juga bisa membuka laporan ini.');
GAMBAR('56-laporan-pdf', 'Laporan BKU November 2026 (PDF) hasil penutupan', 14);
KOTAK('INGAT', 'Di lingkungan uji coba, tanda tangan masih **simulasi** (ada tulisan “bukan TTE yang sah”). Di sekolah, tanda tangan memakai TTE resmi.');
KOTAK('CEK', ['Kenapa transaksi yang menunggu persetujuan belum mengubah saldo?', 'Apa beda belanja luring dan daring dalam pencatatan?', 'Dari mana ARKAS tahu pajak apa yang dipungut?', 'Apa saja syarat sebelum buku bisa ditutup?']);

// ====================================================================== BAB 5
H1('Permasalahan dan Solusi');
KOTAK('RINGKAS', ['Kumpulan masalah yang paling sering muncul, penyebabnya, dan cara mengatasinya. Pesan di kolom pertama sama dengan yang tampil di aplikasi.']);
H2('5.1 Masuk dan akun');
TABEL(['Masalah / pesan', 'Penyebab', 'Solusi'], [
  ['Menu yang dibutuhkan tidak muncul', 'Peran aktif salah atau peran belum diberikan', 'Ganti peran di pojok kanan atas; bila tetap tidak ada, minta Operator menambahkan peran'],
  ['“Sesi tidak ada, kedaluwarsa, atau sudah keluar”', 'Terlalu lama tidak aktif', 'Masuk kembali dengan SSO'],
  ['Data sekolah lain tidak bisa dibuka (403)', 'Memang di luar cakupan peranmu', 'Normal, demi keamanan data'],
], [3000, 3100, 3538]);
H2('5.2 Penganggaran');
TABEL(['Masalah / pesan', 'Penyebab', 'Solusi'], [
  ['“Masih ada pagu yang belum dianggarkan”', 'Total baris < pagu', 'Tambah baris atau naikkan volume/harga sampai sisa Rp0'],
  ['“Total anggaran melebihi pagu” / baris ditolak saat disimpan', 'Total baris > pagu', 'Kurangi volume/harga atau hapus baris'],
  ['“…% melebihi batas …% pagu” (bilah merah)', 'Komponen melewati batas juknis', 'Kurangi baris pada komponen tersebut'],
  ['Tombol Ajukan ke Dinas abu-abu', 'Belum memenuhi aturan juknis, atau bukan Kepala Sekolah', 'Perbaiki daftar di kotak “Belum dapat diajukan”; minta Kepala Sekolah yang mengajukan'],
  ['Kertas kerja dikembalikan Dinas', 'Ada yang tidak sesuai menurut Verifikator', 'Baca alasan & catatan per baris, perbaiki, ajukan lagi'],
  ['Tombol Buat pergeseran/perubahan tidak ada', 'Masih ada versi Draf/Diajukan, atau bukan Operator/Bendahara', 'Selesaikan versi yang sedang berjalan dulu'],
  ['“Total baris tidak boleh di bawah realisasinya”', 'Mengurangi baris yang sudah dibelanjakan', 'Kurangi baris lain yang sisanya masih ada'],
  ['“Kode rekening … tidak dikenal”', 'Kode rekening dinonaktifkan pusat', 'Pilih kode rekening lain yang masih berlaku'],
], [3000, 3100, 3538]);
GAMBAR('10-komponen-melebihi', 'Contoh pesan kepatuhan juknis');
H2('5.3 Penatausahaan dan SIPLah');
TABEL(['Masalah / pesan', 'Penyebab', 'Solusi'], [
  ['“Periode bulan … belum dibuka (RKAS belum disahkan?)”', 'RKAS belum disahkan atau tanggal di luar periode', 'Tunggu pengesahan RKAS; cek tanggal transaksi'],
  ['“Periode buku kas sudah ditutup”', 'Tanggal jatuh di bulan yang sudah ditutup', 'Catat dengan tanggal di periode yang masih Buka'],
  ['“Tanggal transaksi tidak boleh melewati hari ini”', 'Tanggal masa depan', 'Gunakan tanggal bukti yang sebenarnya'],
  ['“Saldo tunai tidak cukup”', 'Belanja tunai melebihi saldo tunai', 'Catat tarik tunai lebih dulu (aplikasi menawarkan tombolnya)'],
  ['“Belanja … melebihi sisa anggaran”', 'Melebihi sisa baris RKAS', 'Gunakan baris lain, atau lakukan pergeseran'],
  ['Transaksi ditolak Kepala Sekolah', 'Bukti/isian kurang tepat', 'Baca alasannya di panel “Transaksi ditolak” → Catat ulang'],
  ['Transaksi SIPLah tidak bisa dicatat (“1 barang belum dipetakan”)', 'Barang dari Mitra belum punya baris RKAS', 'Pilih baris RKAS untuk barang tersebut (★ = kode rekening sama)'],
  ['Peringatan “Pesanan … dibatalkan/diretur di Mitra”', 'Pesanan batal setelah dicatat', 'Bila belum disetujui: Kepala Sekolah menolak; bila sudah: catat pengembalian dana sebagai penerimaan'],
], [3000, 3100, 3538]);
GAMBAR('34-ditolak', 'Panel transaksi ditolak');
H2('5.4 Pajak dan penutupan');
TABEL(['Masalah / pesan', 'Penyebab', 'Solusi'], [
  ['Tombol Catat setor tidak aktif', 'Belum ada pajak yang dicentang', 'Centang pajak yang sejenis di “Pajak belum disetor”'],
  ['NTPN ditolak', 'Bukan 16 karakter atau sudah dipakai', 'Salin persis dari bukti setor'],
  ['Pajak salah karena NPWP', 'Isian NPWP penyedia keliru', 'Minta Kepala Sekolah menolak, lalu catat ulang dengan isian NPWP yang benar'],
  ['“Masih ada transaksi menunggu persetujuan”', 'Belum semua diputuskan Kepala Sekolah', 'Minta Kepala Sekolah menyetujui/menolak semuanya'],
  ['Ada selisih bank/kas', 'Biaya admin bank, bunga, salah catat', 'Isi penjelasannya; catat transaksi yang terlewat bila perlu'],
  ['“Periode sebelumnya belum ditutup”', 'Penutupan harus berurutan', 'Tutup bulan sebelumnya dulu'],
  ['Laporan belum muncul', 'Laporan masih dibuat sistem', 'Tunggu beberapa saat lalu muat ulang tab Laporan'],
], [3000, 3100, 3538]);
GAMBAR('47-tutup-selisih', 'Selisih bank wajib dijelaskan');
KOTAK('TIPS', 'Masih buntu? Catat pesan yang muncul (atau ambil tangkapan layar), sebutkan menu dan langkah yang sedang dikerjakan, lalu hubungi Operator Sekolah atau Dinas Pendidikan setempat.');

// ====================================================================== BAB 6
H1('Penutup');
P('Selamat, kamu sudah mengenal seluruh perjalanan dana BOSP di ARKAS Web: menyusun kertas kerja, mengesahkan RKAS, mencatat setiap rupiah di BKU, memungut dan menyetor pajak, sampai menutup buku dan menghasilkan laporan bertanda tangan.');
P('Tiga kebiasaan yang membuat pekerjaanmu ringan:');
OL([
  '**Catat setiap hari, jangan menumpuk di akhir bulan.** Bukti masih segar dan saldo selalu cocok.',
  '**Rencana yang baik memudahkan pencatatan.** Uraian RKAS yang jelas memudahkan memilih baris saat belanja.',
  '**Tutup buku tepat waktu.** Laporan rapi, Dinas tenang, Komite percaya.',
]);
P('Untuk berlatih langkah demi langkah, buka **Buku Tutorial ARKAS Web untuk Sekolah**. Urutan babnya sama dengan buku ini.');
KOTAK('INGAT', 'Buku ini disusun dari ARKAS Web versi uji coba (November 2026). Tampilan di sekolahmu bisa sedikit berbeda setelah aplikasi diperbarui, tetapi konsep dan alurnya tetap sama.');
P('Terima kasih, dan selamat mengelola dana sekolah dengan rapi, transparan, dan akuntabel!');

// ====================================================================== BAB 7
H1('Glosarium');
TABEL(['Istilah', 'Arti'], GLOSARIUM, [2900, 6738]);

B.simpan('Buku-Panduan-ARKAS-Web-Sekolah.docx', { judul: 'Buku Panduan ARKAS Web untuk Sekolah', deskripsi: 'Konsep, aturan, dan alur penganggaran & penatausahaan ARKAS Web untuk sekolah', sampulPng: path.join(__dirname, 'diagram', 'sampul-panduan.png') });
