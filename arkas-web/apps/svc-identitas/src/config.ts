import fs from 'node:fs';
import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().int().default(3104),
  DATABASE_URL: z.string().url(),
  DATABASE_WORKER_URL: z.string().url(),
  BROKER: z.enum(['memory', 'kafka', 'http']).default('memory'),
  BROKER_BROKERS: z.string().default('localhost:9092'),
  BROKER_HTTP_TARGETS: z.string().default(''),
  INTERNAL_EVENTS_TOKEN: z.string().min(16).optional(),
  // 16.1: kunci privat & OIDC HANYA di svc-identitas
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PRIVATE_KEY_FILE: z.string().optional(),
  JWT_ISSUER: z.string().default('arkas-identitas'),
  JWT_AUDIENCE: z.string().default('arkas-api'),
  TOKEN_TTL_DETIK: z.coerce.number().int().min(60).max(3600).default(900),
  SESI_TTL_JAM: z.coerce.number().min(1).max(24).default(8),
  SESI_IDLE_MENIT: z.coerce.number().min(5).max(480).default(60),
  COOKIE_SECURE: z.enum(['true', 'false']).default('true'),
  /** rahasia HMAC untuk cookie transaksi OIDC (state/nonce/PKCE) — min. 32 karakter */
  OIDC_STATE_SECRET: z.string().min(32),
  OIDC_ISSUER: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_REDIRECT_URI: z.string().url().optional(),
  OIDC_SCOPE: z.string().default('openid email profile'),
  /** HANYA dev: masuk sebagai pengguna terdaftar tanpa SSO */
  AUTH_DEV_ENABLED: z.enum(['true', 'false']).default('false'),
  OUTBOX_INTERVAL_MS: z.coerce.number().int().default(500),
  OTEL_SERVICE_NAME: z.string().default('svc-identitas'),
});

export interface KonfigurasiOidc { issuer: string; clientId: string; clientSecret?: string; redirectUri: string; scope: string }
export interface Konfigurasi {
  port: number; databaseUrl: string; databaseWorkerUrl: string;
  broker: 'memory' | 'kafka' | 'http'; brokerBrokers: string[]; brokerHttpTargets?: string; internalEventsToken?: string;
  jwtPrivateKey: string; jwtIssuer: string; jwtAudience: string; tokenTtlDetik: number;
  sesiTtlJam: number; sesiIdleMenit: number; cookieSecure: boolean; oidcStateSecret: string; oidc?: KonfigurasiOidc;
  authDev: boolean; outboxIntervalMs: number; serviceName: string;
}

export function muatKonfigurasi(env: NodeJS.ProcessEnv = process.env): Konfigurasi {
  const e = Env.parse(env);
  const kunci = e.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? (e.JWT_PRIVATE_KEY_FILE ? fs.readFileSync(e.JWT_PRIVATE_KEY_FILE, 'utf8') : undefined);
  if (!kunci) throw new Error('JWT_PRIVATE_KEY atau JWT_PRIVATE_KEY_FILE wajib diisi');
  const adaOidc = [e.OIDC_ISSUER, e.OIDC_CLIENT_ID, e.OIDC_REDIRECT_URI].filter(Boolean).length;
  if (adaOidc !== 0 && adaOidc !== 3) throw new Error('OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_REDIRECT_URI diisi bersama');
  if (adaOidc === 0 && e.AUTH_DEV_ENABLED !== 'true') throw new Error('Tidak ada metode masuk: isi OIDC_* atau AUTH_DEV_ENABLED=true (dev)');
  if (e.BROKER === 'http' && !e.INTERNAL_EVENTS_TOKEN) throw new Error('INTERNAL_EVENTS_TOKEN wajib bila BROKER=http');
  return {
    port: e.PORT, databaseUrl: e.DATABASE_URL, databaseWorkerUrl: e.DATABASE_WORKER_URL, broker: e.BROKER,
    brokerBrokers: e.BROKER_BROKERS.split(',').map((s) => s.trim()), brokerHttpTargets: e.BROKER_HTTP_TARGETS, internalEventsToken: e.INTERNAL_EVENTS_TOKEN,
    jwtPrivateKey: kunci, jwtIssuer: e.JWT_ISSUER, jwtAudience: e.JWT_AUDIENCE, tokenTtlDetik: e.TOKEN_TTL_DETIK,
    sesiTtlJam: e.SESI_TTL_JAM, sesiIdleMenit: e.SESI_IDLE_MENIT, cookieSecure: e.COOKIE_SECURE === 'true', oidcStateSecret: e.OIDC_STATE_SECRET,
    oidc: adaOidc ? { issuer: e.OIDC_ISSUER!, clientId: e.OIDC_CLIENT_ID!, clientSecret: e.OIDC_CLIENT_SECRET, redirectUri: e.OIDC_REDIRECT_URI!, scope: e.OIDC_SCOPE } : undefined,
    authDev: e.AUTH_DEV_ENABLED === 'true', outboxIntervalMs: e.OUTBOX_INTERVAL_MS, serviceName: e.OTEL_SERVICE_NAME,
  };
}
