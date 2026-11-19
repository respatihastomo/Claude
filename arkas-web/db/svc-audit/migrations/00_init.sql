-- Inisialisasi skema dan role db_audit (svc-audit). Kredensial terpisah dari layanan lain.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_audit_owner') THEN CREATE ROLE arkas_audit_owner NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_app_audit') THEN CREATE ROLE arkas_app_audit NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_worker_audit') THEN CREATE ROLE arkas_worker_audit NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_audit_login') THEN CREATE ROLE api_audit_login LOGIN IN ROLE arkas_app_audit; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_audit_login') THEN CREATE ROLE worker_audit_login LOGIN BYPASSRLS IN ROLE arkas_worker_audit; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION arkas_audit_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA audit TO arkas_app_audit, arkas_worker_audit;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
