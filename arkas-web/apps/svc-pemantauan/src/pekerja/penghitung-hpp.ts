import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { hitungHpp } from '@arkas/aturan';
import { tulisOutbox } from '@arkas/common-ms';
import { TOPIK } from '@arkas/kontrak';
import { POOL_WORKER, SKEMA } from '../infra/tokens';

/** Diterbitkan setelah HPP satu buku dihitung ulang. */
export interface HppDihitungData { npsn: string; tahun: number; sumberDanaKode: string; versiRkas: number | null; ringkasan: unknown; dihitungAt: string }

/**
 * Pekerja HPP (SK-11, "6.3.3 Cocokkan item ke baris"): mengambil buku dari hpp_antrean (SKIP LOCKED), menjalankan
 * fungsi murni hitungHpp atas rencana aktif & belanja Mitra yang DITERIMA, mengganti hasil buku itu secara atomik,
 * menyegarkan mv_hpp_jenjang, dan menerbitkan HppDihitung.
 */
@Injectable()
export class PenghitungHpp {
  private readonly log = new Logger(PenghitungHpp.name);
  private timer?: NodeJS.Timeout;
  private berjalan = false;
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool) {}

  async tick(): Promise<number> {
    const c = await this.pool.connect();
    let n = 0;
    try {
      await c.query('BEGIN');
      const antre = (await c.query<{ npsn: string; tahun: number; sumber_dana_kode: string }>(
        `SELECT npsn, tahun, sumber_dana_kode FROM pemantauan.hpp_antrean ORDER BY diminta_at LIMIT 20 FOR UPDATE SKIP LOCKED`)).rows;
      for (const b of antre) {
        const p = [b.npsn, b.tahun, b.sumber_dana_kode];
        const rencana = (await c.query<{ baris_id: string; kode_rekening: string; kegiatan: string; uraian: string; total: string; versi: number }>(
          `SELECT baris_id, kode_rekening, kegiatan, uraian, total, versi FROM pemantauan.rencana_sah_lokal WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3 AND aktif ORDER BY kegiatan, uraian`, p)).rows;
        // belanja yang merujuk baris versi lama dialihkan ke baris aktif penerusnya (akar sama)
        const belanja = (await c.query<{ transaksi_mitra_id: string; item_id: string; baris_aktif: string | null; kode_rekening: string; uraian: string; jumlah: string }>(
          `SELECT m.transaksi_mitra_id, m.item_id, m.kode_rekening, m.uraian, m.jumlah,
                  (SELECT r.baris_id FROM pemantauan.rencana_sah_lokal r WHERE r.akar_baris_id = m.akar_baris_id AND r.aktif LIMIT 1) AS baris_aktif
           FROM pemantauan.belanja_mitra_lokal m WHERE m.npsn = $1 AND m.tahun = $2 AND m.sumber_dana_kode = $3 AND m.status = 'DITERIMA'`, p)).rows;
        const h = hitungHpp(
          rencana.map((r) => ({ barisId: r.baris_id, kodeRekening: r.kode_rekening, uraian: r.uraian, total: Number(r.total) })),
          belanja.map((x) => ({ itemId: `${x.transaksi_mitra_id}|${x.item_id}`, barisId: x.baris_aktif, kodeRekening: x.kode_rekening, uraian: x.uraian, jumlah: Number(x.jumlah) })),
        );
        const keg = new Map(rencana.map((r) => [r.baris_id, r.kegiatan]));
        await c.query('DELETE FROM pemantauan.hpp_baris WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3', p);
        await c.query('DELETE FROM pemantauan.hpp_cocok WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3', p);
        for (const r of h.baris) {
          await c.query(
            `INSERT INTO pemantauan.hpp_baris (npsn, tahun, sumber_dana_kode, baris_id, kode_rekening, kegiatan, uraian, rencana, belanja, selisih, kategori)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [...p, r.barisId, r.kodeRekening, keg.get(r.barisId), r.uraian, r.rencana, r.belanja, r.selisih, r.kategori]);
        }
        for (const k of h.cocok) {
          const [trx, item] = k.itemId.split('|');
          await c.query(`INSERT INTO pemantauan.hpp_cocok (transaksi_mitra_id, item_id, npsn, tahun, sumber_dana_kode, baris_id, cara, jumlah) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [trx, item, ...p, k.barisId, k.cara, k.jumlah]);
        }
        const versi = rencana[0]?.versi ?? null;
        const at = new Date().toISOString();
        await c.query(
          `INSERT INTO pemantauan.hpp_ringkas (npsn, tahun, sumber_dana_kode, ringkasan, versi_rkas, dihitung_at) VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (npsn, tahun, sumber_dana_kode) DO UPDATE SET ringkasan = EXCLUDED.ringkasan, versi_rkas = EXCLUDED.versi_rkas, dihitung_at = EXCLUDED.dihitung_at`,
          [...p, JSON.stringify(h.ringkasan), versi, at]);
        await c.query('DELETE FROM pemantauan.hpp_antrean WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3', p);
        const ev: HppDihitungData = { npsn: b.npsn, tahun: b.tahun, sumberDanaKode: b.sumber_dana_kode, versiRkas: versi, ringkasan: h.ringkasan, dihitungAt: at };
        await tulisOutbox(c, SKEMA, { topik: TOPIK.HPP_DIHITUNG, tipe: 'HppDihitung', agregatId: `${b.npsn}:${b.tahun}:${b.sumber_dana_kode}`, payload: ev });
        n++;
      }
      if (n) await c.query('SELECT pemantauan.segarkan_mv_hpp()');
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
    if (n) this.log.log(`HPP dihitung ulang untuk ${n} buku`);
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
