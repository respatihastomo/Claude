-- 13.4.3 Hak akses & RLS db_perencanaan. Cakupan Dinas lewat wilayah sekolah di ref_sekolah_lokal.
SET ROLE arkas_perencanaan_owner;
SET search_path = perencanaan;

CREATE OR REPLACE FUNCTION app_ctx(k text) RETURNS text
LANGUAGE sql STABLE SET search_path = perencanaan, pg_temp AS $$ SELECT nullif(current_setting('app.' || k, true), '') $$;

-- SECURITY DEFINER: membaca ref_sekolah_lokal tanpa bergantung pada hak baca pemanggil.
CREATE OR REPLACE FUNCTION boleh_akses(p_npsn char(8), p_sumber varchar) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = perencanaan, pg_temp AS $$
  SELECT CASE
    WHEN app_ctx('peran') IN ('OPERATOR','BENDAHARA','KEPSEK','KOMITE') THEN p_npsn = app_ctx('npsn')
    WHEN app_ctx('peran') IN ('VERIFIKATOR_DINAS','ADMIN_DINAS') THEN
      EXISTS (SELECT 1 FROM ref_sekolah_lokal s WHERE s.npsn = p_npsn AND s.wilayah_kode = app_ctx('wilayah') AND app_ctx('wilayah') IS NOT NULL)
    WHEN app_ctx('peran') IN ('SUPER_ADMIN','PEMANTAU') THEN true
    ELSE false
  END
$$;
CREATE OR REPLACE FUNCTION penyusun(p_npsn char(8)) RETURNS boolean
LANGUAGE sql STABLE SET search_path = perencanaan, pg_temp AS $$ SELECT app_ctx('peran') IN ('OPERATOR','BENDAHARA') AND p_npsn = app_ctx('npsn') $$;
CREATE OR REPLACE FUNCTION kk_milik(p_kk uuid) RETURNS char(8)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = perencanaan, pg_temp AS $$ SELECT npsn FROM kertas_kerja WHERE id = p_kk $$;

GRANT EXECUTE ON FUNCTION app_ctx(text), boleh_akses(char, varchar), penyusun(char), kk_milik(uuid) TO arkas_app_perencanaan, arkas_worker_perencanaan;

GRANT SELECT ON ref_sekolah_lokal, ref_komponen_lokal, realisasi_baris_lokal, pagu, kertas_kerja, baris_kertas_kerja, jadwal_kas, verifikasi, catatan_baris
  TO arkas_app_perencanaan;
GRANT INSERT ON kertas_kerja TO arkas_app_perencanaan;
GRANT UPDATE (status, row_version, diajukan_oleh, diajukan_at, disahkan_oleh, disahkan_at, catatan_kembali) ON kertas_kerja TO arkas_app_perencanaan;
GRANT INSERT, UPDATE, DELETE ON baris_kertas_kerja, jadwal_kas TO arkas_app_perencanaan;
GRANT INSERT ON verifikasi, catatan_baris TO arkas_app_perencanaan;
GRANT INSERT ON outbox TO arkas_app_perencanaan;
GRANT SELECT (event_id) ON outbox TO arkas_app_perencanaan;

GRANT SELECT, INSERT, UPDATE ON ref_sekolah_lokal, ref_komponen_lokal, realisasi_baris_lokal, pagu, inbox_processed, outbox TO arkas_worker_perencanaan;
GRANT SELECT ON kertas_kerja, baris_kertas_kerja TO arkas_worker_perencanaan;

ALTER TABLE pagu ENABLE ROW LEVEL SECURITY;
ALTER TABLE kertas_kerja ENABLE ROW LEVEL SECURITY;
ALTER TABLE baris_kertas_kerja ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_kas ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifikasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE catatan_baris ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_baca ON pagu;
CREATE POLICY p_baca ON pagu FOR SELECT TO arkas_app_perencanaan USING (boleh_akses(npsn, sumber_dana_kode));

