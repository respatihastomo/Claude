import type { PoolClient } from 'pg';
import { AturanPajakRekening, JenisPajak, pilihTarifEfektif } from '@arkas/aturan';
import type {
  BarisBkpPajakDto, PajakDto, BarisBkuDto, BarisRkasDto, ItemTransaksiDto, RincianPajakDto, RingkasanBukuDto, TransaksiDitolakDto, TransaksiDto,
} from '@arkas/kontrak';

/** Repository SQL db_tatausaha. Semua fungsi menerima `tx` dari DbContextService sehingga RLS berlaku. */
const n = (v: string | number | null): number => (v === null ? 0 : Number(v));
const tgl = (v: Date | string): string => (typeof v === 'string' ? v : v.toISOString().slice(0, 10));

export interface Buku { npsn: string; tahun: number; sumberDanaKode: string }

export interface BarisRkasLokal {
  baris_id: string; akar_baris_id: string; kode_rekening: string; kegiatan: string; uraian: string;
  satuan: string | null; harga_satuan: string; total: string; terpakai: string;
}

export async function kunciBuku(tx: PoolClient, b: Buku): Promise<void> {
  await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`tatausaha:${b.npsn}:${b.tahun}:${b.sumberDanaKode}`]);
}

export async function cariPeriode(tx: PoolClient, b: Buku, bulan: number) {
  const r = await tx.query<{ id: string; status: 'BUKA' | 'DIAJUKAN' | 'DITUTUP' }>(
    `SELECT id, status FROM tatausaha.periode WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3 AND bulan = $4`,
    [b.npsn, b.tahun, b.sumberDanaKode, bulan],
  );
  return r.rows[0];
}

export async function cariIdempoten(tx: PoolClient, b: Buku, kunci: string) {
  const r = await tx.query<{ id: string; idempotency_hash: string }>(
    `SELECT id, idempotency_hash FROM tatausaha.transaksi WHERE npsn = $1 AND tahun = $2 AND idempotency_key = $3`,
    [b.npsn, b.tahun, kunci],
  );
  return r.rows[0];
}

export async function barisRkasUntuk(tx: PoolClient, b: Buku, barisIds: string[]): Promise<Map<string, BarisRkasLokal>> {
  const r = await tx.query<BarisRkasLokal>(
    `SELECT r.baris_id, r.akar_baris_id, r.kode_rekening, r.kegiatan, r.uraian, r.satuan, r.harga_satuan, r.total,
            coalesce((SELECT sum(i.jumlah) FROM tatausaha.item_transaksi i
                      JOIN tatausaha.transaksi t ON t.id = i.transaksi_id AND t.tahun = i.tahun
                      WHERE i.akar_baris_id = r.akar_baris_id AND i.tahun = r.tahun AND t.status <> 'DITOLAK'), 0) AS terpakai
     FROM tatausaha.rkas_baris_sah r
     WHERE r.baris_id = ANY($4::uuid[]) AND r.aktif AND r.npsn = $1 AND r.tahun = $2 AND r.sumber_dana_kode = $3`,
    [b.npsn, b.tahun, b.sumberDanaKode, barisIds],
  );
  return new Map(r.rows.map((x) => [x.baris_id, x]));
}

/** UC-32: tarif efektif per rekening untuk sekolah (penimpaan SSPD wilayah paling spesifik; baris nonaktif = tidak dipungut). */
export async function aturanPajak(tx: PoolClient, kodeRekening: string[], npsn: string): Promise<Record<string, AturanPajakRekening[]>> {
  const r = await tx.query<{ kode_rekening: string; jenis: JenisPajak; tarif: string; tarif_tanpa_npwp: string | null; wilayah_kode: string; aktif: boolean }>(
    `SELECT kode_rekening, jenis, tarif, tarif_tanpa_npwp, wilayah_kode, aktif FROM tatausaha.ref_rekening_pajak_lokal WHERE kode_rekening = ANY($1)`,
    [kodeRekening],
  );
  const w = (await tx.query<{ wilayah_kode: string }>(`SELECT wilayah_kode FROM tatausaha.ref_sekolah_lokal WHERE npsn = $1`, [npsn])).rows[0]?.wilayah_kode;
  return pilihTarifEfektif(r.rows.map((x) => ({
    kodeRekening: x.kode_rekening, jenis: x.jenis, tarif: n(x.tarif), tarifTanpaNpwp: x.tarif_tanpa_npwp === null ? null : n(x.tarif_tanpa_npwp),
    wilayahKode: x.wilayah_kode, aktif: x.aktif,
  })), w);
}

