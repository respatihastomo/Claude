// Buku Panduan ARKAS Web untuk Sekolah — memahami konsep, aturan, dan alur. node buat-panduan-sekolah.cjs
const path = require('path');
const { buatBuku, GLOSARIUM } = require('./lib-buku.cjs');
const B = buatBuku('Buku Panduan ARKAS Web untuk Sekolah');
const { H1, H2, H3, P, LI, OL, GAMBAR, KOTAK, TABEL } = B;

// ====================================================================== BAB 1
H1('Pendahuluan');
KOTAK('RINGKAS', ['Buku apa ini, aplikasinya untuk apa, siapa saja yang memakainya, dan seperti apa gambaran satu tahun kerja sekolah di dalamnya.']);
P('Halo! Senang kamu membuka buku ini. 👋');
P('Kalau kamu baru ditunjuk jadi Operator atau Bendahara, atau baru saja dikasih akun ARKAS Web dan bingung harus mulai dari mana — tenang, kamu sedang memegang buku yang tepat. Kita akan jalan pelan-pelan dari nol.');
P('Satu hal yang ingin kami tegaskan di awal: **ARKAS Web itu tidak sulit.** Yang sering bikin pusing bukan aplikasinya, melainkan istilah-istilahnya: pagu, juknis, kertas kerja, BKU, DPP, NTPN. Di buku ini semuanya dijelaskan dengan bahasa sehari-hari dulu, baru istilah resminya.');
P('Jadi, anggap saja buku ini teman ngobrol yang sudah lebih dulu memakai aplikasinya. Ia tidak cuma bilang "klik tombol ini", tapi juga cerita *kenapa* tombol itu ada.');

H2('1.1 Dua buku, satu kerangka');
P('Buku pendamping ARKAS Web untuk sekolah ada dua, dan nomor babnya sama persis. Jadi kamu bisa lompat-lompat di antara keduanya tanpa tersesat.');
TABEL(['', 'Buku Panduan (yang kamu pegang)', 'Buku Tutorial'], [
  ['Buat apa', 'Supaya kamu **paham**', 'Supaya kamu **bisa**'],
  ['Isinya', 'Cerita, diagram alur, mind map, tabel aturan, dan potret bagian layar', 'Urutan klik bernomor dengan tangkapan layar di tiap langkah'],
  ['Enaknya dibaca', 'Sambil ngopi, sebelum praktik, atau saat bertanya-tanya "kok begini, ya?"', 'Sambil duduk di depan komputer, aplikasi terbuka'],
], [1700, 3969, 3969]);
KOTAK('TIPS', 'Resep yang paling enak: baca satu bab di buku ini, langsung praktikkan bab yang sama di Buku Tutorial. Sekali putaran, satu topik tuntas.');

H2('1.2 Apa sih ARKAS Web itu?');
P('Gampangnya: **ARKAS Web adalah buku anggaran dan buku kas sekolah yang pindah ke internet.** Tidak ada yang perlu dipasang di komputer — cukup buka Chrome, Edge, atau Firefox, lalu masuk.');
P('Lalu apa bedanya dengan cara lama yang pakai berkas bolak-balik lewat flashdisk atau surel? Ini yang paling terasa:');
LI([
  '**Datanya cuma satu.** Operator, Bendahara, Kepala Sekolah, Komite, sampai Dinas melihat angka yang sama, saat itu juga. Tidak ada lagi drama "ini versi yang mana, ya?"',
  '**Aturan juknis dicek sambil kamu mengetik.** Kalau honor melewati batas, aplikasi langsung bilang — tidak perlu menunggu ditegur Dinas.',
  '**Pajak dihitung sendiri** oleh aplikasi, berdasarkan kode rekening belanja. Kamu tinggal menyetor.',
  '**Kepala Sekolah menyetujui setiap transaksi** sebelum masuk saldo. Jadi tidak ada uang yang bergerak tanpa sepengetahuan beliau.',
  '**Belanja SIPLah masuk sendiri.** Tidak perlu diketik ulang.',
  '**Laporan jadi otomatis** setelah buku ditutup, tinggal ditandatangani.',
  '**Semua jejak tersimpan.** Siapa mengubah apa dan kapan, tercatat rapi dan tidak bisa dihapus.',
]);
KOTAK('TIPS', 'Poin terakhir itu sebenarnya kabar baik buat kamu: kalau suatu hari ada yang bertanya "kok angkanya begini?", jejaknya ada, dan kamu tidak perlu mengingat-ingat sendiri.');

H2('1.3 Siapa saja yang main di sini?');
P('Setiap orang masuk dengan akunnya sendiri, dan menu yang muncul mengikuti perannya. Jadi jangan heran kalau menu di layarmu berbeda dengan menu di layar teman sebelah — memang begitu seharusnya.');
GAMBAR('d01-peta-peran', 'Siapa mengerjakan apa di ARKAS Web');
TABEL(['Kalau kamu…', 'Bab yang paling sering kamu buka'], [
  ['Operator Sekolah', 'Bab 2 dan Bab 3 (penganggaran)'],
  ['Bendahara', 'Bab 2, Bab 3c, dan seluruh Bab 4 (pencatatan & pajak)'],
  ['Kepala Sekolah', 'Bab 2, Bab 3d–3g, Bab 4 (persetujuan & penutupan)'],
  ['Komite Sekolah', 'Bab 2 dan Bab 4a (membaca BKU & laporan)'],
], [3200, 6438]);

H2('1.4 Satu tahun kerja dalam satu gambar');
P('Sebelum menyelam ke detail, lihat dulu peta besarnya. Urutan bab di buku ini mengikuti urutan di gambar ini, jadi kamu selalu tahu sedang berada di sebelah mana.');
GAMBAR('d02-siklus-tahunan', 'Siklus satu tahun anggaran di ARKAS Web');
H2('1.5 Peta isi aplikasi');
P('Kalau suatu saat kamu merasa "lho, ini bagian apa?", kembali saja ke mind map ini. Anggap ini peta jalannya.');
GAMBAR('d03-mindmap-aplikasi', 'Mind map menu dan pekerjaan utama ARKAS Web');

