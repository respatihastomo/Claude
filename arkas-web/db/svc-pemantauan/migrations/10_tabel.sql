-- DDL db_pemantauan (svc-pemantauan): HPP (hpp_baris, hpp_cocok) + MV mv_hpp_jenjang, dan proyeksi lokal dari event
-- (rencana_sah_lokal, belanja_mitra_lokal, realisasi_lokal, periode_lokal, ref_*). Semua data agregat; tanpa data pribadi.
SET ROLE arkas_pemantauan_owner;
SET search_path = pemantauan;

CREATE TABLE IF NOT EXISTS ref_wilayah_lokal (kode varchar(6) PRIMARY KEY, nama varchar(150) NOT NULL, induk_kode varchar(6), versi bigint NOT NULL);
CREATE TABLE IF NOT EXISTS ref_sekolah_lokal (
  npsn char(8) PRIMARY KEY, nama varchar(200) NOT NULL, jenjang_kode varchar(6) NOT NULL, wilayah_kode varchar(6) NOT NULL, aktif boolean NOT NULL, versi bigint NOT NULL
);

-- KertasKerjaDisahkan: rencana yang disahkan (versi terbaru aktif).
CREATE TABLE IF NOT EXISTS rencana_sah_lokal (
  baris_id uuid PRIMARY KEY, akar_baris_id uuid NOT NULL, npsn char(8) NOT NULL, tahun smallint NOT NULL, sumber_dana_kode varchar(20) NOT NULL,
  versi integer NOT NULL, kode_rekening varchar(30) NOT NULL, kegiatan varchar(300) NOT NULL, uraian varchar(300) NOT NULL,
  total numeric(18,2) NOT NULL, aktif boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS ix_rencana_buku ON rencana_sah_lokal (npsn, tahun, sumber_dana_kode) WHERE aktif;

-- TransaksiMitraDiterima/Dibatalkan: item belanja Mitra SIPLah.
CREATE TABLE IF NOT EXISTS belanja_mitra_lokal (
  transaksi_mitra_id uuid NOT NULL, item_id varchar(60) NOT NULL, npsn char(8) NOT NULL, tahun smallint NOT NULL, sumber_dana_kode varchar(20) NOT NULL,
  mitra_kode varchar(20) NOT NULL, transaction_id varchar(60) NOT NULL, tanggal date NOT NULL, baris_id uuid, akar_baris_id uuid,
  kode_rekening varchar(30) NOT NULL, uraian varchar(300) NOT NULL, jumlah numeric(18,2) NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'DITERIMA' CHECK (status IN ('DITERIMA','DIBATALKAN','RETUR')),
  PRIMARY KEY (transaksi_mitra_id, item_id)
);
CREATE INDEX IF NOT EXISTS ix_belanja_buku ON belanja_mitra_lokal (npsn, tahun, sumber_dana_kode);

-- TransaksiDisetujui (BELANJA): realisasi untuk serapan.
CREATE TABLE IF NOT EXISTS realisasi_lokal (
  transaksi_id uuid PRIMARY KEY, npsn char(8) NOT NULL, tahun smallint NOT NULL, sumber_dana_kode varchar(20) NOT NULL,
  tanggal date NOT NULL, nilai numeric(18,2) NOT NULL, dari_mitra boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS ix_realisasi_buku ON realisasi_lokal (npsn, tahun, sumber_dana_kode);

-- PeriodeDitutup: kepatuhan lapor (bulan yang sudah ditutup per buku).
CREATE TABLE IF NOT EXISTS periode_lokal (
  npsn char(8) NOT NULL, tahun smallint NOT NULL, sumber_dana_kode varchar(20) NOT NULL, bulan smallint NOT NULL, ditutup_at timestamptz NOT NULL,
  PRIMARY KEY (npsn, tahun, sumber_dana_kode, bulan)
);

-- PembukaanDikonfirmasi: status terakhir pembukaan per (sumber dana, Mitra) — alarm bila GAGAL.
CREATE TABLE IF NOT EXISTS pembukaan_lokal (
  sumber_dana_kode varchar(20) NOT NULL, mitra_kode varchar(20) NOT NULL, versi integer NOT NULL, status varchar(10) NOT NULL, at timestamptz NOT NULL,
  PRIMARY KEY (sumber_dana_kode, mitra_kode)
);

-- Antrean hitung ulang HPP (pekerja asinkron, SK-11). Satu baris per buku; event berulang hanya memperbarui waktunya.
CREATE TABLE IF NOT EXISTS hpp_antrean (
  npsn char(8) NOT NULL, tahun smallint NOT NULL, sumber_dana_kode varchar(20) NOT NULL, diminta_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (npsn, tahun, sumber_dana_kode)
);

-- Hasil HPP (fitur 20): kategori per baris rencana & pencocokan per item belanja.
CREATE TABLE IF NOT EXISTS hpp_baris (
  npsn char(8) NOT NULL, tahun smallint NOT NULL, sumber_dana_kode varchar(20) NOT NULL, baris_id uuid NOT NULL,
  kode_rekening varchar(30) NOT NULL, kegiatan varchar(300) NOT NULL, uraian varchar(300) NOT NULL,
  rencana numeric(18,2) NOT NULL, belanja numeric(18,2) NOT NULL, selisih numeric(18,2) NOT NULL,
  kategori varchar(20) NOT NULL CHECK (kategori IN ('SESUAI','MELEBIHI_RENCANA','BELUM_DIBELANJAKAN')),
  PRIMARY KEY (npsn, tahun, sumber_dana_kode, baris_id)
);
CREATE TABLE IF NOT EXISTS hpp_cocok (
  transaksi_mitra_id uuid NOT NULL, item_id varchar(60) NOT NULL, npsn char(8) NOT NULL, tahun smallint NOT NULL, sumber_dana_kode varchar(20) NOT NULL,
  baris_id uuid, cara varchar(15) NOT NULL CHECK (cara IN ('ID_BARIS','KODE_REKENING','TIDAK_COCOK')), jumlah numeric(18,2) NOT NULL,
  PRIMARY KEY (transaksi_mitra_id, item_id)
);
CREATE INDEX IF NOT EXISTS ix_hpp_cocok_buku ON hpp_cocok (npsn, tahun, sumber_dana_kode);
CREATE TABLE IF NOT EXISTS hpp_ringkas (
  npsn char(8) NOT NULL, tahun smallint NOT NULL, sumber_dana_kode varchar(20) NOT NULL,
  ringkasan jsonb NOT NULL, versi_rkas integer, dihitung_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (npsn, tahun, sumber_dana_kode)
);

-- Agregat HPP per jenjang & provinsi untuk dasbor pusat (tanpa NPSN).
DROP MATERIALIZED VIEW IF EXISTS mv_hpp_jenjang;
CREATE MATERIALIZED VIEW mv_hpp_jenjang AS
  SELECT r.tahun, r.sumber_dana_kode, s.jenjang_kode, left(s.wilayah_kode, 2) AS provinsi_kode, k.kategori,
         count(*)::int AS jumlah_sekolah_baris, sum((r.ringkasan -> k.kategori ->> 'nilai')::numeric) AS nilai,
         sum((r.ringkasan -> k.kategori ->> 'jumlah')::int) AS jumlah
  FROM hpp_ringkas r JOIN ref_sekolah_lokal s ON s.npsn = r.npsn
  CROSS JOIN (VALUES ('SESUAI'), ('MELEBIHI_RENCANA'), ('DI_LUAR_RENCANA'), ('BELUM_DIBELANJAKAN')) k(kategori)
  GROUP BY 1, 2, 3, 4, 5
WITH DATA;
CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_hpp_jenjang ON mv_hpp_jenjang (tahun, sumber_dana_kode, jenjang_kode, provinsi_kode, kategori);

CREATE TABLE IF NOT EXISTS outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, topik varchar(80) NOT NULL,
  tipe varchar(60) NOT NULL, agregat_id varchar(60) NOT NULL, correlation_id uuid, payload jsonb NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU','TERKIRIM','MATI')), percobaan smallint NOT NULL DEFAULT 0,
  galat_terakhir text, berikutnya_at timestamptz NOT NULL DEFAULT now(), dibuat_at timestamptz NOT NULL DEFAULT now(), terkirim_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_outbox_menunggu ON outbox (berikutnya_at) WHERE status = 'MENUNGGU';
CREATE TABLE IF NOT EXISTS inbox_processed (event_id uuid PRIMARY KEY, topik varchar(80) NOT NULL, diproses_at timestamptz NOT NULL DEFAULT now());

-- Pembaruan MV oleh pekerja (pemilik MV): SECURITY DEFINER agar login pekerja tidak perlu menjadi pemilik.
CREATE OR REPLACE FUNCTION segarkan_mv_hpp() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pemantauan, pg_temp AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_hpp_jenjang;
END $$;

RESET ROLE;
