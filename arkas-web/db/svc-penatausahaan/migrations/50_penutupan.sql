-- Irisan 3 — UC-15 Penutupan buku kas bulanan, rekonsiliasi rekening koran & pemeriksaan kas (SK-05). Aditif, aman dijalankan ulang.
SET ROLE arkas_tatausaha_owner;
SET search_path = tatausaha;

-- ---------- periode: siklus BUKA -> DIAJUKAN -> DITUTUP (DIAJUKAN -> BUKA bila dikembalikan) ----------
ALTER TABLE periode ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1;
ALTER TABLE periode ADD COLUMN IF NOT EXISTS diajukan_oleh uuid;
ALTER TABLE periode ADD COLUMN IF NOT EXISTS diajukan_at timestamptz;
ALTER TABLE periode ADD COLUMN IF NOT EXISTS alasan_kembali varchar(500);
ALTER TABLE periode DROP CONSTRAINT IF EXISTS periode_status_check;
ALTER TABLE periode DROP CONSTRAINT IF EXISTS ck_periode_status;
ALTER TABLE periode ADD CONSTRAINT ck_periode_status CHECK (status IN ('BUKA','DIAJUKAN','DITUTUP'));
ALTER TABLE periode DROP CONSTRAINT IF EXISTS ck_periode_diajukan;
ALTER TABLE periode ADD CONSTRAINT ck_periode_diajukan CHECK (status = 'BUKA' OR (diajukan_oleh IS NOT NULL AND diajukan_at IS NOT NULL));
ALTER TABLE periode DROP CONSTRAINT IF EXISTS ck_periode_pemisahan;
ALTER TABLE periode ADD CONSTRAINT ck_periode_pemisahan CHECK (ditutup_oleh IS NULL OR ditutup_oleh <> diajukan_oleh);

-- ---------- rekonsiliasi (tabel ke-6 skema tatausaha, 7.3) ----------
CREATE TABLE IF NOT EXISTS rekonsiliasi (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periode_id            uuid NOT NULL UNIQUE REFERENCES periode(id),
  npsn                  char(8) NOT NULL,
  tahun                 smallint NOT NULL,
  sumber_dana_kode      varchar(20) NOT NULL,
  bulan                 smallint NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  saldo_buku_bank       numeric(18,2) NOT NULL,
  saldo_rekening_koran  numeric(18,2) NOT NULL,
  selisih_bank          numeric(18,2) GENERATED ALWAYS AS (saldo_rekening_koran - saldo_buku_bank) STORED,
  penjelasan_bank       varchar(1000),
  saldo_buku_tunai      numeric(18,2) NOT NULL,
  kas_fisik             numeric(18,2) NOT NULL CHECK (kas_fisik >= 0),
  selisih_kas           numeric(18,2) GENERATED ALWAYS AS (kas_fisik - saldo_buku_tunai) STORED,
  penjelasan_kas        varchar(1000),
  ringkasan             jsonb NOT NULL,          -- snapshot BKU bulan itu saat diajukan (dikirim di PeriodeDitutup)
  dibuat_oleh           uuid NOT NULL,
  dibuat_at             timestamptz NOT NULL DEFAULT now(),
  diperbarui_at         timestamptz NOT NULL DEFAULT now(),
  -- selisih wajib dijelaskan (2.1 butir 10)
  CHECK (saldo_rekening_koran = saldo_buku_bank OR length(trim(coalesce(penjelasan_bank, ''))) >= 10),
  CHECK (kas_fisik = saldo_buku_tunai OR length(trim(coalesce(penjelasan_kas, ''))) >= 10)
);

