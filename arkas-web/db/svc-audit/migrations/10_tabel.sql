-- DDL db_audit: 1 tabel inti (jejak, append-only, partisi per tahun) + kepala rantai + inbox_processed.
-- Rantai hash SHA-256 terpisah per (tahun, rantai); rantai = NPSN sekolah, atau 'NASIONAL' untuk data tanpa sekolah
-- (Bab 19: partisi rantai per NPSN agar penguncian urutan tidak menjadi titik antre).
SET ROLE arkas_audit_owner;
SET search_path = audit;

CREATE TABLE IF NOT EXISTS jejak (
  tahun         smallint    NOT NULL,
  rantai        varchar(10) NOT NULL CHECK (rantai = 'NASIONAL' OR rantai ~ '^[0-9]{8}$'),
  urutan        bigint      NOT NULL CHECK (urutan > 0),
  event_id      uuid        NOT NULL,
  layanan       varchar(40) NOT NULL,
  tabel         varchar(60) NOT NULL,
  aksi          varchar(6)  NOT NULL CHECK (aksi IN ('INSERT','UPDATE','DELETE')),
  kunci         varchar(200) NOT NULL,
  npsn          char(8),
  pelaku_id     uuid,
  peran         varchar(20),
  ip            varchar(45),
  request_id    varchar(64),
  alasan        varchar(500),
  sebelum       jsonb,
  sesudah       jsonb,
  terjadi_at    timestamptz NOT NULL,
  dicatat_at    timestamptz NOT NULL DEFAULT now(),
  hash_sebelum  char(64)    NOT NULL,
  hash          char(64)    NOT NULL,
  PRIMARY KEY (tahun, rantai, urutan),
  UNIQUE (tahun, event_id)
) PARTITION BY LIST (tahun);
CREATE TABLE IF NOT EXISTS jejak_2025 PARTITION OF jejak FOR VALUES IN (2025);
CREATE TABLE IF NOT EXISTS jejak_2026 PARTITION OF jejak FOR VALUES IN (2026);
CREATE TABLE IF NOT EXISTS jejak_2027 PARTITION OF jejak FOR VALUES IN (2027);
CREATE TABLE IF NOT EXISTS jejak_lain PARTITION OF jejak DEFAULT;
CREATE INDEX IF NOT EXISTS ix_jejak_waktu ON jejak (tahun, terjadi_at DESC);
CREATE INDEX IF NOT EXISTS ix_jejak_kunci ON jejak (layanan, tabel, kunci);
CREATE INDEX IF NOT EXISTS ix_jejak_pelaku ON jejak (pelaku_id, terjadi_at DESC);

CREATE TABLE IF NOT EXISTS kepala_rantai (
  tahun        smallint    NOT NULL,
  rantai       varchar(10) NOT NULL,
  urutan       bigint      NOT NULL,
  hash         char(64)    NOT NULL,
  diubah_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tahun, rantai)
);

CREATE TABLE IF NOT EXISTS inbox_processed (
  event_id     uuid PRIMARY KEY,
  topik        varchar(80) NOT NULL,
  diproses_at  timestamptz NOT NULL DEFAULT now()
);

-- Append-only: UPDATE/DELETE/TRUNCATE ditolak untuk siapa pun (termasuk pemilik), di luar hak akses.
CREATE OR REPLACE FUNCTION tolak_ubah_jejak() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'JEJAK_APPEND_ONLY' USING DETAIL = 'Jejak audit tidak dapat diubah atau dihapus';
END $$;
DROP TRIGGER IF EXISTS trg_append_only ON jejak;
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON jejak FOR EACH ROW EXECUTE FUNCTION tolak_ubah_jejak();
DROP TRIGGER IF EXISTS trg_append_only_truncate ON jejak;
CREATE TRIGGER trg_append_only_truncate BEFORE TRUNCATE ON jejak FOR EACH STATEMENT EXECUTE FUNCTION tolak_ubah_jejak();

-- Teks kanonik satu entri: jsonb::text deterministik (urutan kunci dinormalkan PostgreSQL), waktu dalam UTC mikrodetik.
CREATE OR REPLACE FUNCTION kanonik(j jejak) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = audit, pg_temp AS $$
  SELECT jsonb_build_object(
    'tahun', j.tahun, 'rantai', j.rantai, 'urutan', j.urutan, 'eventId', j.event_id, 'layanan', j.layanan, 'tabel', j.tabel,
    'aksi', j.aksi, 'kunci', j.kunci, 'npsn', j.npsn, 'pelakuId', j.pelaku_id, 'peran', j.peran, 'ip', j.ip,
    'requestId', j.request_id, 'alasan', j.alasan, 'sebelum', j.sebelum, 'sesudah', j.sesudah,
    'terjadiAt', to_char(j.terjadi_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))::text
