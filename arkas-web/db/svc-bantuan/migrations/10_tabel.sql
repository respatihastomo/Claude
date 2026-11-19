-- DDL db_banper (svc-bantuan): sumber dana Bantuan Pemerintah (pengajuan -> pengesahan), dokumen juknis/panduan,
-- komponen, penerima (+ impor Excel), PKS bank, penyaluran, pengajuan sekolah + proyeksi referensi + outbox/inbox.
SET ROLE arkas_banper_owner;
SET search_path = banper;

CREATE TABLE IF NOT EXISTS ref_sekolah_lokal (
  npsn char(8) PRIMARY KEY, nama varchar(200) NOT NULL, jenjang_kode varchar(6) NOT NULL, wilayah_kode varchar(6) NOT NULL, aktif boolean NOT NULL, versi bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS ref_direktorat_lokal (kode varchar(20) PRIMARY KEY, nama varchar(150) NOT NULL, ditjen_kode varchar(20) NOT NULL, versi bigint NOT NULL);
-- Referensi bank penyalur (fitur 19).
CREATE TABLE IF NOT EXISTS ref_bank (kode varchar(10) PRIMARY KEY, nama varchar(100) NOT NULL);
INSERT INTO ref_bank (kode, nama) VALUES ('BRI', 'Bank Rakyat Indonesia'), ('BNI', 'Bank Negara Indonesia'), ('MANDIRI', 'Bank Mandiri'), ('BSI', 'Bank Syariah Indonesia'), ('BPD', 'Bank Pembangunan Daerah')
ON CONFLICT DO NOTHING;

-- UC-23/24/26: siklus DRAF -> DIAJUKAN -> DISAHKAN, atau DIKEMBALIKAN (-> diperbaiki -> DIAJUKAN).
CREATE TABLE IF NOT EXISTS sumber_dana_bantuan (
  kode               varchar(20) PRIMARY KEY CHECK (kode ~ '^[A-Z0-9_]{3,20}$'),
  nama               varchar(150) NOT NULL,
  direktorat_kode    varchar(20) NOT NULL,
  tahun              smallint NOT NULL,
  jenjang            text[] NOT NULL CHECK (cardinality(jenjang) > 0),
  pengajuan_mulai    date,
  pengajuan_selesai  date,
  status             varchar(12) NOT NULL DEFAULT 'DRAF' CHECK (status IN ('DRAF','DIAJUKAN','DIKEMBALIKAN','DISAHKAN')),
  catatan_balai      varchar(1000),
  diajukan_at        timestamptz,
  disahkan_oleh      uuid,
  disahkan_at        timestamptz,
  dibuat_oleh        uuid NOT NULL,
  dibuat_at          timestamptz NOT NULL DEFAULT now(),
  diubah_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (pengajuan_selesai IS NULL OR pengajuan_mulai IS NULL OR pengajuan_mulai <= pengajuan_selesai)
);

-- Dokumen juknis (disetujui Ditjen, UC-21) & panduan pelaksanaan (disahkan Direktorat, UC-22). Riwayat disimpan; yang berlaku = terbaru.
CREATE TABLE IF NOT EXISTS dokumen (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sumber_dana_kode  varchar(20) NOT NULL REFERENCES sumber_dana_bantuan(kode),
  jenis             varchar(8) NOT NULL CHECK (jenis IN ('JUKNIS','PANDUAN')),
  nama_berkas       varchar(200) NOT NULL,
  berkas_kunci      varchar(300) NOT NULL,
  sha256            char(64) NOT NULL,
  ukuran            integer NOT NULL CHECK (ukuran > 0),
  status            varchar(10) NOT NULL DEFAULT 'DIUNGGAH' CHECK (status IN ('DIUNGGAH','DISETUJUI','DISAHKAN','DITOLAK')),
  catatan           varchar(1000),
  diunggah_oleh     uuid NOT NULL,
  diunggah_at       timestamptz NOT NULL DEFAULT now(),
  diputuskan_oleh   uuid,
  diputuskan_at     timestamptz,
  CHECK ((jenis = 'JUKNIS' AND status <> 'DISAHKAN') OR (jenis = 'PANDUAN' AND status <> 'DISETUJUI'))
);
CREATE INDEX IF NOT EXISTS ix_dokumen_sd ON dokumen (sumber_dana_kode, jenis, diunggah_at DESC);

-- UC-29: komponen bantuan (dipakai menyusun kertas kerja bantuan; batas persen opsional).
CREATE TABLE IF NOT EXISTS komponen_bantuan (
  sumber_dana_kode varchar(20) NOT NULL REFERENCES sumber_dana_bantuan(kode),
  kode             char(2) NOT NULL CHECK (kode ~ '^[0-9]{2}$'),
  nama             varchar(200) NOT NULL,
  maks_persen      numeric(5,2) CHECK (maks_persen > 0 AND maks_persen <= 100),
  PRIMARY KEY (sumber_dana_kode, kode)
);

-- UC-25: penerima. NPSN wajib ada (proyeksi Dapodik/svc-referensi) dan jenjangnya sesuai sumber dana.
CREATE TABLE IF NOT EXISTS penerima (
  sumber_dana_kode varchar(20) NOT NULL REFERENCES sumber_dana_bantuan(kode),
  npsn             char(8) NOT NULL REFERENCES ref_sekolah_lokal(npsn),
  nilai            numeric(18,2) NOT NULL CHECK (nilai > 0),
  PRIMARY KEY (sumber_dana_kode, npsn)
);
-- SK-07: impor Excel diproses pekerja asinkron; hasil per baris disimpan untuk ditampilkan.
CREATE TABLE IF NOT EXISTS impor_penerima (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sumber_dana_kode  varchar(20) NOT NULL REFERENCES sumber_dana_bantuan(kode),
  nama_berkas       varchar(200) NOT NULL,
  berkas_kunci      varchar(300) NOT NULL,
  status            varchar(10) NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU','SELESAI','GAGAL')),
  jumlah_ok         integer NOT NULL DEFAULT 0,
  galat             jsonb NOT NULL DEFAULT '[]',
  dibuat_oleh       uuid NOT NULL,
  dibuat_at         timestamptz NOT NULL DEFAULT now(),
  selesai_at        timestamptz
);

-- UC-27: PKS direktorat teknis dengan bank penyalur.
CREATE TABLE IF NOT EXISTS pks_bank (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sumber_dana_kode  varchar(20) NOT NULL REFERENCES sumber_dana_bantuan(kode),
  bank_kode         varchar(10) NOT NULL REFERENCES ref_bank(kode),
  nomor             varchar(100) NOT NULL,
  tanggal           date NOT NULL,
  dibuat_oleh       uuid NOT NULL,
  dibuat_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sumber_dana_kode, bank_kode)
);

