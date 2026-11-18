-- Irisan 2 — UC-14 Setor pajak & BKP Pajak (SK-03 langkah 6). Perubahan aditif (expand), aman dijalankan ulang.
SET ROLE arkas_tatausaha_owner;
SET search_path = tatausaha;

-- ---------- transaksi: jenis SETOR_PAJAK ----------
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS ntpn char(16);

-- Ganti CHECK lama (tanpa nama) yang menyangkut jenis/cara_bayar dengan versi bernama.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'tatausaha.transaksi'::regclass AND contype = 'c'
      AND conname NOT LIKE 'ck_transaksi_%'
      AND (pg_get_constraintdef(oid) LIKE '%jenis%' )
  LOOP
    EXECUTE format('ALTER TABLE tatausaha.transaksi DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE transaksi DROP CONSTRAINT IF EXISTS ck_transaksi_jenis;
ALTER TABLE transaksi ADD CONSTRAINT ck_transaksi_jenis
  CHECK (jenis IN ('PENERIMAAN','TARIK_TUNAI','SETOR_TUNAI','BELANJA','SETOR_PAJAK'));
ALTER TABLE transaksi DROP CONSTRAINT IF EXISTS ck_transaksi_belanja;
ALTER TABLE transaksi ADD CONSTRAINT ck_transaksi_belanja
  CHECK ((jenis = 'BELANJA') = (nama_toko IS NOT NULL AND no_bukti IS NOT NULL AND penjual_punya_npwp IS NOT NULL));
ALTER TABLE transaksi DROP CONSTRAINT IF EXISTS ck_transaksi_cara_bayar;
ALTER TABLE transaksi ADD CONSTRAINT ck_transaksi_cara_bayar
  CHECK ((jenis IN ('BELANJA','SETOR_PAJAK')) = (cara_bayar IS NOT NULL));
ALTER TABLE transaksi DROP CONSTRAINT IF EXISTS ck_transaksi_pajak;
ALTER TABLE transaksi ADD CONSTRAINT ck_transaksi_pajak CHECK (jenis = 'BELANJA' OR total_pajak = 0);
ALTER TABLE transaksi DROP CONSTRAINT IF EXISTS ck_transaksi_ntpn;
ALTER TABLE transaksi ADD CONSTRAINT ck_transaksi_ntpn
  CHECK ((jenis = 'SETOR_PAJAK') = (ntpn IS NOT NULL) AND (ntpn IS NULL OR ntpn ~ '^[0-9A-Z]{16}$'));
-- Satu NTPN hanya untuk satu setoran yang masih berlaku (setoran DITOLAK melepaskan NTPN-nya).
DROP INDEX IF EXISTS ux_transaksi_ntpn;
CREATE UNIQUE INDEX ux_transaksi_ntpn ON transaksi (ntpn, tahun) WHERE ntpn IS NOT NULL AND status <> 'DITOLAK';

-- ---------- pajak: tautan ke transaksi setor ----------
ALTER TABLE pajak ADD COLUMN IF NOT EXISTS setor_transaksi_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pajak_setor') THEN
    ALTER TABLE tatausaha.pajak ADD CONSTRAINT fk_pajak_setor FOREIGN KEY (setor_transaksi_id, tahun) REFERENCES tatausaha.transaksi (id, tahun);
  END IF;
END $$;
ALTER TABLE pajak DROP CONSTRAINT IF EXISTS ck_pajak_setor;
ALTER TABLE pajak ADD CONSTRAINT ck_pajak_setor CHECK ((status = 'DISETOR') = (setor_transaksi_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS ix_pajak_setor ON pajak (setor_transaksi_id) WHERE setor_transaksi_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_pajak_buku ON pajak (npsn, tahun, sumber_dana_kode, status);

-- Transisi pajak hanya: DIPUNGUT -> DISETOR (ditautkan ke transaksi SETOR_PAJAK yang DICATAT, jenis & buku sama, belanja DISETUJUI)
-- dan DISETOR -> DIPUNGUT (hanya bila transaksi setornya DITOLAK). Kolom lain tidak boleh berubah.
CREATE OR REPLACE FUNCTION cek_setor_pajak() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = tatausaha, pg_temp AS $$
DECLARE s transaksi%ROWTYPE; b_status varchar;
BEGIN
  IF (NEW.transaksi_id, NEW.tahun, NEW.npsn, NEW.sumber_dana_kode, NEW.jenis, NEW.tarif, NEW.dpp, NEW.nilai)
     IS DISTINCT FROM (OLD.transaksi_id, OLD.tahun, OLD.npsn, OLD.sumber_dana_kode, OLD.jenis, OLD.tarif, OLD.dpp, OLD.nilai) THEN
    RAISE EXCEPTION 'PAJAK_TIDAK_DAPAT_DIUBAH' USING DETAIL = 'Hanya status setor yang boleh berubah';
  END IF;
  IF OLD.status = 'DIPUNGUT' AND NEW.status = 'DISETOR' THEN
    SELECT status INTO b_status FROM transaksi WHERE id = NEW.transaksi_id AND tahun = NEW.tahun;
    IF b_status <> 'DISETUJUI' THEN
      RAISE EXCEPTION 'PAJAK_BELUM_SAH' USING DETAIL = 'Pajak hanya dapat disetor setelah belanjanya disetujui';
    END IF;
    SELECT * INTO s FROM transaksi WHERE id = NEW.setor_transaksi_id AND tahun = NEW.tahun;
    IF NOT FOUND OR s.jenis <> 'SETOR_PAJAK' OR s.status <> 'DICATAT' OR s.npsn <> NEW.npsn
       OR s.sumber_dana_kode <> NEW.sumber_dana_kode OR s.ntpn IS DISTINCT FROM NEW.ntpn OR s.tanggal IS DISTINCT FROM NEW.tanggal_setor THEN
      RAISE EXCEPTION 'SETOR_PAJAK_TIDAK_SESUAI' USING DETAIL = 'Transaksi setor tidak cocok dengan pajak';
    END IF;
  ELSIF OLD.status = 'DISETOR' AND NEW.status = 'DIPUNGUT' THEN
    SELECT * INTO s FROM transaksi WHERE id = OLD.setor_transaksi_id AND tahun = OLD.tahun;
    IF s.status <> 'DITOLAK' THEN
      RAISE EXCEPTION 'PAJAK_SUDAH_DISETOR' USING DETAIL = 'Status setor hanya dapat dibatalkan bila transaksi setor ditolak';
    END IF;
  ELSE
    RAISE EXCEPTION 'PAJAK_TIDAK_DAPAT_DIUBAH' USING DETAIL = format('Transisi %s -> %s tidak diizinkan', OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_setor_pajak ON pajak;
CREATE TRIGGER trg_setor_pajak BEFORE UPDATE ON pajak FOR EACH ROW EXECUTE FUNCTION cek_setor_pajak();

-- Nilai setoran harus sama dengan jumlah pajak yang ditautkan, saat disetujui.
CREATE OR REPLACE FUNCTION cek_nilai_setor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = tatausaha, pg_temp AS $$
DECLARE total numeric(18,2);
BEGIN
  IF NEW.jenis = 'SETOR_PAJAK' AND NEW.status = 'DISETUJUI' AND OLD.status = 'DICATAT' THEN
    SELECT coalesce(sum(nilai), 0) INTO total FROM pajak WHERE setor_transaksi_id = NEW.id AND tahun = NEW.tahun AND status = 'DISETOR';
    IF total <> NEW.nilai_bruto THEN
      RAISE EXCEPTION 'SETOR_PAJAK_TIDAK_SESUAI' USING DETAIL = format('Nilai setor %s tidak sama dengan pajak tertaut %s', NEW.nilai_bruto, total);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_nilai_setor ON transaksi;
CREATE TRIGGER trg_nilai_setor BEFORE UPDATE ON transaksi FOR EACH ROW EXECUTE FUNCTION cek_nilai_setor();

-- ---------- Tampilan mutasi: tambah setor pajak ----------
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
FROM transaksi t JOIN pajak p ON p.transaksi_id = t.id AND p.tahun = t.tahun WHERE t.jenis = 'BELANJA' AND p.nilai > 0
UNION ALL
SELECT t.id, t.npsn, t.tahun, t.sumber_dana_kode, t.tanggal, t.dibuat_at, t.status, t.no_bukti,
       t.uraian, CASE WHEN t.cara_bayar = 'TUNAI' THEN 'TUNAI' ELSE 'BANK' END, NULL, 0, t.nilai_bruto, 1
FROM transaksi t WHERE t.jenis = 'SETOR_PAJAK';

-- ---------- Hak akses & RLS ----------
GRANT SELECT ON v_mutasi TO arkas_app_tatausaha, arkas_worker_tatausaha;
GRANT UPDATE (status, ntpn, tanggal_setor, setor_transaksi_id) ON pajak TO arkas_app_tatausaha;
-- Bendahara menautkan pajak ke setoran; Kepala Sekolah membatalkan tautan saat menolak setoran. Aturan transisi di trigger.
DROP POLICY IF EXISTS p_setor ON pajak;
CREATE POLICY p_setor ON pajak FOR UPDATE TO arkas_app_tatausaha
  USING (sekolah_sendiri(npsn, 'BENDAHARA', 'KEPSEK'))
  WITH CHECK (sekolah_sendiri(npsn, 'BENDAHARA', 'KEPSEK'));

RESET ROLE;
