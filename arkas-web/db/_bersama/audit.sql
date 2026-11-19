-- Templat bersama (disertakan migrate.mjs lewat `-- #sertakan _bersama/audit.sql`; {{skema}} diganti skema layanan).
-- Trigger audit: setiap perubahan baris domain ditulis sebagai event AuditDicatat ke outbox lokal (transaksi yang sama),
-- lalu Outbox Relay mengirimnya ke svc-audit untuk dirangkai dengan SHA-256 (db_audit.jejak).
-- Argumen trigger: [0] kolom kunci dipisah koma (bawaan 'id'); [1] kolom yang disembunyikan (data pribadi, UU PDP);
-- [2] 'tabel_induk:kolom_fk' bila baris tidak punya kolom npsn (npsn diambil dari tabel induk lewat id).
CREATE OR REPLACE FUNCTION {{skema}}.catat_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = {{skema}}, pg_temp AS $$
DECLARE
  v_sebelum jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  v_sesudah jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  v_kolom_kunci text[] := string_to_array(coalesce(nullif(TG_ARGV[0], ''), 'id'), ',');
  v_sembunyi text[] := string_to_array(coalesce(TG_ARGV[1], ''), ',');
  v_baris jsonb;
  v_kunci text;
  v_npsn text;
  v_pelaku text := nullif(current_setting('app.pengguna_id', true), '');
  -- tabel berpartisi (mis. transaksi_2026) dicatat dengan nama tabel induknya
  v_tabel text := coalesce((SELECT c.relname::text FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhparent WHERE i.inhrelid = TG_RELID), TG_TABLE_NAME);
BEGIN
  IF v_sembunyi IS NOT NULL AND cardinality(v_sembunyi) > 0 THEN
    v_sebelum := v_sebelum - v_sembunyi;
    v_sesudah := v_sesudah - v_sembunyi;
  END IF;
  IF TG_OP = 'UPDATE' AND v_sebelum = v_sesudah THEN RETURN NULL; END IF;
  v_baris := coalesce(v_sesudah, v_sebelum);
  SELECT string_agg(coalesce(v_baris ->> k, ''), ':') INTO v_kunci FROM unnest(v_kolom_kunci) k;
  v_npsn := nullif(v_baris ->> 'npsn', '');
  IF v_npsn IS NULL AND coalesce(TG_ARGV[2], '') <> '' THEN
    EXECUTE format('SELECT npsn::text FROM {{skema}}.%I WHERE id = $1', split_part(TG_ARGV[2], ':', 1))
      INTO v_npsn USING (v_baris ->> split_part(TG_ARGV[2], ':', 2))::uuid;
  END IF;
  IF v_npsn !~ '^[0-9]{8}$' THEN v_npsn := NULL; END IF;
  IF v_pelaku !~ '^[0-9a-f-]{36}$' OR v_pelaku = '00000000-0000-0000-0000-000000000000' THEN v_pelaku := NULL; END IF;
  INSERT INTO {{skema}}.outbox (topik, tipe, agregat_id, correlation_id, payload)
  VALUES ('arkas.audit.dicatat', 'AuditDicatat', left(v_tabel || ':' || v_kunci, 60),
    CASE WHEN current_setting('app.request_id', true) ~ '^[0-9a-f-]{36}$' THEN current_setting('app.request_id', true)::uuid END,
    jsonb_build_object(
      'tabel', v_tabel, 'aksi', TG_OP, 'kunci', v_kunci, 'npsn', v_npsn,
      'pelakuId', v_pelaku,
      'peran', CASE WHEN v_pelaku IS NULL THEN 'SISTEM' ELSE nullif(current_setting('app.peran', true), '') END,
      'ip', nullif(current_setting('app.ip', true), ''),
      'requestId', nullif(current_setting('app.request_id', true), ''),
      'alasan', nullif(current_setting('app.alasan', true), ''),
      'sebelum', v_sebelum, 'sesudah', v_sesudah,
      'terjadiAt', to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')));
  RETURN NULL;
END $$;
