-- 13.4.1 Inisialisasi skema dan role db_pelaporan. Kredensial terpisah dari layanan lain (7.7).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_pelaporan_owner') THEN CREATE ROLE arkas_pelaporan_owner NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_app_pelaporan') THEN CREATE ROLE arkas_app_pelaporan NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_worker_pelaporan') THEN CREATE ROLE arkas_worker_pelaporan NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_pelaporan_login') THEN CREATE ROLE api_pelaporan_login LOGIN IN ROLE arkas_app_pelaporan; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_pelaporan_login') THEN
    CREATE ROLE worker_pelaporan_login LOGIN BYPASSRLS IN ROLE arkas_worker_pelaporan;
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS pelaporan AUTHORIZATION arkas_pelaporan_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA pelaporan TO arkas_app_pelaporan, arkas_worker_pelaporan;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
