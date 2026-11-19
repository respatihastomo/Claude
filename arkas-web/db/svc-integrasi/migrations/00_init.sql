-- 13.4.1 Inisialisasi skema dan role db_integrasi (svc-integrasi). Kredensial terpisah dari layanan lain (7.7).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_integrasi_owner') THEN CREATE ROLE arkas_integrasi_owner NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_app_integrasi') THEN CREATE ROLE arkas_app_integrasi NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_worker_integrasi') THEN CREATE ROLE arkas_worker_integrasi NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_integrasi_login') THEN CREATE ROLE api_integrasi_login LOGIN IN ROLE arkas_app_integrasi; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_integrasi_login') THEN
    CREATE ROLE worker_integrasi_login LOGIN BYPASSRLS IN ROLE arkas_worker_integrasi;
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS integrasi AUTHORIZATION arkas_integrasi_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA integrasi TO arkas_app_integrasi, arkas_worker_integrasi;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
