import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { z } from 'zod';
import { CloudEvent, consumeIdempotent } from '@arkas/common-ms';
import { SumberDanaDisahkanData } from '@arkas/kontrak';
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

  /**
   * SumberDanaDisahkan (svc-bantuan, 8.3): pagu BANPER dibentuk per sekolah penerima (fitur 3: pagu dari penetapan, tidak bisa diubah sekolah).
   * Sekolah yang belum ada di proyeksi referensi -> lempar agar dicoba ulang setelah ReferensiDiubah tiba.
   */
  async sumberDanaDisahkan(event: CloudEvent): Promise<void> {
    const d = SumberDanaDisahkanData.parse(event.data);
    await consumeIdempotent(this.pool, SKEMA, { ...event, data: d }, async (tx) => {
      const ada = new Set((await tx.query<{ npsn: string }>('SELECT npsn FROM perencanaan.ref_sekolah_lokal WHERE npsn = ANY($1::char(8)[])', [d.penerima.map((p) => p.npsn)])).rows.map((r) => r.npsn));
      const hilang = d.penerima.filter((p) => !ada.has(p.npsn)).map((p) => p.npsn);
      if (hilang.length) throw new Error(`sekolah belum ada di proyeksi referensi: ${hilang.join(', ')}`);
      for (const p of d.penerima) {
        await tx.query(
          `INSERT INTO perencanaan.pagu (npsn, tahun, sumber_dana_kode, nilai) VALUES ($1,$2,$3,$4)
           ON CONFLICT (npsn, tahun, sumber_dana_kode) DO UPDATE SET nilai = EXCLUDED.nilai, ditetapkan_at = now()`, [p.npsn, d.tahun, d.kode, p.nilai]);
      }
    });
  }
}
