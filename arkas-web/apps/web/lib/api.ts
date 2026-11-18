import type { Problem } from '@arkas/kontrak';

export class GalatApi extends Error {
  constructor(public readonly status: number, public readonly problem: Problem) {
    super(problem.detail ?? problem.title);
  }
}

/** Kode 16 — klien API: problem+json -> GalatApi; ETag ikut dikembalikan untuk If-Match. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<{ data: T; etag: string | null }> {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (init.json !== undefined) { headers.set('content-type', 'application/json'); body = JSON.stringify(init.json); }
  const res = await fetch(`/api/v1${path}`, { ...init, headers, body, cache: 'no-store' });
  const teks = await res.text();
  const isi = teks ? JSON.parse(teks) : null;
  if (!res.ok) throw new GalatApi(res.status, isi ?? { type: 'about:blank', title: res.statusText, status: res.status, kode: 'GALAT' });
  return { data: isi as T, etag: res.headers.get('etag') };
}

export const kunciIdempoten = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
