import { expect } from 'vitest';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any; type Page = any;

const require = createRequire(import.meta.url);
export const BASE = process.env.WEB_URL ?? 'http://localhost:3000';
export const NPSN = '20100001';
export const TAHUN = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 4));
export const HARI_INI = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

const AKUN = {
  bendahara: ['bendahara@smpn1.example', '8a000000-0000-4000-8000-000000000001'],
  kepsek: ['kepsek@smpn1.example', '8a000000-0000-4000-8000-000000000003'],
  adminDinas: ['admin@dinas3201.example', '8a000000-0000-4000-8000-000000000005'],
  balai: ['admin@balai.example', '8a000000-0000-4000-8000-000000000006'],
  auditor: ['auditor@inspektorat.example', '8a000000-0000-4000-8000-000000000007'],
  pemantau: ['pemantau@pusat.example', '8a000000-0000-4000-8000-000000000008'],
  verifikator: ['verifikator@dinas3201.example', '8a000000-0000-4000-8000-000000000004'],
  operator: ['bendahara@smpn1.example', '8a000000-0000-4000-8000-000000000002'],
  direktorat: ['admin@dit-smp.example', '8a000000-0000-4000-8000-000000000009'],
  ditjen: ['admin@ditjen-paud.example', '8a000000-0000-4000-8000-00000000000a'],
  timkerja: ['timkerja@dit-smp.example', '8a000000-0000-4000-8000-00000000000b'],
} as const;
export type Akun = keyof typeof AKUN;

let browser: Browser | undefined;
export async function peramban(): Promise<Browser> {
  browser ??= await (require('playwright') as { chromium: { launch(): Promise<Browser> } }).chromium.launch();
  return browser;
}
export async function tutupPeramban() { await browser?.close(); browser = undefined; }

/** Masuk (mode dev) dan pilih peran aktif; jawaban dialog prompt bisa diatur per halaman. */
export async function masuk(akun: Akun, jawabPrompt: () => string | null = () => null): Promise<Page> {
  const ctx = await (await peramban()).newContext({ viewport: { width: 1280, height: 800 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  const p = await ctx.newPage();
  p.on('dialog', (d) => { if (d.type() !== 'prompt') return void d.accept(); const j = jawabPrompt(); return j === null ? d.dismiss() : d.accept(j); });
  const [email, peran] = AKUN[akun];
  expect((await p.request.post(`${BASE}/api/v1/auth/dev-masuk`, { data: { email } })).ok()).toBe(true);
  expect((await p.request.put(`${BASE}/api/v1/me/peran-aktif`, { data: { peranPenggunaId: peran } })).ok()).toBe(true);
  return p;
}
export async function buka(p: Page, path: string) { await p.goto(BASE + path); await p.waitForLoadState('networkidle'); }

/** Panggil API lewat gateway web memakai sesi halaman (cookie). */
export async function api<T = unknown>(p: Page, metode: 'GET' | 'POST' | 'PUT', path: string, data?: unknown, idem = false): Promise<{ status: number; body: T }> {
  const r = await p.request.fetch(`${BASE}/api/v1${path}`, { method: metode, data: data as object | undefined, headers: idem ? { 'idempotency-key': randomUUID() } : {} });
  return { status: r.status(), body: (await r.json().catch(() => null)) as T };
}
