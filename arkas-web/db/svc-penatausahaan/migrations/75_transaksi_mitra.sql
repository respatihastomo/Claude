-- UC-12 Memetakan transaksi Mitra SIPLah: antrean transaksi dari event TransaksiMitraDiterima (svc-integrasi).
-- Bendahara memetakan item ke baris RKAS lalu mencatatnya sebagai BELANJA (NON_TUNAI) yang tetap butuh persetujuan Kepala Sekolah.
SET ROLE arkas_tatausaha_owner;
SET search_path = tatausaha;

CREATE TABLE IF NOT EXISTS transaksi_mitra_masuk (
  id                  uuid PRIMARY KEY,               -- = transaksiMitraId di svc-integrasi
  mitra_kode          varchar(20) NOT NULL,
  transaction_id      varchar(60) NOT NULL,
  npsn                char(8) NOT NULL,
  tahun               smallint NOT NULL,
  sumber_dana_kode    varchar(20) NOT NULL,
  tanggal             date NOT NULL,
  nama_toko           varchar(150) NOT NULL,
  penjual_punya_npwp  boolean NOT NULL,
  total               numeric(18,2) NOT NULL,
  items               jsonb NOT NULL,
  status              varchar(10) NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU','DICATAT','DIBATALKAN')),
  status_mitra        varchar(10) NOT NULL DEFAULT 'DITERIMA' CHECK (status_mitra IN ('DITERIMA','DIBATALKAN','RETUR')),
  alasan_batal        varchar(500),
  transaksi_id        uuid,
  dicatat_oleh        uuid,
  dicatat_at          timestamptz,
  diterima_at         timestamptz NOT NULL,
  UNIQUE (mitra_kode, transaction_id)
);
CREATE INDEX IF NOT EXISTS ix_trx_mitra_masuk_buku ON transaksi_mitra_masuk (npsn, tahun, sumber_dana_kode, status);

GRANT SELECT ON transaksi_mitra_masuk TO arkas_app_tatausaha;
GRANT UPDATE (status, transaksi_id, dicatat_oleh, dicatat_at) ON transaksi_mitra_masuk TO arkas_app_tatausaha;
GRANT SELECT, INSERT, UPDATE ON transaksi_mitra_masuk TO arkas_worker_tatausaha;
ALTER TABLE transaksi_mitra_masuk ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_baca ON transaksi_mitra_masuk;
CREATE POLICY p_baca ON transaksi_mitra_masuk FOR SELECT TO arkas_app_tatausaha USING (boleh_akses(npsn, sumber_dana_kode));
DROP POLICY IF EXISTS p_bendahara ON transaksi_mitra_masuk;
CREATE POLICY p_bendahara ON transaksi_mitra_masuk FOR UPDATE TO arkas_app_tatausaha
  USING (sekolah_sendiri(npsn, 'BENDAHARA') AND status = 'MENUNGGU' AND status_mitra = 'DITERIMA')
  WITH CHECK (sekolah_sendiri(npsn, 'BENDAHARA') AND status = 'DICATAT' AND transaksi_id IS NOT NULL);

DROP TRIGGER IF EXISTS trg_audit ON transaksi_mitra_masuk;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON transaksi_mitra_masuk FOR EACH ROW EXECUTE FUNCTION tatausaha.catat_audit('mitra_kode,transaction_id', 'items');
RESET ROLE;
