-- 13.4.2 DDL db_ref. Data induk dibaca semua layanan lewat event ReferensiDiubah (proyeksi lokal), bukan kueri lintas basis data.
SET ROLE arkas_ref_owner;
SET search_path = ref;

-- Nomor versi global: setiap perubahan mendapat versi lebih besar; konsumen mengabaikan event berversi lebih lama.
CREATE SEQUENCE IF NOT EXISTS versi_seq;

CREATE TABLE IF NOT EXISTS wilayah (
  kode        varchar(6) PRIMARY KEY CHECK (kode ~ '^\d{2}(\d{2}){0,2}$'),
  nama        varchar(150) NOT NULL,
  induk_kode  varchar(6) REFERENCES wilayah(kode),
  aktif       boolean NOT NULL DEFAULT true,
  versi       bigint NOT NULL DEFAULT 0,
  CHECK ((length(kode) = 2) = (induk_kode IS NULL)),
  CHECK (induk_kode IS NULL OR kode LIKE induk_kode || '%')
);
CREATE TABLE IF NOT EXISTS jenjang (
  kode   varchar(6) PRIMARY KEY,
  nama   varchar(60) NOT NULL,
  aktif  boolean NOT NULL DEFAULT true,
  versi  bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS satuan_pendidikan (
  npsn            char(8) PRIMARY KEY CHECK (npsn ~ '^\d{8}$'),
  nama            varchar(200) NOT NULL,
  jenjang_kode    varchar(6) NOT NULL REFERENCES jenjang(kode),
  wilayah_kode    varchar(6) NOT NULL REFERENCES wilayah(kode),
  status_sekolah  varchar(8) NOT NULL CHECK (status_sekolah IN ('NEGERI','SWASTA')),
  aktif           boolean NOT NULL DEFAULT true,
  versi           bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS direktorat (
  kode         varchar(20) PRIMARY KEY,
  nama         varchar(150) NOT NULL,
  ditjen_kode  varchar(20) NOT NULL,
  ditjen_nama  varchar(150) NOT NULL,
  aktif        boolean NOT NULL DEFAULT true,
  versi        bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sumber_dana (
  kode             varchar(20) PRIMARY KEY CHECK (kode ~ '^[A-Z0-9_]+$'),
  nama             varchar(150) NOT NULL,
  kategori         varchar(8) NOT NULL CHECK (kategori IN ('BOSP','BANPER')),
  direktorat_kode  varchar(20) REFERENCES direktorat(kode),
  aktif            boolean NOT NULL DEFAULT true,
  versi            bigint NOT NULL DEFAULT 0
);
-- UC-02: sumber dana yang berhak dipilih per jenjang
CREATE TABLE IF NOT EXISTS sumber_dana_jenjang (
  sumber_dana_kode varchar(20) NOT NULL REFERENCES sumber_dana(kode),
  jenjang_kode     varchar(6) NOT NULL REFERENCES jenjang(kode),
  PRIMARY KEY (sumber_dana_kode, jenjang_kode)
);
CREATE TABLE IF NOT EXISTS kode_rekening (
  kode   varchar(30) PRIMARY KEY CHECK (kode ~ '^\d(\.\d{1,4}){3,6}$'),
  nama   varchar(250) NOT NULL,
  aktif  boolean NOT NULL DEFAULT true,
  versi  bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS komponen (
  sumber_dana_kode varchar(20) NOT NULL REFERENCES sumber_dana(kode),
  kode             char(2) NOT NULL,
  nama             varchar(200) NOT NULL,
  maks_persen      numeric(5,2) CHECK (maks_persen > 0 AND maks_persen <= 100),
  min_persen       numeric(5,2) CHECK (min_persen >= 0 AND min_persen <= 100),
  aktif            boolean NOT NULL DEFAULT true,
  versi            bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (sumber_dana_kode, kode),
  CHECK (min_persen IS NULL OR maks_persen IS NULL OR min_persen <= maks_persen)
);
-- Tarif pajak per kode rekening; wilayah_kode '' = nasional. Hanya SSPD (pajak daerah) boleh ditimpa per wilayah (UC-32).
CREATE TABLE IF NOT EXISTS tarif_pajak (
  kode_rekening     varchar(30) NOT NULL REFERENCES kode_rekening(kode),
  jenis             varchar(10) NOT NULL CHECK (jenis IN ('PPN','PPH21','PPH23','SSPD')),
  wilayah_kode      varchar(6) NOT NULL DEFAULT '',
  tarif             numeric(6,4) NOT NULL CHECK (tarif > 0 AND tarif < 1),
  tarif_tanpa_npwp  numeric(6,4) CHECK (tarif_tanpa_npwp > 0 AND tarif_tanpa_npwp < 1),
  dasar_hukum       varchar(300),
  aktif             boolean NOT NULL DEFAULT true,
  diubah_oleh       uuid,
  diubah_at         timestamptz NOT NULL DEFAULT now(),
  versi             bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (kode_rekening, jenis, wilayah_kode),
  CHECK (wilayah_kode = '' OR (jenis = 'SSPD' AND wilayah_kode ~ '^\d{2}(\d{2}){0,2}$'))
);

CREATE TABLE IF NOT EXISTS outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, topik varchar(80) NOT NULL,
  tipe varchar(60) NOT NULL, agregat_id varchar(60) NOT NULL, correlation_id uuid, payload jsonb NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU','TERKIRIM','MATI')), percobaan smallint NOT NULL DEFAULT 0,
  galat_terakhir text, berikutnya_at timestamptz NOT NULL DEFAULT now(), dibuat_at timestamptz NOT NULL DEFAULT now(), terkirim_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_outbox_antre ON outbox (berikutnya_at) WHERE status = 'MENUNGGU';
CREATE TABLE IF NOT EXISTS inbox_processed (event_id uuid PRIMARY KEY, topik varchar(80) NOT NULL, diproses_at timestamptz NOT NULL DEFAULT now());

-- ---------- Event ReferensiDiubah dari trigger: perubahan apa pun (API, SQL, impor) selalu sampai ke konsumen ----------
CREATE OR REPLACE FUNCTION muatan_referensi(t text, r jsonb, OUT entitas text, OUT kunci text, OUT data jsonb)
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  CASE t
    WHEN 'wilayah' THEN entitas := 'WILAYAH'; kunci := r->>'kode';
      data := jsonb_build_object('kode', r->'kode', 'nama', r->'nama', 'indukKode', r->'induk_kode');
    WHEN 'jenjang' THEN entitas := 'JENJANG'; kunci := r->>'kode'; data := jsonb_build_object('kode', r->'kode', 'nama', r->'nama');
    WHEN 'satuan_pendidikan' THEN entitas := 'SEKOLAH'; kunci := r->>'npsn';
      data := jsonb_build_object('npsn', r->'npsn', 'nama', r->'nama', 'jenjangKode', r->'jenjang_kode', 'wilayahKode', r->'wilayah_kode', 'statusSekolah', r->'status_sekolah');
    WHEN 'direktorat' THEN entitas := 'DIREKTORAT'; kunci := r->>'kode';
      data := jsonb_build_object('kode', r->'kode', 'nama', r->'nama', 'ditjenKode', r->'ditjen_kode', 'ditjenNama', r->'ditjen_nama');
    WHEN 'sumber_dana' THEN entitas := 'SUMBER_DANA'; kunci := r->>'kode';
      data := jsonb_build_object('kode', r->'kode', 'nama', r->'nama', 'kategori', r->'kategori', 'direktoratKode', r->'direktorat_kode');
    WHEN 'kode_rekening' THEN entitas := 'KODE_REKENING'; kunci := r->>'kode'; data := jsonb_build_object('kode', r->'kode', 'nama', r->'nama');
    WHEN 'komponen' THEN entitas := 'KOMPONEN'; kunci := (r->>'sumber_dana_kode') || ':' || (r->>'kode');
      data := jsonb_build_object('sumberDanaKode', r->'sumber_dana_kode', 'kode', r->'kode', 'nama', r->'nama',
        'maksPersen', (r->>'maks_persen')::numeric, 'minPersen', (r->>'min_persen')::numeric);
    WHEN 'tarif_pajak' THEN entitas := 'TARIF_PAJAK'; kunci := (r->>'kode_rekening') || ':' || (r->>'jenis') || ':' || (r->>'wilayah_kode');
      data := jsonb_build_object('kodeRekening', r->'kode_rekening', 'jenis', r->'jenis', 'wilayahKode', r->'wilayah_kode',
        'tarif', (r->>'tarif')::numeric, 'tarifTanpaNpwp', (r->>'tarif_tanpa_npwp')::numeric);
  END CASE;
END $$;

CREATE OR REPLACE FUNCTION beri_versi() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'HAPUS_DILARANG' USING DETAIL = 'Nonaktifkan (aktif = false), jangan hapus'; END IF;
  NEW.versi := nextval('ref.versi_seq');
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION terbitkan_referensi() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ref, pg_temp AS $$
DECLARE m record; r jsonb := to_jsonb(NEW);
BEGIN
  SELECT * INTO m FROM muatan_referensi(TG_TABLE_NAME, r);
  INSERT INTO outbox (topik, tipe, agregat_id, payload)
  VALUES ('arkas.ref.referensi-diubah', 'ReferensiDiubah', left(m.entitas || ':' || m.kunci, 60),
          jsonb_build_object('entitas', m.entitas, 'kunci', m.kunci, 'versi', (r->>'versi')::bigint, 'aktif', (r->>'aktif')::boolean, 'data', m.data));
  RETURN NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wilayah','jenjang','satuan_pendidikan','direktorat','sumber_dana','kode_rekening','komponen','tarif_pajak'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_versi ON ref.%I', t);
    EXECUTE format('CREATE TRIGGER trg_versi BEFORE INSERT OR UPDATE OR DELETE ON ref.%I FOR EACH ROW EXECUTE FUNCTION ref.beri_versi()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_terbit ON ref.%I', t);
    EXECUTE format('CREATE TRIGGER trg_terbit AFTER INSERT OR UPDATE ON ref.%I FOR EACH ROW EXECUTE FUNCTION ref.terbitkan_referensi()', t);
  END LOOP;
END $$;

-- Terbit ulang seluruh referensi (mengisi layanan/proyeksi baru) TANPA mengubah versi: konsumen yang sudah mutakhir mengabaikannya.
CREATE OR REPLACE FUNCTION terbit_ulang(p_correlation uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ref, pg_temp AS $$
DECLARE t text; n integer := 0; k integer; m record; baris jsonb;
BEGIN
  -- urutan menjaga ketergantungan proyeksi (wilayah sebelum sekolah, dst.)
  FOREACH t IN ARRAY ARRAY['wilayah','jenjang','direktorat','sumber_dana','kode_rekening','satuan_pendidikan','komponen','tarif_pajak'] LOOP
    FOR baris IN EXECUTE format('SELECT to_jsonb(x) FROM ref.%I x ORDER BY versi', t) LOOP
      SELECT * INTO m FROM muatan_referensi(t, baris);
      INSERT INTO outbox (topik, tipe, agregat_id, correlation_id, payload)
      VALUES ('arkas.ref.referensi-diubah', 'ReferensiDiubah', left(m.entitas || ':' || m.kunci, 60), p_correlation,
              jsonb_build_object('entitas', m.entitas, 'kunci', m.kunci, 'versi', (baris->>'versi')::bigint, 'aktif', (baris->>'aktif')::boolean, 'data', m.data));
      n := n + 1;
    END LOOP;
  END LOOP;
  RETURN n;
END $$;

RESET ROLE;
