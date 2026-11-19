-- DDL db_integrasi (svc-integrasi): Mitra SIPLah, pembukaan sumber dana, transaksi Mitra + proyeksi lokal + outbox/inbox.
SET ROLE arkas_integrasi_owner;
SET search_path = integrasi;

-- UC-34: Mitra SIPLah terdaftar. client_secret disimpan sebagai hash; rahasia HMAC perlu dibaca untuk verifikasi
-- (produksi: dienkripsi KMS / envelope encryption, Bab 14).
CREATE TABLE IF NOT EXISTS mitra_siplah (
  kode               varchar(20) PRIMARY KEY CHECK (kode ~ '^[A-Z0-9_]{3,20}$'),
  nama               varchar(150) NOT NULL,
  base_url           varchar(300) NOT NULL CHECK (base_url ~ '^https?://'),
  client_id          varchar(60)  NOT NULL UNIQUE,
  client_secret_hash char(64)     NOT NULL,
  hmac_rahasia       varchar(128) NOT NULL,
  ip_diizinkan       text[]       NOT NULL DEFAULT '{}',
  status             varchar(10)  NOT NULL DEFAULT 'AKTIF' CHECK (status IN ('AKTIF','NONAKTIF')),
  dibuat_oleh        uuid,
  dibuat_at          timestamptz  NOT NULL DEFAULT now(),
  diubah_at          timestamptz  NOT NULL DEFAULT now()
);

-- Proyeksi dari ReferensiDiubah.
CREATE TABLE IF NOT EXISTS sumber_dana_lokal (
  kode      varchar(20) PRIMARY KEY,
  nama      varchar(150) NOT NULL,
  kategori  varchar(10) NOT NULL,
  aktif     boolean NOT NULL,
  versi     bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS ref_sekolah_lokal (
  npsn          char(8) PRIMARY KEY,
  nama          varchar(200) NOT NULL,
  jenjang_kode  varchar(6) NOT NULL,
  wilayah_kode  varchar(6) NOT NULL,
  aktif         boolean NOT NULL,
  versi         bigint NOT NULL
);

-- Proyeksi dari KertasKerjaDisahkan: baris RKAS + sisa untuk melayani /mitra/v1/sekolah/{npsn}/anggaran (12.2).
-- akar_baris_id menyatukan baris lintas versi (pergeseran) agar belanja lama tetap mengurangi sisa baris penerusnya.
CREATE TABLE IF NOT EXISTS rkas_anggaran_mitra (
  baris_id          uuid PRIMARY KEY,
  akar_baris_id     uuid NOT NULL,
  kertas_kerja_id   uuid NOT NULL,
  npsn              char(8) NOT NULL,
  tahun             smallint NOT NULL,
  sumber_dana_kode  varchar(20) NOT NULL,
  versi             integer NOT NULL,
  kode_rekening     varchar(30) NOT NULL,
  kegiatan          varchar(300) NOT NULL,
  uraian            varchar(300) NOT NULL,
  volume            numeric(14,2) NOT NULL,
  satuan            varchar(30),
  harga_satuan      numeric(18,2) NOT NULL,
  total             numeric(18,2) NOT NULL,
  aktif             boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS ix_rkas_mitra_buku ON rkas_anggaran_mitra (npsn, tahun, sumber_dana_kode) WHERE aktif;

-- Sekolah berhak per sumber dana (12.3): BOSP dari RKAS yang disahkan; Bantuan Pemerintah dari penerima sah svc-bantuan.
CREATE TABLE IF NOT EXISTS sekolah_berhak_lokal (
  sumber_dana_kode  varchar(20) NOT NULL,
  tahun             smallint NOT NULL,
  npsn              char(8) NOT NULL,
  nilai             numeric(18,2) NOT NULL,
  asal              varchar(12) NOT NULL CHECK (asal IN ('RKAS','PENERIMA')),
  diubah_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sumber_dana_kode, tahun, npsn)
);

-- SK-08: satu baris per (sumber dana, Mitra). versi naik setiap perubahan/penutupan; target = keadaan yang dikirim.
CREATE TABLE IF NOT EXISTS pembukaan_sumber_dana (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sumber_dana_kode  varchar(20) NOT NULL,
  mitra_kode        varchar(20) NOT NULL REFERENCES mitra_siplah(kode),
  versi             integer NOT NULL DEFAULT 1 CHECK (versi > 0),
  target            varchar(5)  NOT NULL DEFAULT 'BUKA' CHECK (target IN ('BUKA','TUTUP')),
  status            varchar(10) NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU','TERKIRIM','DIBUKA','GAGAL','DITUTUP')),
  id_di_mitra       varchar(100),
  percobaan         smallint NOT NULL DEFAULT 0,
  berikutnya_at     timestamptz NOT NULL DEFAULT now(),
  galat_terakhir    text,
  dikonfirmasi_at   timestamptz,
  diubah_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sumber_dana_kode, mitra_kode)
);
CREATE INDEX IF NOT EXISTS ix_pembukaan_antre ON pembukaan_sumber_dana (berikutnya_at) WHERE status = 'MENUNGGU';
CREATE TABLE IF NOT EXISTS pembukaan_riwayat (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pembukaan_id  uuid NOT NULL REFERENCES pembukaan_sumber_dana(id),
  versi         integer NOT NULL,
  dari_status   varchar(10),
  ke_status     varchar(10) NOT NULL,
  peristiwa     varchar(30) NOT NULL,
  catatan       text,
  oleh          varchar(60),
  at            timestamptz NOT NULL DEFAULT now()
);

