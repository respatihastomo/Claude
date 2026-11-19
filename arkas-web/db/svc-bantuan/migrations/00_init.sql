-- 13.4.1 Inisialisasi skema dan role db_banper (svc-bantuan). Kredensial terpisah dari layanan lain (7.7).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_banper_owner') THEN CREATE ROLE arkas_banper_owner NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_app_banper') THEN CREATE ROLE arkas_app_banper NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_worker_banper') THEN CREATE ROLE arkas_worker_banper NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_banper_login') THEN CREATE ROLE api_banper_login LOGIN IN ROLE arkas_app_banper; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_banper_login') THEN
    CREATE ROLE worker_banper_login LOGIN BYPASSRLS IN ROLE arkas_worker_banper;
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS banper AUTHORIZATION arkas_banper_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA banper TO arkas_app_banper, arkas_worker_banper;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