-- Rekonsiliasi hanya dapat ditulis selagi periodenya BUKA; setelah diajukan/ditutup menjadi bukti yang terkunci.
CREATE OR REPLACE FUNCTION jaga_rekonsiliasi() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = tatausaha, pg_temp AS $$
DECLARE p periode%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'HAPUS_DILARANG'; END IF;
  SELECT * INTO p FROM periode WHERE id = NEW.periode_id;
  IF p.status <> 'BUKA' THEN
    RAISE EXCEPTION 'REKONSILIASI_TERKUNCI' USING DETAIL = format('Periode %s/%s berstatus %s', p.bulan, p.tahun, p.status);
  END IF;
  IF (NEW.npsn, NEW.tahun, NEW.sumber_dana_kode, NEW.bulan) IS DISTINCT FROM (p.npsn, p.tahun, p.sumber_dana_kode, p.bulan) THEN
    RAISE EXCEPTION 'PERIODE_TIDAK_SESUAI';
  END IF;
  NEW.diperbarui_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_jaga_rekonsiliasi ON rekonsiliasi;
CREATE TRIGGER trg_jaga_rekonsiliasi BEFORE INSERT OR UPDATE OR DELETE ON rekonsiliasi FOR EACH ROW EXECUTE FUNCTION jaga_rekonsiliasi();

-- Transisi periode & syarat penutupan (lapis terakhir; aplikasi memeriksa lebih dulu dengan pesan ramah).
CREATE OR REPLACE FUNCTION jaga_periode() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = tatausaha, pg_temp AS $$
DECLARE n int;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'HAPUS_DILARANG'; END IF;
  IF (NEW.npsn, NEW.tahun, NEW.sumber_dana_kode, NEW.bulan) IS DISTINCT FROM (OLD.npsn, OLD.tahun, OLD.sumber_dana_kode, OLD.bulan) THEN
    RAISE EXCEPTION 'PERIODE_TIDAK_DAPAT_DIUBAH';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ((OLD.status, NEW.status) IN (('BUKA','DIAJUKAN'), ('DIAJUKAN','BUKA'), ('DIAJUKAN','DITUTUP'))) THEN
      RAISE EXCEPTION 'TRANSISI_PERIODE_TIDAK_SAH' USING DETAIL = format('%s -> %s', OLD.status, NEW.status);
    END IF;
  ELSIF OLD.status = 'DITUTUP' THEN
    RAISE EXCEPTION 'PERIODE_FINAL';
  END IF;

  IF NEW.status = 'DIAJUKAN' AND OLD.status = 'BUKA' THEN
    SELECT count(*) INTO n FROM transaksi
      WHERE periode_id = NEW.id AND tahun = NEW.tahun AND status = 'DICATAT';
    IF n > 0 THEN RAISE EXCEPTION 'MASIH_ADA_TRANSAKSI_MENUNGGU' USING DETAIL = format('%s transaksi belum diputuskan', n); END IF;
    SELECT count(*) INTO n FROM periode
      WHERE npsn = NEW.npsn AND tahun = NEW.tahun AND sumber_dana_kode = NEW.sumber_dana_kode AND bulan < NEW.bulan AND status <> 'DITUTUP';
    IF n > 0 THEN RAISE EXCEPTION 'PERIODE_SEBELUMNYA_BELUM_DITUTUP'; END IF;
    IF NOT EXISTS (SELECT 1 FROM rekonsiliasi WHERE periode_id = NEW.id) THEN RAISE EXCEPTION 'REKONSILIASI_BELUM_ADA'; END IF;
  END IF;
  IF NEW.status = 'DITUTUP' AND (NEW.ditutup_oleh IS NULL OR NEW.ditutup_oleh = NEW.diajukan_oleh) THEN
    RAISE EXCEPTION 'PEMISAHAN_TUGAS';
  END IF;
  IF NEW.status = 'BUKA' THEN NEW.diajukan_oleh := NULL; NEW.diajukan_at := NULL; END IF;
  NEW.row_version := OLD.row_version + 1;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_jaga_periode ON periode;
CREATE TRIGGER trg_jaga_periode BEFORE UPDATE OR DELETE ON periode FOR EACH ROW EXECUTE FUNCTION jaga_periode();

