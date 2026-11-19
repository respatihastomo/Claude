-- SK-09: PenyaluranDicatat (svc-bantuan) -> draf penerimaan di BKU sekolah per sumber dana bantuan.
-- Bendahara mencatatnya sebagai PENERIMAAN setelah dana masuk rekening (UI menyusul bersama buku Bantuan Pemerintah).
SET ROLE arkas_tatausaha_owner;
SET search_path = tatausaha;
CREATE TABLE IF NOT EXISTS penyaluran_masuk (
  id                uuid PRIMARY KEY,               -- = penyaluranId di svc-bantuan
  npsn              char(8) NOT NULL,
  tahun             smallint NOT NULL,
  sumber_dana_kode  varchar(20) NOT NULL,
  tahap             smallint NOT NULL,
  tanggal           date NOT NULL,
  nilai             numeric(18,2) NOT NULL CHECK (nilai > 0),
  bank_kode         varchar(10) NOT NULL,
  nomor_referensi   varchar(60) NOT NULL,
  transaksi_id      uuid,
  diterima_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_penyaluran_masuk_buku ON penyaluran_masuk (npsn, tahun, sumber_dana_kode);
GRANT SELECT ON penyaluran_masuk TO arkas_app_tatausaha;
GRANT SELECT, INSERT, UPDATE ON penyaluran_masuk TO arkas_worker_tatausaha;
ALTER TABLE penyaluran_masuk ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_baca ON penyaluran_masuk;
CREATE POLICY p_baca ON penyaluran_masuk FOR SELECT TO arkas_app_tatausaha USING (boleh_akses(npsn, sumber_dana_kode));
RESET ROLE;
