import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { CloudEvent, consumeIdempotent } from '@arkas/common-ms';
import { ReferensiDiubahData } from '@arkas/kontrak';
import { POOL_WORKER, SKEMA } from '../infra/tokens';

/** ReferensiDiubah -> proyeksi wilayah, direktorat, sekolah (dasar cakupan peran & pengelolaan berjenjang). */
@Injectable()
export class ReferensiConsumer {
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool) {}

  async tangani(event: CloudEvent): Promise<void> {
    const r = ReferensiDiubahData.parse(event.data);
    if (!['WILAYAH', 'DIREKTORAT', 'SEKOLAH'].includes(r.entitas)) return;
    const d = r.data as Record<string, any>;
    await consumeIdempotent(this.pool, SKEMA, { ...event, data: r }, async (tx) => {
      if (r.entitas === 'WILAYAH') {
        await tx.query(
          `INSERT INTO auth.ref_wilayah_lokal (kode, nama, induk_kode, aktif, versi) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (kode) DO UPDATE SET nama = EXCLUDED.nama, induk_kode = EXCLUDED.induk_kode, aktif = EXCLUDED.aktif, versi = EXCLUDED.versi
           WHERE auth.ref_wilayah_lokal.versi < EXCLUDED.versi`,
          [d.kode, d.nama, d.indukKode ?? null, r.aktif, r.versi],
        );
      } else if (r.entitas === 'DIREKTORAT') {
        await tx.query(
          `INSERT INTO auth.ref_direktorat_lokal (kode, nama, ditjen_kode, aktif, versi) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (kode) DO UPDATE SET nama = EXCLUDED.nama, ditjen_kode = EXCLUDED.ditjen_kode, aktif = EXCLUDED.aktif, versi = EXCLUDED.versi
           WHERE auth.ref_direktorat_lokal.versi < EXCLUDED.versi`,
          [d.kode, d.nama, d.ditjenKode, r.aktif, r.versi],
        );
      } else {
        await tx.query(
          `INSERT INTO auth.ref_sekolah_lokal (npsn, nama, wilayah_kode, aktif, versi) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (npsn) DO UPDATE SET nama = EXCLUDED.nama, wilayah_kode = EXCLUDED.wilayah_kode, aktif = EXCLUDED.aktif, versi = EXCLUDED.versi
           WHERE auth.ref_sekolah_lokal.versi < EXCLUDED.versi`,
          [d.npsn, d.nama, d.wilayahKode, r.aktif, r.versi],
        );
      }
    });
  }
}