H2('1.6 Kenalan dengan sekolah cerita kita');
P('Semua contoh di buku ini diambil dari aplikasi yang benar-benar berjalan, dengan satu sekolah yang kita ikuti dari awal sampai akhir. Jadi angkanya nyambung dari bab ke bab, bukan contoh karangan yang berganti-ganti.');
TABEL(['Data', 'Isi'], [
  ['Sekolah', 'SMP Swasta Contoh 2 · NPSN 20100002 · Kabupaten Contoh 2'],
  ['Dana', 'BOSP Reguler 2026, pagu awal Rp12.000.000 (belakangan naik jadi Rp13.500.000)'],
  ['Operator Sekolah', 'Dewi Lestari'],
  ['Bendahara', 'Ahmad Fauzi'],
  ['Kepala Sekolah', 'Hj. Siti Aminah, M.Pd.'],
  ['Komite Sekolah', 'Bambang Wijaya'],
  ['Verifikator Dinas', 'Rudi Setiawan (Dinas Pendidikan Kabupaten Contoh 2)'],
], [2600, 7038]);
H2('1.7 Arti kotak-kotak warna-warni di buku ini');
TABEL(['Kotak', 'Artinya'], [
  ['🧭 Di bab ini', 'Ringkasan isi bab — baca ini dulu kalau sedang buru-buru'],
  ['💡 Tips', 'Cara yang lebih cepat, atau kebiasaan baik yang bikin hidup lebih tenang'],
  ['⚠️ Penting', 'Kalau terlewat, pekerjaanmu bisa ditolak atau harus diulang'],
  ['📌 Ingat', 'Aturan yang paling sering terlupa'],
  ['✏️ Contoh', 'Angka asli dari sekolah cerita kita'],
  ['✅ Cek pemahaman', 'Pertanyaan singkat untuk menguji diri sendiri'],
], [2600, 7038]);

// ====================================================================== BAB 2
H1('Memulai Aplikasi');
KOTAK('RINGKAS', ['Cara masuk, urusan peran, mengenali tampilan, dan satu-dua kebiasaan supaya akunmu aman.']);
GAMBAR('d12-mindmap-memulai', 'Peta Bab 2');
H2('2.1 Yang perlu disiapkan');
LI([
  'Komputer atau laptop dengan peramban yang cukup baru (Chrome, Edge, Firefox) dan internet yang lumayan stabil.',
  'Akun SSO dari pengelola akun. Kamu tidak membuat akun sendiri, dan tidak perlu kata sandi baru khusus ARKAS.',
  'Alamat ARKAS Web dari Dinas Pendidikan setempat. Simpan di penanda (bookmark) supaya tidak hilang.',
]);
H2('2.2 Masuk ke aplikasi');
P('Tekan [[Masuk dengan SSO]], masukkan akun SSO-mu, selesai. Tidak ada pendaftaran, tidak ada kata sandi tambahan.');
GAMBAR('01-masuk', 'Halaman masuk. Di lingkungan uji coba yang muncul daftar akun contoh; di sekolahmu yang muncul tombol “Masuk dengan SSO”.', 13);
KOTAK('INGAT', 'Peranmu dan sekolah mana yang boleh kamu buka itu sudah ditentukan pengelola akun, bukan dipilih sendiri. Jadi kalau menu yang kamu cari tidak kelihatan, jangan dicari-cari di pengaturan — hubungi saja Operator Sekolah.');
H2('2.3 Peran aktif: satu orang boleh punya beberapa topi');
P('Di sekolah kecil, satu orang sering merangkap: Bendahara sekaligus Operator, misalnya. ARKAS Web mengizinkan itu. Yang perlu kamu lakukan cuma memilih **peran aktif** — ibaratnya memilih topi mana yang sedang dipakai. Menu akan menyesuaikan.');
GAMBAR('02-pilih-peran', 'Memilih peran aktif setelah masuk', 13);
P('Mau ganti topi? Tidak usah keluar dari aplikasi. Kotak pilihan di pojok kanan atas itulah tempatnya.');
GAMBAR('e20-pemilih-peran', 'Pemilih peran dan tombol Keluar, selalu ada di pojok kanan atas', 12);
H2('2.4 Mengenal tampilan');
P('Kabar baiknya, semua halaman bentuknya mirip: kepala halaman di atas (nama aplikasi, judul, nama sekolah), pemilih peran di kanan, lalu menu modul di bawahnya.');
GAMBAR('e21-menu-modul', 'Menu modul — isinya berbeda untuk tiap peran', 16.5);
TABEL(['Menu', 'Isi', 'Dilihat oleh'], [
  ['Penganggaran (RKAS)', 'Kertas kerja, versi, kepatuhan juknis, riwayat', 'Semua peran sekolah'],
  ['Penatausahaan', 'BKU, BKP Tunai/Bank/Pajak, penutupan, laporan', 'Semua peran sekolah (Operator hanya melihat)'],
  ['HPP', 'Perbandingan rencana dengan belanja SIPLah', 'Semua peran sekolah'],
  ['Bantuan', 'Bantuan pemerintah yang diterima sekolah', 'Semua peran sekolah'],
  ['Kelola pengguna', 'Mendaftarkan akun warga sekolah', 'Operator'],
  ['Jejak audit', 'Riwayat perubahan yang tidak bisa diutak-atik', 'Kepala Sekolah'],
], [2600, 4438, 2600]);
GAMBAR('04-beranda-operator', 'Tampilan pertama Operator di awal tahun: kertas kerja belum diaktifkan');
H2('2.5 Tiga kebiasaan supaya aman');
LI([
  '**Jangan pinjamkan akun.** Setiap klik tercatat atas namamu. Kalau ada apa-apa, namamu yang muncul di jejak audit.',
  '**Tekan [[Keluar]]** kalau meninggalkan komputer bersama, walau cuma sebentar.',
  '**Bendahara dan Kepala Sekolah jangan orang yang sama.** Aplikasi memang menolak orang menyetujui transaksinya sendiri — dan itu memang untuk melindungi kamu.',
]);
KOTAK('CEK', ['Apa bedanya akun dan peran?', 'Di mana tempat mengganti peran aktif?', 'Kenapa akun tidak boleh dipinjamkan?']);

// ====================================================================== BAB 3
H1('Penganggaran');
KOTAK('RINGKAS', ['3a Kertas kerja & RKAS itu apa', '3b Pengaktifan', '3c Penyusunan', '3d Pengajuan', '3e Pengesahan', '3f Perubahan anggaran', '3g Pergeseran anggaran']);
GAMBAR('d13-mindmap-penganggaran', 'Peta Bab 3');

