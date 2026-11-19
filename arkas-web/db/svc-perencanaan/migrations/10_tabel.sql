-- 13.4.2 DDL db_perencanaan: 6 tabel (pagu, kertas_kerja, baris_kertas_kerja, jadwal_kas, verifikasi, catatan_baris)
-- + proyeksi lokal (ref_sekolah_lokal, ref_komponen_lokal, realisasi_baris_lokal) + outbox/inbox.
SET ROLE arkas_perencanaan_owner;
SET search_path = perencanaan;

-- ---------- Proyeksi lokal ----------
-- Profil sekolah & wilayah (sumber: svc-referensi / SekolahDisinkron) — dipakai RLS cakupan Dinas.
CREATE TABLE IF NOT EXISTS ref_sekolah_lokal (
  npsn            char(8) PRIMARY KEY CHECK (npsn ~ '^[0-9]{8}$'),
  nama            varchar(200) NOT NULL,
  wilayah_kode    varchar(10) NOT NULL,
  jenjang         varchar(10) NOT NULL,
  status_sekolah  varchar(8) NOT NULL CHECK (status_sekolah IN ('NEGERI','SWASTA')),
  diperbarui_at   timestamptz NOT NULL DEFAULT now()
);
-- Komponen BOSP & batasnya (sumber: svc-referensi / ReferensiDiubah).
CREATE TABLE IF NOT EXISTS ref_komponen_lokal (
  sumber_dana_kode varchar(20) NOT NULL,
  kode             char(2) NOT NULL,
  nama             varchar(200) NOT NULL,
  maks_persen      numeric(5,2) CHECK (maks_persen > 0 AND maks_persen <= 100),
  min_persen       numeric(5,2) CHECK (min_persen >= 0 AND min_persen <= 100),
  diperbarui_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sumber_dana_kode, kode)
);
-- Realisasi per baris (sumber: TransaksiDisetujui svc-penatausahaan) — pergeseran tidak boleh di bawahnya (SK-02).
CREATE TABLE IF NOT EXISTS realisasi_baris_lokal (
  transaksi_id  uuid NOT NULL,
  baris_id      uuid NOT NULL,
  jumlah        numeric(18,2) NOT NULL,
  diterima_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (transaksi_id, baris_id)
);
CREATE INDEX IF NOT EXISTS ix_realisasi_baris ON realisasi_baris_lokal (baris_id);

-- ---------- Tabel domain ----------
CREATE TABLE IF NOT EXISTS pagu (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  npsn              char(8) NOT NULL REFERENCES ref_sekolah_lokal(npsn),
  tahun             smallint NOT NULL,
  sumber_dana_kode  varchar(20) NOT NULL,
  nilai             numeric(18,2) NOT NULL CHECK (nilai > 0),
  ditetapkan_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (npsn, tahun, sumber_dana_kode)
);

CREATE TABLE IF NOT EXISTS kertas_kerja (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  npsn                 char(8) NOT NULL,
  tahun                smallint NOT NULL,
  sumber_dana_kode     varchar(20) NOT NULL,
  versi                integer NOT NULL CHECK (versi > 0),
  status               varchar(10) NOT NULL DEFAULT 'DRAF' CHECK (status IN ('DRAF','DIAJUKAN','DISAHKAN','DIGANTI')),
  asal_kertas_kerja_id uuid REFERENCES kertas_kerja(id),
  row_version          integer NOT NULL DEFAULT 1,
  dibuat_oleh          uuid NOT NULL,
  dibuat_at            timestamptz NOT NULL DEFAULT now(),
  diajukan_oleh        uuid,
  diajukan_at          timestamptz,
  disahkan_oleh        uuid,
  disahkan_at          timestamptz,
  catatan_kembali      varchar(1000),
  FOREIGN KEY (npsn, tahun, sumber_dana_kode) REFERENCES pagu (npsn, tahun, sumber_dana_kode),
  UNIQUE (npsn, tahun, sumber_dana_kode, versi),
  CHECK (status NOT IN ('DIAJUKAN','DISAHKAN','DIGANTI') OR diajukan_oleh IS NOT NULL),
  CHECK ((status IN ('DISAHKAN','DIGANTI')) = (disahkan_oleh IS NOT NULL)),
  CHECK (disahkan_oleh IS NULL OR disahkan_oleh NOT IN (dibuat_oleh, diajukan_oleh))
);
-- 7.6: indeks unik parsial — satu versi DISAHKAN dan satu versi terbuka (DRAF/DIAJUKAN) per buku.
CREATE UNIQUE INDEX IF NOT EXISTS ux_kk_disahkan ON kertas_kerja (npsn, tahun, sumber_dana_kode) WHERE status = 'DISAHKAN';
CREATE UNIQUE INDEX IF NOT EXISTS ux_kk_terbuka ON kertas_kerja (npsn, tahun, sumber_dana_kode) WHERE status IN ('DRAF','DIAJUKAN');

CREATE TABLE IF NOT EXISTS baris_kertas_kerja (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kertas_kerja_id  uuid NOT NULL REFERENCES kertas_kerja(id),
  npsn             char(8) NOT NULL,
  komponen_kode    char(2) NOT NULL,
  kegiatan         varchar(300) NOT NULL,
  kode_rekening    varchar(30) NOT NULL,
  uraian           varchar(500) NOT NULL,
  volume           numeric(14,2) NOT NULL CHECK (volume > 0),
  satuan           varchar(30) NOT NULL,
  harga_satuan     numeric(18,2) NOT NULL CHECK (harga_satuan > 0),
  total            numeric(18,2) NOT NULL CHECK (total > 0),
  asal_baris_id    uuid REFERENCES baris_kertas_kerja(id),   -- rantai riwayat pergeseran (7.2)
  akar_baris_id    uuid NOT NULL,
  urut             integer NOT NULL DEFAULT 0,
  dibuat_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (total = round(volume * harga_satuan, 2))
);
CREATE INDEX IF NOT EXISTS ix_baris_kk ON baris_kertas_kerja (kertas_kerja_id, urut);
CREATE INDEX IF NOT EXISTS ix_baris_akar ON baris_kertas_kerja (akar_baris_id);

CREATE TABLE IF NOT EXISTS jadwal_kas (
  baris_id  uuid NOT NULL REFERENCES baris_kertas_kerja(id) ON DELETE CASCADE,
  bulan     smallint NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  nilai     numeric(18,2) NOT NULL CHECK (nilai >= 0),
  PRIMARY KEY (baris_id, bulan)
);

CREATE TABLE IF NOT EXISTS verifikasi (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kertas_kerja_id  uuid NOT NULL REFERENCES kertas_kerja(id),
  pengguna_id      uuid NOT NULL,
  peran            varchar(20) NOT NULL,
  aksi             varchar(12) NOT NULL CHECK (aksi IN ('AJUKAN','KEMBALIKAN','SAHKAN')),
  catatan          varchar(1000),
  at               timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS catatan_baris (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kertas_kerja_id  uuid NOT NULL REFERENCES kertas_kerja(id),
  baris_id         uuid REFERENCES baris_kertas_kerja(id) ON DELETE SET NULL,
  penulis_id       uuid NOT NULL,
  peran            varchar(20) NOT NULL,
  catatan          varchar(1000) NOT NULL,
  at               timestamptz NOT NULL DEFAULT now()
);

-- ---------- Infrastruktur event ----------
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

RESET ROLE;
