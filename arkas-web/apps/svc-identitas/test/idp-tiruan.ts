/** IdP OpenID Connect tiruan untuk uji: discovery, JWKS, dan token endpoint yang memeriksa PKCE S256 & menandatangani ID token. */
import http from 'node:http';
import { createHash } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, KeyLike, SignJWT } from 'jose';

export interface Hibah { challenge: string; nonce: string; sub: string; email?: string; emailVerified?: boolean; nonceSalah?: boolean }

export async function idpTiruan(clientId: string) {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'idp-1', alg: 'RS256', use: 'sig' };
  const hibah = new Map<string, Hibah>();
  let issuer = '';
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url!, issuer);
    const json = (s: number, b: unknown) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
    if (u.pathname === '/.well-known/openid-configuration') {
      return json(200, { issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks` });
    }
    if (u.pathname === '/jwks') return json(200, { keys: [jwk] });
    if (u.pathname === '/token' && req.method === 'POST') {
      let body = ''; for await (const c of req) body += c;
      const p = new URLSearchParams(body);
      const h = hibah.get(p.get('code') ?? '');
      if (!h || p.get('client_id') !== clientId || p.get('grant_type') !== 'authorization_code') return json(400, { error: 'invalid_grant' });
      const challenge = createHash('sha256').update(p.get('code_verifier') ?? '').digest('base64url');
      if (challenge !== h.challenge) return json(400, { error: 'invalid_grant', error_description: 'PKCE gagal' });
      hibah.delete(p.get('code')!);
      const idToken = await new SignJWT({ nonce: h.nonceSalah ? 'salah' : h.nonce, ...(h.email ? { email: h.email, email_verified: h.emailVerified ?? true } : {}) })
        .setProtectedHeader({ alg: 'RS256', kid: 'idp-1' }).setIssuer(issuer).setAudience(clientId).setSubject(h.sub)
        .setIssuedAt().setExpirationTime('5m').sign(privateKey as KeyLike);
      return json(200, { access_token: 'x', token_type: 'Bearer', id_token: idToken });
    }
    json(404, {});
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    issuer,
    /** Mensimulasikan pengguna menyetujui di halaman IdP: kembalikan kode untuk URL otorisasi yang diberikan svc-identitas. */
    setujui(urlOtorisasi: string, h: Omit<Hibah, 'challenge' | 'nonce'>): string {
      const q = new URL(urlOtorisasi).searchParams;
      const kode = `kode-${Math.random().toString(36).slice(2)}`;
      hibah.set(kode, { ...h, challenge: q.get('code_challenge')!, nonce: q.get('nonce')! });
      return kode;
    },
    tutup: () => new Promise<void>((r) => server.close(() => r())),
  };
}
