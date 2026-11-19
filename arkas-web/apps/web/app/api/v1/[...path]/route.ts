import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

/**
 * Pengganti API Gateway pada lingkungan dev (11.1 / 11.2). Rute identitas diteruskan apa adanya (cookie sesi ikut);
 * rute layanan lain: cookie sesi ditukar ke svc-identitas menjadi JWT internal berumur pendek, lalu diteruskan sebagai Bearer.
 */
const SVC = {
  referensi: process.env.SVC_REFERENSI_URL ?? 'http://localhost:3103',
  identitas: process.env.SVC_IDENTITAS_URL ?? 'http://localhost:3104',
  tatausaha: process.env.SVC_PENATAUSAHAAN_URL ?? 'http://localhost:3105',
  pelaporan: process.env.SVC_PELAPORAN_URL ?? 'http://localhost:3106',
  perencanaan: process.env.SVC_PERENCANAAN_URL ?? 'http://localhost:3107',
  audit: process.env.SVC_AUDIT_URL ?? 'http://localhost:3108',
};
function tujuan(path: string[]): keyof typeof SVC {
  if (path[0] === 'auth' || path[0] === 'me' || (path[0] === 'admin' && path[1] === 'pengguna')) return 'identitas';
  if (path[0] === 'referensi' || path[0] === 'dinas' || (path[0] === 'admin' && path[1] === 'referensi')) return 'referensi';
  // 11.2.4: /sekolah/{npsn}, /sekolah/{npsn}/{rekening,sumber-dana} -> svc-referensi
  if (path[0] === 'sekolah' && (path.length === 2 || path[2] === 'rekening' || path[2] === 'sumber-dana')) return 'referensi';
  if (path[0] === 'laporan') return 'pelaporan';
  if (path[0] === 'audit') return 'audit'; // 11.2.16
  if (path[0] === 'kertas-kerja' || path[0] === 'penelaahan') return 'perencanaan';
  if (path[0] === 'sekolah' && (path[2] === 'kertas-kerja' || path[2] === 'pagu')) return 'perencanaan';
  return 'tatausaha';
}
const TERUSKAN = ['content-type', 'idempotency-key', 'if-match', 'accept', 'user-agent'];
const BALIK = ['content-type', 'etag', 'location', 'idempotent-replayed', 'content-disposition', 'cache-control'];

async function teruskan(req: NextRequest, { params }: { params: { path: string[] } }) {
  const layanan = tujuan(params.path);
  const url = new URL(`/api/v1/${params.path.map(encodeURIComponent).join('/')}`, SVC[layanan]);
  url.search = req.nextUrl.search;
  const h = new Headers();
  for (const k of TERUSKAN) { const v = req.headers.get(k); if (v) h.set(k, v); }
  h.set('x-request-id', randomUUID());
  const sesi = cookies().get('arkas_sesi')?.value;
  const cookieSesi = sesi ? `arkas_sesi=${encodeURIComponent(sesi)}` : '';

  // Rute sesi (auth/*, me*) memakai cookie; rute lain — termasuk /admin/pengguna di svc-identitas — memakai JWT internal.
  const ruteSesi = params.path[0] === 'auth' || params.path[0] === 'me';
  if (ruteSesi) {
    if (req.headers.get('cookie')) h.set('cookie', req.headers.get('cookie')!);
  } else {
    // Tukar sesi -> JWT internal. Tanpa sesi/peran aktif: kembalikan galat svc-identitas apa adanya (401/409).
    const t = await fetch(`${SVC.identitas}/api/v1/auth/token`, { method: 'POST', headers: { cookie: cookieSesi }, cache: 'no-store' });
    if (!t.ok) return new Response(await t.arrayBuffer(), { status: t.status, headers: { 'content-type': t.headers.get('content-type') ?? 'application/problem+json' } });
    h.set('authorization', `Bearer ${((await t.json()) as { accessToken: string }).accessToken}`);
  }
  const res = await fetch(url, { method: req.method, headers: h, body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text(), cache: 'no-store', redirect: 'manual' });
  const out = new Headers();
  for (const k of BALIK) { const v = res.headers.get(k); if (v) out.set(k, v); }
  for (const c of res.headers.getSetCookie?.() ?? []) out.append('set-cookie', c);
  return new Response(res.status === 204 || res.status === 304 ? null : await res.arrayBuffer(), { status: res.status, headers: out });
}

export { teruskan as GET, teruskan as POST, teruskan as PUT, teruskan as DELETE };
