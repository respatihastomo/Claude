import { Body, Controller, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { Broker, GalatHttp, MemoryBroker, ZodPipe } from '@arkas/common-ms';
import { CloudEventSchema } from '@arkas/kontrak';
import { BROKER, KONFIGURASI } from '../infra/tokens';
import type { Konfigurasi } from '../config';

const Masukan = z.object({ topik: z.string().min(3).max(80), event: CloudEventSchema });

/**
 * HANYA PENGEMBANGAN (DEV_EVENTS_ENABLED=true): menyuntikkan CloudEvent ke broker, menggantikan layanan hulu
 * yang belum dirilis (mis. svc-perencanaan menerbitkan KertasKerjaDisahkan). Tidak didaftarkan di produksi.
 */
@Controller('internal/v1/events')
export class InternalEventsController {
  constructor(@Inject(BROKER) private readonly broker: Broker, @Inject(KONFIGURASI) private readonly cfg: Konfigurasi) {}

  @Post()
  @HttpCode(202)
  async terbitkan(@Headers('x-internal-token') token: string | undefined, @Body(new ZodPipe(Masukan)) m: z.infer<typeof Masukan>) {
    const harap = Buffer.from(this.cfg.internalEventsToken ?? '');
    const dapat = Buffer.from(token ?? '');
    if (harap.length === 0 || harap.length !== dapat.length || !timingSafeEqual(harap, dapat)) {
      throw new GalatHttp(401, 'TOKEN_INTERNAL_TIDAK_VALID', 'X-Internal-Token tidak valid');
    }
    const sebelum = this.broker instanceof MemoryBroker ? this.broker.mati.length : 0;
    await this.broker.publish(m.topik, { datacontenttype: 'application/json', ...m.event } as never);
    if (this.broker instanceof MemoryBroker && this.broker.mati.length > sebelum) {
      throw new GalatHttp(422, 'EVENT_GAGAL_DIPROSES', this.broker.mati[this.broker.mati.length - 1].galat);
    }
    return { diterima: true, id: m.event.id };
  }
}
