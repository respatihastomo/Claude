import { createPrivateKey, createPublicKey, KeyObject, randomUUID } from 'node:crypto';
import { calculateJwkThumbprint, exportJWK, JWK, SignJWT } from 'jose';

export interface KlaimToken { sub: string; peran: string; npsn?: string; wilayah?: string; direktorat: string[]; ditjen?: string; sid: string }

/** Penerbit JWT internal (RS256, berumur pendek) dan penyedia JWKS untuk API Gateway & layanan lain. */
export class PenerbitToken {
  private readonly privat: KeyObject;
  private readonly publik: KeyObject;
  private kid?: Promise<string>;

  constructor(pem: string, private readonly issuer: string, private readonly audience: string, private readonly ttlDetik: number) {
    this.privat = createPrivateKey(pem);
    this.publik = createPublicKey(this.privat);
  }

  private async kunciId(): Promise<string> {
    this.kid ??= exportJWK(this.publik).then((j) => calculateJwkThumbprint(j));
    return this.kid;
  }

  async terbitkan(k: KlaimToken): Promise<{ accessToken: string; expiresIn: number }> {
    const accessToken = await new SignJWT({ peran: k.peran, ...(k.npsn ? { npsn: k.npsn } : {}), ...(k.wilayah ? { wilayah: k.wilayah } : {}),
      direktorat: k.direktorat, ...(k.ditjen ? { ditjen: k.ditjen } : {}), sid: k.sid })
      .setProtectedHeader({ alg: 'RS256', kid: await this.kunciId(), typ: 'JWT' })
      .setSubject(k.sub).setIssuer(this.issuer).setAudience(this.audience).setIssuedAt().setJti(randomUUID())
      .setExpirationTime(`${this.ttlDetik}s`).sign(this.privat);
    return { accessToken, expiresIn: this.ttlDetik };
  }

  async jwks(): Promise<{ keys: JWK[] }> {
    return { keys: [{ ...(await exportJWK(this.publik)), kid: await this.kunciId(), alg: 'RS256', use: 'sig' }] };
  }

  publicPem(): string {
    return this.publik.export({ type: 'spki', format: 'pem' }).toString();
  }
}