H2('3a. Apa itu Kertas Kerja dan RKAS');
P('**Kertas kerja** itu rancangan. Masih boleh dicoret-coret, ditambah, dikurangi, sesuka hati — selama belum diajukan.');
P('Begitu Dinas mengesahkannya, kertas kerja berubah status menjadi **RKAS**, dan sifatnya langsung berbeda: ia jadi pagar. Setiap belanja nanti harus menunjuk ke salah satu baris RKAS, dan tidak boleh melebihi sisa anggaran baris itu.');
P('Analoginya seperti daftar belanja bulanan yang sudah disepakati sekeluarga: selama masih dibahas boleh diubah, tapi begitu disepakati, belanjanya ya mengikuti daftar itu.');
H3('Istilah yang wajib kamu kenal');
TABEL(['Istilah', 'Bahasa sehari-harinya', 'Contoh di sekolah cerita'], [
  ['Pagu', 'Jatah dana dari pemerintah. Sekolah tidak bisa mengubahnya.', 'Rp12.000.000'],
  ['Komponen BOSP', 'Kelompok kegiatan menurut juknis, berkode dua digit', '03 Kegiatan pembelajaran'],
  ['Kode rekening', 'Jenis belanja — sekaligus penentu pajaknya', '5.1.02.01.01.0024 Alat Tulis Kantor'],
  ['Baris', 'Satu rincian belanja: uraian, volume, satuan, harga', 'ATK 46 pak × Rp25.000'],
  ['Versi', 'Setiap kali RKAS diubah, lahir versi baru', 'Versi 1, 2, 3'],
], [1900, 4738, 3000]);
H3('Bagian-bagian halaman Penganggaran');
P('Begitu kertas kerja aktif, halaman Penganggaran isinya kurang lebih empat hal. Kenali satu per satu, nanti sisanya gampang.');
P('**Pertama, kartu Pagu** di kiri atas. Ini papan skor kamu: berapa jatahnya, berapa yang sudah dianggarkan, dan berapa sisanya. Target akhirnya satu: sisa **Rp0**.');
GAMBAR('e01-kartu-pagu', 'Kartu Pagu — target akhirnya sisa Rp0', 12.5);
P('**Kedua, bilah per komponen.** Setiap komponen yang kamu pakai muncul dengan persentasenya terhadap pagu. Kalau ada batas juknis, batasnya ikut ditulis.');
GAMBAR('e02-bilah-komponen', 'Bilah kepatuhan per komponen; honor dibatasi 20%', 9.5);
P('**Ketiga, kotak kepatuhan.** Hijau artinya aman. Kalau masih kuning, isinya daftar pekerjaan rumah yang harus kamu beresin dulu.');
GAMBAR('e03-kotak-juknis', 'Kotak hijau: kertas kerja siap diajukan', 12.5);
P('**Keempat, tab versi** di atas. Dari sini kamu berpindah antarversi sekaligus melihat statusnya.');
GAMBAR('e04-tab-versi', 'Tab versi beserta statusnya', 15);
P('Di bagian bawah halaman ada **Riwayat**: catatan siapa mengajukan, siapa mengembalikan, siapa mengesahkan, lengkap dengan jam dan menitnya.');
GAMBAR('e06-riwayat', 'Riwayat kertas kerja', 16.5);
H3('Aturan yang dicek otomatis');
TABEL(['Aturan', 'Maksudnya', 'Pesan kalau dilanggar'], [
  ['Total = pagu', 'Pagu harus habis dianggarkan. Tidak kurang, tidak lebih.', '“Masih ada pagu yang belum dianggarkan” / “Total anggaran melebihi pagu”'],
  ['Batas komponen', 'Beberapa komponen dibatasi, mis. honor maksimal 20% pagu', '“Pembayaran honor: 20,83% melebihi batas 20% pagu”'],
  ['Volume × harga', 'Total baris = volume × harga satuan', 'Dihitung aplikasi, kamu tidak perlu menghitung'],
  ['Nilai positif', 'Volume dan harga harus di atas nol', '“Volume dan harga satuan harus lebih dari nol”'],
  ['Tidak di bawah realisasi', 'Saat perubahan/pergeseran, baris tidak boleh lebih kecil dari yang sudah dibelanjakan', '“Total baris tidak boleh di bawah realisasinya”'],
], [2200, 4038, 3400]);
H3('Status kertas kerja');
GAMBAR('d05-status-kk', 'Status kertas kerja dan siapa yang memindahkannya');

H2('3b. Pengaktifan Kertas Kerja');
P('Pekerjaan sekali setahun, dan paling cepat dari semua langkah di bab ini: **satu klik**. Pengaktifan membuat Versi 1 berstatus Draf dan menyambungkannya dengan pagu sekolah tahun itu. Yang boleh melakukannya Operator atau Bendahara.');
LI([
  'Tombolnya baru muncul kalau pagu sekolah untuk tahun dan sumber dana itu sudah ditetapkan pusat. Belum muncul? Berarti menunggu pagu, bukan karena aplikasinya rusak.',
  'Setelah aktif, kartu Pagu langsung menampilkan jatah dan sisanya.',
]);
GAMBAR('06-kk-aktif', 'Kertas kerja Versi 1 sudah aktif dan siap diisi');

