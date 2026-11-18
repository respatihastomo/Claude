-- 13.4.1 Inisialisasi skema & role db_auth (svc-identitas).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_auth_owner') THEN CREATE ROLE arkas_auth_owner NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_app_auth') THEN CREATE ROLE arkas_app_auth NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arkas_worker_auth') THEN CREATE ROLE arkas_worker_auth NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_auth_login') THEN CREATE ROLE api_auth_login LOGIN IN ROLE arkas_app_auth; END IF;
  -- Pekerja: alur masuk/sesi/token (belum ada konteks pengguna), konsumen event, outbox relay.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_auth_login') THEN CREATE ROLE worker_auth_login LOGIN BYPASSRLS IN ROLE arkas_worker_auth; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION arkas_auth_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO arkas_app_auth, arkas_worker_auth;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
