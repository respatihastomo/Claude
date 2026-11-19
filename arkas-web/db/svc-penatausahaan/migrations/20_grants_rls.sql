-- 13.4.3 Hak akses dan RLS db_tatausaha. RLS adalah lapis kedua otorisasi (3.6) setelah ScopeGuard di aplikasi.
SET ROLE arkas_tatausaha_owner;
SET search_path = tatausaha;

CREATE OR REPLACE FUNCTION app_ctx(k text) RETURNS text
LANGUAGE sql STABLE SET search_path = tatausaha, pg_temp AS $$ SELECT nullif(current_setting('app.' || k, true), '') $$;

-- Cakupan baca. Peran Dinas/Direktorat butuh proyeksi wilayah & direktorat sekolah (irisan berikutnya): sementara ditolak.
CREATE OR REPLACE FUNCTION boleh_akses(p_npsn char(8), p_sumber varchar) RETURNS boolean
LANGUAGE sql STABLE SET search_path = tatausaha, pg_temp AS $$
  SELECT CASE
    WHEN app_ctx('peran') IN ('OPERATOR','BENDAHARA','KEPSEK','KOMITE') THEN p_npsn = app_ctx('npsn')
    WHEN app_ctx('peran') IN ('SUPER_ADMIN','PEMANTAU') THEN true
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION sekolah_sendiri(p_npsn char(8), VARIADIC p_peran text[]) RETURNS boolean
LANGUAGE sql STABLE SET search_path = tatausaha, pg_temp AS $$ SELECT app_ctx('peran') = ANY (p_peran) AND p_npsn = app_ctx('npsn') $$;

-- ---------- Hak akses API (arkas_app_tatausaha) ----------
GRANT EXECUTE ON FUNCTION app_ctx(text), boleh_akses(char, varchar), sekolah_sendiri(char, text[]) TO arkas_app_tatausaha, arkas_worker_tatausaha;
GRANT SELECT ON rkas_baris_sah, ref_rekening_pajak_lokal, periode, v_mutasi TO arkas_app_tatausaha;
GRANT SELECT, INSERT ON transaksi, item_transaksi, pajak TO arkas_app_tatausaha;
-- Hanya kolom keputusan yang boleh diubah; tidak ada DELETE (koreksi memakai transaksi pembalik).
GRANT UPDATE (status, diputuskan_oleh, diputuskan_at, alasan_tolak, row_version) ON transaksi TO arkas_app_tatausaha;
GRANT INSERT ON outbox TO arkas_app_tatausaha;
GRANT SELECT (event_id) ON outbox TO arkas_app_tatausaha;   -- untuk INSERT ... RETURNING event_id

-- ---------- Hak akses pekerja (consumer event & outbox relay) ----------
GRANT SELECT, INSERT, UPDATE ON rkas_baris_sah, ref_rekening_pajak_lokal, periode, inbox_processed TO arkas_worker_tatausaha;
GRANT SELECT, UPDATE ON outbox TO arkas_worker_tatausaha;
GRANT INSERT ON outbox TO arkas_worker_tatausaha;
GRANT SELECT ON transaksi, item_transaksi, pajak, v_mutasi TO arkas_worker_tatausaha;
GRANT EXECUTE ON FUNCTION pastikan_partisi(smallint) TO arkas_worker_tatausaha;
REVOKE EXECUTE ON FUNCTION pastikan_partisi(smallint) FROM PUBLIC;

-- ---------- Kebijakan RLS ----------
ALTER TABLE rkas_baris_sah ENABLE ROW LEVEL SECURITY;
ALTER TABLE periode        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi      ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_transaksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE pajak          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_baca ON rkas_baris_sah;
CREATE POLICY p_baca ON rkas_baris_sah FOR SELECT TO arkas_app_tatausaha USING (boleh_akses(npsn, sumber_dana_kode));
DROP POLICY IF EXISTS p_baca ON periode;
CREATE POLICY p_baca ON periode FOR SELECT TO arkas_app_tatausaha USING (boleh_akses(npsn, sumber_dana_kode));

DROP POLICY IF EXISTS p_baca ON transaksi;
CREATE POLICY p_baca ON transaksi FOR SELECT TO arkas_app_tatausaha USING (boleh_akses(npsn, sumber_dana_kode));
DROP POLICY IF EXISTS p_catat ON transaksi;
CREATE POLICY p_catat ON transaksi FOR INSERT TO arkas_app_tatausaha
  WITH CHECK (sekolah_sendiri(npsn, 'BENDAHARA') AND dibuat_oleh::text = app_ctx('pengguna_id') AND status = 'DICATAT');
DROP POLICY IF EXISTS p_putuskan ON transaksi;
CREATE POLICY p_putuskan ON transaksi FOR UPDATE TO arkas_app_tatausaha
  USING (sekolah_sendiri(npsn, 'KEPSEK'))
  WITH CHECK (sekolah_sendiri(npsn, 'KEPSEK') AND diputuskan_oleh::text = app_ctx('pengguna_id'));

DROP POLICY IF EXISTS p_baca ON item_transaksi;
CREATE POLICY p_baca ON item_transaksi FOR SELECT TO arkas_app_tatausaha USING (boleh_akses(npsn, sumber_dana_kode));
DROP POLICY IF EXISTS p_catat ON item_transaksi;
CREATE POLICY p_catat ON item_transaksi FOR INSERT TO arkas_app_tatausaha WITH CHECK (sekolah_sendiri(npsn, 'BENDAHARA'));

DROP POLICY IF EXISTS p_baca ON pajak;
CREATE POLICY p_baca ON pajak FOR SELECT TO arkas_app_tatausaha USING (boleh_akses(npsn, sumber_dana_kode));
DROP POLICY IF EXISTS p_catat ON pajak;
CREATE POLICY p_catat ON pajak FOR INSERT TO arkas_app_tatausaha WITH CHECK (sekolah_sendiri(npsn, 'BENDAHARA'));

RESET ROLE;
