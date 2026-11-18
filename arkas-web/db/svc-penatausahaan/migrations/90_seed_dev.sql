-- Data contoh HANYA untuk lingkungan pengembangan. Di produksi tabel ini diisi dari event ReferensiDiubah (svc-referensi).
-- Kode rekening dan tarif adalah contoh; nilai resmi mengikuti konfigurasi pajak di svc-referensi/Dinas.
SET search_path = tatausaha;
INSERT INTO ref_rekening_pajak_lokal (kode_rekening, jenis, tarif, tarif_tanpa_npwp) VALUES
  ('5.1.02.01.01.0024', 'PPN',   0.1100, NULL),    -- Belanja Alat/Bahan ATK (PPN 12% x DPP 11/12 = 11% efektif)
  ('5.1.02.02.01.0013', 'PPH23', 0.0200, 0.0400),  -- Jasa servis/pemeliharaan
  ('5.1.02.02.01.0026', 'PPN',   0.1100, NULL),    -- Jasa tenaga kebersihan (badan usaha)
  ('5.1.02.02.01.0026', 'PPH23', 0.0200, 0.0400),
  ('5.1.02.01.01.0052', 'SSPD',  0.1000, NULL),    -- Makanan dan minuman rapat (pajak restoran)
  ('5.1.02.02.01.0003', 'PPH21', 0.0500, 0.0600)   -- Honorarium narasumber
ON CONFLICT (kode_rekening, jenis) DO UPDATE SET tarif = EXCLUDED.tarif, tarif_tanpa_npwp = EXCLUDED.tarif_tanpa_npwp, diperbarui_at = now();
