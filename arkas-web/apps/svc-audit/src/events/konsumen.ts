import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { CloudEvent, consumeIdempotent } from '@arkas/common-ms';
import { AuditDicatatData } from '@arkas/kontrak';
import { POOL_WORKER, SKEMA } from '../infra/tokens';

/** Nama layanan diambil dari `source` CloudEvent (diisi Outbox Relay layanan asal), bukan dari isi pesan. */
const LAYANAN = /^svc-[a-z]+$/;

/** Konsumen AuditDicatat: idempoten (inbox_processed) + penambahan berantai dalam satu transaksi. */
@Injectable()
export class KonsumenAudit {
  private readonly log = new Logger(KonsumenAudit.name);
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool) {}

  async auditDicatat(event: CloudEvent): Promise<void> {
    const d = AuditDicatatData.parse(event.data);
    if (!LAYANAN.test(event.source)) throw new Error(`source tidak dikenal: ${event.source}`);
    const baru = await consumeIdempotent(this.pool, SKEMA, { ...event, data: d }, async (tx) => {
      await tx.query(
        `SELECT 1 FROM audit.tambah_jejak($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [event.id, event.source, d.tabel, d.aksi, d.kunci, d.npsn, d.pelakuId, d.peran, d.ip, d.requestId, d.alasan,
          d.sebelum && JSON.stringify(d.sebelum), d.sesudah && JSON.stringify(d.sesudah), d.terjadiAt],
      );
    });
    if (!baru) this.log.debug(`AuditDicatat ${event.id} duplikat`);
  }
}
