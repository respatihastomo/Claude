import { NextRequest, NextResponse } from 'next/server';

/** Dev saja: ganti peran aktif (pengganti "pilih peran aktif" UC-01 di svc-identitas). */
export async function POST(req: NextRequest) {
  const { peran } = (await req.json()) as { peran?: string };
  const res = NextResponse.json({ peran: peran === 'KEPSEK' ? 'KEPSEK' : 'BENDAHARA' });
  res.cookies.set('peran', peran === 'KEPSEK' ? 'KEPSEK' : 'BENDAHARA', { httpOnly: true, sameSite: 'lax', path: '/' });
  return res;
}