/** Saldo resmi (hanya DISETUJUI) dan saldo tersedia (penerimaan DISETUJUI - pengeluaran DISETUJUI/DICATAT) per buku kas. */
export async function saldo(tx: PoolClient, b: Buku) {
  const r = await tx.query<{ buku: 'TUNAI' | 'BANK'; resmi: string; tersedia: string }>(
    `SELECT buku,
            sum(CASE WHEN status = 'DISETUJUI' THEN penerimaan - pengeluaran ELSE 0 END) AS resmi,
            sum(CASE WHEN status = 'DISETUJUI' THEN penerimaan ELSE 0 END)
              - sum(CASE WHEN status IN ('DISETUJUI','DICATAT') THEN pengeluaran ELSE 0 END) AS tersedia
     FROM tatausaha.v_mutasi WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3 GROUP BY buku`,
    [b.npsn, b.tahun, b.sumberDanaKode],
  );
  const ambil = (buku: 'TUNAI' | 'BANK') => r.rows.find((x) => x.buku === buku);
  return {
    resmi: { tunai: n(ambil('TUNAI')?.resmi ?? 0), bank: n(ambil('BANK')?.resmi ?? 0) },
    tersedia: { tunai: n(ambil('TUNAI')?.tersedia ?? 0), bank: n(ambil('BANK')?.tersedia ?? 0) },
  };
}

export interface TransaksiBaru {
  buku: Buku; periodeId: string; jenis: string; tanggal: string; caraBayar: string | null; noBukti: string | null;
  uraian: string; namaToko: string | null; penjualPunyaNpwp: boolean | null; nilaiBruto: number; totalPajak: number;
  dibuatOleh: string; idempotencyKey: string; idempotencyHash: string; ntpn?: string | null;
}

export async function simpanTransaksi(tx: PoolClient, t: TransaksiBaru): Promise<string> {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO tatausaha.transaksi (tahun, npsn, sumber_dana_kode, periode_id, jenis, tanggal, cara_bayar, no_bukti, uraian,
       nama_toko, penjual_punya_npwp, nilai_bruto, total_pajak, dibuat_oleh, idempotency_key, idempotency_hash, ntpn)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
    [t.buku.tahun, t.buku.npsn, t.buku.sumberDanaKode, t.periodeId, t.jenis, t.tanggal, t.caraBayar, t.noBukti, t.uraian,
      t.namaToko, t.penjualPunyaNpwp, t.nilaiBruto, t.totalPajak, t.dibuatOleh, t.idempotencyKey, t.idempotencyHash, t.ntpn ?? null],
  );
  return r.rows[0].id;
}

export async function simpanItem(
  tx: PoolClient, buku: Buku, transaksiId: string,
  i: { barisId: string; akarBarisId: string; kodeRekening: string; uraian: string; volume: number; satuan: string | null; hargaSatuan: number; jumlah: number },
): Promise<void> {
  await tx.query(
    `INSERT INTO tatausaha.item_transaksi (tahun, transaksi_id, npsn, sumber_dana_kode, baris_kertas_kerja_id, akar_baris_id,
       kode_rekening, uraian, volume, satuan, harga_satuan, jumlah)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [buku.tahun, transaksiId, buku.npsn, buku.sumberDanaKode, i.barisId, i.akarBarisId, i.kodeRekening, i.uraian, i.volume, i.satuan, i.hargaSatuan, i.jumlah],
  );
}

export async function simpanPajak(tx: PoolClient, buku: Buku, transaksiId: string, p: { jenis: string; tarif: number; dpp: number; nilai: number }): Promise<void> {
  await tx.query(
    `INSERT INTO tatausaha.pajak (transaksi_id, tahun, npsn, sumber_dana_kode, jenis, tarif, dpp, nilai) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [transaksiId, buku.tahun, buku.npsn, buku.sumberDanaKode, p.jenis, p.tarif, p.dpp, p.nilai],
  );
}

