import type { Pool, PoolClient } from 'pg';
import type { CloudEvent } from './cloud-event';

/**
 * Kode 11 — Idempotent Event Consumer. Mencatat event_id ke <skema>.inbox_processed dan menjalankan penangan
 * dalam SATU transaksi lokal; event yang sama tidak akan dieksekusi dua kali.
 * @returns true bila diproses, false bila duplikat.
 */
export async function consumeIdempotent<T>(
  pool: Pool,
  skema: string,
  event: CloudEvent<T>,
  penangan: (tx: PoolClient, data: T, event: CloudEvent<T>) => Promise<void>,
): Promise<boolean> {
  if (!/^[a-z_]+$/.test(skema)) throw new Error('skema tidak valid');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO ${skema}.inbox_processed (event_id, topik) VALUES ($1::uuid, $2) ON CONFLICT (event_id) DO NOTHING`,
      [event.id, event.type],
    );
    if (r.rowCount === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    await penangan(client, event.data, event);
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
