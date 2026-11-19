-- Hak akses db_integrasi. API (Balai SDSP/Pemantau) lewat RLS; endpoint Mitra & pekerja keluar memakai login pekerja
-- dengan penyaringan eksplisit per mitra_kode (identitas Mitra dari token OAuth2, bukan dari JWT pengguna).
SET ROLE arkas_integrasi_owner;
SET search_path = integrasi;

CREATE OR REPLACE FUNCTION app_ctx(k text) RETURNS text
LANGUAGE sql STABLE SET search_path = integrasi, pg_temp AS $$ SELECT nullif(current_setting('app.' || k, true), '') $$;
CREATE OR REPLACE FUNCTION boleh_baca() RETURNS boolean
LANGUAGE sql STABLE SET search_path = integrasi, pg_temp AS $$ SELECT app_ctx('peran') IN ('SUPER_ADMIN','PEMANTAU','AUDITOR') $$;

GRANT EXECUTE ON FUNCTION app_ctx(text), boleh_baca() TO arkas_app_integrasi, arkas_worker_integrasi;
GRANT SELECT ON mitra_siplah, sumber_dana_lokal, ref_sekolah_lokal, rkas_anggaran_mitra, sekolah_berhak_lokal,
  pembukaan_sumber_dana, pembukaan_riwayat, transaksi_mitra, item_mitra TO arkas_app_integrasi;
GRANT INSERT ON mitra_siplah, pembukaan_sumber_dana, pembukaan_riwayat TO arkas_app_integrasi;
GRANT UPDATE (nama, base_url, ip_diizinkan, status, diubah_at, client_secret_hash, hmac_rahasia) ON mitra_siplah TO arkas_app_integrasi;
GRANT UPDATE (versi, target, status, percobaan, berikutnya_at, galat_terakhir, diubah_at) ON pembukaan_sumber_dana TO arkas_app_integrasi;
GRANT INSERT ON outbox TO arkas_app_integrasi;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA integrasi TO arkas_app_integrasi, arkas_worker_integrasi;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA integrasi TO arkas_worker_integrasi;
GRANT DELETE ON sekolah_berhak_lokal TO arkas_worker_integrasi;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['mitra_siplah','sumber_dana_lokal','ref_sekolah_lokal','rkas_anggaran_mitra','sekolah_berhak_lokal','pembukaan_sumber_dana','pembukaan_riwayat','transaksi_mitra','item_mitra'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS p_baca ON %I', t);
    EXECUTE format('CREATE POLICY p_baca ON %I FOR SELECT TO arkas_app_integrasi USING (boleh_baca())', t);
  END LOOP;
END $$;
-- UC-34/37/39: hanya Balai SDSP yang mendaftarkan Mitra dan mengelola pembukaan.
DROP POLICY IF EXISTS p_balai_tambah ON mitra_siplah;
CREATE POLICY p_balai_tambah ON mitra_siplah FOR INSERT TO arkas_app_integrasi WITH CHECK (app_ctx('peran') = 'SUPER_ADMIN');
DROP POLICY IF EXISTS p_balai_ubah ON mitra_siplah;
CREATE POLICY p_balai_ubah ON mitra_siplah FOR UPDATE TO arkas_app_integrasi USING (app_ctx('peran') = 'SUPER_ADMIN');
DROP POLICY IF EXISTS p_balai_tambah ON pembukaan_sumber_dana;
CREATE POLICY p_balai_tambah ON pembukaan_sumber_dana FOR INSERT TO arkas_app_integrasi WITH CHECK (app_ctx('peran') = 'SUPER_ADMIN');
DROP POLICY IF EXISTS p_balai_ubah ON pembukaan_sumber_dana;
CREATE POLICY p_balai_ubah ON pembukaan_sumber_dana FOR UPDATE TO arkas_app_integrasi USING (app_ctx('peran') = 'SUPER_ADMIN');
DROP POLICY IF EXISTS p_balai_tambah ON pembukaan_riwayat;
CREATE POLICY p_balai_tambah ON pembukaan_riwayat FOR INSERT TO arkas_app_integrasi WITH CHECK (app_ctx('peran') = 'SUPER_ADMIN');

RESET ROLE;