interface BarisTransaksi {
  id: string; npsn: string; tahun: number; sumber_dana_kode: string; jenis: TransaksiDto['jenis']; tanggal: Date;
  cara_bayar: TransaksiDto['caraBayar']; no_bukti: string | null; uraian: string; nama_toko: string | null;
  penjual_punya_npwp: boolean | null; nilai_bruto: string; total_pajak: string; status: TransaksiDto['status'];
  dibuat_oleh: string; dibuat_at: Date; diputuskan_oleh: string | null; diputuskan_at: Date | null;
  alasan_tolak: string | null; row_version: number; ntpn: string | null;
}

export async function ambilTransaksi(tx: PoolClient, id: string, kunci = false): Promise<TransaksiDto | undefined> {
  const r = await tx.query<BarisTransaksi>(
    `SELECT * FROM tatausaha.transaksi WHERE id = $1 ${kunci ? 'FOR UPDATE' : ''}`,
    [id],
  );
  const t = r.rows[0];
  if (!t) return undefined;
  const items = await tx.query<{ id: string; baris_kertas_kerja_id: string; kode_rekening: string; uraian: string; volume: string; satuan: string | null; harga_satuan: string; jumlah: string }>(
    `SELECT id, baris_kertas_kerja_id, kode_rekening, uraian, volume, satuan, harga_satuan, jumlah
     FROM tatausaha.item_transaksi WHERE transaksi_id = $1 AND tahun = $2 ORDER BY kode_rekening, id`,
    [t.id, t.tahun],
  );
  const pajak = await tx.query<{ jenis: RincianPajakDto['jenis']; tarif: string; dpp: string; nilai: string; status: 'DIPUNGUT' | 'DISETOR' }>(
    // belanja: pajak yang dipungutnya; setor pajak: pajak yang ditautkan ke setoran ini
    `SELECT jenis, tarif, dpp, nilai, status FROM tatausaha.pajak WHERE (transaksi_id = $1 OR setor_transaksi_id = $1) AND tahun = $2 ORDER BY jenis, tarif, id`,
    [t.id, t.tahun],
  );
  const bruto = n(t.nilai_bruto);
  const pj = n(t.total_pajak);
  return {
    id: t.id, npsn: t.npsn, tahun: t.tahun, sumberDanaKode: t.sumber_dana_kode, jenis: t.jenis, tanggal: tgl(t.tanggal),
    caraBayar: t.cara_bayar, noBukti: t.no_bukti, uraian: t.uraian, namaToko: t.nama_toko, penjualPunyaNpwp: t.penjual_punya_npwp,
    nilaiBruto: bruto, totalPajak: pj, nilaiNetto: Math.round((bruto - pj) * 100) / 100, status: t.status, ntpn: t.ntpn,
    dibuatOleh: t.dibuat_oleh, dibuatAt: t.dibuat_at.toISOString(), diputuskanOleh: t.diputuskan_oleh,
    diputuskanAt: t.diputuskan_at?.toISOString() ?? null, alasanTolak: t.alasan_tolak, versi: t.row_version,
    items: items.rows.map<ItemTransaksiDto>((i) => ({
      id: i.id, barisId: i.baris_kertas_kerja_id, kodeRekening: i.kode_rekening, uraian: i.uraian, volume: n(i.volume),
      satuan: i.satuan, hargaSatuan: n(i.harga_satuan), jumlah: n(i.jumlah),
    })),
    pajak: pajak.rows.map((p) => ({ jenis: p.jenis, tarif: n(p.tarif), dpp: n(p.dpp), nilai: n(p.nilai), status: p.status })),
  };
}

