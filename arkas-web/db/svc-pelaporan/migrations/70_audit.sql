-- Audit stream (D7): trigger catat_audit() pada tabel domain svc-pelaporan -> outbox AuditDicatat -> svc-audit.
SET ROLE arkas_pelaporan_owner;
-- #sertakan _bersama/audit.sql pelaporan

DROP TRIGGER IF EXISTS trg_audit ON pelaporan.laporan;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON pelaporan.laporan FOR EACH ROW EXECUTE FUNCTION pelaporan.catat_audit('id');
RESET ROLE;
