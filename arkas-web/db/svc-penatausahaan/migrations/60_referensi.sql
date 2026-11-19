-- svc-referensi: proyeksi tarif pajak ber-wilayah (UC-32) & wilayah sekolah, diisi event ReferensiDiubah. Aditif, aman dijalankan ulang.
SET ROLE arkas_tatausaha_owner;
SET search_path = tatausaha;

ALTER TABLE ref_rekening_pajak_lokal ADD COLUMN IF NOT EXISTS wilayah_kode varchar(6) NOT NULL DEFAULT '';
ALTER TABLE ref_rekening_pajak_lokal ADD COLUMN IF NOT EXISTS aktif boolean NOT NULL DEFAULT true;
ALTER TABLE ref_rekening_pajak_lokal ADD COLUMN IF NOT EXISTS versi bigint NOT NULL DEFAULT 0;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ref_rekening_pajak_lokal_pkey'
             AND array_length(conkey, 1) = 2) THEN
    ALTER TABLE tatausaha.ref_rekening_pajak_lokal DROP CONSTRAINT ref_rekening_pajak_lokal_pkey;
    ALTER TABLE tatausaha.ref_rekening_pajak_lokal ADD CONSTRAINT ref_rekening_pajak_lokal_pkey PRIMARY KEY (kode_rekening, jenis, wilayah_kode);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ref_sekolah_lokal (
  npsn          char(8) PRIMARY KEY,
  wilayah_kode  varchar(6) NOT NULL,
  versi         bigint NOT NULL DEFAULT 0
);
GRANT SELECT ON ref_sekolah_lokal TO arkas_app_tatausaha;
GRANT SELECT, INSERT, UPDATE ON ref_sekolah_lokal TO arkas_worker_tatausaha;

RESET ROLE;