export async function putuskan(
  tx: PoolClient, id: string, status: 'DISETUJUI' | 'DITOLAK', oleh: string, alasan: string | null,
): Promise<void> {
  await tx.query(
    `UPDATE tatausaha.transaksi SET status = $2, diputuskan_oleh = $3, diputuskan_at = now(), alasan_tolak = $4 WHERE id = $1`,
    [id, status, oleh, alasan],
  );
}

/** Transaksi DITOLAK pada periode yang masih BUKA (yang sudah ditutup tidak bisa ditindaklanjuti lagi), terbaru dulu. */
export async function daftarDitolak(tx: PoolClient, b: Buku): Promise<TransaksiDitolakDto[]> {
  const r = await tx.query<{ id: string; jenis: TransaksiDitolakDto['jenis']; tanggal: Date; no_bukti: string | null; uraian: string;
    nama_toko: string | null; nilai_bruto: string; alasan_tolak: string | null; diputuskan_at: Date | null }>(
    `SELECT t.id, t.jenis, t.tanggal, t.no_bukti, t.uraian, t.nama_toko, t.nilai_bruto, t.alasan_tolak, t.diputuskan_at
     FROM tatausaha.transaksi t JOIN tatausaha.periode p ON p.id = t.periode_id
     WHERE t.npsn = $1 AND t.tahun = $2 AND t.sumber_dana_kode = $3 AND t.status = 'DITOLAK' AND p.status = 'BUKA'
     ORDER BY t.diputuskan_at DESC NULLS LAST, t.id LIMIT 50`,
    [b.npsn, b.tahun, b.sumberDanaKode],
  );
  return r.rows.map((x) => ({
    id: x.id, jenis: x.jenis, tanggal: tgl(x.tanggal), noBukti: x.no_bukti, uraian: x.uraian, namaToko: x.nama_toko,
    nilaiBruto: n(x.nilai_bruto), alasanTolak: x.alasan_tolak, diputuskanAt: x.diputuskan_at?.toISOString() ?? null,
  }));
}

/** BKU dengan saldo berjalan (hanya baris DISETUJUI yang menggerakkan saldo); filter bulan diterapkan setelah saldo dihitung. */
export async function daftarBku(tx: PoolClient, b: Buku, bulan?: number, buku?: 'TUNAI' | 'BANK'): Promise<BarisBkuDto[]> {
  const r = await tx.query<{
    transaksi_id: string; tanggal: Date; no_bukti: string | null; uraian: string; buku: 'TUNAI' | 'BANK';
    kode_rekening: string | null; penerimaan: string; pengeluaran: string; status: BarisBkuDto['status']; saldo: string | null;
  }>(
    `WITH m AS (
       SELECT *, CASE WHEN status = 'DISETUJUI'
                   THEN sum(CASE WHEN status = 'DISETUJUI' THEN penerimaan - pengeluaran ELSE 0 END)
                        OVER (ORDER BY tanggal, dibuat_at, transaksi_id, urut, uraian ROWS UNBOUNDED PRECEDING) END AS saldo
       FROM tatausaha.v_mutasi
       WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3 AND status <> 'DITOLAK' AND ($5::text IS NULL OR buku = $5)
     )
     SELECT transaksi_id, tanggal, no_bukti, uraian, buku, kode_rekening, penerimaan, pengeluaran, status, saldo
     FROM m WHERE ($4::int IS NULL OR extract(month FROM tanggal) = $4)
     ORDER BY tanggal, dibuat_at, transaksi_id, urut, uraian`,
    [b.npsn, b.tahun, b.sumberDanaKode, bulan ?? null, buku ?? null],
  );
  return r.rows.map((x) => ({
    transaksiId: x.transaksi_id, tanggal: tgl(x.tanggal), noBukti: x.no_bukti, uraian: x.uraian, buku: x.buku,
    kodeRekening: x.kode_rekening, penerimaan: n(x.penerimaan), pengeluaran: n(x.pengeluaran), status: x.status,
    saldo: x.saldo === null ? null : n(x.saldo),
  }));
}

