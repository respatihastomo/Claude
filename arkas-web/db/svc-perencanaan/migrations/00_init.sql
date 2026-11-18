-- 13.4.1 Inisialisasi skema dan role db_perencanaan.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_perencanaan_owner') THEN CREATE ROLE arkas_perencanaan_owner NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_app_perencanaan') THEN CREATE ROLE arkas_app_perencanaan NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_worker_perencanaan') THEN CREATE ROLE arkas_worker_perencanaan NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_perencanaan_login') THEN CREATE ROLE api_perencanaan_login LOGIN IN ROLE arkas_app_perencanaan; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_perencanaan_login') THEN
    CREATE ROLE worker_perencanaan_login LOGIN BYPASSRLS IN ROLE arkas_worker_perencanaan;
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS perencanaan AUTHORIZATION arkas_perencanaan_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA perencanaan TO arkas_app_perencanaan, arkas_worker_perencanaan;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
