-- svc-referensi: proyeksi wilayah, direktorat, sekolah diisi event ReferensiDiubah (penjaga versi). Aditif, aman dijalankan ulang.
SET ROLE arkas_auth_owner;
SET search_path = auth;
ALTER TABLE ref_wilayah_lokal ADD COLUMN IF NOT EXISTS aktif boolean NOT NULL DEFAULT true;
ALTER TABLE ref_wilayah_lokal ADD COLUMN IF NOT EXISTS versi bigint NOT NULL DEFAULT 0;
ALTER TABLE ref_direktorat_lokal ADD COLUMN IF NOT EXISTS aktif boolean NOT NULL DEFAULT true;
ALTER TABLE ref_direktorat_lokal ADD COLUMN IF NOT EXISTS versi bigint NOT NULL DEFAULT 0;
ALTER TABLE ref_sekolah_lokal ADD COLUMN IF NOT EXISTS aktif boolean NOT NULL DEFAULT true;
ALTER TABLE ref_sekolah_lokal ADD COLUMN IF NOT EXISTS versi bigint NOT NULL DEFAULT 0;
RESET ROLE;
