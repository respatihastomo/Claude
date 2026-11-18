import type { Pool } from 'pg';
import type { Broker } from './broker';
import type { CloudEvent } from './cloud-event';

export interface OpsiRelay {
  skema: string;
  source: string;
  ukuranBatch?: number;
  maksPercobaan?: number;
  intervalMs?: number;
  log?: (pesan: string) => void;
}

interface BarisOutbox {
  id: string; event_id: string; topik: string; tipe: string; agregat_id: string;
  correlation_id: string | null; payload: unknown; percobaan: number; dibuat_at: Date;
}

/**
 * Kode 11 — Outbox Relay. Mengambil baris MENUNGGU dengan FOR UPDATE SKIP LOCKED (aman untuk banyak pod),
 * menerbitkan ke broker, menandai TERKIRIM; gagal -> backoff eksponensial, lewat batas -> MATI (dipantau, 16.4).
 */
export class OutboxRelay {
  private timer?: NodeJS.Timeout;
  private berjalan = false;

  constructor(private readonly pool: Pool, private readonly broker: Broker, private readonly opsi: OpsiRelay) {
    if (!/^[a-z_]+$/.test(opsi.skema)) throw new Error('skema tidak valid');
  }

  /** Satu putaran relay. @returns jumlah pesan terkirim. */
  async tick(): Promise<number> {
    const { skema, source } = this.opsi;
    const batch = this.opsi.ukuranBatch ?? 100;
    const maks = this.opsi.maksPercobaan ?? 10;
    const client = await this.pool.connect();
    let terkirim = 0;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<BarisOutbox>(
        `SELECT id, event_id, topik, tipe, agregat_id, correlation_id, payload, percobaan, dibuat_at
         FROM ${skema}.outbox WHERE status = 'MENUNGGU' AND berikutnya_at <= now()
         ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED`,
        [batch],
      );
      for (const b of rows) {
        const event: CloudEvent = {
          specversion: '1.0', id: b.event_id, source, type: b.tipe, subject: b.agregat_id,
          time: b.dibuat_at.toISOString(), datacontenttype: 'application/json',
          ...(b.correlation_id ? { correlationid: b.correlation_id } : {}), data: b.payload,
        };
        try {
          await this.broker.publish(b.topik, event);
          await client.query(`UPDATE ${skema}.outbox SET status = 'TERKIRIM', terkirim_at = now(), percobaan = percobaan + 1 WHERE id = $1`, [b.id]);
          terkirim++;
        } catch (e) {
          const galat = e instanceof Error ? e.message : String(e);
          const mati = b.percobaan + 1 >= maks;
          await client.query(
            `UPDATE ${skema}.outbox SET percobaan = percobaan + 1, galat_terakhir = $2,
               status = CASE WHEN $3 THEN 'MATI' ELSE 'MENUNGGU' END,
               berikutnya_at = now() + make_interval(secs => least(power(2, percobaan + 1), 300))
             WHERE id = $1`,
            [b.id, galat, mati],
          );
          this.opsi.log?.(`outbox ${b.event_id} gagal (${b.percobaan + 1}/${maks}): ${galat}`);
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
    return terkirim;
  }

  start(): void {
    const interval = this.opsi.intervalMs ?? 500;
    const putar = async () => {
      if (this.berjalan) return;
      this.berjalan = true;
      try {
        while ((await this.tick()) > 0) { /* kuras antrean */ }
      } catch (e) {
        this.opsi.log?.(`relay galat: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        this.berjalan = false;
      }
    };
    this.timer = setInterval(putar, interval);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
