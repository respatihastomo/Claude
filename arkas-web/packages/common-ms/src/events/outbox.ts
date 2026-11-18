import type { PoolClient } from 'pg';

export interface PesanOutbox {
  topik: string;
  tipe: string;
  agregatId: string;
  correlationId?: string;
  payload: unknown;
}

/** Transactional Outbox: dipanggil di dalam transaksi domain yang sama (Kode 9). */
export async function tulisOutbox(tx: PoolClient, skema: string, p: PesanOutbox): Promise<string> {
  if (!/^[a-z_]+$/.test(skema)) throw new Error('skema tidak valid');
  const r = await tx.query<{ event_id: string }>(
    `INSERT INTO ${skema}.outbox (topik, tipe, agregat_id, correlation_id, payload) VALUES ($1, $2, $3, $4, $5) RETURNING event_id`,
    [p.topik, p.tipe, p.agregatId, p.correlationId ?? null, JSON.stringify(p.payload)],
  );
  return r.rows[0].event_id;
}
