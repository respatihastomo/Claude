import 'reflect-metadata';
import { Controller, DynamicModule, Get, Inject, INestApplication, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { Pool } from 'pg';
import { Broker, DbContextService, HttpBroker, KafkaBroker, MemoryBroker, OutboxRelay, ProblemFilter, ScopeGuard, VerifikatorJwt } from '@arkas/common-ms';
import { TOPIK } from '@arkas/kontrak';
import type { Konfigurasi } from './config';
import { BROKER, KONFIGURASI, PEMBUAT_PDF, PENANDATANGAN, PENYIMPANAN, POOL_API, POOL_WORKER, SKEMA } from './infra/tokens';
import { ChromiumPdf, GotenbergPdf, PembuatPdf } from './infra/pdf';
import { BerkasLokal } from './infra/penyimpanan';
import { TteBsre, TteSimulasiDev } from './infra/tte';
import { KonsumenPelaporan } from './events/konsumen';
import { InternalEventsController } from './events/internal-events.controller';
import { LaporanController } from './laporan/laporan.controller';
import { LaporanService } from './laporan/laporan.service';
import { PembuatLaporan } from './laporan/pembuat';

@Controller('health')
class HealthController {
  constructor(@Inject(POOL_API) private readonly pool: Pool) {}
  @Get('live') live() { return { status: 'ok' }; }
  @Get('ready') async ready() { await this.pool.query('SELECT 1'); return { status: 'ok' }; }
}

class Penutup implements OnApplicationShutdown {
  constructor(@Inject(POOL_API) private readonly api: Pool, @Inject(POOL_WORKER) private readonly worker: Pool, @Inject(PEMBUAT_PDF) private readonly pdf: PembuatPdf) {}
  async onApplicationShutdown() { await Promise.all([this.api.end(), this.worker.end(), this.pdf.tutup()]); }
}

function modul(cfg: Konfigurasi, broker: Broker, pdf: PembuatPdf): DynamicModule {
  @Module({}) class AppModule {}
  return {
    module: AppModule,
    controllers: [LaporanController, HealthController, ...(cfg.devEvents || cfg.broker === 'http' ? [InternalEventsController] : [])],
    providers: [
      { provide: KONFIGURASI, useValue: cfg },
      { provide: BROKER, useValue: broker },
      { provide: PEMBUAT_PDF, useValue: pdf },
      { provide: PENYIMPANAN, useFactory: () => new BerkasLokal(cfg.penyimpananDir) },
      { provide: PENANDATANGAN, useFactory: () => (cfg.tte === 'bsre' ? new TteBsre() : new TteSimulasiDev()) },
      { provide: POOL_API, useFactory: () => new Pool({ connectionString: cfg.databaseUrl, max: 10, application_name: cfg.serviceName }) },
      { provide: POOL_WORKER, useFactory: () => new Pool({ connectionString: cfg.databaseWorkerUrl, max: 5, application_name: `${cfg.serviceName}-worker` }) },
      { provide: DbContextService, useFactory: (p: Pool) => new DbContextService(p), inject: [POOL_API] },
      { provide: VerifikatorJwt, useFactory: () => new VerifikatorJwt(cfg.jwtPublicKey, cfg.jwtIssuer, cfg.jwtAudience) },
      { provide: ScopeGuard, useFactory: (r: Reflector, j: VerifikatorJwt) => new ScopeGuard(r, j), inject: [Reflector, VerifikatorJwt] },
      KonsumenPelaporan, LaporanService, PembuatLaporan, Penutup,
    ],
  };
}

export interface Aplikasi { app: INestApplication; broker: Broker; relay: OutboxRelay; pembuat: PembuatLaporan }

export async function buatAplikasi(cfg: Konfigurasi, opsi: { broker?: Broker; pdf?: PembuatPdf; logger?: false } = {}): Promise<Aplikasi> {
  const broker = opsi.broker ?? (
    cfg.broker === 'kafka' ? new KafkaBroker(cfg.brokerBrokers, cfg.serviceName)
      : cfg.broker === 'http' ? new HttpBroker(HttpBroker.uraiTargets(cfg.brokerHttpTargets ?? ''), cfg.internalEventsToken!)
        : new MemoryBroker());
  const pdf = opsi.pdf ?? (cfg.pdf === 'gotenberg' ? new GotenbergPdf(cfg.gotenbergUrl!) : new ChromiumPdf());
  const app = await NestFactory.create(modul(cfg, broker, pdf), { logger: opsi.logger === false ? false : ['log', 'warn', 'error'] });
  app.useGlobalFilters(new ProblemFilter());
  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  const k = app.get(KonsumenPelaporan);
  await broker.subscribe(TOPIK.PERIODE_DITUTUP, `${cfg.serviceName}.periode-ditutup`, (e) => k.periodeDitutup(e));
  await broker.subscribe(TOPIK.TRANSAKSI_DISETUJUI, `${cfg.serviceName}.transaksi-disetujui`, (e) => k.transaksiDisetujui(e));

  const log = new Logger('OutboxRelay');
  const relay = new OutboxRelay(app.get<Pool>(POOL_WORKER), broker, { skema: SKEMA, source: cfg.serviceName, intervalMs: cfg.outboxIntervalMs, log: (m) => log.warn(m) });
  return { app, broker, relay, pembuat: app.get(PembuatLaporan) };
}