H2('3c. Penyusunan Kertas Kerja');
P('Inilah bagian yang paling banyak makan waktu — dan paling menentukan. Tugasmu: menambahkan baris belanja sampai pagu habis dan semua aturan hijau.');
P('Satu baris butuh enam isian. Mari kita lihat satu per satu, supaya tidak ada yang bikin ragu di tengah jalan.');
GAMBAR('e07-isian-komponen', 'Isian 1 — komponen BOSP: kegiatan ini masuk kelompok yang mana', 14);
GAMBAR('e08-isian-rekening', 'Isian 2 — kode rekening: ketik kode atau nama barangnya, pilihan muncul sendiri. Kode ini yang nanti menentukan pajak.', 14);
GAMBAR('e09-isian-uraian', 'Isian 3 — uraian: tulis sejelas mungkin. Bendahara akan mencari baris ini lewat kata-kata di sini.', 14);
GAMBAR('e10-isian-volume-harga', 'Isian 4, 5, 6 — volume, satuan, dan harga satuan', 14);
GAMBAR('e11-total-simpan', 'Totalnya dihitung aplikasi. Tinggal simpan.', 11);
KOTAK('TIPS', ['Susun dari yang pasti-pasti dulu: listrik, internet, kebersihan. Sisanya baru kegiatan.', 'Pakai harga yang wajar menurut standar harga daerah — ini penyebab nomor satu kertas kerja dikembalikan Dinas.', 'Uraian yang jelas itu hadiah untuk Bendahara. “Kertas HVS A4 untuk pembelajaran” jauh lebih membantu daripada sekadar “Kertas”.']);
H3('Kalau ada aturan yang dilanggar');
P('Tidak perlu panik, dan tidak perlu menebak-nebak. Bilah komponennya berubah merah, dan kotak **Belum dapat diajukan** menuliskan persis apa yang harus diperbaiki.');
GAMBAR('10-komponen-melebihi', 'Honor 20,83% melewati batas 20%. ① bilah berubah merah, ② kotak kepatuhan merinci apa yang harus diperbaiki.', 8.6);
KOTAK('CONTOH', 'Sekolah cerita sempat kebablasan: honor narasumber 2 × Rp1.250.000 = Rp2.500.000, alias 20,83% dari pagu. Setelah diturunkan jadi 2 × Rp600.000, honornya tinggal 10% dan bilahnya kembali biru. Beres.');
P('Kalau sudah muncul tanda **✓ Memenuhi aturan juknis** dan sisa pagu Rp0, berarti kertas kerjamu siap naik ke meja Kepala Sekolah.');
GAMBAR('e05-anatomi-tabel', 'Tabel kertas kerja dikelompokkan per komponen; kolom Realisasi menunjukkan yang sudah dibelanjakan', 16.5, 19);
H3('Isi kertas kerja sekolah cerita (Versi 1)');
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

H2('3d. Pengajuan Kertas Kerja');
P('Tombol [[Ajukan ke Dinas]] cuma bisa ditekan **Kepala Sekolah**, dan itu bukan tanpa alasan: yang bertanggung jawab atas rencana sekolah memang beliau. Tombolnya juga baru menyala kalau semua aturan juknis sudah hijau.');
GAMBAR('14-ajukan', 'Kepala Sekolah mengajukan kertas kerja ke Dinas');
LI([
  'Setelah diajukan, kertas kerja **terkunci**. Mau Operator, mau Bendahara, tidak ada yang bisa mengubahnya. Ini normal.',
  'Kertas kerja masuk ke antrean Verifikator Dinas di wilayahmu.',
  'Siapa pun yang melakukan apa pun, tercatat di Riwayat.',
]);
KOTAK('TIPS', 'Sebelum Kepala Sekolah menekan tombol, duduk berdua sebentar dan baca ulang kertas kerjanya. Lebih hemat waktu daripada menunggu dikembalikan Dinas seminggu kemudian.');

H2('3e. Pengesahan Kertas Kerja (RKAS)');
P('Sekarang giliran Dinas. Hasilnya cuma dua kemungkinan, dan dua-duanya bukan kiamat.');
TABEL(['Hasil', 'Yang terjadi', 'Yang kamu lakukan'], [
  ['**Dikembalikan**', 'Status balik ke Draf, lengkap dengan alasan umum dan catatan di baris tertentu', 'Perbaiki baris yang dicatat, lalu Kepala Sekolah mengajukan lagi. Tidak perlu mulai dari nol.'],
  ['**Disahkan**', 'Versi itu resmi jadi RKAS yang berlaku', 'Mulai mencatat di Penatausahaan'],
], [1800, 3919, 3919]);
GAMBAR('d04-alur-rkas', 'Alur dari penyusunan sampai pengesahan, lintas peran');
P('Kalau dikembalikan, kamu tidak perlu menebak maunya Dinas apa: alasannya tertulis di kotak oranye, dan catatan per barisnya menempel persis di baris yang dimaksud.');
GAMBAR('18-dikembalikan', 'Alasan pengembalian dan catatan per baris dari Verifikator');
H3('Begitu RKAS disahkan, empat hal langsung terjadi');
LI([
  'Periode BKU bulan berjalan **terbuka sendiri**. Bendahara boleh mulai mencatat.',
  'Baris RKAS muncul sebagai pilihan saat mencatat belanja, lengkap dengan sisa anggarannya.',
  'Rencana dikirim ke **Mitra SIPLah**, jadi sekolah bisa belanja daring sesuai sisa anggaran.',
  'Rencana dipakai sebagai pembanding di halaman **HPP**.',
]);
GAMBAR('20-disahkan', 'RKAS Versi 1 disahkan, beserta riwayat prosesnya');

H2('3f. Perubahan Anggaran');
P('Pertanyaan yang paling sering muncul: "Saya mau mengubah RKAS, pakai perubahan atau pergeseran?" Jawabannya cuma bergantung pada satu hal — **pagunya berubah atau tidak**.');
GAMBAR('d16-pilih-perubahan-pergeseran', 'Satu pertanyaan, dua jalur');
P('**Perubahan anggaran** dipakai kalau pagu sekolah berubah: ada penetapan ulang, tambahan dana, atau SiLPA. Karena jatahnya berubah, total RKAS harus ikut menyesuaikan.');
P('Caranya: tekan [[Buat pergeseran/perubahan]]. Aplikasi menyalin RKAS yang berlaku jadi versi baru berstatus Draf, lalu selisih pagunya muncul sebagai "sisa" yang harus kamu habiskan. Setelah itu alurnya sama seperti biasa: Kepala Sekolah mengajukan, Dinas mengesahkan, versi lama otomatis jadi **Diganti**.');
GAMBAR('58-versi2-draf', 'Pagu naik jadi Rp13.500.000, jadi Versi 2 punya sisa Rp1.500.000 untuk dianggarkan');
KOTAK('CONTOH', 'Pagu sekolah cerita naik dari Rp12.000.000 jadi Rp13.500.000. Dewi menambahkan kegiatan baru "Makan minum workshop KKG guru" (komponen 06), 60 kotak × Rp25.000 = Rp1.500.000. Pas. Versi 2 diajukan, disahkan, selesai.');
GAMBAR('61-perubahan-disahkan', 'Versi 2 berlaku, Versi 1 jadi arsip');
KOTAK('INGAT', ['Tombolnya tidak muncul selama masih ada versi Draf atau Diajukan. Beresin dulu yang sedang jalan.', 'Transaksi yang sudah tercatat tidak hilang ke mana-mana. Realisasinya ikut pindah ke baris yang sama di versi baru.']);

