-- 13.4.2 DDL tabel db_tatausaha (irisan vertikal 1: periode, transaksi, item_transaksi, pajak + proyeksi & outbox/inbox)
-- Tabel bukti dan rekonsiliasi menyusul pada irisan berikutnya (unggah bukti S3, penutupan buku kas).
SET ROLE arkas_tatausaha_owner;
SET search_path = tatausaha;

-- ---------- Proyeksi baca lokal (CQRS read model) ----------
-- Diisi dari event KertasKerjaDisahkan (svc-perencanaan). Rujukan logis, tanpa FK lintas basis data.
CREATE TABLE IF NOT EXISTS rkas_baris_sah (
  baris_id          uuid PRIMARY KEY,
  akar_baris_id     uuid NOT NULL,                 -- akar rantai riwayat (asal_baris_id) untuk akumulasi realisasi lintas versi
  asal_baris_id     uuid,
  kertas_kerja_id   uuid NOT NULL,
  versi             integer NOT NULL CHECK (versi > 0),
  npsn              char(8) NOT NULL CHECK (npsn ~ '^[0-9]{8}$'),
  tahun             smallint NOT NULL,
  sumber_dana_kode  varchar(20) NOT NULL,
  kode_rekening     varchar(30) NOT NULL,
  kegiatan          varchar(300) NOT NULL,
  uraian            varchar(500) NOT NULL,
  volume            numeric(14,2) NOT NULL,
  satuan            varchar(30),
  harga_satuan      numeric(18,2) NOT NULL,
  total             numeric(18,2) NOT NULL CHECK (total >= 0),
  aktif             boolean NOT NULL DEFAULT true,
  diperbarui_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_rkas_sah_buku ON rkas_baris_sah (npsn, tahun, sumber_dana_kode) WHERE aktif;
CREATE INDEX IF NOT EXISTS ix_rkas_sah_akar ON rkas_baris_sah (akar_baris_id);

-- Proyeksi sakelar pajak per kode rekening + tarif (sumber: svc-referensi, event ReferensiDiubah).
CREATE TABLE IF NOT EXISTS ref_rekening_pajak_lokal (
  kode_rekening     varchar(30) NOT NULL,
  jenis             varchar(10) NOT NULL CHECK (jenis IN ('PPN','PPH21','PPH23','SSPD')),
  tarif             numeric(6,4) NOT NULL CHECK (tarif > 0 AND tarif < 1),
  tarif_tanpa_npwp  numeric(6,4) CHECK (tarif_tanpa_npwp > 0 AND tarif_tanpa_npwp < 1),
  diperbarui_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kode_rekening, jenis)
);

-- ---------- Tabel domain ----------
CREATE TABLE IF NOT EXISTS periode (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  npsn              char(8) NOT NULL CHECK (npsn ~ '^[0-9]{8}$'),
  tahun             smallint NOT NULL,
  sumber_dana_kode  varchar(20) NOT NULL,
  bulan             smallint NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  status            varchar(10) NOT NULL DEFAULT 'BUKA' CHECK (status IN ('BUKA','DITUTUP')),
  dibuka_at         timestamptz NOT NULL DEFAULT now(),
  ditutup_at        timestamptz,
  ditutup_oleh      uuid,
  UNIQUE (npsn, tahun, sumber_dana_kode, bulan),
  CHECK ((status = 'DITUTUP') = (ditutup_at IS NOT NULL))
);