$$;
CREATE OR REPLACE FUNCTION hitung_hash(j jejak) RETURNS char(64) LANGUAGE sql IMMUTABLE SET search_path = audit, pg_temp AS $$
  SELECT encode(sha256(convert_to(j.hash_sebelum || E'\n' || kanonik(j), 'UTF8')), 'hex')
$$;

-- Menambah satu entri ke rantainya: kunci baris kepala (antre per rantai saja), hitung hash, sisipkan, majukan kepala.
CREATE OR REPLACE FUNCTION tambah_jejak(
  p_event_id uuid, p_layanan text, p_tabel text, p_aksi text, p_kunci text, p_npsn text, p_pelaku uuid, p_peran text,
  p_ip text, p_request_id text, p_alasan text, p_sebelum jsonb, p_sesudah jsonb, p_terjadi timestamptz
) RETURNS jejak LANGUAGE plpgsql SECURITY DEFINER SET search_path = audit, pg_temp AS $$
DECLARE
  v_tahun smallint := extract(year FROM p_terjadi AT TIME ZONE 'Asia/Jakarta');
  v_rantai text := coalesce(p_npsn, 'NASIONAL');
  k kepala_rantai;
  j jejak;
BEGIN
  INSERT INTO kepala_rantai (tahun, rantai, urutan, hash) VALUES (v_tahun, v_rantai, 0, repeat('0', 64)) ON CONFLICT DO NOTHING;
  SELECT * INTO k FROM kepala_rantai WHERE tahun = v_tahun AND rantai = v_rantai FOR UPDATE;
  j := ROW(v_tahun, v_rantai, k.urutan + 1, p_event_id, p_layanan, p_tabel, p_aksi, left(p_kunci, 200), p_npsn, p_pelaku, p_peran,
           left(p_ip, 45), left(p_request_id, 64), left(p_alasan, 500), p_sebelum, p_sesudah, p_terjadi, now(), k.hash, repeat('0', 64))::jejak;
  j.hash := hitung_hash(j);
  INSERT INTO jejak VALUES (j.*);
  UPDATE kepala_rantai SET urutan = j.urutan, hash = j.hash, diubah_at = now() WHERE tahun = v_tahun AND rantai = v_rantai;
  RETURN j;
END $$;

-- Verifikasi satu rantai: hash tiap entri dihitung ulang, tautan hash_sebelum & urutan diperiksa, ujungnya dicocokkan dengan kepala.
CREATE OR REPLACE FUNCTION verifikasi_rantai(p_tahun smallint, p_rantai text)
RETURNS TABLE (diperiksa bigint, rusak_urutan bigint, alasan text, hash_kepala char(64))
LANGUAGE sql STABLE SET search_path = audit, pg_temp AS $$
  WITH r AS (
    SELECT j.urutan, j.hash, j.hash_sebelum, hitung_hash(j) AS hitung,
           lag(j.hash) OVER w AS hash_lalu, lag(j.urutan) OVER w AS urutan_lalu
    FROM jejak j WHERE j.tahun = p_tahun AND j.rantai = p_rantai
    WINDOW w AS (ORDER BY j.urutan)
  ), salah AS (
    SELECT urutan, CASE
      WHEN urutan <> coalesce(urutan_lalu, 0) + 1 THEN 'URUTAN_TERPUTUS'
      WHEN hash_sebelum <> coalesce(hash_lalu, repeat('0', 64)) THEN 'TAUTAN_RUSAK'
      WHEN hitung <> hash THEN 'ISI_BERUBAH'
    END AS alasan
    FROM r
  ),
  ujung AS (SELECT coalesce(max(urutan), 0) AS urutan, (SELECT hash FROM r ORDER BY urutan DESC LIMIT 1) AS hash FROM r),
  kepala AS (SELECT coalesce((SELECT urutan FROM kepala_rantai WHERE tahun = p_tahun AND rantai = p_rantai), 0) AS urutan,
                    (SELECT hash FROM kepala_rantai WHERE tahun = p_tahun AND rantai = p_rantai) AS hash),
  -- entri di ujung yang dihapus tidak memutus tautan, tetapi tidak cocok lagi dengan kepala rantai
  hilang AS (SELECT u.urutan + 1 AS urutan, 'ENTRI_HILANG'::text AS alasan FROM ujung u, kepala k
             WHERE k.urutan <> u.urutan OR k.hash IS DISTINCT FROM u.hash),
  semua AS (SELECT urutan, alasan FROM salah WHERE alasan IS NOT NULL UNION ALL SELECT urutan, alasan FROM hilang)
  SELECT (SELECT count(*) FROM r), s.urutan, s.alasan, (SELECT hash FROM kepala)
  FROM (SELECT 1) x LEFT JOIN LATERAL (SELECT urutan, alasan FROM semua ORDER BY urutan LIMIT 1) s ON true
$$;

RESET ROLE;
