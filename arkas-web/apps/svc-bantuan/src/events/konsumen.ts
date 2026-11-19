import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { CloudEvent, consumeIdempotent } from '@arkas/common-ms';
import { ReferensiDiubahData } from '@arkas/kontrak';
import { POOL_WORKER, SKEMA } from '../infra/tokens';

/** Replika sekolah (validasi NPSN & jenjang penerima) dan direktorat (cakupan Ditjen) dari ReferensiDiubah. */
@Injectable()
export class KonsumenBantuan {
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool) {}

  async referensiDiubah(e: CloudEvent): Promise<void> {
    const r = ReferensiDiubahData.parse(e.data);
    if (r.entitas !== 'SEKOLAH' && r.entitas !== 'DIREKTORAT') return;
    await consumeIdempotent(this.pool, SKEMA, { ...e, data: r }, async (tx) => {
      const d = r.data as Record<string, string>;
      if (r.entitas === 'SEKOLAH') {
        await tx.query(`INSERT INTO banper.ref_sekolah_lokal (npsn, nama, jenjang_kode, wilayah_kode, aktif, versi) VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (npsn) DO UPDATE SET nama = EXCLUDED.nama, jenjang_kode = EXCLUDED.jenjang_kode, wilayah_kode = EXCLUDED.wilayah_kode, aktif = EXCLUDED.aktif, versi = EXCLUDED.versi
          WHERE banper.ref_sekolah_lokal.versi < EXCLUDED.versi`, [d.npsn, d.nama, d.jenjangKode, d.wilayahKode, r.aktif, r.versi]);
      } else {
        await tx.query(`INSERT INTO banper.ref_direktorat_lokal (kode, nama, ditjen_kode, versi) VALUES ($1,$2,$3,$4)
          ON CONFLICT (kode) DO UPDATE SET nama = EXCLUDED.nama, ditjen_kode = EXCLUDED.ditjen_kode, versi = EXCLUDED.versi WHERE banper.ref_direktorat_lokal.versi < EXCLUDED.versi`,
          [d.kode, d.nama, d.ditjenKode, r.versi]);
      }
    });
  }
}
