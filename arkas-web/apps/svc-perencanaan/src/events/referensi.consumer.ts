import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { CloudEvent, consumeIdempotent } from '@arkas/common-ms';
import { ReferensiDiubahData } from '@arkas/kontrak';
import { POOL_WORKER, SKEMA } from '../infra/tokens';

/** ReferensiDiubah -> proyeksi sekolah (cakupan Dinas), komponen BOSP (batas juknis), kode rekening (validasi baris). */
@Injectable()
export class ReferensiConsumer {
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool) {}

  async tangani(event: CloudEvent): Promise<void> {
    const r = ReferensiDiubahData.parse(event.data);
    if (!['SEKOLAH', 'KOMPONEN', 'KODE_REKENING'].includes(r.entitas)) return;
    const d = r.data as Record<string, any>;
    await consumeIdempotent(this.pool, SKEMA, { ...event, data: r }, async (tx) => {
      if (r.entitas === 'SEKOLAH') {
        await tx.query(
          `INSERT INTO perencanaan.ref_sekolah_lokal (npsn, nama, wilayah_kode, jenjang, status_sekolah, aktif, versi, diperbarui_at) VALUES ($1,$2,$3,$4,$5,$6,$7, now())
           ON CONFLICT (npsn) DO UPDATE SET nama = EXCLUDED.nama, wilayah_kode = EXCLUDED.wilayah_kode, jenjang = EXCLUDED.jenjang,
             status_sekolah = EXCLUDED.status_sekolah, aktif = EXCLUDED.aktif, versi = EXCLUDED.versi, diperbarui_at = now()
           WHERE perencanaan.ref_sekolah_lokal.versi < EXCLUDED.versi`,
          [d.npsn, d.nama, d.wilayahKode, d.jenjangKode, d.statusSekolah, r.aktif, r.versi],
        );
      } else if (r.entitas === 'KOMPONEN') {
        await tx.query(
          `INSERT INTO perencanaan.ref_komponen_lokal (sumber_dana_kode, kode, nama, maks_persen, min_persen, aktif, versi, diperbarui_at) VALUES ($1,$2,$3,$4,$5,$6,$7, now())
           ON CONFLICT (sumber_dana_kode, kode) DO UPDATE SET nama = EXCLUDED.nama, maks_persen = EXCLUDED.maks_persen, min_persen = EXCLUDED.min_persen,
             aktif = EXCLUDED.aktif, versi = EXCLUDED.versi, diperbarui_at = now()
           WHERE perencanaan.ref_komponen_lokal.versi < EXCLUDED.versi`,
          [d.sumberDanaKode, d.kode, d.nama, d.maksPersen ?? null, d.minPersen ?? null, r.aktif, r.versi],
        );
      } else {
        await tx.query(
          `INSERT INTO perencanaan.ref_rekening_lokal (kode, nama, aktif, versi) VALUES ($1,$2,$3,$4)
           ON CONFLICT (kode) DO UPDATE SET nama = EXCLUDED.nama, aktif = EXCLUDED.aktif, versi = EXCLUDED.versi WHERE perencanaan.ref_rekening_lokal.versi < EXCLUDED.versi`,
          [d.kode, d.nama, r.aktif, r.versi],
        );
      }
    });
  }
}