-- UC-28: penyaluran per sekolah per tahap. cek_penyaluran: sumber dana DISAHKAN, sekolah penerima sah, total <= nilai penerima, PKS bank ada.
CREATE TABLE IF NOT EXISTS penyaluran (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sumber_dana_kode  varchar(20) NOT NULL REFERENCES sumber_dana_bantuan(kode),
  npsn              char(8) NOT NULL,
  tahap             smallint NOT NULL CHECK (tahap BETWEEN 1 AND 4),
  tanggal           date NOT NULL,
  nilai             numeric(18,2) NOT NULL CHECK (nilai > 0),
  bank_kode         varchar(10) NOT NULL REFERENCES ref_bank(kode),
  nomor_referensi   varchar(60) NOT NULL,
  dibuat_oleh       uuid NOT NULL,
  dibuat_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sumber_dana_kode, npsn, tahap)
);
CREATE OR REPLACE FUNCTION cek_penyaluran() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status text; v_nilai numeric; v_total numeric;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'PENYALURAN_FINAL' USING DETAIL = 'Penyaluran tidak dapat diubah atau dihapus; catat koreksi'; END IF;
  SELECT status INTO v_status FROM banper.sumber_dana_bantuan WHERE kode = NEW.sumber_dana_kode;
  IF v_status IS DISTINCT FROM 'DISAHKAN' THEN RAISE EXCEPTION 'SUMBER_DANA_BELUM_DISAHKAN' USING DETAIL = 'Penyaluran hanya untuk sumber dana yang sudah disahkan Balai SDSP'; END IF;
  IF NOT EXISTS (SELECT 1 FROM banper.pks_bank WHERE sumber_dana_kode = NEW.sumber_dana_kode AND bank_kode = NEW.bank_kode) THEN
    RAISE EXCEPTION 'PKS_BANK_BELUM_ADA' USING DETAIL = format('Belum ada PKS dengan bank %s untuk sumber dana ini', NEW.bank_kode);
  END IF;
  SELECT nilai INTO v_nilai FROM banper.penerima WHERE sumber_dana_kode = NEW.sumber_dana_kode AND npsn = NEW.npsn;
  IF v_nilai IS NULL THEN RAISE EXCEPTION 'BUKAN_PENERIMA' USING DETAIL = format('NPSN %s tidak tercantum sebagai penerima yang disahkan', NEW.npsn); END IF;
  SELECT coalesce(sum(nilai), 0) INTO v_total FROM banper.penyaluran WHERE sumber_dana_kode = NEW.sumber_dana_kode AND npsn = NEW.npsn;
  IF v_total + NEW.nilai > v_nilai THEN
    RAISE EXCEPTION 'MELEBIHI_NILAI_BANTUAN' USING DETAIL = format('Total penyaluran %s melebihi nilai bantuan %s', v_total + NEW.nilai, v_nilai);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cek_penyaluran ON penyaluran;