export async function daftarRkas(tx: PoolClient, b: Buku): Promise<BarisRkasDto[]> {
  const r = await tx.query<BarisRkasLokal & { pajak: string[] | null }>(
    `SELECT r.baris_id, r.akar_baris_id, r.kode_rekening, r.kegiatan, r.uraian, r.satuan, r.harga_satuan, r.total,
            coalesce((SELECT sum(i.jumlah) FROM tatausaha.item_transaksi i
                      JOIN tatausaha.transaksi t ON t.id = i.transaksi_id AND t.tahun = i.tahun
                      WHERE i.akar_baris_id = r.akar_baris_id AND i.tahun = r.tahun AND t.status <> 'DITOLAK'), 0) AS terpakai,
            NULL::text[] AS pajak
     FROM tatausaha.rkas_baris_sah r
     WHERE r.aktif AND r.npsn = $1 AND r.tahun = $2 AND r.sumber_dana_kode = $3
     ORDER BY r.kegiatan, r.kode_rekening, r.uraian`,
    [b.npsn, b.tahun, b.sumberDanaKode],
  );
  const efektif = await aturanPajak(tx, [...new Set(r.rows.map((x) => x.kode_rekening))], b.npsn);
  return r.rows.map((x) => ({
    barisId: x.baris_id, kodeRekening: x.kode_rekening, kegiatan: x.kegiatan, uraian: x.uraian, satuan: x.satuan,
    hargaSatuan: n(x.harga_satuan), anggaran: n(x.total), realisasi: n(x.terpakai),
    sisa: Math.round((n(x.total) - n(x.terpakai)) * 100) / 100, pajak: (efektif[x.kode_rekening] ?? []).map((p) => p.jenis),
  }));
}

export async function ringkasan(tx: PoolClient, b: Buku, bulanIni: number): Promise<RingkasanBukuDto> {
  const s = await saldo(tx, b);
  const agg = await tx.query<{ pagu: string; realisasi: string; menunggu: string; terutang: string }>(
    `SELECT
       (SELECT coalesce(sum(total), 0) FROM tatausaha.rkas_baris_sah WHERE aktif AND npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3) AS pagu,
       (SELECT coalesce(sum(i.jumlah), 0) FROM tatausaha.item_transaksi i JOIN tatausaha.transaksi t ON t.id = i.transaksi_id AND t.tahun = i.tahun
         WHERE t.npsn = $1 AND t.tahun = $2 AND t.sumber_dana_kode = $3 AND t.status = 'DISETUJUI') AS realisasi,
       (SELECT count(*) FROM tatausaha.transaksi WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3 AND status = 'DICATAT') AS menunggu,
       (SELECT coalesce(sum(p.nilai), 0) FROM tatausaha.pajak p JOIN tatausaha.transaksi t ON t.id = p.transaksi_id AND t.tahun = p.tahun
         WHERE p.npsn = $1 AND p.tahun = $2 AND p.sumber_dana_kode = $3 AND t.status = 'DISETUJUI' AND p.status = 'DIPUNGUT') AS terutang`,
    [b.npsn, b.tahun, b.sumberDanaKode],
  );
  const per = await tx.query<{ bulan: number; status: 'BUKA' | 'DIAJUKAN' | 'DITUTUP' }>(
    `SELECT bulan, status FROM tatausaha.periode WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3
     ORDER BY (status <> 'DITUTUP') DESC, (bulan = $4) DESC, bulan LIMIT 1`,
    [b.npsn, b.tahun, b.sumberDanaKode, bulanIni],
  );
  const a = agg.rows[0];
  return {
    npsn: b.npsn, tahun: b.tahun, sumberDanaKode: b.sumberDanaKode, periodeBerjalan: per.rows[0] ?? null,
    saldo: { tunai: s.resmi.tunai, bank: s.resmi.bank, total: Math.round((s.resmi.tunai + s.resmi.bank) * 100) / 100 },
    saldoTersedia: s.tersedia, pagu: n(a.pagu), realisasi: n(a.realisasi), menungguPersetujuan: n(a.menunggu), pajakTerutang: n(a.terutang),
  };
}

