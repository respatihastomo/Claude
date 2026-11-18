import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { peranDari, tokenDev } from '@/lib/dev-sesi';

/** Proxy /api/v1/* -> microservice pemilik domain (peran API Gateway pada lingkungan dev; pemetaan 11.2). */
const SVC_TATAUSAHA = process.env.SVC_PENATAUSAHAAN_URL ?? 'http://localhost:3105';
const SVC_PELAPORAN = process.env.SVC_PELAPORAN_URL ?? 'http://localhost:3106';
const SVC_PERENCANAAN = process.env.SVC_PERENCANAAN_URL ?? 'http://localhost:3107';
/** 11.2.8–11.2.12: /kertas-kerja*, /penelaahan, /sekolah/{npsn}/{kertas-kerja,pagu}* -> svc-perencanaan; /laporan* -> svc-pelaporan. */
function tujuan(path: string[]): string {
  if (path[0] === 'laporan') return SVC_PELAPORAN;
  if (path[0] === 'kertas-kerja' || path[0] === 'penelaahan') return SVC_PERENCANAAN;
  if (path[0] === 'sekolah' && (path[2] === 'kertas-kerja' || path[2] === 'pagu')) return SVC_PERENCANAAN;
  return SVC_TATAUSAHA;
}
const TERUSKAN = ['content-type', 'idempotency-key', 'if-match', 'accept'];
const BALIK = ['content-type', 'etag', 'location', 'idempotent-replayed', 'content-disposition', 'cache-control'];

async function teruskan(req: NextRequest, { params }: { params: { path: string[] } }) {
  const url = new URL(`/api/v1/${params.path.map(encodeURIComponent).join('/')}`, tujuan(params.path));
  url.search = req.nextUrl.search;
  const h = new Headers();
  for (const k of TERUSKAN) { const v = req.headers.get(k); if (v) h.set(k, v); }
  h.set('authorization', `Bearer ${await tokenDev(peranDari(cookies().get('peran')?.value))}`);
  h.set('x-request-id', randomUUID());
  const res = await fetch(url, { method: req.method, headers: h, body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text(), cache: 'no-store' });
  const out = new Headers();
  for (const k of BALIK) { const v = res.headers.get(k); if (v) out.set(k, v); }
  return new Response(res.status === 204 ? null : await res.arrayBuffer(), { status: res.status, headers: out });
}

export { teruskan as GET, teruskan as POST, teruskan as PUT, teruskan as DELETE };