CREATE TRIGGER trg_cek_penyaluran BEFORE INSERT OR UPDATE OR DELETE ON penyaluran FOR EACH ROW EXECUTE FUNCTION cek_penyaluran();

-- Setelah disahkan, penerima & komponen dikunci (perubahan lewat sumber dana baru/adendum, belum dicakup).
CREATE OR REPLACE FUNCTION kunci_setelah_sah() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_kode text := coalesce(NEW.sumber_dana_kode, OLD.sumber_dana_kode);
BEGIN
  IF (SELECT status FROM banper.sumber_dana_bantuan WHERE kode = v_kode) IN ('DIAJUKAN','DISAHKAN') THEN
    RAISE EXCEPTION 'SUMBER_DANA_TERKUNCI' USING DETAIL = 'Data tidak dapat diubah saat sumber dana sedang diajukan atau sudah disahkan';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_kunci ON penerima;
CREATE TRIGGER trg_kunci BEFORE INSERT OR UPDATE OR DELETE ON penerima FOR EACH ROW EXECUTE FUNCTION kunci_setelah_sah();
DROP TRIGGER IF EXISTS trg_kunci ON komponen_bantuan;
CREATE TRIGGER trg_kunci BEFORE INSERT OR UPDATE OR DELETE ON komponen_bantuan FOR EACH ROW EXECUTE FUNCTION kunci_setelah_sah();

-- UC-17/18: pengajuan sekolah (PKS, RAB, SPTJM). Satu pengajuan aktif per sekolah per bantuan (ux_pengajuan_aktif).
CREATE TABLE IF NOT EXISTS pengajuan_sekolah (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sumber_dana_kode  varchar(20) NOT NULL REFERENCES sumber_dana_bantuan(kode),
  npsn              char(8) NOT NULL,
  status            varchar(12) NOT NULL DEFAULT 'DRAF' CHECK (status IN ('DRAF','DIAJUKAN','DIKEMBALIKAN','DISETUJUI','DITOLAK')),
  nilai_rab         numeric(18,2),
  dokumen           jsonb NOT NULL DEFAULT '{}',   -- {PKS|RAB|SPTJM: {kunci, sha256, ukuran, namaBerkas}}
  catatan           varchar(1000),
  riwayat           jsonb NOT NULL DEFAULT '[]',
  dibuat_oleh       uuid NOT NULL,
  diajukan_at       timestamptz,
  diputuskan_oleh   uuid,
  diputuskan_at     timestamptz,
  diubah_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pengajuan_aktif ON pengajuan_sekolah (sumber_dana_kode, npsn) WHERE status <> 'DITOLAK';

CREATE TABLE IF NOT EXISTS outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, topik varchar(80) NOT NULL,
  tipe varchar(60) NOT NULL, agregat_id varchar(60) NOT NULL, correlation_id uuid, payload jsonb NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU','TERKIRIM','MATI')), percobaan smallint NOT NULL DEFAULT 0,
  galat_terakhir text, berikutnya_at timestamptz NOT NULL DEFAULT now(), dibuat_at timestamptz NOT NULL DEFAULT now(), terkirim_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_outbox_menunggu ON outbox (berikutnya_at) WHERE status = 'MENUNGGU';
CREATE TABLE IF NOT EXISTS inbox_processed (event_id uuid PRIMARY KEY, topik varchar(80) NOT NULL, diproses_at timestamptz NOT NULL DEFAULT now());

RESET ROLE;
