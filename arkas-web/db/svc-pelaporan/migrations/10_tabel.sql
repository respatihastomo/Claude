-- 13.4.2 DDL db_pelaporan: 1 tabel domain (laporan) + proyeksi lokal dari event svc-penatausahaan + outbox/inbox.
SET ROLE arkas_pelaporan_owner;
SET search_path = pelaporan;

-- Proyeksi dari PeriodeDitutup (7.3: pelaporan.bku_periode_ringkas).
CREATE TABLE IF NOT EXISTS bku_periode_ringkas (
  periode_id        uuid PRIMARY KEY,
  npsn              char(8) NOT NULL CHECK (npsn ~ '^[0-9]{8}$'),
  tahun             smallint NOT NULL,
  sumber_dana_kode  varchar(20) NOT NULL,
  bulan             smallint NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  ringkasan         jsonb NOT NULL,
  rekonsiliasi      jsonb NOT NULL,
  diajukan_oleh     uuid NOT NULL,
  ditutup_oleh      uuid NOT NULL,
  ditutup_at        timestamptz NOT NULL,
  diterima_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (npsn, tahun, sumber_dana_kode, bulan)
);

-- Proyeksi dari TransaksiDisetujui: baris BKU yang dicetak di laporan.
CREATE TABLE IF NOT EXISTS bku_transaksi_lokal (
  transaksi_id      uuid PRIMARY KEY,
  npsn              char(8) NOT NULL,
  tahun             smallint NOT NULL,
  sumber_dana_kode  varchar(20) NOT NULL,
  jenis             varchar(12) NOT NULL,
  tanggal           date NOT NULL,
  no_bukti          varchar(40),
  uraian            varchar(500) NOT NULL,
  cara_bayar        varchar(10),
  nama_toko         varchar(150),
  ntpn              char(16),
  nilai_bruto       numeric(18,2) NOT NULL,
  total_pajak       numeric(18,2) NOT NULL DEFAULT 0,
  items             jsonb NOT NULL DEFAULT '[]',
  pajak             jsonb NOT NULL DEFAULT '[]',
  disetujui_at      timestamptz NOT NULL,
  diterima_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_bku_lokal_bulan ON bku_transaksi_lokal (npsn, tahun, sumber_dana_kode, tanggal);

CREATE TABLE IF NOT EXISTS laporan (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis                varchar(20) NOT NULL CHECK (jenis IN ('BKU_BULANAN')),
  periode_id           uuid NOT NULL REFERENCES bku_periode_ringkas(periode_id),
  npsn                 char(8) NOT NULL,
  tahun                smallint NOT NULL,
  sumber_dana_kode     varchar(20) NOT NULL,
  bulan                smallint NOT NULL,
  status               varchar(16) NOT NULL DEFAULT 'MENUNGGU'
                       CHECK (status IN ('MENUNGGU','SIAP','GAGAL','DITANDATANGANI')),
  percobaan            smallint NOT NULL DEFAULT 0,
  berikutnya_at        timestamptz NOT NULL DEFAULT now(),
  galat_terakhir       text,
  berkas_kunci         varchar(300),
  berkas_sha256        char(64),
  berkas_ukuran        integer,
  siap_at              timestamptz,
  tertanda_kunci       varchar(300),
  tertanda_sha256      char(64),
  ditandatangani_oleh  uuid,
  ditandatangani_at    timestamptz,
  penyedia_tte         varchar(16) CHECK (penyedia_tte IN ('SIMULASI_DEV','BSRE')),
  row_version          integer NOT NULL DEFAULT 1,
  dibuat_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jenis, periode_id),
  CHECK (status NOT IN ('SIAP','DITANDATANGANI') OR (berkas_kunci IS NOT NULL AND berkas_sha256 IS NOT NULL)),
  CHECK ((status = 'DITANDATANGANI') = (ditandatangani_oleh IS NOT NULL AND tertanda_kunci IS NOT NULL AND penyedia_tte IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_laporan_antre ON laporan (berikutnya_at) WHERE status = 'MENUNGGU';
CREATE INDEX IF NOT EXISTS ix_laporan_buku ON laporan (npsn, tahun, sumber_dana_kode, bulan);

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
CREATE INDEX IF NOT EXISTS ix_outbox_antre ON outbox (berikutnya_at) WHERE status = 'MENUNGGU';

CREATE TABLE IF NOT EXISTS inbox_processed (
  event_id     uuid PRIMARY KEY,
  topik        varchar(80) NOT NULL,
  diproses_at  timestamptz NOT NULL DEFAULT now()
);

-- Laporan bertanda tangan bersifat final.
CREATE OR REPLACE FUNCTION jaga_laporan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'HAPUS_DILARANG'; END IF;
  IF OLD.status = 'DITANDATANGANI' THEN RAISE EXCEPTION 'LAPORAN_FINAL' USING DETAIL = 'Laporan bertanda tangan tidak dapat diubah'; END IF;
  IF NEW.status = 'DITANDATANGANI' AND OLD.status <> 'SIAP' THEN
    RAISE EXCEPTION 'LAPORAN_BELUM_SIAP' USING DETAIL = format('Laporan berstatus %s belum dapat ditandatangani', OLD.status);
  END IF;
  IF (NEW.jenis, NEW.periode_id, NEW.npsn, NEW.tahun, NEW.sumber_dana_kode, NEW.bulan)
     IS DISTINCT FROM (OLD.jenis, OLD.periode_id, OLD.npsn, OLD.tahun, OLD.sumber_dana_kode, OLD.bulan) THEN
    RAISE EXCEPTION 'LAPORAN_TIDAK_DAPAT_DIUBAH';
  END IF;
  NEW.row_version := OLD.row_version + 1;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_jaga_laporan ON laporan;
CREATE TRIGGER trg_jaga_laporan BEFORE UPDATE OR DELETE ON laporan FOR EACH ROW EXECUTE FUNCTION jaga_laporan();

RESET ROLE;
