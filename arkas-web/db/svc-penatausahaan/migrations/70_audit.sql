-- Audit stream (D7): trigger catat_audit() pada tabel domain svc-penatausahaan -> outbox AuditDicatat -> svc-audit.
SET ROLE arkas_tatausaha_owner;
-- #sertakan _bersama/audit.sql tatausaha

DROP TRIGGER IF EXISTS trg_audit ON tatausaha.periode;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON tatausaha.periode FOR EACH ROW EXECUTE FUNCTION tatausaha.catat_audit('id');
DROP TRIGGER IF EXISTS trg_audit ON tatausaha.transaksi;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON tatausaha.transaksi FOR EACH ROW EXECUTE FUNCTION tatausaha.catat_audit('id');
DROP TRIGGER IF EXISTS trg_audit ON tatausaha.pajak;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON tatausaha.pajak FOR EACH ROW EXECUTE FUNCTION tatausaha.catat_audit('id');
DROP TRIGGER IF EXISTS trg_audit ON tatausaha.rekonsiliasi;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON tatausaha.rekonsiliasi FOR EACH ROW EXECUTE FUNCTION tatausaha.catat_audit('id');
RESET ROLE;
