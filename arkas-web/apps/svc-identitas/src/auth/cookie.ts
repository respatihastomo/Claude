import type { Request, Response } from 'express';

export const COOKIE_SESI = 'arkas_sesi';
export const COOKIE_OIDC = 'arkas_oidc';

export function bacaCookie(req: Request, nama: string): string | undefined {
  for (const bagian of (req.headers.cookie ?? '').split(';')) {
    const i = bagian.indexOf('=');
    if (i > 0 && bagian.slice(0, i).trim() === nama) return decodeURIComponent(bagian.slice(i + 1).trim());
  }
  return undefined;
}

/** HttpOnly + SameSite=Lax (+ Secure di produksi): token tidak terbaca skrip dan tidak terkirim pada POST lintas situs. */
export function pasangCookie(res: Response, nama: string, nilai: string, opsi: { secure: boolean; maxAgeDetik: number; path?: string }) {
  res.cookie(nama, nilai, { httpOnly: true, sameSite: 'lax', secure: opsi.secure, maxAge: opsi.maxAgeDetik * 1000, path: opsi.path ?? '/' });
}
export function hapusCookie(res: Response, nama: string, secure: boolean, path = '/') {
  res.clearCookie(nama, { httpOnly: true, sameSite: 'lax', secure, path });
}
