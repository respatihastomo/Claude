-- HANYA pengembangan: referensi contoh. Kode rekening, komponen, dan tarif adalah CONTOH; nilai resmi mengikuti
-- peraturan & juknis yang berlaku dan dikelola Balai SDSP lewat svc-referensi.
SET search_path = ref;
INSERT INTO wilayah (kode, nama, induk_kode) VALUES ('32', 'Provinsi Contoh A', NULL) ON CONFLICT (kode) DO NOTHING;
INSERT INTO wilayah (kode, nama, induk_kode) VALUES ('3201', 'Kabupaten Contoh 1', '32'), ('3202', 'Kabupaten Contoh 2', '32') ON CONFLICT (kode) DO NOTHING;
INSERT INTO jenjang (kode, nama) VALUES ('SD', 'Sekolah Dasar'), ('SMP', 'Sekolah Menengah Pertama'), ('SMA', 'Sekolah Menengah Atas'), ('SMK', 'Sekolah Menengah Kejuruan')
ON CONFLICT (kode) DO NOTHING;
INSERT INTO satuan_pendidikan (npsn, nama, jenjang_kode, wilayah_kode, status_sekolah) VALUES
  ('20100001', 'SMP Negeri Contoh 1', 'SMP', '3201', 'NEGERI'), ('20100002', 'SMP Swasta Contoh 2', 'SMP', '3202', 'SWASTA')
ON CONFLICT (npsn) DO NOTHING;
INSERT INTO direktorat (kode, nama, ditjen_kode, ditjen_nama) VALUES
  ('SMP', 'Direktorat SMP', 'PAUDDIKDASMEN', 'Ditjen PAUD, Dikdas, dan Dikmen'), ('SD', 'Direktorat SD', 'PAUDDIKDASMEN', 'Ditjen PAUD, Dikdas, dan Dikmen')
ON CONFLICT (kode) DO NOTHING;
INSERT INTO sumber_dana (kode, nama, kategori) VALUES ('BOSP_REG', 'BOSP Reguler', 'BOSP') ON CONFLICT (kode) DO NOTHING;
INSERT INTO sumber_dana_jenjang VALUES ('BOSP_REG', 'SD'), ('BOSP_REG', 'SMP'), ('BOSP_REG', 'SMA'), ('BOSP_REG', 'SMK') ON CONFLICT DO NOTHING;
INSERT INTO kode_rekening (kode, nama) VALUES
  ('5.1.02.01.01.0001', 'Belanja Langganan Daya dan Jasa'),
  ('5.1.02.01.01.0024', 'Belanja Alat/Bahan untuk Kegiatan Kantor - Alat Tulis Kantor'),
  ('5.1.02.01.01.0025', 'Belanja Alat/Bahan untuk Kegiatan Kantor - Kertas dan Cover'),
  ('5.1.02.01.01.0052', 'Belanja Makanan dan Minuman Rapat'),
  ('5.1.02.02.01.0003', 'Honorarium Narasumber'),
  ('5.1.02.02.01.0013', 'Belanja Jasa Servis'),
  ('5.1.02.02.01.0026', 'Belanja Jasa Tenaga Kebersihan'),
  ('5.1.02.02.01.0061', 'Belanja Jasa Internet')
ON CONFLICT (kode) DO NOTHING;
INSERT INTO komponen (sumber_dana_kode, kode, nama, maks_persen, min_persen) VALUES
  ('BOSP_REG', '01', 'Penerimaan peserta didik baru', NULL, NULL),
  ('BOSP_REG', '02', 'Pengembangan perpustakaan', NULL, NULL),
  ('BOSP_REG', '03', 'Kegiatan pembelajaran dan ekstrakurikuler', NULL, NULL),
  ('BOSP_REG', '04', 'Kegiatan asesmen dan evaluasi pembelajaran', NULL, NULL),
  ('BOSP_REG', '05', 'Administrasi kegiatan sekolah', NULL, NULL),
  ('BOSP_REG', '06', 'Pengembangan profesi pendidik dan tenaga kependidikan', NULL, NULL),
  ('BOSP_REG', '07', 'Langganan daya dan jasa', NULL, NULL),
  ('BOSP_REG', '08', 'Pemeliharaan sarana dan prasarana sekolah', NULL, NULL),
  ('BOSP_REG', '09', 'Penyediaan alat multimedia pembelajaran', NULL, NULL),
  ('BOSP_REG', '12', 'Pembayaran honor', 20.00, NULL)
ON CONFLICT (sumber_dana_kode, kode) DO NOTHING;
INSERT INTO tarif_pajak (kode_rekening, jenis, wilayah_kode, tarif, tarif_tanpa_npwp, dasar_hukum) VALUES
  ('5.1.02.01.01.0024', 'PPN', '', 0.1100, NULL, 'contoh: PPN 12% x DPP 11/12'),
  ('5.1.02.02.01.0013', 'PPH23', '', 0.0200, 0.0400, 'contoh'),
  ('5.1.02.02.01.0026', 'PPN', '', 0.1100, NULL, 'contoh'),
  ('5.1.02.02.01.0026', 'PPH23', '', 0.0200, 0.0400, 'contoh'),
  ('5.1.02.01.01.0052', 'SSPD', '', 0.1000, NULL, 'contoh: pajak restoran, dapat ditimpa Dinas'),
  ('5.1.02.02.01.0003', 'PPH21', '', 0.0500, 0.0600, 'contoh')
ON CONFLICT (kode_rekening, jenis, wilayah_kode) DO NOTHING;
