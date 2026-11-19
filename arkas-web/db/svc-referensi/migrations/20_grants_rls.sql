-- 13.4.3 Hak akses & RLS db_ref. Data referensi bukan data sekolah: dapat dibaca semua pengguna terautentikasi.
-- Penulisan: Balai SDSP (SUPER_ADMIN) untuk semua; Admin Dinas hanya tarif SSPD wilayahnya (UC-32).
SET ROLE arkas_ref_owner;
SET search_path = ref;

CREATE OR REPLACE FUNCTION app_ctx(k text) RETURNS text
LANGUAGE sql STABLE SET search_path = ref, pg_temp AS $$ SELECT nullif(current_setting('app.' || k, true), '') $$;
GRANT EXECUTE ON FUNCTION app_ctx(text) TO arkas_app_ref, arkas_worker_ref;
REVOKE EXECUTE ON FUNCTION terbit_ulang(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION terbit_ulang(uuid) TO arkas_app_ref;

GRANT SELECT ON wilayah, jenjang, satuan_pendidikan, direktorat, sumber_dana, sumber_dana_jenjang, kode_rekening, komponen, tarif_pajak TO arkas_app_ref;
GRANT INSERT, UPDATE ON wilayah, jenjang, satuan_pendidikan, direktorat, sumber_dana, sumber_dana_jenjang, kode_rekening, komponen, tarif_pajak TO arkas_app_ref;
GRANT SELECT ON outbox TO arkas_app_ref;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA ref TO arkas_worker_ref;
GRANT USAGE ON SEQUENCE versi_seq TO arkas_app_ref, arkas_worker_ref;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wilayah','jenjang','satuan_pendidikan','direktorat','sumber_dana','sumber_dana_jenjang','kode_rekening','komponen'] LOOP
    EXECUTE format('ALTER TABLE ref.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS p_baca ON ref.%I', t);
    EXECUTE format('CREATE POLICY p_baca ON ref.%I FOR SELECT TO arkas_app_ref USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS p_tulis ON ref.%I', t);
    EXECUTE format($p$CREATE POLICY p_tulis ON ref.%I FOR ALL TO arkas_app_ref USING (ref.app_ctx('peran') = 'SUPER_ADMIN') WITH CHECK (ref.app_ctx('peran') = 'SUPER_ADMIN')$p$, t);
  END LOOP;
END $$;

ALTER TABLE tarif_pajak ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_baca ON tarif_pajak;
CREATE POLICY p_baca ON tarif_pajak FOR SELECT TO arkas_app_ref USING (true);
DROP POLICY IF EXISTS p_balai ON tarif_pajak;
CREATE POLICY p_balai ON tarif_pajak FOR ALL TO arkas_app_ref
  USING (app_ctx('peran') = 'SUPER_ADMIN') WITH CHECK (app_ctx('peran') = 'SUPER_ADMIN' AND diubah_oleh::text = app_ctx('pengguna_id'));
DROP POLICY IF EXISTS p_dinas ON tarif_pajak;
CREATE POLICY p_dinas ON tarif_pajak FOR ALL TO arkas_app_ref
  USING (app_ctx('peran') = 'ADMIN_DINAS' AND jenis = 'SSPD' AND wilayah_kode <> '' AND wilayah_kode LIKE app_ctx('wilayah') || '%')
  WITH CHECK (app_ctx('peran') = 'ADMIN_DINAS' AND jenis = 'SSPD' AND wilayah_kode <> '' AND wilayah_kode LIKE app_ctx('wilayah') || '%'
              AND diubah_oleh::text = app_ctx('pengguna_id'));

RESET ROLE;
