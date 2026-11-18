-- 13.4.1 Inisialisasi skema dan role db_tatausaha (dijalankan oleh superuser / DBA)
-- Kredensial terisolasi per layanan (7.7): svc-penatausahaan tidak dapat membuka basis data layanan lain.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_tatausaha_owner') THEN
    CREATE ROLE arkas_tatausaha_owner NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_app_tatausaha') THEN
    CREATE ROLE arkas_app_tatausaha NOLOGIN;            -- proses API, tunduk RLS
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_worker_tatausaha') THEN
    CREATE ROLE arkas_worker_tatausaha NOLOGIN;         -- consumer event & outbox relay
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_tatausaha_login') THEN
    CREATE ROLE api_tatausaha_login LOGIN IN ROLE arkas_app_tatausaha;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_tatausaha_login') THEN
    -- BYPASSRLS tidak diwariskan lewat keanggotaan role, maka dipasang langsung di role login pekerja.
    CREATE ROLE worker_tatausaha_login LOGIN BYPASSRLS IN ROLE arkas_worker_tatausaha;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS tatausaha AUTHORIZATION arkas_tatausaha_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA tatausaha TO arkas_app_tatausaha, arkas_worker_tatausaha;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
