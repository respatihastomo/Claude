import { NextRequest, NextResponse } from 'next/server';

/** Dev saja: ganti peran aktif (pengganti "pilih peran aktif" UC-01 di svc-identitas). */
export async function POST(req: NextRequest) {
  const { peran } = (await req.json()) as { peran?: string };
  const p = peran === 'KEPSEK' || peran === 'VERIFIKATOR_DINAS' ? peran : 'BENDAHARA';
  const res = NextResponse.json({ peran: p });
  res.cookies.set('peran', p, { httpOnly: true, sameSite: 'lax', path: '/' });
  return res;
}
