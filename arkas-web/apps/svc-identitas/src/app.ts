import 'reflect-metadata';
import { Controller, DynamicModule, Get, Inject, INestApplication, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { Pool } from 'pg';
import { Broker, DbContextService, HttpBroker, KafkaBroker, MemoryBroker, OutboxRelay, ProblemFilter, ScopeGuard, VerifikatorJwt } from '@arkas/common-ms';
import type { Konfigurasi } from './config';
import { BROKER, KONFIGURASI, POOL_API, POOL_WORKER, SKEMA } from './infra/tokens';
import { PenerbitToken } from './infra/penerbit';
import { KlienOidc } from './infra/oidc';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { PenggunaController } from './pengguna/pengguna.controller';
import { PenggunaService } from './pengguna/pengguna.service';
import { ReferensiConsumer } from './events/referensi.consumer';
import { InternalEventsController } from './events/internal-events.controller';
import { TOPIK } from '@arkas/kontrak';

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
  const penerbit = new PenerbitToken(cfg.jwtPrivateKey, cfg.jwtIssuer, cfg.jwtAudience, cfg.tokenTtlDetik);
  @Module({}) class AppModule {}
  return {
    module: AppModule,
    controllers: [AuthController, PenggunaController, HealthController, ...(cfg.broker === 'http' ? [InternalEventsController] : [])],
    providers: [
      { provide: KONFIGURASI, useValue: cfg },
      { provide: BROKER, useValue: broker },
      { provide: PenerbitToken, useValue: penerbit },
      { provide: KlienOidc, useFactory: () => (cfg.oidc ? new KlienOidc(cfg.oidc) : null) },
      { provide: POOL_API, useFactory: () => new Pool({ connectionString: cfg.databaseUrl, max: 10, application_name: cfg.serviceName }) },
      { provide: POOL_WORKER, useFactory: () => new Pool({ connectionString: cfg.databaseWorkerUrl, max: 10, application_name: `${cfg.serviceName}-worker` }) },
      { provide: DbContextService, useFactory: (p: Pool) => new DbContextService(p), inject: [POOL_API] },
      // svc-identitas memverifikasi token yang ia terbitkan sendiri dengan kunci publik pasangannya.
      { provide: VerifikatorJwt, useFactory: () => new VerifikatorJwt(penerbit.publicPem(), cfg.jwtIssuer, cfg.jwtAudience) },
      { provide: ScopeGuard, useFactory: (r: Reflector, j: VerifikatorJwt) => new ScopeGuard(r, j), inject: [Reflector, VerifikatorJwt] },
      AuthService, PenggunaService, ReferensiConsumer, Penutup,
    ],
  };
}

export interface Aplikasi { app: INestApplication; broker: Broker; relay: OutboxRelay }

export async function buatAplikasi(cfg: Konfigurasi, opsi: { broker?: Broker; logger?: false } = {}): Promise<Aplikasi> {
  const broker = opsi.broker ?? (
    cfg.broker === 'kafka' ? new KafkaBroker(cfg.brokerBrokers, cfg.serviceName)
      : cfg.broker === 'http' ? new HttpBroker(HttpBroker.uraiTargets(cfg.brokerHttpTargets ?? ''), cfg.internalEventsToken!)
        : new MemoryBroker());
  const app = await NestFactory.create(modul(cfg, broker), { logger: opsi.logger === false ? false : ['log', 'warn', 'error'] });
  app.useGlobalFilters(new ProblemFilter());
  app.enableShutdownHooks();
  const http = app.getHttpAdapter().getInstance();
  http.disable('x-powered-by');
  http.set('trust proxy', true);
  const ref = app.get(ReferensiConsumer);
  await broker.subscribe(TOPIK.REFERENSI_DIUBAH, `${cfg.serviceName}.referensi`, (e) => ref.tangani(e));
  const log = new Logger('OutboxRelay');
  const relay = new OutboxRelay(app.get<Pool>(POOL_WORKER), broker, { skema: SKEMA, source: cfg.serviceName, intervalMs: cfg.outboxIntervalMs, log: (m) => log.warn(m) });
  return { app, broker, relay };
}
