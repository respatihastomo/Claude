-- svc-referensi: proyeksi sekolah, komponen, dan kode rekening diisi event ReferensiDiubah (penjaga versi). Aditif, aman dijalankan ulang.
SET ROLE arkas_perencanaan_owner;
SET search_path = perencanaan;
ALTER TABLE ref_sekolah_lokal ADD COLUMN IF NOT EXISTS aktif boolean NOT NULL DEFAULT true;
ALTER TABLE ref_sekolah_lokal ADD COLUMN IF NOT EXISTS versi bigint NOT NULL DEFAULT 0;
ALTER TABLE ref_komponen_lokal ADD COLUMN IF NOT EXISTS aktif boolean NOT NULL DEFAULT true;
ALTER TABLE ref_komponen_lokal ADD COLUMN IF NOT EXISTS versi bigint NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS ref_rekening_lokal (
  kode   varchar(30) PRIMARY KEY,
  nama   varchar(250) NOT NULL,
  aktif  boolean NOT NULL DEFAULT true,
  versi  bigint NOT NULL DEFAULT 0
);
GRANT SELECT ON ref_rekening_lokal TO arkas_app_perencanaan;
GRANT SELECT, INSERT, UPDATE ON ref_rekening_lokal TO arkas_worker_perencanaan;
RESET ROLE;
