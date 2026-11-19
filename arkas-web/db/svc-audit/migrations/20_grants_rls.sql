-- Hak akses dan RLS db_audit. API hanya membaca; pekerja menambah lewat tambah_jejak().
SET ROLE arkas_audit_owner;
SET search_path = audit;

CREATE OR REPLACE FUNCTION app_ctx(k text) RETURNS text
LANGUAGE sql STABLE SET search_path = audit, pg_temp AS $$ SELECT nullif(current_setting('app.' || k, true), '') $$;
-- UC-31: Auditor & Balai SDSP membaca semua rantai; Kepala Sekolah hanya rantai sekolahnya.
CREATE OR REPLACE FUNCTION boleh_akses(p_rantai varchar) RETURNS boolean
LANGUAGE sql STABLE SET search_path = audit, pg_temp AS $$
  SELECT CASE
    WHEN app_ctx('peran') IN ('AUDITOR','SUPER_ADMIN') THEN true
    WHEN app_ctx('peran') = 'KEPSEK' THEN p_rantai = app_ctx('npsn')
    ELSE false
  END
$$;

GRANT EXECUTE ON FUNCTION app_ctx(text), boleh_akses(varchar), kanonik(jejak), hitung_hash(jejak), verifikasi_rantai(smallint, text) TO arkas_app_audit, arkas_worker_audit;
GRANT EXECUTE ON FUNCTION tambah_jejak(uuid, text, text, text, text, text, uuid, text, text, text, text, jsonb, jsonb, timestamptz) TO arkas_worker_audit;
REVOKE EXECUTE ON FUNCTION tambah_jejak(uuid, text, text, text, text, text, uuid, text, text, text, text, jsonb, jsonb, timestamptz) FROM PUBLIC;
GRANT SELECT ON jejak, kepala_rantai TO arkas_app_audit;
GRANT SELECT ON jejak, kepala_rantai TO arkas_worker_audit;
GRANT SELECT, INSERT ON inbox_processed TO arkas_worker_audit;

ALTER TABLE jejak ENABLE ROW LEVEL SECURITY;
ALTER TABLE kepala_rantai ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_baca ON jejak;
CREATE POLICY p_baca ON jejak FOR SELECT TO arkas_app_audit USING (boleh_akses(rantai));
DROP POLICY IF EXISTS p_baca ON kepala_rantai;
CREATE POLICY p_baca ON kepala_rantai FOR SELECT TO arkas_app_audit USING (boleh_akses(rantai));

RESET ROLE;