H2('3g. Pergeseran Anggaran');
P('**Pergeseran** dipakai kalau pagunya tetap, tapi isinya perlu ditata ulang. Misalnya: cetak soal ternyata tidak sebanyak perkiraan, sementara servis AC malah lebih mahal. Uangnya tinggal dipindah dari satu baris ke baris lain.');
P('Satu hal yang membedakannya dari perubahan: ada **lantai** yang tidak boleh ditembus, yaitu realisasi. Kalau sebuah baris sudah dibelanjakan Rp500.000, kamu tidak bisa menurunkannya jadi Rp250.000 — uangnya sudah terlanjur keluar.');
TABEL(['Aturan pergeseran', 'Penjelasan'], [
  ['Total tetap = pagu', 'Yang dikurangi di satu baris harus ditambahkan di baris lain, jumlahnya sama persis'],
  ['Tidak boleh di bawah realisasi', 'Lihat kolom Realisasi sebelum mengurangi'],
  ['Baris yang sudah dibelanjakan tidak bisa dihapus', 'Tombol Hapus cuma muncul untuk baris yang masih kosong realisasinya'],
  ['Batas komponen tetap berlaku', 'Jangan sampai menggeser malah membuat komponen melewati batas'],
  ['Tetap lewat Dinas', 'Versi pergeseran diajukan Kepala Sekolah dan disahkan Verifikator'],
], [3300, 6338]);
GAMBAR('63-di-bawah-realisasi', 'Aplikasi menolak dengan sopan kalau baris mau dikurangi di bawah realisasinya', 14);
KOTAK('CONTOH', 'Cetak soal diturunkan dari 300 jadi 240 eksemplar (−Rp210.000). Harga servis AC dinaikkan dari Rp250.000 jadi Rp355.000 per kali (+Rp210.000). Total tetap Rp13.500.000, dan semua pihak senang.');
GAMBAR('68-pergeseran-disahkan', 'Pergeseran (Versi 3) sudah disahkan');
KOTAK('CEK', ['Apa beda kertas kerja dengan RKAS?', 'Siapa yang boleh mengajukan ke Dinas?', 'Kapan pakai perubahan, kapan pakai pergeseran?', 'Kenapa ada baris yang tidak bisa dikurangi?']);

// ====================================================================== BAB 4
H1('Penatausahaan');
KOTAK('RINGKAS', ['4a BKU dan buku kas pembantu', '4b Mencatat ke BKU: luring dan daring (SIPLah), sampai jadi laporan', '4c Perpajakan', '4d Penutupan BKU']);
H2('4a. Apa itu BKU dan Buku Kas Pembantu');
P('**Buku Kas Umum (BKU)** itu buku harian uang sekolah: semua yang masuk, semua yang keluar, beserta saldo berjalannya. Supaya mudah diperiksa, isinya juga dipilah ke **Buku Kas Pembantu (BKP)** — tunai, bank, dan pajak.');
P('Kabar baiknya: kamu cukup mencatat **sekali** di BKU. Buku pembantunya terisi sendiri.');
GAMBAR('d11-mindmap-bku', 'BKU dan buku pembantunya');
TABEL(['Buku', 'Isi', 'Contoh'], [
  ['BKU', 'Semua transaksi urut tanggal, dengan saldo berjalan', 'Seluruh contoh di bawah ini'],
  ['BKP Tunai', 'Uang tunai di brankas', 'Tarik tunai Rp1.500.000'],
  ['BKP Bank', 'Uang di rekening sekolah', 'Penerimaan BOSP Rp6.000.000'],
  ['BKP Pajak', 'Pajak yang dipungut dan disetor', 'PPN Rp24.774 dipungut lalu disetor'],
], [1600, 4519, 3519]);
H3('Membaca halaman Penatausahaan');
P('Di atas ada kartu-kartu ringkasan. Tiga yang paling sering kamu lirik:');
GAMBAR('e12-kartu-saldo', 'Kartu ringkasan: saldo, realisasi terhadap pagu, dan periode berjalan', 16.5);
P('Perhatikan kata **tersedia** di bawah saldo. Itu saldo yang sudah dikurangi transaksi yang masih menunggu persetujuan — angka inilah yang realistis untuk dipakai belanja.');
GAMBAR('e22-kartu-periode', 'Kartu periode: bulan mana yang sedang terbuka, berapa yang menunggu persetujuan, dan sisa pajak', 8.5);
P('Di bawahnya ada tabel BKU. Setiap baris punya tanggal, nomor bukti, uraian, buku (tunai/bank), nilai masuk atau keluar, saldo berjalan, dan statusnya.');
GAMBAR('e23-anatomi-baris-bku', 'Anatomi tabel BKU', 16.5);
H3('Status transaksi');
GAMBAR('d07-alur-transaksi', 'Perjalanan satu transaksi');
KOTAK('PENTING', 'Transaksi berstatus **Menunggu persetujuan** belum mengubah saldo. Yang sudah **Disetujui** sifatnya final — tidak bisa diedit. Kalau salah, betulkan dengan transaksi koreksi, bukan dengan mengubah yang lama. Terdengar merepotkan, tapi justru inilah yang membuat BKU bisa dipercaya.');

