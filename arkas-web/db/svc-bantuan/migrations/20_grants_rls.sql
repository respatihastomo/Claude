-- Hak akses & RLS db_banper. Lapis kedua setelah ScopeGuard + pemeriksaan peran di layanan.
SET ROLE arkas_banper_owner;
SET search_path = banper;

CREATE OR REPLACE FUNCTION app_ctx(k text) RETURNS text
LANGUAGE sql STABLE SET search_path = banper, pg_temp AS $$ SELECT nullif(current_setting('app.' || k, true), '') $$;
-- Siapa yang boleh melihat satu sumber dana bantuan.
CREATE OR REPLACE FUNCTION boleh_lihat(p_kode varchar) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = banper, pg_temp AS $$
  SELECT CASE
    WHEN app_ctx('peran') IN ('SUPER_ADMIN','PEMANTAU','AUDITOR') THEN true
    WHEN app_ctx('peran') IN ('ADMIN_DIREKTORAT','TIM_KERJA') THEN
      EXISTS (SELECT 1 FROM sumber_dana_bantuan s WHERE s.kode = p_kode AND s.direktorat_kode = ANY (string_to_array(app_ctx('direktorat'), ',')))
    WHEN app_ctx('peran') = 'ADMIN_DITJEN' THEN
      EXISTS (SELECT 1 FROM sumber_dana_bantuan s JOIN ref_direktorat_lokal d ON d.kode = s.direktorat_kode WHERE s.kode = p_kode AND d.ditjen_kode = app_ctx('ditjen'))
    -- fitur 14: sekolah hanya melihat bantuan yang sudah disahkan dan mencantumkannya sebagai penerima
    WHEN app_ctx('peran') IN ('OPERATOR','BENDAHARA','KEPSEK','KOMITE') THEN
      EXISTS (SELECT 1 FROM sumber_dana_bantuan s JOIN penerima p ON p.sumber_dana_kode = s.kode WHERE s.kode = p_kode AND s.status = 'DISAHKAN' AND p.npsn = app_ctx('npsn'))
    ELSE false
  END
$$;
CREATE OR REPLACE FUNCTION direktorat_saya(p_kode varchar) RETURNS boolean
LANGUAGE sql STABLE SET search_path = banper, pg_temp AS $$ SELECT p_kode = ANY (string_to_array(app_ctx('direktorat'), ',')) $$;

