-- Audit stream (D7): trigger catat_audit() pada tabel domain svc-identitas -> outbox AuditDicatat -> svc-audit.
SET ROLE arkas_auth_owner;
-- #sertakan _bersama/audit.sql auth

DROP TRIGGER IF EXISTS trg_audit ON auth.pengguna;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON auth.pengguna FOR EACH ROW EXECUTE FUNCTION auth.catat_audit('id', 'email,nama,sso_issuer,sso_sub,masuk_terakhir_at');
DROP TRIGGER IF EXISTS trg_audit ON auth.peran_pengguna;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON auth.peran_pengguna FOR EACH ROW EXECUTE FUNCTION auth.catat_audit('id');
RESET ROLE;
