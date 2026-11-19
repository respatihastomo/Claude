-- 13.4.2 DDL db_auth: 3 tabel (pengguna, peran_pengguna, sesi) + proyeksi lokal + outbox/inbox.
SET ROLE arkas_auth_owner;
SET search_path = auth;

-- ---------- Proyeksi lokal (sumber: svc-referensi) ----------
CREATE TABLE IF NOT EXISTS ref_wilayah_lokal (kode varchar(6) PRIMARY KEY, nama varchar(150) NOT NULL, induk_kode varchar(6));
CREATE TABLE IF NOT EXISTS ref_direktorat_lokal (kode varchar(20) PRIMARY KEY, nama varchar(150) NOT NULL, ditjen_kode varchar(20) NOT NULL);
CREATE TABLE IF NOT EXISTS ref_sekolah_lokal (npsn char(8) PRIMARY KEY, nama varchar(200) NOT NULL, wilayah_kode varchar(6) NOT NULL);

-- ---------- Domain ----------
CREATE TABLE IF NOT EXISTS pengguna (
  id           uuid PRIMARY KEY,
  email        varchar(200) NOT NULL UNIQUE CHECK (email = lower(email)),
  nama         varchar(150) NOT NULL,
  status       varchar(10) NOT NULL DEFAULT 'AKTIF' CHECK (status IN ('AKTIF','NONAKTIF')),
  sso_issuer   varchar(300),
  sso_sub      varchar(255),
  dibuat_oleh  uuid,
  dibuat_at    timestamptz NOT NULL DEFAULT now(),
  masuk_terakhir_at timestamptz,
  UNIQUE (sso_issuer, sso_sub),
  CHECK ((sso_issuer IS NULL) = (sso_sub IS NULL))
);

CREATE TABLE IF NOT EXISTS peran_pengguna (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pengguna_id      uuid NOT NULL REFERENCES pengguna(id),
  peran            varchar(20) NOT NULL CHECK (peran IN ('OPERATOR','BENDAHARA','KEPSEK','KOMITE','VERIFIKATOR_DINAS','ADMIN_DINAS',
                     'ADMIN_DIREKTORAT','TIM_KERJA','ADMIN_DITJEN','SUPER_ADMIN','PEMANTAU','AUDITOR')),
  npsn             char(8),
  wilayah_kode     varchar(6),
  direktorat_kode  varchar(20),
  ditjen_kode      varchar(20),
  berlaku_sampai   timestamptz,
  diberikan_oleh   uuid,
  diberikan_at     timestamptz NOT NULL DEFAULT now(),
  dicabut_oleh     uuid,
  dicabut_at       timestamptz,
  alasan_cabut     varchar(500),
  -- bentuk cakupan per jenis peran (sama dengan aturan validasiBentukCakupan)
  CHECK (
    (peran IN ('OPERATOR','BENDAHARA','KEPSEK','KOMITE') AND npsn IS NOT NULL AND wilayah_kode IS NULL AND direktorat_kode IS NULL AND ditjen_kode IS NULL) OR
    (peran IN ('VERIFIKATOR_DINAS','ADMIN_DINAS') AND wilayah_kode IS NOT NULL AND npsn IS NULL AND direktorat_kode IS NULL AND ditjen_kode IS NULL) OR
    (peran IN ('ADMIN_DIREKTORAT','TIM_KERJA') AND direktorat_kode IS NOT NULL AND npsn IS NULL AND wilayah_kode IS NULL AND ditjen_kode IS NULL) OR
    (peran = 'ADMIN_DITJEN' AND ditjen_kode IS NOT NULL AND npsn IS NULL AND wilayah_kode IS NULL AND direktorat_kode IS NULL) OR
    (peran IN ('SUPER_ADMIN','PEMANTAU','AUDITOR') AND npsn IS NULL AND wilayah_kode IS NULL AND direktorat_kode IS NULL AND ditjen_kode IS NULL)
  ),
  CHECK (peran <> 'AUDITOR' OR berlaku_sampai IS NOT NULL),
  CHECK ((dicabut_at IS NULL) = (dicabut_oleh IS NULL)),
  CHECK (diberikan_oleh IS NULL OR diberikan_oleh <> pengguna_id)
);
-- satu peran aktif yang sama untuk cakupan yang sama
CREATE UNIQUE INDEX IF NOT EXISTS ux_peran_aktif ON peran_pengguna
  (pengguna_id, peran, coalesce(npsn, ''), coalesce(wilayah_kode, ''), coalesce(direktorat_kode, ''), coalesce(ditjen_kode, '')) WHERE dicabut_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_peran_pengguna ON peran_pengguna (pengguna_id);

