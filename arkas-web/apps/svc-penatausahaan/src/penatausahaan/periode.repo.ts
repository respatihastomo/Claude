import type { PoolClient } from 'pg';
import type { PeriodeDto, RekonsiliasiDto, RingkasanBulanDto, StatusPeriode } from '@arkas/kontrak';
import type { Buku } from './penatausahaan.repo';

const n = (v: string | number | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));
const r2 = (x: number) => Math.round(x * 100) / 100;

interface BarisPeriode {
  id: string; npsn: string; tahun: number; sumber_dana_kode: string; bulan: number; status: StatusPeriode; row_version: number;
  diajukan_oleh: string | null; diajukan_at: Date | null; ditutup_oleh: string | null; ditutup_at: Date | null; alasan_kembali: string | null;
}
const keDto = (p: BarisPeriode): PeriodeDto => ({
  id: p.id, npsn: p.npsn, tahun: p.tahun, sumberDanaKode: p.sumber_dana_kode, bulan: p.bulan, status: p.status, versi: p.row_version,
  diajukanOleh: p.diajukan_oleh, diajukanAt: p.diajukan_at?.toISOString() ?? null, ditutupOleh: p.ditutup_oleh,
  ditutupAt: p.ditutup_at?.toISOString() ?? null, alasanKembali: p.alasan_kembali,
});

export async function daftarPeriode(tx: PoolClient, b: Buku): Promise<PeriodeDto[]> {
  const r = await tx.query<BarisPeriode>(
    `SELECT * FROM tatausaha.periode WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3 ORDER BY bulan`,
    [b.npsn, b.tahun, b.sumberDanaKode],
  );
  return r.rows.map(keDto);
}

export async function ambilPeriode(tx: PoolClient, id: string, kunci = false): Promise<PeriodeDto | undefined> {
  const r = await tx.query<BarisPeriode>(`SELECT * FROM tatausaha.periode WHERE id = $1 ${kunci ? 'FOR UPDATE' : ''}`, [id]);
  return r.rows[0] ? keDto(r.rows[0]) : undefined;
}

/** Ringkasan BKU satu bulan dari transaksi DISETUJUI: saldo awal, mutasi, saldo akhir per buku + buku pajak. */
export async function ringkasanBulan(tx: PoolClient, b: Buku, bulan: number): Promise<RingkasanBulanDto> {
  const awal = `${b.tahun}-${String(bulan).padStart(2, '0')}-01`;
  const kas = await tx.query<{ buku: 'TUNAI' | 'BANK'; awal: string; masuk: string; keluar: string }>(
    `SELECT buku,
            sum(CASE WHEN tanggal < $4::date THEN penerimaan - pengeluaran ELSE 0 END) AS awal,
            sum(CASE WHEN tanggal >= $4::date AND tanggal < ($4::date + interval '1 month') THEN penerimaan ELSE 0 END) AS masuk,
            sum(CASE WHEN tanggal >= $4::date AND tanggal < ($4::date + interval '1 month') THEN pengeluaran ELSE 0 END) AS keluar
     FROM tatausaha.v_mutasi
     WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3 AND status = 'DISETUJUI' AND tanggal < ($4::date + interval '1 month')
     GROUP BY buku`,
    [b.npsn, b.tahun, b.sumberDanaKode, awal],
  );
  const pajak = await tx.query<{ awal: string; dipungut: string; disetor: string }>(
    `WITH m AS (
       SELECT bl.tanggal, p.nilai AS masuk, 0::numeric AS keluar
       FROM tatausaha.pajak p JOIN tatausaha.transaksi bl ON bl.id = p.transaksi_id AND bl.tahun = p.tahun
       WHERE p.npsn = $1 AND p.tahun = $2 AND p.sumber_dana_kode = $3 AND bl.status = 'DISETUJUI'
       UNION ALL
       SELECT s.tanggal, 0, s.nilai_bruto FROM tatausaha.transaksi s
       WHERE s.npsn = $1 AND s.tahun = $2 AND s.sumber_dana_kode = $3 AND s.jenis = 'SETOR_PAJAK' AND s.status = 'DISETUJUI'
     )
     SELECT coalesce(sum(CASE WHEN tanggal < $4::date THEN masuk - keluar END), 0) AS awal,
            coalesce(sum(CASE WHEN tanggal >= $4::date AND tanggal < ($4::date + interval '1 month') THEN masuk END), 0) AS dipungut,
            coalesce(sum(CASE WHEN tanggal >= $4::date AND tanggal < ($4::date + interval '1 month') THEN keluar END), 0) AS disetor
     FROM m`,
    [b.npsn, b.tahun, b.sumberDanaKode, awal],
  );
  const jml = await tx.query<{ n: string }>(
    `SELECT count(*) AS n FROM tatausaha.transaksi t JOIN tatausaha.periode p ON p.id = t.periode_id
     WHERE p.npsn = $1 AND p.tahun = $2 AND p.sumber_dana_kode = $3 AND p.bulan = $4 AND t.status = 'DISETUJUI'`,
    [b.npsn, b.tahun, b.sumberDanaKode, bulan],
  );
  const buku = (k: 'TUNAI' | 'BANK') => {
    const x = kas.rows.find((r) => r.buku === k);
    const saldoAwal = n(x?.awal), penerimaan = n(x?.masuk), pengeluaran = n(x?.keluar);
    return { saldoAwal, penerimaan, pengeluaran, saldoAkhir: r2(saldoAwal + penerimaan - pengeluaran) };
  };
  const pj = pajak.rows[0];
  return {
    tunai: buku('TUNAI'), bank: buku('BANK'),
    pajak: { saldoAwal: n(pj.awal), dipungut: n(pj.dipungut), disetor: n(pj.disetor), saldoAkhir: r2(n(pj.awal) + n(pj.dipungut) - n(pj.disetor)) },
    jumlahTransaksi: n(jml.rows[0].n),
  };
}