H2('4b. Dari pencatatan BKU sampai laporan sekolah');
P('Laporan sekolah tidak dibuat di akhir bulan — laporan **tumbuh** dari pencatatan harianmu. Setiap transaksi yang disetujui akan mengalir ke buku pembantu, mengurangi sisa RKAS, muncul di HPP, lalu dirangkum jadi laporan bulanan saat buku ditutup.');
P('Artinya sederhana: kalau pencatatan hariannya rapi, laporan akhir bulan nyaris tidak perlu kerja tambahan.');
H3('Empat prinsip yang menyelamatkan');
LI([
  '**Ada bukti dulu, baru dicatat.** Nota, kuitansi, bukti transfer, atau invoice SIPLah.',
  '**Tanggal ikut bukti**, dan harus di dalam periode yang terbuka. Tanggal masa depan ditolak.',
  '**Belanja wajib menunjuk baris RKAS**, dan tidak boleh melebihi sisanya.',
  '**Saldo harus cukup.** Belanja tunai butuh saldo tunai. Kurang? Catat tarik tunai dulu.',
]);
H3('Uang masuk: penerimaan dan tarik tunai');
P('Dana BOSP yang masuk rekening dicatat sebagai **penerimaan** (masuk BKP Bank). Butuh uang tunai untuk belanja kecil? Catat **tarik tunai**: saldo bank turun, saldo tunai naik. Kebalikannya namanya setor tunai.');
GAMBAR('25-saldo-bank', 'Setelah penerimaan disetujui, saldo bank bertambah');
H3('Luring atau daring?');
P('Ada dua jalur belanja, dan keduanya bermuara di BKU yang sama. Yang penting: jangan sampai satu belanja dicatat lewat dua jalur sekaligus.');
GAMBAR('d17-pilih-cara-catat', 'Tentukan jalurnya dulu');
TABEL(['', 'Luring', 'Daring (SIPLah)'], [
  ['Belanja di', 'Toko atau penyedia langsung', 'Aplikasi Mitra SIPLah'],
  ['Yang mengetik', 'Bendahara, lewat wizard 3 langkah', 'Dikirim otomatis oleh Mitra'],
  ['Cara bayar', 'Tunai atau non-tunai', 'Non-tunai'],
  ['Baris RKAS', 'Dipilih Bendahara di langkah 2', 'Ikut dari Mitra; yang belum ada dipetakan Bendahara'],
  ['Pajak', 'Dihitung otomatis di langkah 3', 'Dihitung otomatis juga'],
  ['Persetujuan', 'Kepala Sekolah', 'Kepala Sekolah'],
  ['Kalau batal', 'Kepala Sekolah menolak', 'Muncul peringatan pembatalan/retur dari Mitra'],
], [2200, 3719, 3719]);
H3('Belanja luring: wizard tiga langkah');
P('Wizard-nya memandu kamu bertahap, jadi tidak ada isian yang terlewat.');
GAMBAR('e13-langkah-wizard', 'Tiga langkah wizard belanja', 16.5);
P('Di langkah 1, dua isian yang paling berpengaruh: **cara bayar** (menentukan saldo mana yang dipakai) dan **centang NPWP** (menentukan tarif PPh).');
GAMBAR('e14-cara-bayar', 'Pilih tunai atau non-tunai', 9);
GAMBAR('e15-npwp-penyedia', 'Centang NPWP ini memengaruhi besarnya pajak', 14);
P('Di langkah 2, cari baris RKAS-nya. Tidak perlu hafal kode rekening — ketik saja kata yang kamu ingat.');
GAMBAR('e16-cari-rkas', 'Cari baris RKAS dengan kata kunci', 14);
P('Setelah baris dipilih, isi volume dan harga sesuai nota. Perhatikan **sisa** anggaran baris itu: kalau belanjamu melebihi sisanya, aplikasi akan menolak.');
GAMBAR('e17-sisa-anggaran-baris', 'Sisa anggaran baris terlihat saat mengisi', 14);
P('Langkah 3 adalah bagian yang paling disukai Bendahara: pajaknya sudah dihitungkan.');
GAMBAR('e18-rincian-pajak', 'Rincian pajak dihitung otomatis', 13.5);
P('Satu angka yang wajib kamu lihat: **Dibayar ke penyedia**. Itulah uang yang benar-benar berpindah ke toko. Sisanya kamu pegang dulu untuk disetor sebagai pajak.');
GAMBAR('e19-dibayar-penyedia', 'Angka yang dibayarkan ke toko', 16);
H3('Belanja daring lewat SIPLah');
P('Kalau sekolah belanja di aplikasi Mitra SIPLah, kamu tidak perlu mengetik apa pun. Transaksinya dikirim sendiri ke ARKAS dan muncul di panel biru di atas BKU.');
GAMBAR('d08-luring-daring', 'Dua jalur pencatatan belanja');
GAMBAR('35-siplah-masuk', 'Pesanan SIPLah masuk sendiri; satu barang masih perlu dipetakan ke baris RKAS');
KOTAK('INGAT', ['Mitra baru bisa melayani kalau RKAS sudah disahkan dan sumber dananya dibuka.', 'Sisa anggaran yang dilihat Mitra mengikuti RKAS — jadi sekolah tidak bisa belanja melebihi rencananya.']);
H3('Giliran Kepala Sekolah: setujui atau tolak');
P('Kepala Sekolah memeriksa setiap transaksi dengan bukti fisik di tangan. Kalau cocok, tekan [[Setujui]]. Kalau ada yang janggal, tekan [[Tolak]] dan tulis alasannya.');
GAMBAR('e24-tombol-putusan', 'Dua tombol keputusan di setiap baris yang menunggu', 16.5);
GAMBAR('e25-pemberitahuan-kepsek', 'Pemberitahuan jumlah transaksi yang menunggu keputusan', 16);
P('Transaksi yang ditolak tidak masuk BKU, tapi juga tidak hilang. Ia muncul di panel merah milik Bendahara lengkap dengan alasan dan tombol [[Catat ulang]], jadi tidak perlu mengetik ulang dari awal.');
GAMBAR('34-ditolak', 'Panel transaksi ditolak dan tombol Catat ulang');
H3('HPP: rencana dibanding kenyataan');
P('Halaman **HPP** membandingkan tiap baris RKAS dengan belanja SIPLah: sesuai rencana, melebihi, di luar rencana, atau belum dibelanjakan. Dinas dan pusat melihat halaman yang sama.');
GAMBAR('e29-kartu-hpp', 'Empat kartu ringkasan HPP', 16.5);

