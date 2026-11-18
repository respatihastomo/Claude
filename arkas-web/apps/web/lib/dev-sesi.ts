import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { createPrivateKey, KeyObject } from 'node:crypto';
import { SignJWT } from 'jose';

/**
 * PENGGANTI DEV untuk svc-identitas + API Gateway. Di produksi, sesi SSO dan JWT internal diterbitkan svc-identitas
 * dan gateway memvalidasi token. Di sini satu NPSN contoh dan pengguna tetap per peran.
 */
export const PERAN_DEV = {
  BENDAHARA: { sub: '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e01', nama: 'Sri Wahyuni (Bendahara)' },
  KEPSEK: { sub: '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e02', nama: 'Drs. Bambang S. (Kepala Sekolah)' },
  VERIFIKATOR_DINAS: { sub: '6f1d6c0e-0d3a-4b8e-9a51-1b2f3c4d5e03', nama: 'Rina A. (Verifikator Dinas, wilayah 3201)' },
} as const;
export const WILAYAH_DEV = process.env.DEV_WILAYAH ?? '3201';
export type PeranDev = keyof typeof PERAN_DEV;
export const NPSN_DEV = process.env.DEV_NPSN ?? '20100001';

let kunci: KeyObject | undefined;
function kunciPrivat(): KeyObject {
  kunci ??= createPrivateKey(fs.readFileSync(process.env.DEV_JWT_PRIVATE_KEY_FILE ?? path.resolve(process.cwd(), '../../.dev-keys/private.pem')));
  return kunci;
}

export function peranDari(cookie: string | undefined): PeranDev {
  return cookie === 'KEPSEK' || cookie === 'VERIFIKATOR_DINAS' ? cookie : 'BENDAHARA';
}

export async function tokenDev(peran: PeranDev): Promise<string> {
  const cakupan = peran === 'VERIFIKATOR_DINAS' ? { wilayah: WILAYAH_DEV } : { npsn: NPSN_DEV };
  return new SignJWT({ peran, ...cakupan, direktorat: [] })
    .setProtectedHeader({ alg: 'RS256' }).setSubject(PERAN_DEV[peran].sub).setIssuer('arkas-identitas').setAudience('arkas-api')
    .setIssuedAt().setExpirationTime('15m').sign(kunciPrivat());
}
