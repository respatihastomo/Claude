-- Audit stream (D7): trigger catat_audit() pada tabel domain svc-integrasi -> outbox AuditDicatat -> svc-audit.
SET ROLE arkas_integrasi_owner;
-- #sertakan _bersama/audit.sql integrasi

DROP TRIGGER IF EXISTS trg_audit ON integrasi.mitra_siplah;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON integrasi.mitra_siplah FOR EACH ROW EXECUTE FUNCTION integrasi.catat_audit('kode', 'client_secret_hash,hmac_rahasia');
DROP TRIGGER IF EXISTS trg_audit ON integrasi.pembukaan_sumber_dana;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON integrasi.pembukaan_sumber_dana FOR EACH ROW EXECUTE FUNCTION integrasi.catat_audit('sumber_dana_kode,mitra_kode', 'percobaan,berikutnya_at,galat_terakhir,diubah_at');
DROP TRIGGER IF EXISTS trg_audit ON integrasi.transaksi_mitra;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON integrasi.transaksi_mitra FOR EACH ROW EXECUTE FUNCTION integrasi.catat_audit('mitra_kode,transaction_id');
RESET ROLE;