CREATE TABLE IF NOT EXISTS sesi (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash      char(64) NOT NULL UNIQUE,      -- SHA-256 dari token acak di cookie; token mentah tidak disimpan
  pengguna_id     uuid NOT NULL REFERENCES pengguna(id),
  peran_aktif_id  uuid REFERENCES peran_pengguna(id),
  metode          varchar(10) NOT NULL CHECK (metode IN ('SSO','DEV')),
  dibuat_at       timestamptz NOT NULL DEFAULT now(),
  terakhir_at     timestamptz NOT NULL DEFAULT now(),
  kedaluwarsa_at  timestamptz NOT NULL,
  dicabut_at      timestamptz,
  ip              inet,
  user_agent      varchar(300)
);
CREATE INDEX IF NOT EXISTS ix_sesi_pengguna ON sesi (pengguna_id) WHERE dicabut_at IS NULL;

CREATE TABLE IF NOT EXISTS outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, topik varchar(80) NOT NULL,
  tipe varchar(60) NOT NULL, agregat_id varchar(60) NOT NULL, correlation_id uuid, payload jsonb NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU','TERKIRIM','MATI')), percobaan smallint NOT NULL DEFAULT 0,
  galat_terakhir text, berikutnya_at timestamptz NOT NULL DEFAULT now(), dibuat_at timestamptz NOT NULL DEFAULT now(), terkirim_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_outbox_antre ON outbox (berikutnya_at) WHERE status = 'MENUNGGU';
CREATE TABLE IF NOT EXISTS inbox_processed (event_id uuid PRIMARY KEY, topik varchar(80) NOT NULL, diproses_at timestamptz NOT NULL DEFAULT now());

-- Peran yang dicabut tidak dapat diaktifkan lagi; data identitas tidak dihapus (jejak).
CREATE OR REPLACE FUNCTION jaga_peran() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'HAPUS_DILARANG'; END IF;
  IF OLD.dicabut_at IS NOT NULL THEN RAISE EXCEPTION 'PERAN_SUDAH_DICABUT'; END IF;
  IF (NEW.pengguna_id, NEW.peran, NEW.npsn, NEW.wilayah_kode, NEW.direktorat_kode, NEW.ditjen_kode, NEW.diberikan_oleh, NEW.diberikan_at)
     IS DISTINCT FROM (OLD.pengguna_id, OLD.peran, OLD.npsn, OLD.wilayah_kode, OLD.direktorat_kode, OLD.ditjen_kode, OLD.diberikan_oleh, OLD.diberikan_at) THEN
    RAISE EXCEPTION 'PERAN_TIDAK_DAPAT_DIUBAH' USING DETAIL = 'Cabut lalu beri peran baru';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_jaga_peran ON peran_pengguna;
CREATE TRIGGER trg_jaga_peran BEFORE UPDATE OR DELETE ON peran_pengguna FOR EACH ROW EXECUTE FUNCTION jaga_peran();
-- Mencabut peran juga melepas sesi yang sedang memakainya sebagai peran aktif.
CREATE OR REPLACE FUNCTION lepas_peran_aktif() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = auth, pg_temp AS $$
BEGIN
  IF NEW.dicabut_at IS NOT NULL AND OLD.dicabut_at IS NULL THEN
    UPDATE sesi SET peran_aktif_id = NULL WHERE peran_aktif_id = NEW.id;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_lepas_peran ON peran_pengguna;
CREATE TRIGGER trg_lepas_peran AFTER UPDATE ON peran_pengguna FOR EACH ROW EXECUTE FUNCTION lepas_peran_aktif();

RESET ROLE;
