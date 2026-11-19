import 'reflect-metadata';
import { Controller, DynamicModule, Get, Inject, INestApplication, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Pool } from 'pg';
import { Broker, DbContextService, HttpBroker, KafkaBroker, MemoryBroker, OutboxRelay, ProblemFilter, ScopeGuard, VerifikatorJwt } from '@arkas/common-ms';
import { TOPIK } from '@arkas/kontrak';
import type { Konfigurasi } from './config';
import { BROKER, KONFIGURASI, POOL_API, POOL_WORKER, SKEMA } from './infra/tokens';
import { AdminIntegrasiController } from './admin/admin.controller';
import { AdminIntegrasiService } from './admin/admin.service';
import { InternalEventsController } from './events/internal-events.controller';
import { KonsumenIntegrasi } from './events/konsumen';
import { MitraGuard } from './mitra/keamanan';
import { MitraApiController } from './mitra/mitra-api.controller';
import { MitraApiService } from './mitra/mitra-api.service';
import { PengirimPembukaan } from './pekerja/pengirim-pembukaan';

@Controller('health')
class HealthController {
  constructor(@Inject(POOL_API) private readonly pool: Pool) {}
  @Get('live') live() { return { status: 'ok' }; }
  @Get('ready') async ready() { await this.pool.query('SELECT 1'); return { status: 'ok' }; }
}
class Penutup implements OnApplicationShutdown {
  constructor(@Inject(POOL_API) private readonly api: Pool, @Inject(POOL_WORKER) private readonly worker: Pool) {}
  async onApplicationShutdown() { await Promise.all([this.api.end(), this.worker.end()]); }
}

function modul(cfg: Konfigurasi, broker: Broker): DynamicModule {
  @Module({}) class AppModule {}
  return {
    module: AppModule,
    controllers: [MitraApiController, AdminIntegrasiController, HealthController, ...(cfg.devEvents || cfg.broker === 'http' ? [InternalEventsController] : [])],
    providers: [
      { provide: KONFIGURASI, useValue: cfg },
      { provide: BROKER, useValue: broker },
      { provide: POOL_API, useFactory: () => new Pool({ connectionString: cfg.databaseUrl, max: 10, application_name: cfg.serviceName }) },
      { provide: POOL_WORKER, useFactory: () => new Pool({ connectionString: cfg.databaseWorkerUrl, max: 10, application_name: `${cfg.serviceName}-worker` }) },
      { provide: DbContextService, useFactory: (p: Pool) => new DbContextService(p), inject: [POOL_API] },
      { provide: VerifikatorJwt, useFactory: () => new VerifikatorJwt(cfg.jwtPublicKey, cfg.jwtIssuer, cfg.jwtAudience) },
      { provide: ScopeGuard, useFactory: (r: Reflector, j: VerifikatorJwt) => new ScopeGuard(r, j), inject: [Reflector, VerifikatorJwt] },
      MitraGuard, MitraApiService, AdminIntegrasiService, KonsumenIntegrasi, PengirimPembukaan, Penutup,
    ],
  };
}

export interface Aplikasi { app: INestApplication; broker: Broker; relay: OutboxRelay; pengirim: PengirimPembukaan }

export async function buatAplikasi(cfg: Konfigurasi, opsi: { broker?: Broker; logger?: false } = {}): Promise<Aplikasi> {
  const broker = opsi.broker ?? (
    cfg.broker === 'kafka' ? new KafkaBroker(cfg.brokerBrokers, cfg.serviceName)
      : cfg.broker === 'http' ? new HttpBroker(HttpBroker.uraiTargets(cfg.brokerHttpTargets ?? ''), cfg.internalEventsToken!)
        : new MemoryBroker());
  // rawBody: tanda tangan HMAC Mitra dihitung atas body mentah, bukan JSON hasil urai
  const app = await NestFactory.create<NestExpressApplication>(modul(cfg, broker), { rawBody: true, logger: opsi.logger === false ? false : ['log', 'warn', 'error'] });
  app.useGlobalFilters(new ProblemFilter());
  app.enableShutdownHooks();
  app.disable('x-powered-by');
  app.set('trust proxy', cfg.trustProxy);
  const k = app.get(KonsumenIntegrasi);
  await broker.subscribe(TOPIK.REFERENSI_DIUBAH, `${cfg.serviceName}.referensi-diubah`, (e) => k.referensiDiubah(e));
  await broker.subscribe(TOPIK.KERTAS_KERJA_DISAHKAN, `${cfg.serviceName}.kk-disahkan`, (e) => k.kertasKerjaDisahkan(e));
  await broker.subscribe(TOPIK.SUMBER_DANA_DISAHKAN, `${cfg.serviceName}.sumber-dana-disahkan`, (e) => k.sumberDanaDisahkan(e));
  const log = new Logger('OutboxRelay');
  const relay = new OutboxRelay(app.get<Pool>(POOL_WORKER), broker, { skema: SKEMA, source: cfg.serviceName, intervalMs: cfg.outboxIntervalMs, log: (m) => log.warn(m) });
  return { app, broker, relay, pengirim: app.get(PengirimPembukaan) };
}
