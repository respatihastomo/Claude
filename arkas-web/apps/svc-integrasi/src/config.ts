import fs from 'node:fs';
import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().int().default(3109),
  DATABASE_URL: z.string().url(),
  DATABASE_WORKER_URL: z.string().url(),
  BROKER: z.enum(['memory', 'kafka', 'http']).default('memory'),
  BROKER_BROKERS: z.string().default('localhost:9092'),
  BROKER_HTTP_TARGETS: z.string().default(''),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_PUBLIC_KEY_FILE: z.string().optional(),
  JWT_ISSUER: z.string().default('arkas-identitas'),
  JWT_AUDIENCE: z.string().default('arkas-api'),
  DEV_EVENTS_ENABLED: z.enum(['true', 'false']).default('false'),
  INTERNAL_EVENTS_TOKEN: z.string().min(16).optional(),
  /** kunci penandatangan token OAuth2 Mitra (HS256), minimal 32 karakter */
  MITRA_TOKEN_SECRET: z.string().min(32),
  /** jumlah proxy tepercaya di depan layanan (API Gateway) untuk membaca IP asli dari X-Forwarded-For */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  OUTBOX_INTERVAL_MS: z.coerce.number().int().default(500),
  PENGIRIM_INTERVAL_MS: z.coerce.number().int().default(1000),
  PENGIRIM_MAKS_PERCOBAAN: z.coerce.number().int().default(8),
  OTEL_SERVICE_NAME: z.string().default('svc-integrasi'),
});

export interface Konfigurasi {
  port: number; databaseUrl: string; databaseWorkerUrl: string;
  broker: 'memory' | 'kafka' | 'http'; brokerBrokers: string[]; brokerHttpTargets?: string;
  jwtPublicKey: string; jwtIssuer: string; jwtAudience: string; devEvents: boolean; internalEventsToken?: string;
  mitraTokenSecret: string; trustProxy: number;
  outboxIntervalMs: number; pengirimIntervalMs: number; pengirimMaksPercobaan: number; serviceName: string;
}

export function muatKonfigurasi(env: NodeJS.ProcessEnv = process.env): Konfigurasi {
  const e = Env.parse(env);
  const pem = e.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') ?? (e.JWT_PUBLIC_KEY_FILE ? fs.readFileSync(e.JWT_PUBLIC_KEY_FILE, 'utf8') : undefined);
  if (!pem) throw new Error('JWT_PUBLIC_KEY atau JWT_PUBLIC_KEY_FILE wajib diisi');
  const devEvents = e.DEV_EVENTS_ENABLED === 'true';
  if ((devEvents || e.BROKER === 'http') && !e.INTERNAL_EVENTS_TOKEN) throw new Error('INTERNAL_EVENTS_TOKEN wajib bila DEV_EVENTS_ENABLED=true atau BROKER=http');
  return {
    port: e.PORT, databaseUrl: e.DATABASE_URL, databaseWorkerUrl: e.DATABASE_WORKER_URL, broker: e.BROKER,
    brokerBrokers: e.BROKER_BROKERS.split(',').map((s) => s.trim()), brokerHttpTargets: e.BROKER_HTTP_TARGETS,
    jwtPublicKey: pem, jwtIssuer: e.JWT_ISSUER, jwtAudience: e.JWT_AUDIENCE, devEvents, internalEventsToken: e.INTERNAL_EVENTS_TOKEN,
    mitraTokenSecret: e.MITRA_TOKEN_SECRET, trustProxy: e.TRUST_PROXY,
    outboxIntervalMs: e.OUTBOX_INTERVAL_MS, pengirimIntervalMs: e.PENGIRIM_INTERVAL_MS, pengirimMaksPercobaan: e.PENGIRIM_MAKS_PERCOBAAN, serviceName: e.OTEL_SERVICE_NAME,
  };
}
