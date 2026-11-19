-- 13.4.3 Hak akses dan RLS db_pelaporan.
SET ROLE arkas_pelaporan_owner;
SET search_path = pelaporan;

CREATE OR REPLACE FUNCTION app_ctx(k text) RETURNS text
LANGUAGE sql STABLE SET search_path = pelaporan, pg_temp AS $$ SELECT nullif(current_setting('app.' || k, true), '') $$;
CREATE OR REPLACE FUNCTION boleh_akses(p_npsn char(8), p_sumber varchar) RETURNS boolean
LANGUAGE sql STABLE SET search_path = pelaporan, pg_temp AS $$
  SELECT CASE
    WHEN app_ctx('peran') IN ('OPERATOR','BENDAHARA','KEPSEK','KOMITE') THEN p_npsn = app_ctx('npsn')
    WHEN app_ctx('peran') IN ('SUPER_ADMIN','PEMANTAU') THEN true
    ELSE false
  END
$$;

GRANT EXECUTE ON FUNCTION app_ctx(text), boleh_akses(char, varchar) TO arkas_app_pelaporan, arkas_worker_pelaporan;
GRANT SELECT ON laporan, bku_periode_ringkas, bku_transaksi_lokal TO arkas_app_pelaporan;
GRANT UPDATE (status, tertanda_kunci, tertanda_sha256, ditandatangani_oleh, ditandatangani_at, penyedia_tte) ON laporan TO arkas_app_pelaporan;
GRANT INSERT ON outbox TO arkas_app_pelaporan;
GRANT SELECT (event_id) ON outbox TO arkas_app_pelaporan;

GRANT SELECT, INSERT, UPDATE ON laporan, bku_periode_ringkas, bku_transaksi_lokal, inbox_processed TO arkas_worker_pelaporan;
GRANT SELECT, INSERT, UPDATE ON outbox TO arkas_worker_pelaporan;

ALTER TABLE laporan ENABLE ROW LEVEL SECURITY;
ALTER TABLE bku_periode_ringkas ENABLE ROW LEVEL SECURITY;
ALTER TABLE bku_transaksi_lokal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_baca ON laporan;
CREATE POLICY p_baca ON laporan FOR SELECT TO arkas_app_pelaporan USING (boleh_akses(npsn, sumber_dana_kode));
DROP POLICY IF EXISTS p_tanda_tangan ON laporan;
CREATE POLICY p_tanda_tangan ON laporan FOR UPDATE TO arkas_app_pelaporan
  USING (app_ctx('peran') = 'KEPSEK' AND npsn = app_ctx('npsn') AND status = 'SIAP')
  WITH CHECK (app_ctx('peran') = 'KEPSEK' AND npsn = app_ctx('npsn') AND status = 'DITANDATANGANI' AND ditandatangani_oleh::text = app_ctx('pengguna_id'));
DROP POLICY IF EXISTS p_baca ON bku_periode_ringkas;
CREATE POLICY p_baca ON bku_periode_ringkas FOR SELECT TO arkas_app_pelaporan USING (boleh_akses(npsn, sumber_dana_kode));
DROP POLICY IF EXISTS p_baca ON bku_transaksi_lokal;
CREATE POLICY p_baca ON bku_transaksi_lokal FOR SELECT TO arkas_app_pelaporan USING (boleh_akses(npsn, sumber_dana_kode));

RESET ROLE;