H2('4c. Pencatatan Perpajakan');
P('Bagian ini sering bikin deg-degan, padahal sebenarnya paling ringan — karena hitungannya bukan tugasmu. ARKAS Web menentukan pajaknya dari **kode rekening** baris RKAS dan status **NPWP** penyedia. Tugasmu cuma dua: pastikan isiannya benar, dan setor tepat waktu.');
GAMBAR('d14-mindmap-pajak', 'Peta perpajakan sekolah');
TABEL(['Jenis pajak', 'Kena pada (contoh rekening)', 'Tarif', 'Cara hitung'], [
  ['PPN', 'Barang/jasa kena pajak: ATK (0024), bahan cetak (0029), kebersihan (0026)', '11%', 'Harga nota dianggap sudah termasuk PPN: DPP = harga ÷ 1,11, lalu PPN = DPP × 11%'],
  ['PPh 23', 'Jasa: servis (0013), kebersihan (0026)', '2% (4% tanpa NPWP)', 'Dari DPP bila kena PPN juga, atau dari harga'],
  ['PPh 21', 'Honor orang pribadi, mis. narasumber (0003)', '5% (6% tanpa NPWP)', 'Dari nilai honor'],
  ['Pajak daerah (SSPD)', 'Makan minum (0052)', 'Sesuai Perda; umumnya 10%', 'Dari harga'],
], [1700, 3700, 1700, 2538]);
KOTAK('CONTOH', 'Belanja ATK Rp250.000 di Toko Sinar Pelajar. DPP = 250.000 ÷ 1,11 = Rp225.225,23. PPN = Rp24.774 (dibulatkan ke bawah). Jadi yang dibayar ke toko Rp225.226, dan Rp24.774 kamu setor ke kas negara.');
P('Semua pungutan berkumpul di tab **BKP Pajak**, bagian "Pajak belum disetor". Setelah menyetor lewat bank, kantor pos, atau e-billing, catat setorannya dengan **NTPN** dari bukti setor.');
GAMBAR('e26-ntpn', 'Setoran pajak tercatat lengkap dengan NTPN-nya', 16.5);
GAMBAR('43-bkp-pajak', 'BKP Pajak: pungutan dan setoran berdampingan, saldo kembali Rp0');
KOTAK('PENTING', ['Setor sesuai batas waktu ketentuan perpajakan — umumnya paling lambat pertengahan bulan berikutnya. Ragu? Tanya KPP setempat.', 'Satu setoran untuk satu jenis pajak. Jangan dicampur.', 'NTPN 16 karakter, disalin persis, dan tidak boleh dipakai dua kali.']);

H2('4d. Penutupan BKU');
P('Tutup buku itu bukan sekadar formalitas bulanan. Ini momen kamu membuktikan bahwa catatan di aplikasi sama dengan kenyataan: saldo bank cocok dengan rekening koran, saldo tunai cocok dengan uang di brankas.');
P('Setelah ditutup, bulan itu terkunci, laporan PDF terbit otomatis, dan bulan berikutnya terbuka.');
GAMBAR('d10-alur-tutup-buku', 'Alur penutupan BKU setiap bulan');
P('Aplikasi memberi daftar periksa, jadi kamu tidak perlu mengingat syaratnya satu per satu.');
GAMBAR('e27-daftar-periksa', 'Daftar periksa penutupan — semua harus hijau', 14);
TABEL(['Syarat', 'Penjelasan'], [
  ['Bulan sudah berakhir', 'Penutupan dilakukan setelah akhir bulan'],
  ['Semua transaksi sudah diputuskan', 'Tidak ada yang menggantung menunggu Kepala Sekolah'],
  ['Periode sebelumnya sudah ditutup', 'Urut, bulan demi bulan'],
  ['Rekonsiliasi diisi', 'Saldo rekening koran dan hasil hitung kas fisik'],
  ['Selisih dijelaskan', 'Kalau ada selisih, wajib ditulis penyebabnya'],
], [3300, 6338]);
GAMBAR('47-tutup-selisih', 'Selisih bank Rp6.500 wajib dijelaskan sebelum penutupan bisa diajukan');
P('Bendahara mengajukan, Kepala Sekolah memeriksa **berita acara pemeriksaan kas**, lalu menekan [[Setujui & tutup buku]]. Kalau ada yang janggal, beliau bisa mengembalikannya.');
GAMBAR('50-kepsek-berita-acara', 'Berita acara pemeriksaan kas');
H3('Laporan bulanan');
P('Begitu buku ditutup, laporan BKU terbit otomatis dalam bentuk PDF. Kepala Sekolah tinggal menandatanganinya, dan setelah itu laporan jadi final. Komite Sekolah juga bisa membukanya — memang begitu maksudnya.');
GAMBAR('e28-kartu-laporan', 'Kartu laporan: lihat PDF, lalu tandatangani', 16.5);
GAMBAR('56-laporan-pdf', 'Isi laporan BKU November 2026', 13);
KOTAK('INGAT', 'Di lingkungan uji coba, tanda tangannya masih simulasi (ada tulisan "bukan TTE yang sah"). Di sekolahmu, yang dipakai TTE resmi.');
H3('Jejak audit');
P('Kalau suatu saat ada yang bertanya "siapa yang mengubah angka ini?", jawabannya ada di menu **Jejak audit**. Lencana hijau artinya catatan tidak pernah diutak-atik.');
GAMBAR('e30-jejak-audit', 'Jejak audit dengan lencana keutuhan data', 16.5);
KOTAK('CEK', ['Kenapa transaksi yang menunggu belum mengubah saldo?', 'Apa beda pencatatan luring dan daring?', 'Dari mana aplikasi tahu pajak apa yang harus dipungut?', 'Apa saja syarat sebelum buku bisa ditutup?']);

