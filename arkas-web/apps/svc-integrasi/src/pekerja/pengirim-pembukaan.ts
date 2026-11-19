import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { KONFIGURASI, POOL_WORKER } from '../infra/tokens';
import type { Konfigurasi } from '../config';
import { BarisPembukaan, terapkanPembukaan } from '../pembukaan';
import { tandaTangan } from '../mitra/keamanan';

interface Antre extends BarisPembukaan { percobaan: number; base_url: string; hmac_rahasia: string; nama: string | null; kategori: string | null }

/**
 * 7.2 Buka sumber dana di Mitra (11.2.19, keluar): POST {baseMitra}/arkas/v1/sumber-dana bertanda tangan HMAC,
 * Idempotency-Key "{kode}:{versi}:SUMBER_DANA_{DIBUKA|DITUTUP}". Gagal -> backoff eksponensial; lewat batas -> GAGAL (alarm, kirim ulang manual).
 * FOR UPDATE SKIP LOCKED: aman dijalankan banyak pod.
 */
@Injectable()
export class PengirimPembukaan {
  private readonly log = new Logger(PengirimPembukaan.name);
  private timer?: NodeJS.Timeout;
  private berjalan = false;
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool, @Inject(KONFIGURASI) private readonly cfg: Konfigurasi) {}

  async tick(): Promise<number> {
    const c = await this.pool.connect();
    let selesai = 0;
    try {
      await c.query('BEGIN');
      const { rows } = await c.query<Antre>(
        `SELECT p.id, p.sumber_dana_kode, p.mitra_kode, p.status, p.versi, p.target, p.percobaan, m.base_url, m.hmac_rahasia, s.nama, s.kategori
         FROM integrasi.pembukaan_sumber_dana p JOIN integrasi.mitra_siplah m ON m.kode = p.mitra_kode
         LEFT JOIN integrasi.sumber_dana_lokal s ON s.kode = p.sumber_dana_kode
         WHERE p.status = 'MENUNGGU' AND p.berikutnya_at <= now() AND m.status = 'AKTIF'
         ORDER BY p.berikutnya_at LIMIT 20 FOR UPDATE OF p SKIP LOCKED`);
      for (const b of rows) {
        const status = b.target === 'BUKA' ? 'DIBUKA' : 'DITUTUP';
        const body = JSON.stringify({ kode: b.sumber_dana_kode, nama: b.nama, kategori: b.kategori, versi: b.versi, status });
        const ts = String(Math.floor(Date.now() / 1000));
        try {
          const res = await fetch(`${b.base_url}/arkas/v1/sumber-dana`, {
            method: 'POST', body, signal: AbortSignal.timeout(10_000),
            headers: { 'content-type': 'application/json', 'idempotency-key': `${b.sumber_dana_kode}:${b.versi}:SUMBER_DANA_${status}`, 'x-timestamp': ts, 'x-signature': tandaTangan(b.hmac_rahasia, ts, body) },
          });
          const teks = await res.text();
          if (!res.ok) throw new Error(`HTTP ${res.status} ${teks.slice(0, 200)}`);
          const idDiMitra = (() => { try { return (JSON.parse(teks) as { idDiMitra?: string }).idDiMitra ?? null; } catch { return null; } })();
          await terapkanPembukaan(c, b, { aksi: 'KIRIM_BERHASIL' }, 'SISTEM:pengirim', idDiMitra ? `idDiMitra=${idDiMitra}` : null);
          if (idDiMitra) await c.query('UPDATE integrasi.pembukaan_sumber_dana SET id_di_mitra = $2 WHERE id = $1', [b.id, idDiMitra]);
          selesai++;
        } catch (e) {
          const galat = e instanceof Error ? e.message : String(e);
          const ke = b.percobaan + 1;
          if (ke >= this.cfg.pengirimMaksPercobaan) {
            await terapkanPembukaan(c, b, { aksi: 'KIRIM_GAGAL_AKHIR', alasan: galat }, 'SISTEM:pengirim', galat);
            await c.query('UPDATE integrasi.pembukaan_sumber_dana SET percobaan = $2, galat_terakhir = $3 WHERE id = $1', [b.id, ke, galat]);
            this.log.error(`pembukaan ${b.sumber_dana_kode} di ${b.mitra_kode} GAGAL setelah ${ke} percobaan: ${galat}`);
          } else {
            await c.query(
              `UPDATE integrasi.pembukaan_sumber_dana SET percobaan = $2::smallint, galat_terakhir = $3, berikutnya_at = now() + make_interval(secs => least(power(2, $2::int), 300)) WHERE id = $1`,
              [b.id, ke, galat]);
            this.log.warn(`pembukaan ${b.sumber_dana_kode} di ${b.mitra_kode} gagal (${ke}/${this.cfg.pengirimMaksPercobaan}): ${galat}`);
          }
        }
      }
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
    return selesai;
  }

  start(intervalMs: number) {
    this.timer = setInterval(async () => {
      if (this.berjalan) return;
      this.berjalan = true;
      try { while ((await this.tick()) > 0) { /* kuras */ } } catch (e) { this.log.error(e instanceof Error ? e.message : String(e)); } finally { this.berjalan = false; }
    }, intervalMs);
  }
  stop() { if (this.timer) clearInterval(this.timer); }
}
