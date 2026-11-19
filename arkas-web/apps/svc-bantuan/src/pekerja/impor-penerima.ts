import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import ExcelJS from 'exceljs';
import { PENYIMPANAN, POOL_WORKER } from '../infra/tokens';
import type { PenyimpananBerkas } from '../infra/penyimpanan';
import { SumberDanaService } from '../bantuan/sumber-dana.service';

export const MAKS_BARIS_IMPOR = 20_000;

/** Templat impor penerima (fitur 18): kolom A NPSN (teks), kolom B nilai bantuan (Rp). */
export async function buatTemplat(kode: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Penerima');
  ws.columns = [{ header: 'NPSN', key: 'npsn', width: 14 }, { header: 'Nilai bantuan (Rp)', key: 'nilai', width: 22 }];
  ws.getColumn(1).numFmt = '@';
  ws.getColumn(2).numFmt = '#,##0';
  ws.getRow(1).font = { bold: true };
  const p = wb.addWorksheet('Petunjuk');
  [`Sumber dana: ${kode}`, 'Isi satu sekolah per baris mulai baris 2 di lembar "Penerima".', 'NPSN 8 digit, harus ada di Dapodik dan jenjangnya sesuai sasaran bantuan.',
    'Nilai bantuan dalam rupiah tanpa titik/koma.', 'Bila ada satu baris salah, seluruh berkas ditolak dan daftar kesalahannya ditampilkan.'].forEach((t) => p.addRow([t]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * SK-07 pekerja impor penerima: mengambil antrean (SKIP LOCKED), membaca Excel, memvalidasi setiap baris terhadap replika
 * sekolah (Dapodik via svc-referensi). Semua-atau-tidak-sama-sekali: satu baris salah -> GAGAL dengan daftar galat per baris.
 */
@Injectable()
export class ImporPenerima {
  private readonly log = new Logger(ImporPenerima.name);
  private timer?: NodeJS.Timeout;
  private berjalan = false;
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool, @Inject(PENYIMPANAN) private readonly berkas: PenyimpananBerkas) {}

  async tick(): Promise<number> {
    const c = await this.pool.connect();
    let n = 0;
    try {
      await c.query('BEGIN');
      const j = (await c.query<{ id: string; sumber_dana_kode: string; berkas_kunci: string }>(
        `SELECT id, sumber_dana_kode, berkas_kunci FROM banper.impor_penerima WHERE status = 'MENUNGGU' ORDER BY dibuat_at LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0];
      if (j) {
        n = 1;
        const galat: Array<{ baris: number; npsn: string | null; pesan: string }> = [];
        const ok: Array<{ npsn: string; nilai: number }> = [];
        try {
          const s = (await c.query<{ jenjang: string[]; status: string }>('SELECT jenjang, status FROM banper.sumber_dana_bantuan WHERE kode = $1', [j.sumber_dana_kode])).rows[0];
          if (!['DRAF', 'DIKEMBALIKAN'].includes(s.status)) throw new Error(`Sumber dana berstatus ${s.status} tidak dapat diubah`);
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(await this.berkas.ambil(j.berkas_kunci) as unknown as ExcelJS.Buffer);
          const ws = wb.getWorksheet('Penerima') ?? wb.worksheets[0];
          if (!ws) throw new Error('Lembar "Penerima" tidak ditemukan');
          if (ws.rowCount > MAKS_BARIS_IMPOR + 1) throw new Error(`Maksimal ${MAKS_BARIS_IMPOR} baris per berkas`);
          const sudah = new Set<string>();
          for (let i = 2; i <= ws.rowCount; i++) {
            const row = ws.getRow(i);
            const teks = (v: ExcelJS.CellValue) => (v === null || v === undefined ? '' : typeof v === 'object' && 'text' in v ? String(v.text) : typeof v === 'object' && 'result' in v ? String(v.result) : String(v)).trim();
            const npsn = teks(row.getCell(1).value).replace(/\.0+$/, '');
            const nilaiTeks = teks(row.getCell(2).value).replace(/[^\d.,-]/g, '');
            if (!npsn && !nilaiTeks) continue;
            const nilai = Number(nilaiTeks.replace(/\./g, '').replace(',', '.'));
            if (!/^\d{8}$/.test(npsn)) { galat.push({ baris: i, npsn: npsn || null, pesan: 'NPSN harus 8 digit angka' }); continue; }
            if (sudah.has(npsn)) { galat.push({ baris: i, npsn, pesan: 'NPSN tercantum lebih dari sekali' }); continue; }
            sudah.add(npsn);
            if (!Number.isFinite(nilai) || nilai <= 0) { galat.push({ baris: i, npsn, pesan: 'Nilai bantuan harus angka lebih dari 0' }); continue; }
            const g = await SumberDanaService.validasiPenerima(c, s.jenjang, npsn);
            if (g) { galat.push({ baris: i, npsn, pesan: g }); continue; }
            ok.push({ npsn, nilai: Math.round(nilai * 100) / 100 });
          }
          if (!ok.length && !galat.length) galat.push({ baris: 0, npsn: null, pesan: 'Berkas tidak berisi data penerima' });
        } catch (e) {
          galat.push({ baris: 0, npsn: null, pesan: e instanceof Error ? e.message : String(e) });
        }
        if (galat.length) {
          await c.query(`UPDATE banper.impor_penerima SET status = 'GAGAL', galat = $2, selesai_at = now() WHERE id = $1`, [j.id, JSON.stringify(galat.slice(0, 500))]);
        } else {
          for (const p of ok) {
            await c.query(`INSERT INTO banper.penerima (sumber_dana_kode, npsn, nilai) VALUES ($1,$2,$3) ON CONFLICT (sumber_dana_kode, npsn) DO UPDATE SET nilai = EXCLUDED.nilai`, [j.sumber_dana_kode, p.npsn, p.nilai]);
          }
          await c.query(`UPDATE banper.impor_penerima SET status = 'SELESAI', jumlah_ok = $2, selesai_at = now() WHERE id = $1`, [j.id, ok.length]);
        }
        this.log.log(`impor ${j.id}: ${galat.length ? `GAGAL (${galat.length} galat)` : `${ok.length} penerima`}`);
      }
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally { c.release(); }
    return n;
  }
  start(ms: number) {
    this.timer = setInterval(async () => {
      if (this.berjalan) return;
      this.berjalan = true;
      try { while ((await this.tick()) > 0) { /* kuras */ } } catch (e) { this.log.error(e instanceof Error ? e.message : String(e)); } finally { this.berjalan = false; }
    }, ms);
  }
  stop() { if (this.timer) clearInterval(this.timer); }
}