// ---------- Irisan 2: setor pajak ----------

interface BarisPajak {
  id: string; jenis: PajakDto['jenis']; tarif: string; dpp: string; nilai: string; status: 'DIPUNGUT' | 'DISETOR';
  transaksi_id: string; tanggal_belanja: Date; no_bukti: string | null; nama_toko: string | null; uraian_belanja: string;
  cara_bayar: string | null; status_belanja: PajakDto['statusBelanja']; ntpn: string | null; tanggal_setor: Date | null;
  setor_transaksi_id: string | null; status_setor: PajakDto['statusSetor'];
}

const SQL_PAJAK = `
  SELECT p.id, p.jenis, p.tarif, p.dpp, p.nilai, p.status, p.transaksi_id, b.tanggal AS tanggal_belanja, b.no_bukti, b.nama_toko,
         b.uraian AS uraian_belanja, b.cara_bayar, b.status AS status_belanja, p.ntpn, p.tanggal_setor, p.setor_transaksi_id,
         s.status AS status_setor
  FROM tatausaha.pajak p
  JOIN tatausaha.transaksi b ON b.id = p.transaksi_id AND b.tahun = p.tahun
  LEFT JOIN tatausaha.transaksi s ON s.id = p.setor_transaksi_id AND s.tahun = p.tahun`;

const kePajakDto = (x: BarisPajak): PajakDto => ({
  id: x.id, jenis: x.jenis, tarif: n(x.tarif), dpp: n(x.dpp), nilai: n(x.nilai), status: x.status, transaksiId: x.transaksi_id,
  tanggalBelanja: tgl(x.tanggal_belanja), noBukti: x.no_bukti, namaToko: x.nama_toko, uraianBelanja: x.uraian_belanja,
  bukuPungut: x.cara_bayar === 'TUNAI' ? 'TUNAI' : 'BANK', statusBelanja: x.status_belanja, ntpn: x.ntpn,
  tanggalSetor: x.tanggal_setor ? tgl(x.tanggal_setor) : null, setorTransaksiId: x.setor_transaksi_id, statusSetor: x.status_setor,
});

/** Daftar pajak buku (belanja DITOLAK tidak ditampilkan karena pajaknya tidak pernah dipungut). */
export async function daftarPajak(tx: PoolClient, b: Buku, status?: 'DIPUNGUT' | 'DISETOR'): Promise<PajakDto[]> {
  const r = await tx.query<BarisPajak>(
    `${SQL_PAJAK} WHERE p.npsn = $1 AND p.tahun = $2 AND p.sumber_dana_kode = $3 AND b.status <> 'DITOLAK' AND ($4::text IS NULL OR p.status = $4)
     ORDER BY b.tanggal, b.dibuat_at, p.jenis, p.id`,
    [b.npsn, b.tahun, b.sumberDanaKode, status ?? null],
  );
  return r.rows.map(kePajakDto);
}

/** Mengunci baris pajak yang akan disetor (FOR UPDATE) agar tidak disetor ganda oleh permintaan bersamaan. */
export async function kunciPajak(tx: PoolClient, b: Buku, ids: string[]): Promise<PajakDto[]> {
  const r = await tx.query<BarisPajak>(
    `${SQL_PAJAK} WHERE p.id = ANY($4::uuid[]) AND p.npsn = $1 AND p.tahun = $2 AND p.sumber_dana_kode = $3 FOR UPDATE OF p`,
    [b.npsn, b.tahun, b.sumberDanaKode, ids],
  );
  return r.rows.map(kePajakDto);
}

