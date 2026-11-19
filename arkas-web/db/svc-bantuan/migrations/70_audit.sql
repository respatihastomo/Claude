-- Audit stream (D7): trigger catat_audit() pada tabel domain svc-bantuan -> outbox AuditDicatat -> svc-audit.
SET ROLE arkas_banper_owner;
-- #sertakan _bersama/audit.sql banper

DROP TRIGGER IF EXISTS trg_audit ON banper.sumber_dana_bantuan;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON banper.sumber_dana_bantuan FOR EACH ROW EXECUTE FUNCTION banper.catat_audit('kode');
DROP TRIGGER IF EXISTS trg_audit ON banper.dokumen;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON banper.dokumen FOR EACH ROW EXECUTE FUNCTION banper.catat_audit('id');
DROP TRIGGER IF EXISTS trg_audit ON banper.penerima;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON banper.penerima FOR EACH ROW EXECUTE FUNCTION banper.catat_audit('sumber_dana_kode,npsn');
DROP TRIGGER IF EXISTS trg_audit ON banper.pks_bank;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON banper.pks_bank FOR EACH ROW EXECUTE FUNCTION banper.catat_audit('id');
DROP TRIGGER IF EXISTS trg_audit ON banper.penyaluran;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON banper.penyaluran FOR EACH ROW EXECUTE FUNCTION banper.catat_audit('id');
DROP TRIGGER IF EXISTS trg_audit ON banper.pengajuan_sekolah;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON banper.pengajuan_sekolah FOR EACH ROW EXECUTE FUNCTION banper.catat_audit('id', 'riwayat');
RESET ROLE;
