import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { z } from 'zod';
import { CloudEvent, consumeIdempotent } from '@arkas/common-ms';
import { POOL_WORKER, SKEMA } from '../infra/tokens';

/** Kontrak konsumen: field TransaksiDisetujui yang dipakai svc-perencanaan. */
const TransaksiDisetujuiKonsumen = z.object({
  transaksiId: z.string().uuid(),
  jenis: z.string(),
  items: z.array(z.object({ barisId: z.string().uuid(), jumlah: z.number() })),
});

/** TransaksiDisetujui -> perencanaan.realisasi_baris_lokal (8.3): batas bawah pergeseran per baris (SK-02). */
@Injectable()
export class KonsumenPerencanaan {
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool) {}

  async transaksiDisetujui(event: CloudEvent): Promise<void> {
    const d = TransaksiDisetujuiKonsumen.parse(event.data);
    await consumeIdempotent(this.pool, SKEMA, { ...event, data: d }, async (tx) => {
      for (const i of d.items) {
        await tx.query(
          `INSERT INTO perencanaan.realisasi_baris_lokal (transaksi_id, baris_id, jumlah) VALUES ($1,$2,$3)
           ON CONFLICT (transaksi_id, baris_id) DO UPDATE SET jumlah = perencanaan.realisasi_baris_lokal.jumlah + EXCLUDED.jumlah`,
          [d.transaksiId, i.barisId, i.jumlah],
        );
      }
    });
  }
}