DROP POLICY IF EXISTS p_baca ON kertas_kerja;
CREATE POLICY p_baca ON kertas_kerja FOR SELECT TO arkas_app_perencanaan USING (boleh_akses(npsn, sumber_dana_kode));
DROP POLICY IF EXISTS p_aktifkan ON kertas_kerja;
CREATE POLICY p_aktifkan ON kertas_kerja FOR INSERT TO arkas_app_perencanaan
  WITH CHECK (penyusun(npsn) AND status = 'DRAF' AND dibuat_oleh::text = app_ctx('pengguna_id'));
-- Sekolah: penyusun mengubah DRAF (versi baris), Kepala Sekolah mengajukan; Dinas wilayahnya memutuskan DIAJUKAN.
DROP POLICY IF EXISTS p_ubah_sekolah ON kertas_kerja;
CREATE POLICY p_ubah_sekolah ON kertas_kerja FOR UPDATE TO arkas_app_perencanaan
  USING (status = 'DRAF' AND (penyusun(npsn) OR (app_ctx('peran') = 'KEPSEK' AND npsn = app_ctx('npsn'))))
  WITH CHECK (status IN ('DRAF','DIAJUKAN') AND npsn = app_ctx('npsn'));
DROP POLICY IF EXISTS p_putuskan_dinas ON kertas_kerja;
CREATE POLICY p_putuskan_dinas ON kertas_kerja FOR UPDATE TO arkas_app_perencanaan
  USING (app_ctx('peran') = 'VERIFIKATOR_DINAS' AND boleh_akses(npsn, sumber_dana_kode) AND status IN ('DIAJUKAN','DISAHKAN'))
  WITH CHECK (app_ctx('peran') = 'VERIFIKATOR_DINAS' AND boleh_akses(npsn, sumber_dana_kode));

DROP POLICY IF EXISTS p_baca ON baris_kertas_kerja;
CREATE POLICY p_baca ON baris_kertas_kerja FOR SELECT TO arkas_app_perencanaan USING (boleh_akses(npsn, NULL));
DROP POLICY IF EXISTS p_tulis ON baris_kertas_kerja;
CREATE POLICY p_tulis ON baris_kertas_kerja FOR ALL TO arkas_app_perencanaan
  USING (penyusun(npsn)) WITH CHECK (penyusun(npsn) AND npsn = kk_milik(kertas_kerja_id));

DROP POLICY IF EXISTS p_baca ON jadwal_kas;
CREATE POLICY p_baca ON jadwal_kas FOR SELECT TO arkas_app_perencanaan
  USING (EXISTS (SELECT 1 FROM baris_kertas_kerja b WHERE b.id = baris_id));
DROP POLICY IF EXISTS p_tulis ON jadwal_kas;
CREATE POLICY p_tulis ON jadwal_kas FOR ALL TO arkas_app_perencanaan
  USING (EXISTS (SELECT 1 FROM baris_kertas_kerja b WHERE b.id = baris_id AND penyusun(b.npsn)))
  WITH CHECK (EXISTS (SELECT 1 FROM baris_kertas_kerja b WHERE b.id = baris_id AND penyusun(b.npsn)));

DROP POLICY IF EXISTS p_baca ON verifikasi;
CREATE POLICY p_baca ON verifikasi FOR SELECT TO arkas_app_perencanaan USING (boleh_akses(kk_milik(kertas_kerja_id), NULL));
DROP POLICY IF EXISTS p_tulis ON verifikasi;
CREATE POLICY p_tulis ON verifikasi FOR INSERT TO arkas_app_perencanaan
  WITH CHECK (boleh_akses(kk_milik(kertas_kerja_id), NULL) AND pengguna_id::text = app_ctx('pengguna_id') AND peran = app_ctx('peran'));
DROP POLICY IF EXISTS p_baca ON catatan_baris;
CREATE POLICY p_baca ON catatan_baris FOR SELECT TO arkas_app_perencanaan USING (boleh_akses(kk_milik(kertas_kerja_id), NULL));
DROP POLICY IF EXISTS p_tulis ON catatan_baris;
CREATE POLICY p_tulis ON catatan_baris FOR INSERT TO arkas_app_perencanaan
  WITH CHECK (boleh_akses(kk_milik(kertas_kerja_id), NULL) AND penulis_id::text = app_ctx('pengguna_id') AND peran = app_ctx('peran'));

RESET ROLE;
