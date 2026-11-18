import 'reflect-metadata';
import { INestApplication, Logger, Module, OnApplicationShutdown, Inject, DynamicModule } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { Pool } from 'pg';
import { Broker, DbContextService, KafkaBroker, MemoryBroker, OutboxRelay, ProblemFilter, ScopeGuard, VerifikatorJwt } from '@arkas/common-ms';
import { TOPIK } from '@arkas/kontrak';
import type { Konfigurasi } from './config';
import { BROKER, KONFIGURASI, POOL_API, POOL_WORKER, SKEMA } from './infra/tokens';
import { BkuController } from './penatausahaan/bku.controller';
import { TransaksiController } from './penatausahaan/transaksi.controller';
import { PajakController } from './penatausahaan/pajak.controller';
import { PeriodeController } from './penatausahaan/periode.controller';
import { PeriodeService } from './penatausahaan/periode.service';
import { PenatausahaanService } from './penatausahaan/penatausahaan.service';
import { KertasKerjaDisahkanConsumer } from './events/kertas-kerja-disahkan.consumer';
import { InternalEventsController } from './events/internal-events.controller';
import { HealthController } from './health.controller';

class Penutup implements OnApplicationShutdown {
  constructor(@Inject(POOL_API) private readonly api: Pool, @Inject(POOL_WORKER) private readonly worker: Pool) {}
  async onApplicationShutdown() {
    await Promise.all([this.api.end(), this.worker.end()]);
  }
}

function modulAplikasi(cfg: Konfigurasi, broker: Broker): DynamicModule {
  @Module({})
  class AppModule {}
  return {
    module: AppModule,
    controllers: [BkuController, TransaksiController, PajakController, PeriodeController, HealthController, ...(cfg.devEvents ? [InternalEventsController] : [])],
    providers: [
      { provide: KONFIGURASI, useValue: cfg },
      { provide: BROKER, useValue: broker },
      { provide: POOL_API, useFactory: () => new Pool({ connectionString: cfg.databaseUrl, max: 20, application_name: cfg.serviceName }) },
      { provide: POOL_WORKER, useFactory: () => new Pool({ connectionString: cfg.databaseWorkerUrl, max: 5, application_name: `${cfg.serviceName}-worker` }) },
      { provide: DbContextService, useFactory: (p: Pool) => new DbContextService(p), inject: [POOL_API] },
      { provide: VerifikatorJwt, useFactory: () => new VerifikatorJwt(cfg.jwtPublicKey, cfg.jwtIssuer, cfg.jwtAudience) },
      { provide: ScopeGuard, useFactory: (r: Reflector, j: VerifikatorJwt) => new ScopeGuard(r, j), inject: [Reflector, VerifikatorJwt] },
      PenatausahaanService,
      PeriodeService,
      KertasKerjaDisahkanConsumer,
      Penutup,
    ],
  };
}

export interface Aplikasi { app: INestApplication; broker: Broker; relay: OutboxRelay }

/** Merakit aplikasi (dipakai main.ts dan uji integrasi). */
export async function buatAplikasi(cfg: Konfigurasi, opsi: { broker?: Broker; logger?: false } = {}): Promise<Aplikasi> {
  const broker = opsi.broker ?? (cfg.broker === 'kafka' ? new KafkaBroker(cfg.brokerBrokers, cfg.serviceName) : new MemoryBroker());
  const app = await NestFactory.create(modulAplikasi(cfg, broker), { logger: opsi.logger === false ? false : ['log', 'warn', 'error'] });
  app.useGlobalFilters(new ProblemFilter());
  app.enableShutdownHooks();
  const http = app.getHttpAdapter().getInstance();
  http.disable('x-powered-by');
  http.set('trust proxy', true);

  const consumer = app.get(KertasKerjaDisahkanConsumer);
  await broker.subscribe(TOPIK.KERTAS_KERJA_DISAHKAN, `${cfg.serviceName}.kk-disahkan`, async (e) => { await consumer.tangani(e); });

  const log = new Logger('OutboxRelay');
  const relay = new OutboxRelay(app.get<Pool>(POOL_WORKER), broker, {
    skema: SKEMA, source: cfg.serviceName, intervalMs: cfg.outboxIntervalMs, log: (m) => log.warn(m),
  });
  return { app, broker, relay };
}