-- Partisi per tahun anggaran (7.6). PK menyertakan kunci partisi.
CREATE TABLE IF NOT EXISTS transaksi (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  tahun               smallint NOT NULL,
  npsn                char(8) NOT NULL CHECK (npsn ~ '^[0-9]{8}$'),
  sumber_dana_kode    varchar(20) NOT NULL,
  periode_id          uuid NOT NULL REFERENCES periode(id),
  jenis               varchar(12) NOT NULL CHECK (jenis IN ('PENERIMAAN','TARIK_TUNAI','SETOR_TUNAI','BELANJA')),
  tanggal             date NOT NULL,
  cara_bayar          varchar(10) CHECK (cara_bayar IN ('TUNAI','NON_TUNAI')),
  no_bukti            varchar(40),
  uraian              varchar(500) NOT NULL,
  nama_toko           varchar(150),
  penjual_punya_npwp  boolean,
  nilai_bruto         numeric(18,2) NOT NULL CHECK (nilai_bruto > 0),
  total_pajak         numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_pajak >= 0),
  status              varchar(10) NOT NULL DEFAULT 'DICATAT' CHECK (status IN ('DICATAT','DISETUJUI','DITOLAK')),
  dibuat_oleh         uuid NOT NULL,
  dibuat_at           timestamptz NOT NULL DEFAULT now(),
  diputuskan_oleh     uuid,                  -- KEPSEK yang menyetujui atau menolak
  diputuskan_at       timestamptz,
  alasan_tolak        varchar(500),
  idempotency_key     varchar(80) NOT NULL,
  idempotency_hash    char(64) NOT NULL,
  row_version         integer NOT NULL DEFAULT 1,
  PRIMARY KEY (id, tahun),
  UNIQUE (npsn, tahun, idempotency_key),
  CHECK (extract(year FROM tanggal) = tahun),
  CHECK (total_pajak <= nilai_bruto),
  -- belanja wajib cara bayar, toko, bukti; mutasi kas tidak memakai cara_bayar
  CHECK ((jenis = 'BELANJA') = (cara_bayar IS NOT NULL AND nama_toko IS NOT NULL AND no_bukti IS NOT NULL AND penjual_punya_npwp IS NOT NULL)),
  CHECK (jenis = 'BELANJA' OR total_pajak = 0),
  -- pemisahan tugas
  CHECK (diputuskan_oleh IS NULL OR diputuskan_oleh <> dibuat_oleh),
  CHECK ((status = 'DICATAT') = (diputuskan_oleh IS NULL)),
  CHECK ((diputuskan_oleh IS NULL) = (diputuskan_at IS NULL)),
  CHECK (status <> 'DITOLAK' OR alasan_tolak IS NOT NULL)
) PARTITION BY LIST (tahun);
CREATE INDEX IF NOT EXISTS ix_transaksi_buku ON transaksi (npsn, tahun, sumber_dana_kode, tanggal);
CREATE INDEX IF NOT EXISTS ix_transaksi_status ON transaksi (npsn, tahun, status);

CREATE TABLE IF NOT EXISTS item_transaksi (
  id                     uuid NOT NULL DEFAULT gen_random_uuid(),
  tahun                  smallint NOT NULL,
  transaksi_id           uuid NOT NULL,
  npsn                   char(8) NOT NULL,
  sumber_dana_kode       varchar(20) NOT NULL,
  baris_kertas_kerja_id  uuid NOT NULL,        -- rujukan logis ke perencanaan.baris_kertas_kerja via rkas_baris_sah
  akar_baris_id          uuid NOT NULL,
  kode_rekening          varchar(30) NOT NULL,
  uraian                 varchar(300) NOT NULL,
  volume                 numeric(14,2) NOT NULL CHECK (volume > 0),
  satuan                 varchar(30),
  harga_satuan           numeric(18,2) NOT NULL CHECK (harga_satuan > 0),
  jumlah                 numeric(18,2) NOT NULL CHECK (jumlah > 0),
  PRIMARY KEY (id, tahun),
  FOREIGN KEY (transaksi_id, tahun) REFERENCES transaksi (id, tahun)
) PARTITION BY LIST (tahun);
CREATE INDEX IF NOT EXISTS ix_item_akar ON item_transaksi (akar_baris_id);
CREATE INDEX IF NOT EXISTS ix_item_transaksi ON item_transaksi (transaksi_id);

CREATE TABLE IF NOT EXISTS pajak (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaksi_id     uuid NOT NULL,
  tahun            smallint NOT NULL,
  npsn             char(8) NOT NULL,
  sumber_dana_kode varchar(20) NOT NULL,
  jenis            varchar(10) NOT NULL CHECK (jenis IN ('PPN','PPH21','PPH23','SSPD')),
  tarif            numeric(6,4) NOT NULL,
  dpp              numeric(18,2) NOT NULL CHECK (dpp > 0),
  nilai            numeric(18,2) NOT NULL CHECK (nilai >= 0),
  status           varchar(10) NOT NULL DEFAULT 'DIPUNGUT' CHECK (status IN ('DIPUNGUT','DISETOR')),
  ntpn             char(16) CHECK (ntpn ~ '^[0-9A-Z]{16}$'),
  tanggal_setor    date,
  FOREIGN KEY (transaksi_id, tahun) REFERENCES transaksi (id, tahun),
  UNIQUE (transaksi_id, jenis, tarif),
  CHECK ((status = 'DISETOR') = (ntpn IS NOT NULL AND tanggal_setor IS NOT NULL))
);

