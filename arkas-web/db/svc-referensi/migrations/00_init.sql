-- 13.4.1 Inisialisasi skema & role db_ref (svc-referensi).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_ref_owner') THEN CREATE ROLE arkas_ref_owner NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_app_ref') THEN CREATE ROLE arkas_app_ref NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_worker_ref') THEN CREATE ROLE arkas_worker_ref NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_ref_login') THEN CREATE ROLE api_ref_login LOGIN IN ROLE arkas_app_ref; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_ref_login') THEN CREATE ROLE worker_ref_login LOGIN BYPASSRLS IN ROLE arkas_worker_ref; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS ref AUTHORIZATION arkas_ref_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA ref TO arkas_app_ref, arkas_worker_ref;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