export async function dataKesiapan(tx: PoolClient, p: PeriodeDto) {
  const r = await tx.query<{ menunggu: string; sebelum: string; pajak: string }>(
    `SELECT
       (SELECT count(*) FROM tatausaha.transaksi WHERE periode_id = $1 AND tahun = $3 AND status = 'DICATAT') AS menunggu,
       (SELECT count(*) FROM tatausaha.periode WHERE npsn = $2 AND tahun = $3 AND sumber_dana_kode = $4 AND bulan < $5 AND status <> 'DITUTUP') AS sebelum,
       (SELECT coalesce(sum(pj.nilai), 0) FROM tatausaha.pajak pj JOIN tatausaha.transaksi bl ON bl.id = pj.transaksi_id AND bl.tahun = pj.tahun
          WHERE bl.periode_id = $1 AND bl.status = 'DISETUJUI' AND pj.status = 'DIPUNGUT') AS pajak`,
    [p.id, p.npsn, p.tahun, p.sumberDanaKode, p.bulan],
  );
  const x = r.rows[0];
  return { menunggu: n(x.menunggu), periodeSebelumTerbuka: n(x.sebelum), pajakBelumDisetor: n(x.pajak) };
}

export async function ambilRekonsiliasi(tx: PoolClient, periodeId: string): Promise<(RekonsiliasiDto & { ringkasan: RingkasanBulanDto }) | null> {
  const r = await tx.query<{
    saldo_buku_bank: string; saldo_rekening_koran: string; selisih_bank: string; penjelasan_bank: string | null; saldo_buku_tunai: string;
    kas_fisik: string; selisih_kas: string; penjelasan_kas: string | null; dibuat_oleh: string; diperbarui_at: Date; ringkasan: RingkasanBulanDto;
  }>(`SELECT * FROM tatausaha.rekonsiliasi WHERE periode_id = $1`, [periodeId]);
  const x = r.rows[0];
  if (!x) return null;
  return {
    saldoBukuBank: n(x.saldo_buku_bank), saldoRekeningKoran: n(x.saldo_rekening_koran), selisihBank: n(x.selisih_bank), penjelasanBank: x.penjelasan_bank,
    saldoBukuTunai: n(x.saldo_buku_tunai), kasFisik: n(x.kas_fisik), selisihKas: n(x.selisih_kas), penjelasanKas: x.penjelasan_kas,
    dibuatOleh: x.dibuat_oleh, diperbaruiAt: x.diperbarui_at.toISOString(), ringkasan: x.ringkasan,
  };
}

export async function simpanRekonsiliasi(tx: PoolClient, p: PeriodeDto, d: {
  saldoBukuBank: number; saldoRekeningKoran: number; penjelasanBank: string | null; saldoBukuTunai: number; kasFisik: number;
  penjelasanKas: string | null; ringkasan: RingkasanBulanDto; oleh: string;
}): Promise<void> {
  await tx.query(
    `INSERT INTO tatausaha.rekonsiliasi (periode_id, npsn, tahun, sumber_dana_kode, bulan, saldo_buku_bank, saldo_rekening_koran, penjelasan_bank,
       saldo_buku_tunai, kas_fisik, penjelasan_kas, ringkasan, dibuat_oleh)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (periode_id) DO UPDATE SET saldo_buku_bank = EXCLUDED.saldo_buku_bank, saldo_rekening_koran = EXCLUDED.saldo_rekening_koran,
       penjelasan_bank = EXCLUDED.penjelasan_bank, saldo_buku_tunai = EXCLUDED.saldo_buku_tunai, kas_fisik = EXCLUDED.kas_fisik,
       penjelasan_kas = EXCLUDED.penjelasan_kas, ringkasan = EXCLUDED.ringkasan, dibuat_oleh = EXCLUDED.dibuat_oleh`,
    [p.id, p.npsn, p.tahun, p.sumberDanaKode, p.bulan, d.saldoBukuBank, d.saldoRekeningKoran, d.penjelasanBank, d.saldoBukuTunai, d.kasFisik,
      d.penjelasanKas, JSON.stringify(d.ringkasan), d.oleh],
  );
}

export async function ajukan(tx: PoolClient, id: string, oleh: string): Promise<void> {
  await tx.query(`UPDATE tatausaha.periode SET status = 'DIAJUKAN', diajukan_oleh = $2, diajukan_at = now(), alasan_kembali = NULL WHERE id = $1`, [id, oleh]);
}
export async function tutup(tx: PoolClient, id: string, oleh: string): Promise<void> {
  await tx.query(`UPDATE tatausaha.periode SET status = 'DITUTUP', ditutup_oleh = $2, ditutup_at = now() WHERE id = $1`, [id, oleh]);
}
export async function kembalikan(tx: PoolClient, id: string, alasan: string): Promise<void> {
  await tx.query(`UPDATE tatausaha.periode SET status = 'BUKA', alasan_kembali = $2 WHERE id = $1`, [id, alasan]);
}
export async function bukaPeriode(tx: PoolClient, b: Buku, bulan: number): Promise<void> {
  await tx.query(
    `INSERT INTO tatausaha.periode (npsn, tahun, sumber_dana_kode, bulan) VALUES ($1,$2,$3,$4) ON CONFLICT (npsn, tahun, sumber_dana_kode, bulan) DO NOTHING`,
    [b.npsn, b.tahun, b.sumberDanaKode, bulan],
  );
}
