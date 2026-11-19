import 'reflect-metadata';
import { Controller, DynamicModule, Get, Inject, INestApplication, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Pool } from 'pg';
import { Broker, DbContextService, HttpBroker, KafkaBroker, MemoryBroker, OutboxRelay, ProblemFilter, ScopeGuard, VerifikatorJwt } from '@arkas/common-ms';
import { TOPIK } from '@arkas/kontrak';
import type { Konfigurasi } from './config';
import { BROKER, KONFIGURASI, PENYIMPANAN, POOL_API, POOL_WORKER, SKEMA } from './infra/tokens';
import { BerkasLokal } from './infra/penyimpanan';
import { JENIS_XLSX } from './bantuan/berkas';
import { PengajuanController, SumberDanaController } from './bantuan/bantuan.controller';
import { PengajuanService } from './bantuan/pengajuan.service';
import { SumberDanaService } from './bantuan/sumber-dana.service';
import { InternalEventsController } from './events/internal-events.controller';
import { KonsumenBantuan } from './events/konsumen';
import { ImporPenerima } from './pekerja/impor-penerima';

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
    controllers: [SumberDanaController, PengajuanController, HealthController, ...(cfg.devEvents || cfg.broker === 'http' ? [InternalEventsController] : [])],
    providers: [
      { provide: KONFIGURASI, useValue: cfg },
      { provide: BROKER, useValue: broker },
      { provide: PENYIMPANAN, useFactory: () => new BerkasLokal(cfg.penyimpananDir) },
      { provide: POOL_API, useFactory: () => new Pool({ connectionString: cfg.databaseUrl, max: 10, application_name: cfg.serviceName }) },
      { provide: POOL_WORKER, useFactory: () => new Pool({ connectionString: cfg.databaseWorkerUrl, max: 5, application_name: `${cfg.serviceName}-worker` }) },
      { provide: DbContextService, useFactory: (p: Pool) => new DbContextService(p), inject: [POOL_API] },
      { provide: VerifikatorJwt, useFactory: () => new VerifikatorJwt(cfg.jwtPublicKey, cfg.jwtIssuer, cfg.jwtAudience) },
      { provide: ScopeGuard, useFactory: (r: Reflector, j: VerifikatorJwt) => new ScopeGuard(r, j), inject: [Reflector, VerifikatorJwt] },
      SumberDanaService, PengajuanService, KonsumenBantuan, ImporPenerima, Penutup,
    ],
  };
}

export interface Aplikasi { app: INestApplication; broker: Broker; relay: OutboxRelay; impor: ImporPenerima }

export async function buatAplikasi(cfg: Konfigurasi, opsi: { broker?: Broker; logger?: false } = {}): Promise<Aplikasi> {
  const broker = opsi.broker ?? (
    cfg.broker === 'kafka' ? new KafkaBroker(cfg.brokerBrokers, cfg.serviceName)
      : cfg.broker === 'http' ? new HttpBroker(HttpBroker.uraiTargets(cfg.brokerHttpTargets ?? ''), cfg.internalEventsToken!)
        : new MemoryBroker());
  const app = await NestFactory.create<NestExpressApplication>(modul(cfg, broker), { logger: opsi.logger === false ? false : ['log', 'warn', 'error'] });
  // unggahan PDF/XLSX dikirim sebagai body biner (bukan multipart), maks 10 MB
  app.useBodyParser('raw', { type: ['application/pdf', JENIS_XLSX], limit: '10mb' });
  app.useGlobalFilters(new ProblemFilter());
  app.enableShutdownHooks();
  app.disable('x-powered-by');
  const k = app.get(KonsumenBantuan);
  await broker.subscribe(TOPIK.REFERENSI_DIUBAH, `${cfg.serviceName}.referensi`, (e) => k.referensiDiubah(e));
  const log = new Logger('OutboxRelay');
  const relay = new OutboxRelay(app.get<Pool>(POOL_WORKER), broker, { skema: SKEMA, source: cfg.serviceName, intervalMs: cfg.outboxIntervalMs, log: (m) => log.warn(m) });
  return { app, broker, relay, impor: app.get(ImporPenerima) };
}
