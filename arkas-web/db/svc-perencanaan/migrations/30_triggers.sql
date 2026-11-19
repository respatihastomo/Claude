-- 13.4.4 Trigger integritas db_perencanaan.
SET ROLE arkas_perencanaan_owner;
SET search_path = perencanaan;

-- Baris & jadwal kas hanya dapat diubah selagi kertas kerja DRAF.
CREATE OR REPLACE FUNCTION cek_kk_draf() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = perencanaan, pg_temp AS $$
DECLARE st varchar; kk uuid;
BEGIN
  IF TG_TABLE_NAME = 'jadwal_kas' THEN
    SELECT kertas_kerja_id INTO kk FROM baris_kertas_kerja WHERE id = coalesce(NEW.baris_id, OLD.baris_id);
  ELSE
    kk := coalesce(NEW.kertas_kerja_id, OLD.kertas_kerja_id);
  END IF;
  SELECT status INTO st FROM kertas_kerja WHERE id = kk;
  IF st IS DISTINCT FROM 'DRAF' THEN
    RAISE EXCEPTION 'KERTAS_KERJA_TERKUNCI' USING DETAIL = format('Kertas kerja berstatus %s tidak dapat diubah', st);
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_baris_draf ON baris_kertas_kerja;
CREATE TRIGGER trg_baris_draf BEFORE INSERT OR UPDATE OR DELETE ON baris_kertas_kerja FOR EACH ROW EXECUTE FUNCTION cek_kk_draf();
DROP TRIGGER IF EXISTS trg_jadwal_draf ON jadwal_kas;
CREATE TRIGGER trg_jadwal_draf BEFORE INSERT OR UPDATE OR DELETE ON jadwal_kas FOR EACH ROW EXECUTE FUNCTION cek_kk_draf();

-- 13.4.4 cek_pagu: total baris kertas kerja tidak boleh melampaui pagu (dicek saat baris berubah).
CREATE OR REPLACE FUNCTION cek_pagu() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = perencanaan, pg_temp AS $$
DECLARE total numeric(18,2); batas numeric(18,2); kk uuid;
BEGIN
  kk := coalesce(NEW.kertas_kerja_id, OLD.kertas_kerja_id);
  SELECT coalesce(sum(b.total), 0) INTO total FROM baris_kertas_kerja b WHERE b.kertas_kerja_id = kk;
  SELECT p.nilai INTO batas FROM kertas_kerja k JOIN pagu p USING (npsn, tahun, sumber_dana_kode) WHERE k.id = kk;
  IF total > batas THEN
    RAISE EXCEPTION 'PAGU_TERLAMPAUI' USING DETAIL = format('{"pagu":%s,"total":%s}', batas, total);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_cek_pagu ON baris_kertas_kerja;
CREATE CONSTRAINT TRIGGER trg_cek_pagu AFTER INSERT OR UPDATE ON baris_kertas_kerja
  DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION cek_pagu();

-- Siklus status kertas kerja (Tabel 8.2): DRAF -> DIAJUKAN -> DISAHKAN -> DIGANTI; DIAJUKAN -> DRAF (dikembalikan).
CREATE OR REPLACE FUNCTION jaga_kertas_kerja() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'HAPUS_DILARANG'; END IF;
  IF (NEW.npsn, NEW.tahun, NEW.sumber_dana_kode, NEW.versi, NEW.asal_kertas_kerja_id, NEW.dibuat_oleh)
     IS DISTINCT FROM (OLD.npsn, OLD.tahun, OLD.sumber_dana_kode, OLD.versi, OLD.asal_kertas_kerja_id, OLD.dibuat_oleh) THEN
    RAISE EXCEPTION 'KERTAS_KERJA_TIDAK_DAPAT_DIUBAH';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT ((OLD.status, NEW.status) IN
     (('DRAF','DIAJUKAN'), ('DIAJUKAN','DRAF'), ('DIAJUKAN','DISAHKAN'), ('DISAHKAN','DIGANTI'))) THEN
    RAISE EXCEPTION 'TRANSISI_TIDAK_SAH' USING DETAIL = format('%s -> %s', OLD.status, NEW.status);
  END IF;
  IF OLD.status IN ('DISAHKAN','DIGANTI') AND NEW.status = OLD.status THEN RAISE EXCEPTION 'KERTAS_KERJA_FINAL'; END IF;
  IF NEW.status = 'DRAF' THEN NEW.diajukan_oleh := NULL; NEW.diajukan_at := NULL; END IF;
  NEW.row_version := OLD.row_version + 1;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_jaga_kk ON kertas_kerja;
CREATE TRIGGER trg_jaga_kk BEFORE UPDATE OR DELETE ON kertas_kerja FOR EACH ROW EXECUTE FUNCTION jaga_kertas_kerja();

RESET ROLE;
