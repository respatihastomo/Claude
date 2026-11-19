-- Audit stream (D7): trigger catat_audit() pada tabel domain svc-referensi -> outbox AuditDicatat -> svc-audit.
SET ROLE arkas_ref_owner;
-- #sertakan _bersama/audit.sql ref

DROP TRIGGER IF EXISTS trg_audit ON ref.wilayah;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON ref.wilayah FOR EACH ROW EXECUTE FUNCTION ref.catat_audit('kode');
DROP TRIGGER IF EXISTS trg_audit ON ref.jenjang;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON ref.jenjang FOR EACH ROW EXECUTE FUNCTION ref.catat_audit('kode');
DROP TRIGGER IF EXISTS trg_audit ON ref.satuan_pendidikan;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON ref.satuan_pendidikan FOR EACH ROW EXECUTE FUNCTION ref.catat_audit('npsn');
DROP TRIGGER IF EXISTS trg_audit ON ref.direktorat;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON ref.direktorat FOR EACH ROW EXECUTE FUNCTION ref.catat_audit('kode');
DROP TRIGGER IF EXISTS trg_audit ON ref.sumber_dana;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON ref.sumber_dana FOR EACH ROW EXECUTE FUNCTION ref.catat_audit('kode');
DROP TRIGGER IF EXISTS trg_audit ON ref.sumber_dana_jenjang;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON ref.sumber_dana_jenjang FOR EACH ROW EXECUTE FUNCTION ref.catat_audit('sumber_dana_kode,jenjang_kode');
DROP TRIGGER IF EXISTS trg_audit ON ref.kode_rekening;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON ref.kode_rekening FOR EACH ROW EXECUTE FUNCTION ref.catat_audit('kode');
DROP TRIGGER IF EXISTS trg_audit ON ref.komponen;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON ref.komponen FOR EACH ROW EXECUTE FUNCTION ref.catat_audit('sumber_dana_kode,kode');
DROP TRIGGER IF EXISTS trg_audit ON ref.tarif_pajak;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON ref.tarif_pajak FOR EACH ROW EXECUTE FUNCTION ref.catat_audit('kode_rekening,jenis,wilayah_kode');
RESET ROLE;
