import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { z } from 'zod';
import { CloudEvent, consumeIdempotent } from '@arkas/common-ms';
import { POOL_WORKER, SKEMA } from '../infra/tokens';

export const PenyaluranDicatatKonsumen = z.object({
  penyaluranId: z.string().uuid(), sumberDanaKode: z.string(), npsn: z.string().regex(/^\d{8}$/), tahun: z.number().int(), tahap: z.number().int(),
  tanggal: z.string(), nilai: z.number().positive(), bankKode: z.string(), nomorReferensi: z.string(),
});

/** SK-09: penyaluran Bantuan Pemerintah -> draf penerimaan di buku sumber dana bantuan sekolah. */
@Injectable()
export class PenyaluranConsumer {
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool) {}
  async tangani(e: CloudEvent): Promise<void> {
    const d = PenyaluranDicatatKonsumen.parse(e.data);
    await consumeIdempotent(this.pool, SKEMA, { ...e, data: d }, async (tx) => {
      await tx.query(`INSERT INTO tatausaha.penyaluran_masuk (id, npsn, tahun, sumber_dana_kode, tahap, tanggal, nilai, bank_kode, nomor_referensi)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`, [d.penyaluranId, d.npsn, d.tahun, d.sumberDanaKode, d.tahap, d.tanggal, d.nilai, d.bankKode, d.nomorReferensi]);
    });
  }
}