GRANT EXECUTE ON FUNCTION app_ctx(text), boleh_lihat(varchar), direktorat_saya(varchar) TO arkas_app_banper, arkas_worker_banper;
GRANT SELECT ON ALL TABLES IN SCHEMA banper TO arkas_app_banper;
REVOKE SELECT ON outbox, inbox_processed FROM arkas_app_banper;
GRANT SELECT (event_id) ON outbox TO arkas_app_banper;
GRANT INSERT ON sumber_dana_bantuan, dokumen, komponen_bantuan, penerima, impor_penerima, pks_bank, penyaluran, pengajuan_sekolah, outbox TO arkas_app_banper;
GRANT UPDATE ON sumber_dana_bantuan, dokumen, komponen_bantuan, penerima, pks_bank, pengajuan_sekolah TO arkas_app_banper;
GRANT DELETE ON komponen_bantuan, penerima TO arkas_app_banper;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA banper TO arkas_worker_banper;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA banper TO arkas_app_banper, arkas_worker_banper;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['dokumen','komponen_bantuan','penerima','impor_penerima','pks_bank','penyaluran'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS p_baca ON %I', t);
    EXECUTE format('CREATE POLICY p_baca ON %I FOR SELECT TO arkas_app_banper USING (boleh_lihat(sumber_dana_kode))', t);
    EXECUTE format('DROP POLICY IF EXISTS p_tulis ON %I', t);
    -- tulis data sumber dana hanya oleh Admin Direktorat pemiliknya; keputusan dokumen dicek di layanan (Ditjen/Direktorat)
    EXECUTE format('CREATE POLICY p_tulis ON %I FOR ALL TO arkas_app_banper USING (boleh_lihat(sumber_dana_kode) AND app_ctx(''peran'') IN (''ADMIN_DIREKTORAT'',''ADMIN_DITJEN'')) WITH CHECK (boleh_lihat(sumber_dana_kode) AND app_ctx(''peran'') IN (''ADMIN_DIREKTORAT'',''ADMIN_DITJEN''))', t);
  END LOOP;
END $$;
-- penerima: sekolah hanya melihat barisnya sendiri
DROP POLICY IF EXISTS p_baca ON penerima;
CREATE POLICY p_baca ON penerima FOR SELECT TO arkas_app_banper
  USING (boleh_lihat(sumber_dana_kode) AND (app_ctx('peran') NOT IN ('OPERATOR','BENDAHARA','KEPSEK','KOMITE') OR npsn = app_ctx('npsn')));
DROP POLICY IF EXISTS p_baca ON penyaluran;
CREATE POLICY p_baca ON penyaluran FOR SELECT TO arkas_app_banper
  USING (boleh_lihat(sumber_dana_kode) AND (app_ctx('peran') NOT IN ('OPERATOR','BENDAHARA','KEPSEK','KOMITE') OR npsn = app_ctx('npsn')));

ALTER TABLE sumber_dana_bantuan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_baca ON sumber_dana_bantuan;
CREATE POLICY p_baca ON sumber_dana_bantuan FOR SELECT TO arkas_app_banper USING (boleh_lihat(kode));
DROP POLICY IF EXISTS p_buat ON sumber_dana_bantuan;
CREATE POLICY p_buat ON sumber_dana_bantuan FOR INSERT TO arkas_app_banper WITH CHECK (app_ctx('peran') = 'ADMIN_DIREKTORAT' AND direktorat_saya(direktorat_kode));
DROP POLICY IF EXISTS p_ubah ON sumber_dana_bantuan;
CREATE POLICY p_ubah ON sumber_dana_bantuan FOR UPDATE TO arkas_app_banper
  USING (boleh_lihat(kode) AND app_ctx('peran') IN ('ADMIN_DIREKTORAT','SUPER_ADMIN'))
  WITH CHECK (app_ctx('peran') IN ('ADMIN_DIREKTORAT','SUPER_ADMIN'));

ALTER TABLE pengajuan_sekolah ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_baca ON pengajuan_sekolah;
CREATE POLICY p_baca ON pengajuan_sekolah FOR SELECT TO arkas_app_banper
  USING (boleh_lihat(sumber_dana_kode) AND (app_ctx('peran') NOT IN ('OPERATOR','BENDAHARA','KEPSEK','KOMITE') OR npsn = app_ctx('npsn')));
DROP POLICY IF EXISTS p_sekolah ON pengajuan_sekolah;
CREATE POLICY p_sekolah ON pengajuan_sekolah FOR ALL TO arkas_app_banper
  USING (app_ctx('peran') IN ('OPERATOR','KEPSEK') AND npsn = app_ctx('npsn') AND boleh_lihat(sumber_dana_kode))
  WITH CHECK (app_ctx('peran') IN ('OPERATOR','KEPSEK') AND npsn = app_ctx('npsn') AND status IN ('DRAF','DIAJUKAN'));
DROP POLICY IF EXISTS p_penelaah ON pengajuan_sekolah;
CREATE POLICY p_penelaah ON pengajuan_sekolah FOR UPDATE TO arkas_app_banper
  USING (app_ctx('peran') IN ('TIM_KERJA','ADMIN_DIREKTORAT') AND boleh_lihat(sumber_dana_kode) AND status = 'DIAJUKAN')
  WITH CHECK (status IN ('DISETUJUI','DITOLAK','DIKEMBALIKAN'));
RESET ROLE;
