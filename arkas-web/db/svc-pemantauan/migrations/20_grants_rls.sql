-- Hak akses db_pemantauan. API hanya membaca (RLS per cakupan); pekerja mengisi proyeksi & hasil HPP.
SET ROLE arkas_pemantauan_owner;
SET search_path = pemantauan;

CREATE OR REPLACE FUNCTION app_ctx(k text) RETURNS text
LANGUAGE sql STABLE SET search_path = pemantauan, pg_temp AS $$ SELECT nullif(current_setting('app.' || k, true), '') $$;
-- UC-30/33: sekolah melihat sekolahnya; Dinas sekolah di wilayahnya (prefiks kode); pusat semua.
CREATE OR REPLACE FUNCTION boleh_akses(p_npsn char(8)) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pemantauan, pg_temp AS $$
  SELECT CASE
    WHEN app_ctx('peran') IN ('OPERATOR','BENDAHARA','KEPSEK','KOMITE') THEN p_npsn = app_ctx('npsn')
    WHEN app_ctx('peran') IN ('VERIFIKATOR_DINAS','ADMIN_DINAS') THEN
      EXISTS (SELECT 1 FROM ref_sekolah_lokal s WHERE s.npsn = p_npsn AND s.wilayah_kode LIKE app_ctx('wilayah') || '%')
    WHEN app_ctx('peran') IN ('SUPER_ADMIN','PEMANTAU','AUDITOR') THEN true
    ELSE false
  END
$$;

GRANT EXECUTE ON FUNCTION app_ctx(text), boleh_akses(char) TO arkas_app_pemantauan, arkas_worker_pemantauan;
GRANT EXECUTE ON FUNCTION segarkan_mv_hpp() TO arkas_worker_pemantauan;
REVOKE EXECUTE ON FUNCTION segarkan_mv_hpp() FROM PUBLIC;
GRANT SELECT ON ref_wilayah_lokal, ref_sekolah_lokal, rencana_sah_lokal, belanja_mitra_lokal, realisasi_lokal, periode_lokal, pembukaan_lokal,
  hpp_baris, hpp_cocok, hpp_ringkas, mv_hpp_jenjang TO arkas_app_pemantauan;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pemantauan TO arkas_worker_pemantauan;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA pemantauan TO arkas_worker_pemantauan;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['rencana_sah_lokal','belanja_mitra_lokal','realisasi_lokal','periode_lokal','hpp_baris','hpp_cocok','hpp_ringkas'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS p_baca ON %I', t);
    EXECUTE format('CREATE POLICY p_baca ON %I FOR SELECT TO arkas_app_pemantauan USING (boleh_akses(npsn))', t);
  END LOOP;
END $$;
-- Referensi sekolah: yang boleh diakses saja (nama sekolah tidak bocor ke wilayah lain).
ALTER TABLE ref_sekolah_lokal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_baca ON ref_sekolah_lokal;
CREATE POLICY p_baca ON ref_sekolah_lokal FOR SELECT TO arkas_app_pemantauan USING (boleh_akses(npsn));
-- mv_hpp_jenjang tidak memuat NPSN; hanya pusat yang membacanya lewat API (dicek di layanan).
RESET ROLE;
