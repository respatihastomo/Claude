-- HANYA pengembangan: referensi contoh & pengguna contoh (email domain .example, ID tetap agar cocok dengan data demo layanan lain).
SET search_path = auth;
INSERT INTO ref_wilayah_lokal (kode, nama, induk_kode) VALUES
  ('32', 'Provinsi Contoh A', NULL), ('3201', 'Kabupaten Contoh 1', '32'), ('3202', 'Kabupaten Contoh 2', '32')
ON CONFLICT (kode) DO NOTHING;
INSERT INTO ref_direktorat_lokal (kode, nama, ditjen_kode) VALUES
  ('SMP', 'Direktorat SMP', 'PAUDDIKDASMEN'), ('SD', 'Direktorat SD', 'PAUDDIKDASMEN')
ON CONFLICT (kode) DO NOTHING;
INSERT INTO ref_sekolah_lokal (npsn, nama, wilayah_kode) VALUES
  ('20100001', 'SMP Negeri Contoh 1', '3201'), ('20100002', 'SMP Swasta Contoh 2', '3202')
ON CONFLICT (npsn) DO NOTHING;

INSERT INTO pengguna (id, email, nama) VALUES
  ('6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e01', 'bendahara@smpn1.example', 'Sri Wahyuni'),
  ('6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e02', 'kepsek@smpn1.example', 'Drs. Bambang S.'),
  ('6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e03', 'verifikator@dinas3201.example', 'Rina A.'),
  ('6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e04', 'admin@dinas3201.example', 'Hendra P.'),
  ('6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e05', 'admin@balai.example', 'Admin Balai SDSP')
ON CONFLICT (id) DO NOTHING;
INSERT INTO peran_pengguna (id, pengguna_id, peran, npsn, wilayah_kode) VALUES
  ('8a000000-0000-4000-8000-000000000001', '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e01', 'BENDAHARA', '20100001', NULL),
  ('8a000000-0000-4000-8000-000000000002', '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e01', 'OPERATOR', '20100001', NULL),
  ('8a000000-0000-4000-8000-000000000003', '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e02', 'KEPSEK', '20100001', NULL),
  ('8a000000-0000-4000-8000-000000000004', '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e03', 'VERIFIKATOR_DINAS', NULL, '3201'),
  ('8a000000-0000-4000-8000-000000000005', '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e04', 'ADMIN_DINAS', NULL, '3201'),
  ('8a000000-0000-4000-8000-000000000006', '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e05', 'SUPER_ADMIN', NULL, NULL)
ON CONFLICT (id) DO NOTHING;
-- Auditor (UC-31): peran berbatas waktu sesuai surat tugas.
INSERT INTO pengguna (id, email, nama) VALUES
  ('6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e06', 'auditor@inspektorat.example', 'Dra. Lestari W. (Auditor)')
ON CONFLICT (id) DO NOTHING;
INSERT INTO peran_pengguna (id, pengguna_id, peran, berlaku_sampai) VALUES
  ('8a000000-0000-4000-8000-000000000007', '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e06', 'AUDITOR', '2027-12-31T23:59:59+07:00')
ON CONFLICT (id) DO NOTHING;