-- UC-35: transaksi dari Mitra. Kunci idempotensi (mitra_kode, transaction_id) — "Hook Integrasi ARKAS–SIPLah".
CREATE TABLE IF NOT EXISTS transaksi_mitra (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mitra_kode           varchar(20) NOT NULL REFERENCES mitra_siplah(kode),
  transaction_id       varchar(60) NOT NULL,
  npsn                 char(8) NOT NULL,
  tahun                smallint NOT NULL,
  sumber_dana_kode     varchar(20) NOT NULL,
  tanggal              date NOT NULL,
  nama_toko            varchar(150) NOT NULL,
  penjual_punya_npwp   boolean NOT NULL,
  total                numeric(18,2) NOT NULL CHECK (total > 0),
  status               varchar(10) NOT NULL DEFAULT 'DITERIMA' CHECK (status IN ('DITERIMA','DIBATALKAN','RETUR')),
  alasan_batal         varchar(500),
  payload_hash         char(64) NOT NULL,
  diterima_at          timestamptz NOT NULL DEFAULT now(),
  dibatalkan_at        timestamptz,
  UNIQUE (mitra_kode, transaction_id)
);
CREATE INDEX IF NOT EXISTS ix_trx_mitra_sekolah ON transaksi_mitra (npsn, tahun, sumber_dana_kode);
CREATE TABLE IF NOT EXISTS item_mitra (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaksi_id     uuid NOT NULL REFERENCES transaksi_mitra(id),
  item_id          varchar(60) NOT NULL,
  baris_id         uuid,
  akar_baris_id    uuid,
  kode_rekening    varchar(30) NOT NULL,
  uraian           varchar(300) NOT NULL,
  volume           numeric(14,2) NOT NULL CHECK (volume > 0),
  satuan           varchar(30),
  harga_satuan     numeric(18,2) NOT NULL CHECK (harga_satuan > 0),
  jumlah           numeric(18,2) NOT NULL,
  UNIQUE (transaksi_id, item_id)
);
CREATE INDEX IF NOT EXISTS ix_item_mitra_akar ON item_mitra (akar_baris_id);

CREATE TABLE IF NOT EXISTS outbox (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id        uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  topik           varchar(80) NOT NULL,
  tipe            varchar(60) NOT NULL,
  agregat_id      varchar(60) NOT NULL,
  correlation_id  uuid,
  payload         jsonb NOT NULL,
  status          varchar(10) NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU','TERKIRIM','MATI')),
  percobaan       smallint NOT NULL DEFAULT 0,
  galat_terakhir  text,
  berikutnya_at   timestamptz NOT NULL DEFAULT now(),
  dibuat_at       timestamptz NOT NULL DEFAULT now(),
  terkirim_at     timestamptz
);
CREATE INDEX IF NOT EXISTS ix_outbox_menunggu ON outbox (berikutnya_at) WHERE status = 'MENUNGGU';
CREATE TABLE IF NOT EXISTS inbox_processed (
  event_id     uuid PRIMARY KEY,
  topik        varchar(80) NOT NULL,
  diproses_at  timestamptz NOT NULL DEFAULT now()
);

-- Transaksi Mitra bersifat final: tidak dihapus; pembatalan/retur hanya mengubah status satu kali.
CREATE OR REPLACE FUNCTION jaga_transaksi_mitra() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'HAPUS_DILARANG'; END IF;
  IF OLD.status <> 'DITERIMA' THEN RAISE EXCEPTION 'TRANSAKSI_MITRA_FINAL' USING DETAIL = format('Transaksi berstatus %s tidak dapat diubah', OLD.status); END IF;
  IF (NEW.mitra_kode, NEW.transaction_id, NEW.npsn, NEW.total, NEW.payload_hash) IS DISTINCT FROM (OLD.mitra_kode, OLD.transaction_id, OLD.npsn, OLD.total, OLD.payload_hash) THEN
    RAISE EXCEPTION 'TRANSAKSI_MITRA_FINAL' USING DETAIL = 'Isi transaksi Mitra tidak dapat diubah';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_jaga ON transaksi_mitra;
CREATE TRIGGER trg_jaga BEFORE UPDATE OR DELETE ON transaksi_mitra FOR EACH ROW EXECUTE FUNCTION jaga_transaksi_mitra();
CREATE OR REPLACE FUNCTION tolak_ubah_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'TRANSAKSI_MITRA_FINAL' USING DETAIL = 'Item transaksi Mitra tidak dapat diubah'; END $$;
DROP TRIGGER IF EXISTS trg_jaga ON item_mitra;
CREATE TRIGGER trg_jaga BEFORE UPDATE OR DELETE ON item_mitra FOR EACH ROW EXECUTE FUNCTION tolak_ubah_item();

RESET ROLE;