// ====================================================================== BAB 5
H1('Permasalahan dan Solusi');
KOTAK('RINGKAS', ['Kumpulan masalah yang paling sering bikin kening berkerut, beserta penyebab dan jalan keluarnya. Pesan di kolom pertama persis seperti yang muncul di layar.']);
P('Sebelum masuk daftarnya, satu hal yang perlu kamu tahu: **hampir semua "error" di ARKAS Web itu bukan kerusakan.** Itu aplikasi sedang menjaga kamu dari kesalahan yang nanti repot dibetulkan. Jadi baca pesannya pelan-pelan — biasanya jawabannya sudah ada di situ.');
GAMBAR('d15-mindmap-masalah', 'Peta masalah yang sering muncul');
H2('5.1 Masuk dan akun');
TABEL(['Masalah / pesan', 'Penyebab', 'Solusi'], [
  ['Menu yang dicari tidak ada', 'Peran aktif salah, atau peran belum diberikan', 'Ganti peran di pojok kanan atas; kalau tetap tidak ada, minta Operator menambahkan'],
  ['“Sesi tidak ada, kedaluwarsa, atau sudah keluar”', 'Terlalu lama menganggur', 'Masuk lagi lewat SSO'],
  ['Data sekolah lain tidak bisa dibuka (403)', 'Memang di luar cakupan peranmu', 'Normal, bukan kerusakan'],
], [3000, 3100, 3538]);
H2('5.2 Penganggaran');
TABEL(['Masalah / pesan', 'Penyebab', 'Solusi'], [
  ['“Masih ada pagu yang belum dianggarkan”', 'Total baris < pagu', 'Tambah baris atau naikkan volume/harga sampai sisa Rp0'],
  ['“Total anggaran melebihi pagu”', 'Total baris > pagu', 'Kurangi volume/harga, atau hapus baris'],
  ['“…% melebihi batas …% pagu”', 'Komponen melewati batas juknis', 'Kurangi baris di komponen itu'],
  ['Tombol Ajukan ke Dinas abu-abu', 'Belum lolos juknis, atau kamu bukan Kepala Sekolah', 'Beresin daftar di kotak “Belum dapat diajukan”; mengajukan tugas Kepala Sekolah'],
  ['Kertas kerja dikembalikan Dinas', 'Ada yang perlu diperbaiki menurut Verifikator', 'Baca alasan & catatan per baris, perbaiki, ajukan lagi'],
  ['Tombol Buat pergeseran/perubahan tidak muncul', 'Masih ada versi Draf/Diajukan, atau perannya bukan Operator/Bendahara', 'Selesaikan dulu versi yang sedang berjalan'],
  ['“Total baris tidak boleh di bawah realisasinya”', 'Mengurangi baris yang sudah dibelanjakan', 'Kurangi baris lain yang sisanya masih ada'],
  ['“Kode rekening … tidak dikenal”', 'Kode itu sudah dinonaktifkan pusat', 'Pilih kode rekening lain yang masih berlaku'],
], [3000, 3100, 3538]);
H2('5.3 Penatausahaan dan SIPLah');
TABEL(['Masalah / pesan', 'Penyebab', 'Solusi'], [
  ['“Periode bulan … belum dibuka”', 'RKAS belum disahkan, atau tanggalnya di luar periode', 'Tunggu RKAS disahkan; periksa tanggal transaksi'],
  ['“Periode buku kas sudah ditutup”', 'Tanggalnya jatuh di bulan yang sudah ditutup', 'Pakai tanggal di periode yang masih Buka'],
  ['“Tanggal transaksi tidak boleh melewati hari ini”', 'Tanggal masa depan', 'Pakai tanggal bukti yang sebenarnya'],
  ['“Saldo tunai tidak cukup”', 'Belanja tunai melebihi saldo tunai', 'Catat tarik tunai dulu — aplikasi bahkan menyodorkan tombolnya'],
  ['“Belanja … melebihi sisa anggaran”', 'Melebihi sisa baris RKAS', 'Pakai baris lain, atau lakukan pergeseran'],
  ['Transaksi ditolak Kepala Sekolah', 'Bukti atau isian kurang pas', 'Baca alasannya di panel merah → Catat ulang'],
  ['“1 barang belum dipetakan”', 'Barang dari Mitra belum punya baris RKAS', 'Pilih baris RKAS untuk barang itu (★ = kode rekening sama)'],
  ['“Pesanan … dibatalkan/diretur di Mitra”', 'Pesanan batal setelah dicatat', 'Belum disetujui: Kepala Sekolah menolak. Sudah disetujui: catat pengembalian dana sebagai penerimaan'],
], [3000, 3100, 3538]);
H2('5.4 Pajak dan penutupan');
TABEL(['Masalah / pesan', 'Penyebab', 'Solusi'], [
  ['Tombol Catat setor tidak aktif', 'Belum ada pajak yang dicentang', 'Centang pajak sejenis di “Pajak belum disetor”'],
  ['NTPN ditolak', 'Bukan 16 karakter, salah ketik, atau sudah dipakai', 'Salin persis dari bukti setor'],
  ['Pajak terasa kebesaran/kekecilan', 'Centang NPWP penyedia keliru', 'Minta Kepala Sekolah menolak, lalu catat ulang dengan isian yang benar'],
  ['“Masih ada transaksi menunggu persetujuan”', 'Belum semua diputuskan', 'Minta Kepala Sekolah menuntaskan antreannya'],
  ['Ada selisih bank/kas', 'Biaya admin bank, bunga, atau ada yang belum dicatat', 'Cari dulu penyebabnya; kalau memang tidak bisa dihilangkan, tulis penjelasannya'],
  ['“Periode sebelumnya belum ditutup”', 'Penutupan harus urut', 'Tutup bulan sebelumnya dulu'],
  ['Laporan belum muncul', 'Masih dibuat sistem', 'Tunggu sebentar, lalu muat ulang tab Laporan'],
], [3000, 3100, 3538]);
KOTAK('TIPS', 'Masih buntu juga? Siapkan empat hal sebelum menghubungi Operator atau Dinas: nama sekolah & NPSN, peranmu, menu yang sedang dibuka, dan tangkapan layar pesannya. Dijamin lebih cepat selesai.');

// ====================================================================== BAB 6
H1('Penutup');
P('Sampai di sini, kamu sudah mengikuti perjalanan lengkap satu rupiah dana BOSP: dari direncanakan di kertas kerja, disahkan jadi RKAS, dibelanjakan dan dicatat di BKU, dipungut pajaknya, sampai akhirnya muncul di laporan bulanan yang ditandatangani Kepala Sekolah.');
P('Kalau boleh meninggalkan tiga pesan saja, ini pesannya:');
OL([
  '**Catat harian, jangan menumpuk.** Satu jam setiap minggu jauh lebih ringan daripada satu hari penuh di akhir bulan — dan notanya belum sempat hilang.',
  '**Rencana yang rapi memudahkan pencatatan.** Uraian RKAS yang jelas hari ini menghemat waktu Bendahara berbulan-bulan ke depan.',
  '**Tutup buku tepat waktu.** Laporan rapi, Dinas tenang, Komite percaya, dan kamu bisa tidur nyenyak.',
]);
P('Mau langsung praktik? Buka **Buku Tutorial ARKAS Web untuk Sekolah** — nomor babnya sama persis dengan buku ini, jadi kamu tinggal melanjutkan.');
KOTAK('INGAT', 'Buku ini disusun dari ARKAS Web versi uji coba (November 2026). Tampilan di sekolahmu bisa sedikit berbeda setelah aplikasi diperbarui, tapi konsep dan alurnya tetap sama.');
P('Terima kasih sudah membaca sampai habis. Selamat mengelola dana sekolah dengan rapi, transparan, dan tenang! 🎓');

// ====================================================================== BAB 7
H1('Glosarium');
P('Bingung dengan sebuah istilah? Cari di sini dulu.');
TABEL(['Istilah', 'Arti'], GLOSARIUM, [2900, 6738]);

B.simpan('Buku-Panduan-ARKAS-Web-Sekolah.docx', { judul: 'Buku Panduan ARKAS Web untuk Sekolah', deskripsi: 'Konsep, aturan, dan alur penganggaran & penatausahaan ARKAS Web untuk sekolah', sampulPng: path.join(__dirname, 'diagram', 'sampul-panduan.png') });
