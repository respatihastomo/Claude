import { createPublicKey, KeyObject } from 'node:crypto';
import { jwtVerify } from 'jose';
import { z } from 'zod';
import { PERAN } from '../context/peran';

/** Klaim JWT internal yang diterbitkan svc-identitas dan diteruskan API Gateway. */
export const KlaimInternal = z.object({
  sub: z.string().uuid(),
  peran: z.enum(PERAN),
  npsn: z.string().regex(/^\d{8}$/).optional(),
  wilayah: z.string().optional(),
  direktorat: z.array(z.string()).default([]),
  ditjen: z.string().optional(),
  /** id sesi svc-identitas */
  sid: z.string().optional(),
});
export type KlaimInternal = z.infer<typeof KlaimInternal>;

export class VerifikatorJwt {
  private readonly key: KeyObject;
  constructor(publicKeyPem: string, private readonly issuer: string, private readonly audience: string) {
    this.key = createPublicKey(publicKeyPem);
  }

  async verifikasi(token: string): Promise<KlaimInternal> {
    const { payload } = await jwtVerify(token, this.key, { issuer: this.issuer, audience: this.audience, algorithms: ['RS256', 'ES256'] });
    return KlaimInternal.parse(payload);
  }
}
