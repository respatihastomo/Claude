import { Pool, PoolClient } from 'pg';
import { RequestContext } from '../context/request-context';
import { terjemahkanGalatPg } from './galat-pg';

export const PG_POOL = Symbol('PG_POOL');

/**
 * Kode 4 — DbContextService. Setiap unit kerja berjalan dalam satu transaksi lokal dan
 * menyuntikkan klaim JWT ke variabel sesi (set_config ..., true = lokal transaksi) untuk kebijakan RLS.
 * Implementasi memakai `pg` langsung (lapisan "SQL langsung" pada 3.3).
 */
export class DbContextService {
  constructor(private readonly pool: Pool) {}

  async run<T>(ctx: RequestContext, work: (tx: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await client.query("SET LOCAL statement_timeout = '15s'");
      await client.query(
        `SELECT set_config('app.pengguna_id', $1, true), set_config('app.peran', $2, true),
                set_config('app.npsn', $3, true), set_config('app.wilayah', $4, true),
                set_config('app.direktorat', $5, true), set_config('app.ip', $6, true),
                set_config('app.alasan', $7, true), set_config('app.request_id', $8, true)`,
        [ctx.penggunaId, ctx.peran, ctx.npsn ?? '', ctx.wilayahKode ?? '', ctx.direktoratIds.join(','), ctx.ip, ctx.alasan ?? '', ctx.requestId],
      );
      const hasil = await work(client);
      await client.query('COMMIT');
      return hasil;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw terjemahkanGalatPg(e);
    } finally {
      client.release();
    }
  }
}
