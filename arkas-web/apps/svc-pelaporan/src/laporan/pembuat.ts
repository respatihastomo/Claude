import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { POOL_WORKER, PEMBUAT_PDF, PENYIMPANAN } from '../infra/tokens';
import type { PembuatPdf } from '../infra/pdf';
import type { PenyimpananBerkas } from '../infra/penyimpanan';
import { periksaKonsistensi, susunBaris } from './bku';
import { DataLaporan, htmlLaporanBku } from './templat';
import { sumberData } from './laporan.repo';

export const MAKS_PERCOBAAN = 8;
export const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** Menyusun data laporan dari proyeksi lokal. Melempar bila data transaksi belum konsisten dengan ringkasan PeriodeDitutup. */
export async function dataLaporan(client: Parameters<typeof sumberData>[0], periodeId: string, dibuatAt: string): Promise<DataLaporan> {
  const s = await sumberData(client, periodeId);
  const r = s.periode.ringkasan;
  const baris = susunBaris(s.transaksi, r.tunai.saldoAwal + r.bank.saldoAwal);
  const salah = periksaKonsistensi(s.transaksi, baris, r);
  if (salah.length) throw new DataBelumLengkap(`Data transaksi belum lengkap/konsisten: ${salah.join('; ')}`);
  return { ...s.periode, rekonsiliasi: s.periode.rekonsiliasi, baris, dibuatAt };
}
export class DataBelumLengkap extends Error {}

/**
 * Pekerja pembuat laporan (antrean di tabel laporan, aman untuk banyak pod):
 * 1) klaim satu laporan MENUNGGU dengan FOR UPDATE SKIP LOCKED dan sewa 5 menit, 2) susun & periksa data,
 * 3) render HTML -> PDF, simpan, catat SHA-256 -> SIAP. Data belum lengkap / galat -> coba lagi dengan backoff, lalu GAGAL.
 */
@Injectable()
export class PembuatLaporan {
  private readonly log = new Logger(PembuatLaporan.name);
  private timer?: NodeJS.Timeout;
  private sibuk = false;

  constructor(
    @Inject(POOL_WORKER) private readonly pool: Pool,
    @Inject(PEMBUAT_PDF) private readonly pdf: PembuatPdf,
    @Inject(PENYIMPANAN) private readonly simpan: PenyimpananBerkas,
  ) {}

  /** Memproses satu laporan bila ada. @returns id laporan yang diproses atau undefined. */
  async tick(): Promise<string | undefined> {
    const klaim = await this.pool.query<{ id: string; periode_id: string; npsn: string; tahun: number; bulan: number; percobaan: number }>(
      `UPDATE pelaporan.laporan SET berikutnya_at = now() + interval '5 minutes'
       WHERE id = (SELECT id FROM pelaporan.laporan WHERE status = 'MENUNGGU' AND berikutnya_at <= now() ORDER BY berikutnya_at LIMIT 1 FOR UPDATE SKIP LOCKED)
       RETURNING id, periode_id, npsn, tahun, bulan, percobaan`,
    );
    const l = klaim.rows[0];
    if (!l) return undefined;
    try {
      const client = await this.pool.connect();
      let data: DataLaporan;
      try { data = await dataLaporan(client, l.periode_id, new Date().toISOString()); } finally { client.release(); }
      const isi = await this.pdf.buat(htmlLaporanBku(data));
      const kunci = `laporan/${l.npsn}/${l.tahun}/${String(l.bulan).padStart(2, '0')}/${l.id}.pdf`;
      await this.simpan.simpan(kunci, isi);
      await this.pool.query(
        `UPDATE pelaporan.laporan SET status = 'SIAP', berkas_kunci = $2, berkas_sha256 = $3, berkas_ukuran = $4, siap_at = now(),
           percobaan = percobaan + 1, galat_terakhir = NULL WHERE id = $1`,
        [l.id, kunci, sha256(isi), isi.length],
      );
      this.log.log(`laporan ${l.id} (${l.npsn} ${l.bulan}/${l.tahun}) SIAP, ${isi.length} bita`);
    } catch (e) {
      const galat = e instanceof Error ? e.message : String(e);
      const gagal = l.percobaan + 1 >= MAKS_PERCOBAAN;
      await this.pool.query(
        `UPDATE pelaporan.laporan SET percobaan = percobaan + 1, galat_terakhir = $2, status = CASE WHEN $3 THEN 'GAGAL' ELSE 'MENUNGGU' END,
           berikutnya_at = now() + make_interval(secs => least(power(2, percobaan + 1), 300)) WHERE id = $1`,
        [l.id, galat, gagal],
      );
      this.log.warn(`laporan ${l.id} percobaan ${l.percobaan + 1}/${MAKS_PERCOBAAN}: ${galat}`);
    }
    return l.id;
  }

  start(intervalMs: number): void {
    this.timer = setInterval(async () => {
      if (this.sibuk) return;
      this.sibuk = true;
      try { while (await this.tick()) { /* kuras antrean */ } } catch (e) { this.log.error(e instanceof Error ? e.message : String(e)); } finally { this.sibuk = false; }
    }, intervalMs);
  }
  stop(): void { if (this.timer) clearInterval(this.timer); }
}
