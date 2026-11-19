-- 13.4.3 Hak akses & RLS db_auth. API (pengelolaan pengguna) tunduk RLS; alur masuk/sesi/token memakai login pekerja.
SET ROLE arkas_auth_owner;
SET search_path = auth;

CREATE OR REPLACE FUNCTION app_ctx(k text) RETURNS text
LANGUAGE sql STABLE SET search_path = auth, pg_temp AS $$ SELECT nullif(current_setting('app.' || k, true), '') $$;

/** Apakah peran aktif pemanggil boleh MELIHAT/MENGELOLA baris peran ini (cerminan aturan periksaPemberianPeran). */
CREATE OR REPLACE FUNCTION dalam_kelola(p_peran varchar, p_npsn char(8), p_wilayah varchar, p_direktorat varchar, p_ditjen varchar) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = auth, pg_temp AS $$
  SELECT CASE app_ctx('peran')
    WHEN 'SUPER_ADMIN' THEN true
    WHEN 'ADMIN_DINAS' THEN
      coalesce(p_wilayah, (SELECT wilayah_kode FROM ref_sekolah_lokal WHERE npsn = p_npsn), '') LIKE app_ctx('wilayah') || '%'
      AND p_peran IN ('ADMIN_DINAS','VERIFIKATOR_DINAS','OPERATOR','BENDAHARA','KEPSEK','KOMITE')
    WHEN 'ADMIN_DITJEN' THEN
      p_direktorat IN (SELECT kode FROM ref_direktorat_lokal WHERE ditjen_kode = app_ctx('ditjen')) OR p_ditjen = app_ctx('ditjen')
    WHEN 'ADMIN_DIREKTORAT' THEN p_direktorat = split_part(app_ctx('direktorat'), ',', 1)
    WHEN 'OPERATOR' THEN p_npsn = app_ctx('npsn')
    ELSE false
  END
$$;

GRANT EXECUTE ON FUNCTION app_ctx(text), dalam_kelola(varchar, char, varchar, varchar, varchar) TO arkas_app_auth, arkas_worker_auth;
GRANT SELECT ON ref_wilayah_lokal, ref_direktorat_lokal, ref_sekolah_lokal TO arkas_app_auth;
GRANT SELECT, INSERT ON pengguna, peran_pengguna TO arkas_app_auth;
GRANT UPDATE (dicabut_oleh, dicabut_at, alasan_cabut) ON peran_pengguna TO arkas_app_auth;
GRANT INSERT ON outbox TO arkas_app_auth;
GRANT SELECT (event_id) ON outbox TO arkas_app_auth;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA auth TO arkas_worker_auth;

ALTER TABLE pengguna ENABLE ROW LEVEL SECURITY;
ALTER TABLE peran_pengguna ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_baca ON peran_pengguna;
CREATE POLICY p_baca ON peran_pengguna FOR SELECT TO arkas_app_auth
  USING (pengguna_id::text = app_ctx('pengguna_id') OR dalam_kelola(peran, npsn, wilayah_kode, direktorat_kode, ditjen_kode));
DROP POLICY IF EXISTS p_beri ON peran_pengguna;
CREATE POLICY p_beri ON peran_pengguna FOR INSERT TO arkas_app_auth
  WITH CHECK (dalam_kelola(peran, npsn, wilayah_kode, direktorat_kode, ditjen_kode) AND diberikan_oleh::text = app_ctx('pengguna_id')
              AND pengguna_id::text <> app_ctx('pengguna_id'));
DROP POLICY IF EXISTS p_cabut ON peran_pengguna;
CREATE POLICY p_cabut ON peran_pengguna FOR UPDATE TO arkas_app_auth
  USING (dalam_kelola(peran, npsn, wilayah_kode, direktorat_kode, ditjen_kode) AND pengguna_id::text <> app_ctx('pengguna_id'))
  WITH CHECK (dicabut_oleh::text = app_ctx('pengguna_id'));

-- Pengguna terlihat oleh dirinya sendiri, pembuatnya, dan pengelola yang dapat melihat salah satu perannya.
DROP POLICY IF EXISTS p_baca ON pengguna;
CREATE POLICY p_baca ON pengguna FOR SELECT TO arkas_app_auth
  USING (id::text = app_ctx('pengguna_id') OR dibuat_oleh::text = app_ctx('pengguna_id')
         OR EXISTS (SELECT 1 FROM peran_pengguna r WHERE r.pengguna_id = pengguna.id));
DROP POLICY IF EXISTS p_buat ON pengguna;
CREATE POLICY p_buat ON pengguna FOR INSERT TO arkas_app_auth
  WITH CHECK (dibuat_oleh::text = app_ctx('pengguna_id') AND app_ctx('peran') IN ('SUPER_ADMIN','ADMIN_DITJEN','ADMIN_DIREKTORAT','ADMIN_DINAS','OPERATOR'));

RESET ROLE;

-- Pemeriksaan keberadaan email TANPA membuka data pengguna di luar cakupan (mencegah duplikat akun saat admin menambah pengguna).
SET ROLE arkas_auth_owner;
CREATE OR REPLACE FUNCTION auth.email_terdaftar(p_email varchar) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = auth, pg_temp AS $$ SELECT EXISTS (SELECT 1 FROM pengguna WHERE email = lower(p_email)) $$;
REVOKE EXECUTE ON FUNCTION auth.email_terdaftar(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.email_terdaftar(varchar) TO arkas_app_auth;
RESET ROLE;
