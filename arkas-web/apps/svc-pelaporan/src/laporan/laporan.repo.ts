import type { PoolClient } from 'pg';
import type { Ringkasan, TransaksiLokal } from './bku';
import type { DataLaporan } from './templat';

const n = (v: string | number | null) => (v === null ? 0 : Number(v));
const tgl = (v: Date | string) => (typeof v === 'string' ? v : v.toISOString().slice(0, 10));

export interface LaporanDto {
  id: string; jenis: 'BKU_BULANAN'; periodeId: string; npsn: string; tahun: number; sumberDanaKode: string; bulan: number;
  status: 'MENUNGGU' | 'SIAP' | 'GAGAL' | 'DITANDATANGANI'; percobaan: number; galatTerakhir: string | null;
  sha256: string | null; ukuran: number | null; siapAt: string | null;
  ditandatanganiOleh: string | null; ditandatanganiAt: string | null; penyediaTte: 'SIMULASI_DEV' | 'BSRE' | null; sha256Tertanda: string | null;
  versi: number; dibuatAt: string;
}
interface Baris {
  id: string; jenis: 'BKU_BULANAN'; periode_id: string; npsn: string; tahun: number; sumber_dana_kode: string; bulan: number; status: LaporanDto['status'];
  percobaan: number; galat_terakhir: string | null; berkas_kunci: string | null; berkas_sha256: string | null; berkas_ukuran: number | null; siap_at: Date | null;
  tertanda_kunci: string | null; tertanda_sha256: string | null; ditandatangani_oleh: string | null; ditandatangani_at: Date | null;
  penyedia_tte: LaporanDto['penyediaTte']; row_version: number; dibuat_at: Date;
}
export type LaporanPenuh = LaporanDto & { berkasKunci: string | null; tertandaKunci: string | null };
const keDto = (b: Baris): LaporanPenuh => ({
  id: b.id, jenis: b.jenis, periodeId: b.periode_id, npsn: b.npsn, tahun: b.tahun, sumberDanaKode: b.sumber_dana_kode, bulan: b.bulan, status: b.status,
  percobaan: b.percobaan, galatTerakhir: b.galat_terakhir, sha256: b.berkas_sha256, ukuran: b.berkas_ukuran, siapAt: b.siap_at?.toISOString() ?? null,
  ditandatanganiOleh: b.ditandatangani_oleh, ditandatanganiAt: b.ditandatangani_at?.toISOString() ?? null, penyediaTte: b.penyedia_tte,
  sha256Tertanda: b.tertanda_sha256, versi: b.row_version, dibuatAt: b.dibuat_at.toISOString(), berkasKunci: b.berkas_kunci, tertandaKunci: b.tertanda_kunci,
});
export const publik = ({ berkasKunci: _a, tertandaKunci: _b, ...x }: LaporanPenuh): LaporanDto => x;

export async function daftar(tx: PoolClient, npsn: string, tahun: number, sd: string): Promise<LaporanPenuh[]> {
  const r = await tx.query<Baris>(`SELECT * FROM pelaporan.laporan WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3 ORDER BY bulan DESC, jenis`, [npsn, tahun, sd]);
  return r.rows.map(keDto);
}
export async function ambil(tx: PoolClient, id: string, kunci = false): Promise<LaporanPenuh | undefined> {
  const r = await tx.query<Baris>(`SELECT * FROM pelaporan.laporan WHERE id = $1 ${kunci ? 'FOR UPDATE' : ''}`, [id]);
  return r.rows[0] ? keDto(r.rows[0]) : undefined;
}

export interface SumberData {
  periode: { npsn: string; tahun: number; sumberDanaKode: string; bulan: number; ringkasan: Ringkasan; rekonsiliasi: DataLaporan['rekonsiliasi']; diajukanOleh: string; ditutupOleh: string; ditutupAt: string };
  transaksi: TransaksiLokal[];
}
export async function sumberData(tx: PoolClient, periodeId: string): Promise<SumberData> {
  const p = (await tx.query(`SELECT * FROM pelaporan.bku_periode_ringkas WHERE periode_id = $1`, [periodeId])).rows[0];
  const awal = `${p.tahun}-${String(p.bulan).padStart(2, '0')}-01`;
  const t = await tx.query(
    `SELECT * FROM pelaporan.bku_transaksi_lokal WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3
       AND tanggal >= $4::date AND tanggal < ($4::date + interval '1 month')`,
    [p.npsn, p.tahun, p.sumber_dana_kode, awal],
  );
  return {
    periode: {
      npsn: p.npsn, tahun: p.tahun, sumberDanaKode: p.sumber_dana_kode, bulan: p.bulan, ringkasan: p.ringkasan, rekonsiliasi: p.rekonsiliasi,
      diajukanOleh: p.diajukan_oleh, ditutupOleh: p.ditutup_oleh, ditutupAt: p.ditutup_at.toISOString(),
    },
    transaksi: t.rows.map((x) => ({
      transaksiId: x.transaksi_id, jenis: x.jenis, tanggal: tgl(x.tanggal), noBukti: x.no_bukti, uraian: x.uraian, caraBayar: x.cara_bayar, ntpn: x.ntpn,
      nilaiBruto: n(x.nilai_bruto), disetujuiAt: x.disetujui_at.toISOString(), items: x.items, pajak: x.pajak,
    })),
  };
}
