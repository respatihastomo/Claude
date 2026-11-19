-- 13.4.4 Trigger integritas db_tatausaha. Kode galat dikirim di MESSAGE dan dipetakan aplikasi ke 422 (RFC 9457).
SET ROLE arkas_tatausaha_owner;
SET search_path = tatausaha;

-- Transaksi hanya boleh di periode BUKA milik buku yang sama dan bulan yang sama dengan tanggalnya.
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
    RAISE EXCEPTION 'PERIODE_TERTUTUP' USING DETAIL = format('Periode %s/%s sudah ditutup', p.bulan, p.tahun);
  END IF;
  RETURN NEW;
END $$;

-- Data keuangan tidak pernah dihapus atau diubah setelah diputuskan.
CREATE OR REPLACE FUNCTION jaga_transaksi() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'HAPUS_DILARANG' USING DETAIL = 'Pembatalan memakai transaksi KOREKSI pembalik';
  END IF;
  IF OLD.status <> 'DICATAT' THEN
    RAISE EXCEPTION 'TRANSAKSI_FINAL' USING DETAIL = format('Transaksi berstatus %s tidak dapat diubah', OLD.status);
  END IF;
  NEW.row_version := OLD.row_version + 1;
  RETURN NEW;
END $$;

-- Item belanja wajib merujuk baris RKAS yang disahkan (proyeksi lokal) dan realisasi akumulatif <= anggaran.
CREATE OR REPLACE FUNCTION cek_item_rkas() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = tatausaha, pg_temp AS $$
DECLARE b rkas_baris_sah%ROWTYPE; terpakai numeric(18,2);
BEGIN
  -- Kunci baris anggaran: menyerialkan pencatatan bersamaan pada baris yang sama.
  SELECT * INTO b FROM rkas_baris_sah WHERE baris_id = NEW.baris_kertas_kerja_id FOR UPDATE;
  IF NOT FOUND OR NOT b.aktif OR b.npsn <> NEW.npsn OR b.tahun <> NEW.tahun OR b.sumber_dana_kode <> NEW.sumber_dana_kode THEN
    RAISE EXCEPTION 'BARIS_RKAS_TIDAK_SAH' USING DETAIL = format('Baris %s tidak ada di RKAS yang disahkan untuk buku ini', NEW.baris_kertas_kerja_id);
  END IF;
  IF NEW.jumlah <> round(NEW.volume * NEW.harga_satuan, 2) THEN
    RAISE EXCEPTION 'JUMLAH_TIDAK_SESUAI' USING DETAIL = 'jumlah harus volume x harga satuan';
  END IF;
  NEW.akar_baris_id := b.akar_baris_id;
  NEW.kode_rekening := b.kode_rekening;

  SELECT coalesce(sum(i.jumlah), 0) INTO terpakai
  FROM item_transaksi i JOIN transaksi t ON t.id = i.transaksi_id AND t.tahun = i.tahun
  WHERE i.akar_baris_id = b.akar_baris_id AND i.tahun = NEW.tahun AND t.status <> 'DITOLAK';

  IF terpakai + NEW.jumlah > b.total THEN
    RAISE EXCEPTION 'MELEBIHI_ANGGARAN' USING DETAIL = format('{"barisId":"%s","anggaran":%s,"terpakai":%s,"diminta":%s}', b.baris_id, b.total, terpakai, NEW.jumlah);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_periode_tertutup ON transaksi;
CREATE TRIGGER trg_periode_tertutup BEFORE INSERT OR UPDATE ON transaksi FOR EACH ROW EXECUTE FUNCTION tolak_periode_tertutup();
DROP TRIGGER IF EXISTS trg_jaga_transaksi ON transaksi;
CREATE TRIGGER trg_jaga_transaksi BEFORE UPDATE OR DELETE ON transaksi FOR EACH ROW EXECUTE FUNCTION jaga_transaksi();
DROP TRIGGER IF EXISTS trg_item_rkas ON item_transaksi;
CREATE TRIGGER trg_item_rkas BEFORE INSERT ON item_transaksi FOR EACH ROW EXECUTE FUNCTION cek_item_rkas();

CREATE OR REPLACE FUNCTION tolak_hapus() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'HAPUS_DILARANG'; END $$;
DROP TRIGGER IF EXISTS trg_hapus_item ON item_transaksi;
CREATE TRIGGER trg_hapus_item BEFORE DELETE ON item_transaksi FOR EACH ROW EXECUTE FUNCTION tolak_hapus();
DROP TRIGGER IF EXISTS trg_hapus_pajak ON pajak;
CREATE TRIGGER trg_hapus_pajak BEFORE DELETE ON pajak FOR EACH ROW EXECUTE FUNCTION tolak_hapus();

RESET ROLE;