export async function tautkanPajak(tx: PoolClient, ids: string[], setorId: string, ntpn: string, tanggal: string): Promise<void> {
  await tx.query(
    `UPDATE tatausaha.pajak SET status = 'DISETOR', setor_transaksi_id = $2, ntpn = $3, tanggal_setor = $4 WHERE id = ANY($1::uuid[])`,
    [ids, setorId, ntpn, tanggal],
  );
}

/** Dipanggil saat setoran DITOLAK: pajak kembali terutang. */
export async function lepaskanPajak(tx: PoolClient, setorId: string): Promise<void> {
  await tx.query(
    `UPDATE tatausaha.pajak SET status = 'DIPUNGUT', setor_transaksi_id = NULL, ntpn = NULL, tanggal_setor = NULL WHERE setor_transaksi_id = $1`,
    [setorId],
  );
}

/** Buku Kas Pembantu Pajak dengan saldo pajak berjalan (pungut dari belanja disetujui, setor dari setoran disetujui). */
export async function daftarBkpPajak(tx: PoolClient, b: Buku, bulan?: number): Promise<BarisBkpPajakDto[]> {
  const r = await tx.query<{
    transaksi_id: string; tanggal: Date; no_bukti: string | null; uraian: string; jenis: BarisBkpPajakDto['jenis']; ntpn: string | null;
    penerimaan: string; pengeluaran: string; status: BarisBkpPajakDto['status']; saldo: string | null;
  }>(
    `WITH m AS (
       SELECT b.id AS transaksi_id, b.tanggal, b.dibuat_at, b.no_bukti, 'Pungut ' || p.jenis || ' — ' || b.uraian AS uraian, p.jenis,
              NULL::char(16) AS ntpn, p.nilai AS penerimaan, 0::numeric AS pengeluaran, b.status, 1 AS urut
       FROM tatausaha.pajak p JOIN tatausaha.transaksi b ON b.id = p.transaksi_id AND b.tahun = p.tahun
       WHERE p.npsn = $1 AND p.tahun = $2 AND p.sumber_dana_kode = $3 AND b.status <> 'DITOLAK' AND p.nilai > 0
       UNION ALL
       SELECT s.id, s.tanggal, s.dibuat_at, s.no_bukti, s.uraian, (SELECT min(p.jenis) FROM tatausaha.pajak p WHERE p.setor_transaksi_id = s.id),
              s.ntpn, 0, s.nilai_bruto, s.status, 2
       FROM tatausaha.transaksi s
       WHERE s.npsn = $1 AND s.tahun = $2 AND s.sumber_dana_kode = $3 AND s.jenis = 'SETOR_PAJAK' AND s.status <> 'DITOLAK'
     ), j AS (
       SELECT *, CASE WHEN status = 'DISETUJUI'
                   THEN sum(CASE WHEN status = 'DISETUJUI' THEN penerimaan - pengeluaran ELSE 0 END)
                        OVER (ORDER BY tanggal, dibuat_at, transaksi_id, urut, jenis ROWS UNBOUNDED PRECEDING) END AS saldo
       FROM m
     )
     SELECT transaksi_id, tanggal, no_bukti, uraian, jenis, ntpn, penerimaan, pengeluaran, status, saldo
     FROM j WHERE ($4::int IS NULL OR extract(month FROM tanggal) = $4)
     ORDER BY tanggal, dibuat_at, transaksi_id, urut, jenis`,
    [b.npsn, b.tahun, b.sumberDanaKode, bulan ?? null],
  );
  return r.rows.map((x) => ({
    transaksiId: x.transaksi_id, tanggal: tgl(x.tanggal), noBukti: x.no_bukti, uraian: x.uraian, jenis: x.jenis, ntpn: x.ntpn,
    penerimaan: n(x.penerimaan), pengeluaran: n(x.pengeluaran), status: x.status, saldo: x.saldo === null ? null : n(x.saldo),
  }));
}