-- Pesan trigger transaksi diperjelas untuk periode yang sedang diajukan.
CREATE OR REPLACE FUNCTION tolak_periode_tertutup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = tatausaha, pg_temp AS $$
DECLARE p periode%ROWTYPE;
BEGIN
  SELECT * INTO p FROM periode WHERE id = NEW.periode_id;
  IF NOT FOUND OR p.npsn <> NEW.npsn OR p.tahun <> NEW.tahun OR p.sumber_dana_kode <> NEW.sumber_dana_kode
     OR p.bulan <> extract(month FROM NEW.tanggal) THEN
    RAISE EXCEPTION 'PERIODE_TIDAK_SESUAI' USING DETAIL = format('periode %s tidak cocok dengan buku/tanggal transaksi', NEW.periode_id);
  END IF;
  IF p.status <> 'BUKA' THEN
    RAISE EXCEPTION 'PERIODE_TERTUTUP' USING DETAIL = CASE p.status WHEN 'DIAJUKAN'
      THEN format('Periode %s/%s sedang diajukan untuk ditutup', p.bulan, p.tahun)
      ELSE format('Periode %s/%s sudah ditutup', p.bulan, p.tahun) END;
  END IF;
  RETURN NEW;
END $$;

-- ---------- Hak akses & RLS ----------
GRANT SELECT ON rekonsiliasi TO arkas_app_tatausaha, arkas_worker_tatausaha;
GRANT INSERT ON rekonsiliasi TO arkas_app_tatausaha;
GRANT UPDATE (saldo_buku_bank, saldo_rekening_koran, penjelasan_bank, saldo_buku_tunai, kas_fisik, penjelasan_kas, ringkasan, dibuat_oleh)
  ON rekonsiliasi TO arkas_app_tatausaha;
GRANT INSERT ON periode TO arkas_app_tatausaha;
GRANT UPDATE (status, diajukan_oleh, diajukan_at, ditutup_at, ditutup_oleh, alasan_kembali) ON periode TO arkas_app_tatausaha;

ALTER TABLE rekonsiliasi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_baca ON rekonsiliasi;
CREATE POLICY p_baca ON rekonsiliasi FOR SELECT TO arkas_app_tatausaha USING (boleh_akses(npsn, sumber_dana_kode));
DROP POLICY IF EXISTS p_tulis ON rekonsiliasi;
CREATE POLICY p_tulis ON rekonsiliasi FOR INSERT TO arkas_app_tatausaha
  WITH CHECK (sekolah_sendiri(npsn, 'BENDAHARA') AND dibuat_oleh::text = app_ctx('pengguna_id'));
DROP POLICY IF EXISTS p_ubah ON rekonsiliasi;
CREATE POLICY p_ubah ON rekonsiliasi FOR UPDATE TO arkas_app_tatausaha
  USING (sekolah_sendiri(npsn, 'BENDAHARA')) WITH CHECK (sekolah_sendiri(npsn, 'BENDAHARA') AND dibuat_oleh::text = app_ctx('pengguna_id'));

-- Bendahara mengajukan; Kepala Sekolah menutup/mengembalikan dan membuka periode berikutnya.
DROP POLICY IF EXISTS p_ajukan ON periode;
CREATE POLICY p_ajukan ON periode FOR UPDATE TO arkas_app_tatausaha
  USING (sekolah_sendiri(npsn, 'BENDAHARA') AND status = 'BUKA')
  WITH CHECK (sekolah_sendiri(npsn, 'BENDAHARA') AND status = 'DIAJUKAN' AND diajukan_oleh::text = app_ctx('pengguna_id'));
DROP POLICY IF EXISTS p_putuskan ON periode;
CREATE POLICY p_putuskan ON periode FOR UPDATE TO arkas_app_tatausaha
  USING (sekolah_sendiri(npsn, 'KEPSEK') AND status = 'DIAJUKAN')
  WITH CHECK (sekolah_sendiri(npsn, 'KEPSEK') AND (status = 'BUKA' OR (status = 'DITUTUP' AND ditutup_oleh::text = app_ctx('pengguna_id'))));
DROP POLICY IF EXISTS p_buka_berikut ON periode;
CREATE POLICY p_buka_berikut ON periode FOR INSERT TO arkas_app_tatausaha
  WITH CHECK (sekolah_sendiri(npsn, 'KEPSEK') AND status = 'BUKA');

RESET ROLE;
