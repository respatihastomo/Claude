import { Body, Controller, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { Broker, MasukanEventInternal, terimaEventInternal, ZodPipe } from '@arkas/common-ms';
import { BROKER, KONFIGURASI } from '../infra/tokens';
import type { Konfigurasi } from '../config';

/** HANYA PENGEMBANGAN: titik terima CloudEvent untuk BROKER=http (svc-referensi -> svc-bantuan). */
@Controller('internal/v1/events')
export class InternalEventsController {
  constructor(@Inject(BROKER) private readonly broker: Broker, @Inject(KONFIGURASI) private readonly cfg: Konfigurasi) {}

  @Post()
  @HttpCode(202)
  terima(@Headers('x-internal-token') token: string | undefined, @Body(new ZodPipe(MasukanEventInternal)) m: MasukanEventInternal) {
    return terimaEventInternal(this.broker, this.cfg.internalEventsToken, token, m);
  }
}
