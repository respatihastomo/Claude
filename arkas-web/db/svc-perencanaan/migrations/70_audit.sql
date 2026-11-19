-- Audit stream (D7): trigger catat_audit() pada tabel domain svc-perencanaan -> outbox AuditDicatat -> svc-audit.
SET ROLE arkas_perencanaan_owner;
-- #sertakan _bersama/audit.sql perencanaan

DROP TRIGGER IF EXISTS trg_audit ON perencanaan.pagu;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON perencanaan.pagu FOR EACH ROW EXECUTE FUNCTION perencanaan.catat_audit('id');
DROP TRIGGER IF EXISTS trg_audit ON perencanaan.kertas_kerja;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON perencanaan.kertas_kerja FOR EACH ROW EXECUTE FUNCTION perencanaan.catat_audit('id');
DROP TRIGGER IF EXISTS trg_audit ON perencanaan.baris_kertas_kerja;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON perencanaan.baris_kertas_kerja FOR EACH ROW EXECUTE FUNCTION perencanaan.catat_audit('id');
DROP TRIGGER IF EXISTS trg_audit ON perencanaan.verifikasi;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON perencanaan.verifikasi FOR EACH ROW EXECUTE FUNCTION perencanaan.catat_audit('id', '', 'kertas_kerja:kertas_kerja_id');
DROP TRIGGER IF EXISTS trg_audit ON perencanaan.catatan_baris;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON perencanaan.catatan_baris FOR EACH ROW EXECUTE FUNCTION perencanaan.catat_audit('id', '', 'kertas_kerja:kertas_kerja_id');
RESET ROLE;