-- ---------- Infrastruktur event (7.5) ----------
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

-- ---------- Partisi ----------
CREATE OR REPLACE FUNCTION pastikan_partisi(p_tahun smallint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = tatausaha, pg_temp AS $$
BEGIN
  IF p_tahun < 2020 OR p_tahun > 2100 THEN RAISE EXCEPTION 'tahun partisi tidak wajar: %', p_tahun; END IF;
  EXECUTE format('CREATE TABLE IF NOT EXISTS tatausaha.transaksi_%s PARTITION OF tatausaha.transaksi FOR VALUES IN (%s)', p_tahun, p_tahun);
  EXECUTE format('CREATE TABLE IF NOT EXISTS tatausaha.item_transaksi_%s PARTITION OF tatausaha.item_transaksi FOR VALUES IN (%s)', p_tahun, p_tahun);
END $$;

SELECT pastikan_partisi(2025::smallint), pastikan_partisi(2026::smallint), pastikan_partisi(2027::smallint);

-- ---------- Tampilan mutasi buku (sumber BKU & saldo) ----------
-- Satu baris per mutasi: belanja = pengeluaran bruto; pajak yang dipungut = penerimaan di buku yang sama
-- (uang pajak tetap di kas sampai disetor, irisan berikutnya); tarik/setor tunai = dua baris berlawanan.
CREATE OR REPLACE VIEW v_mutasi WITH (security_invoker = true) AS
SELECT t.id AS transaksi_id, t.npsn, t.tahun, t.sumber_dana_kode, t.tanggal, t.dibuat_at, t.status, t.no_bukti,
       t.uraian, 'BANK'::text AS buku, NULL::varchar AS kode_rekening, t.nilai_bruto AS penerimaan, 0::numeric AS pengeluaran, 1 AS urut
FROM transaksi t WHERE t.jenis = 'PENERIMAAN'
UNION ALL
SELECT t.id, t.npsn, t.tahun, t.sumber_dana_kode, t.tanggal, t.dibuat_at, t.status, t.no_bukti,
       t.uraian, CASE WHEN t.jenis = 'TARIK_TUNAI' THEN 'BANK' ELSE 'TUNAI' END, NULL, 0, t.nilai_bruto, 1
FROM transaksi t WHERE t.jenis IN ('TARIK_TUNAI','SETOR_TUNAI')
UNION ALL
SELECT t.id, t.npsn, t.tahun, t.sumber_dana_kode, t.tanggal, t.dibuat_at, t.status, t.no_bukti,
       t.uraian, CASE WHEN t.jenis = 'TARIK_TUNAI' THEN 'TUNAI' ELSE 'BANK' END, NULL, t.nilai_bruto, 0, 2
FROM transaksi t WHERE t.jenis IN ('TARIK_TUNAI','SETOR_TUNAI')
UNION ALL
SELECT t.id, t.npsn, t.tahun, t.sumber_dana_kode, t.tanggal, t.dibuat_at, t.status, t.no_bukti,
       i.uraian, CASE WHEN t.cara_bayar = 'TUNAI' THEN 'TUNAI' ELSE 'BANK' END, i.kode_rekening, 0, i.jumlah, 1
FROM transaksi t JOIN item_transaksi i ON i.transaksi_id = t.id AND i.tahun = t.tahun WHERE t.jenis = 'BELANJA'
UNION ALL
SELECT t.id, t.npsn, t.tahun, t.sumber_dana_kode, t.tanggal, t.dibuat_at, t.status, t.no_bukti,
       'Pungut ' || p.jenis || ' ' || coalesce(t.no_bukti, ''), CASE WHEN t.cara_bayar = 'TUNAI' THEN 'TUNAI' ELSE 'BANK' END,
       NULL, p.nilai, 0, 3
FROM transaksi t JOIN pajak p ON p.transaksi_id = t.id AND p.tahun = t.tahun WHERE t.jenis = 'BELANJA' AND p.nilai > 0;

RESET ROLE;
