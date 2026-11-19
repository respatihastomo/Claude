import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { CloudEvent, consumeIdempotent } from '@arkas/common-ms';
import { SumberDanaDisahkanData } from '@arkas/kontrak';
import { POOL_WORKER, SKEMA } from '../infra/tokens';

/**
 * SumberDanaDisahkan (svc-bantuan) -> referensi sumber dana BANPER aktif beserta jenjang & komponennya (fitur 14).
 * Trigger beri_versi/terbitkan_referensi menerbitkan ReferensiDiubah, sehingga svc-integrasi membuka sumber dana di Mitra
 * dan svc-perencanaan mendapat komponen. Hanya menulis bila isi berubah (event ulang tidak menaikkan versi).
 */
@Injectable()
export class KonsumenReferensi {
  private readonly log = new Logger(KonsumenReferensi.name);
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool) {}

  async sumberDanaDisahkan(e: CloudEvent): Promise<void> {
    const d = SumberDanaDisahkanData.parse(e.data);
    await consumeIdempotent(this.pool, SKEMA, { ...e, data: d }, async (tx) => {
      await tx.query(
        `INSERT INTO ref.sumber_dana (kode, nama, kategori, direktorat_kode, aktif) VALUES ($1,$2,'BANPER',$3,true)
         ON CONFLICT (kode) DO UPDATE SET nama = EXCLUDED.nama, kategori = EXCLUDED.kategori, direktorat_kode = EXCLUDED.direktorat_kode, aktif = true
         WHERE (ref.sumber_dana.nama, ref.sumber_dana.kategori, ref.sumber_dana.direktorat_kode, ref.sumber_dana.aktif) IS DISTINCT FROM (EXCLUDED.nama, EXCLUDED.kategori, EXCLUDED.direktorat_kode, true)`,
        [d.kode, d.nama, d.direktoratKode]);
      for (const j of d.jenjang) {
        await tx.query(`INSERT INTO ref.sumber_dana_jenjang (sumber_dana_kode, jenjang_kode) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [d.kode, j]);
      }
      for (const k of d.komponen) {
        await tx.query(
          `INSERT INTO ref.komponen (sumber_dana_kode, kode, nama, maks_persen, aktif) VALUES ($1,$2,$3,$4,true)
           ON CONFLICT (sumber_dana_kode, kode) DO UPDATE SET nama = EXCLUDED.nama, maks_persen = EXCLUDED.maks_persen, aktif = true
           WHERE (ref.komponen.nama, ref.komponen.maks_persen, ref.komponen.aktif) IS DISTINCT FROM (EXCLUDED.nama, EXCLUDED.maks_persen, true)`,
          [d.kode, k.kode, k.nama, k.maksPersen]);
      }
      this.log.log(`SumberDanaDisahkan ${d.kode}: referensi BANPER aktif (${d.jenjang.join(', ')}, ${d.komponen.length} komponen)`);
    });
  }
}
