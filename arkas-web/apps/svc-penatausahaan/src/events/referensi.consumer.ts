import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { CloudEvent, consumeIdempotent } from '@arkas/common-ms';
import { ReferensiDiubahData } from '@arkas/kontrak';
import { POOL_WORKER, SKEMA } from '../infra/tokens';

/**
 * ReferensiDiubah (svc-referensi) -> proyeksi lokal: tarif pajak per rekening & wilayah, dan wilayah sekolah (untuk SSPD).
 * Idempoten (inbox) dan tahan urutan acak: baris hanya ditimpa event berversi lebih besar.
 */
@Injectable()
export class ReferensiConsumer {
  private readonly log = new Logger(ReferensiConsumer.name);
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool) {}

  async tangani(event: CloudEvent): Promise<void> {
    const r = ReferensiDiubahData.parse(event.data);
    if (r.entitas !== 'TARIF_PAJAK' && r.entitas !== 'SEKOLAH') return; // bukan urusan layanan ini
    await consumeIdempotent(this.pool, SKEMA, { ...event, data: r }, async (tx) => {
      const d = r.data as Record<string, unknown>;
      if (r.entitas === 'TARIF_PAJAK') {
        await tx.query(
          `INSERT INTO tatausaha.ref_rekening_pajak_lokal (kode_rekening, jenis, wilayah_kode, tarif, tarif_tanpa_npwp, aktif, versi, diperbarui_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7, now())
           ON CONFLICT (kode_rekening, jenis, wilayah_kode) DO UPDATE SET tarif = EXCLUDED.tarif, tarif_tanpa_npwp = EXCLUDED.tarif_tanpa_npwp,
             aktif = EXCLUDED.aktif, versi = EXCLUDED.versi, diperbarui_at = now()
           WHERE tatausaha.ref_rekening_pajak_lokal.versi < EXCLUDED.versi`,
          [d.kodeRekening, d.jenis, d.wilayahKode ?? '', d.tarif, d.tarifTanpaNpwp ?? null, r.aktif, r.versi],
        );
      } else {
        await tx.query(
          `INSERT INTO tatausaha.ref_sekolah_lokal (npsn, wilayah_kode, versi) VALUES ($1,$2,$3)
           ON CONFLICT (npsn) DO UPDATE SET wilayah_kode = EXCLUDED.wilayah_kode, versi = EXCLUDED.versi WHERE tatausaha.ref_sekolah_lokal.versi < EXCLUDED.versi`,
          [d.npsn, d.wilayahKode, r.versi],
        );
      }
    });
    this.log.debug?.(`ReferensiDiubah ${r.entitas} ${r.kunci} v${r.versi}`);
  }
}
