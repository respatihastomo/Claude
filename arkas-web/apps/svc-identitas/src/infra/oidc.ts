import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import type { KonfigurasiOidc } from '../config';

interface Discovery { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string; end_session_endpoint?: string }
export interface KlaimIdp { iss: string; sub: string; email?: string; email_verified?: boolean; name?: string }

const b64url = (b: Buffer) => b.toString('base64url');
export const acak = (n = 32) => b64url(randomBytes(n));
export const tantanganPkce = (verifier: string) => b64url(createHash('sha256').update(verifier).digest());

/**
 * Klien OpenID Connect (Authorization Code + PKCE S256) untuk SSO penyedia identitas (UC-01).
 * ID token diverifikasi dengan JWKS penyedia: tanda tangan, iss, aud, exp, dan nonce.
 */
export class KlienOidc {
  private discovery?: Promise<Discovery>;
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly cfg: KonfigurasiOidc) {}

  private muat(): Promise<Discovery> {
    this.discovery ??= fetch(`${this.cfg.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10_000) })
      .then(async (r) => {
        if (!r.ok) throw new Error(`discovery OIDC gagal: HTTP ${r.status}`);
        const d = (await r.json()) as Discovery;
        if (d.issuer !== this.cfg.issuer) throw new Error(`issuer discovery (${d.issuer}) tidak sama dengan OIDC_ISSUER`);
        return d;
      })
      .catch((e) => { this.discovery = undefined; throw e; });
    return this.discovery;
  }

  async urlOtorisasi(p: { state: string; nonce: string; verifier: string }): Promise<string> {
    const d = await this.muat();
    const u = new URL(d.authorization_endpoint);
    u.search = new URLSearchParams({
      response_type: 'code', client_id: this.cfg.clientId, redirect_uri: this.cfg.redirectUri, scope: this.cfg.scope,
      state: p.state, nonce: p.nonce, code_challenge: tantanganPkce(p.verifier), code_challenge_method: 'S256',
    }).toString();
    return u.toString();
  }

  async tukarKode(kode: string, verifier: string, nonce: string): Promise<KlaimIdp> {
    const d = await this.muat();
    const body = new URLSearchParams({ grant_type: 'authorization_code', code: kode, redirect_uri: this.cfg.redirectUri, client_id: this.cfg.clientId, code_verifier: verifier });
    if (this.cfg.clientSecret) body.set('client_secret', this.cfg.clientSecret);
    const r = await fetch(d.token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`penukaran kode OIDC gagal: HTTP ${r.status}`);
    const { id_token: idToken } = (await r.json()) as { id_token?: string };
    if (!idToken) throw new Error('respons token OIDC tanpa id_token');
    this.jwks ??= createRemoteJWKSet(new URL(d.jwks_uri));
    const { payload } = await jwtVerify(idToken, this.jwks, { issuer: d.issuer, audience: this.cfg.clientId, algorithms: ['RS256', 'ES256', 'PS256'] });
    if ((payload as JWTPayload & { nonce?: string }).nonce !== nonce) throw new Error('nonce ID token tidak cocok');
    const p = payload as JWTPayload & Omit<KlaimIdp, 'iss' | 'sub'>;
    return { iss: p.iss!, sub: p.sub!, email: p.email?.toLowerCase(), email_verified: p.email_verified === true, name: p.name };
  }
}
