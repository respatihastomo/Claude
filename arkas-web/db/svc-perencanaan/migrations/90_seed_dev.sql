-- HANYA pengembangan. Produksi: sekolah & komponen dari svc-referensi (SekolahDisinkron/ReferensiDiubah),
-- pagu dari penetapan alokasi BOSP (svc-integrasi). Batas persen di bawah adalah CONTOH; nilai resmi mengikuti juknis BOSP berlaku.
SET search_path = perencanaan;
INSERT INTO ref_sekolah_lokal (npsn, nama, wilayah_kode, jenjang, status_sekolah) VALUES
  ('20100001', 'SMP Negeri Contoh 1', '3201', 'SMP', 'NEGERI'),
  ('20100002', 'SMP Swasta Contoh 2', '3202', 'SMP', 'SWASTA')
ON CONFLICT (npsn) DO UPDATE SET nama = EXCLUDED.nama, wilayah_kode = EXCLUDED.wilayah_kode;

INSERT INTO ref_komponen_lokal (sumber_dana_kode, kode, nama, maks_persen, min_persen) VALUES
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
ON CONFLICT (sumber_dana_kode, kode) DO UPDATE SET nama = EXCLUDED.nama, maks_persen = EXCLUDED.maks_persen, min_persen = EXCLUDED.min_persen;

INSERT INTO pagu (npsn, tahun, sumber_dana_kode, nilai)
SELECT n, extract(year FROM now() AT TIME ZONE 'Asia/Jakarta')::smallint, 'BOSP_REG', v
FROM (VALUES ('20100001', 19580000.00), ('20100002', 12000000.00)) AS x(n, v)
ON CONFLICT (npsn, tahun, sumber_dana_kode) DO NOTHING;
