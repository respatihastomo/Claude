import { NextRequest, NextResponse } from 'next/server';

/** Halaman aplikasi wajib bersesi; tanpa cookie sesi diarahkan ke /masuk (validitas sesi diperiksa svc-identitas). */
export function middleware(req: NextRequest) {
  if (req.cookies.get('arkas_sesi')) return NextResponse.next();
  const u = req.nextUrl.clone();
  u.pathname = '/masuk';
  u.search = `?kembali=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(u);
}

export const config = { matcher: ['/((?!masuk|api|_next|favicon.ico).*)'] };
