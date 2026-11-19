-- 13.4.1 Inisialisasi skema dan role db_pemantauan (svc-pemantauan). Kredensial terpisah dari layanan lain (7.7).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_pemantauan_owner') THEN CREATE ROLE arkas_pemantauan_owner NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_app_pemantauan') THEN CREATE ROLE arkas_app_pemantauan NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_worker_pemantauan') THEN CREATE ROLE arkas_worker_pemantauan NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_pemantauan_login') THEN CREATE ROLE api_pemantauan_login LOGIN IN ROLE arkas_app_pemantauan; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_pemantauan_login') THEN
    CREATE ROLE worker_pemantauan_login LOGIN BYPASSRLS IN ROLE arkas_worker_pemantauan;
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS pemantauan AUTHORIZATION arkas_pemantauan_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA pemantauan TO arkas_app_pemantauan, arkas_worker_pemantauan;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
