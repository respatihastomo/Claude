import { CanActivate, createParamDecorator, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { Pool } from 'pg';
import { jwtVerify, SignJWT } from 'jose';
import { GalatHttp } from '@arkas/common-ms';
import { KONFIGURASI, POOL_WORKER } from '../infra/tokens';
import type { Konfigurasi } from '../config';

/** 12.4: token OAuth2 client credentials berumur 10 menit; HMAC-SHA256 atas "{timestamp}.{body mentah}", umur maks 5 menit. */
export const UMUR_TOKEN_DETIK = 600;
export const UMUR_PESAN_DETIK = 300;
const AUD = 'arkas-mitra';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const tandaTangan = (rahasia: string, ts: string, body: string) => createHmac('sha256', rahasia).update(`${ts}.${body}`).digest('hex');
export const rahasiaAcak = (n = 32) => randomBytes(n).toString('base64url');
export function samaWaktuKonstan(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
const kunciToken = (s: string) => new TextEncoder().encode(s);
export const terbitkanTokenMitra = (rahasia: string, mitraKode: string) =>
  new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(mitraKode).setAudience(AUD).setIssuer('arkas-integrasi')
    .setIssuedAt().setExpirationTime(`${UMUR_TOKEN_DETIK}s`).sign(kunciToken(rahasia));

/** Normalisasi alamat IPv4 yang dipetakan IPv6 (::ffff:127.0.0.1). */
export const normalIp = (ip: string | undefined) => (ip ?? '').replace(/^::ffff:/, '');

export interface MitraTerverifikasi { kode: string; nama: string; baseUrl: string; hmacRahasia: string }
type ReqMitra = Request & { rawBody?: Buffer; mitra?: MitraTerverifikasi };

/**
 * Penjaga /mitra/v1/* (kecuali oauth/token): Bearer token Mitra + Mitra AKTIF + IP terdaftar + tanda tangan HMAC
 * (X-Timestamp detik Unix, X-Signature hex) atas body mentah, umur pesan <= 5 menit.
 */
@Injectable()
export class MitraGuard implements CanActivate {
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool, @Inject(KONFIGURASI) private readonly cfg: Konfigurasi) {}

  async canActivate(c: ExecutionContext): Promise<boolean> {
    const req = c.switchToHttp().getRequest<ReqMitra>();
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer ')) throw new GalatHttp(401, 'TOKEN_MITRA_WAJIB', 'Authorization: Bearer <token Mitra> wajib');
    let kode: string;
    try {
      const { payload } = await jwtVerify(auth.slice(7), kunciToken(this.cfg.mitraTokenSecret), { audience: AUD, issuer: 'arkas-integrasi', algorithms: ['HS256'] });
      kode = String(payload.sub);
    } catch {
      throw new GalatHttp(401, 'TOKEN_MITRA_TIDAK_VALID', 'Token Mitra tidak valid atau kedaluwarsa');
    }
    const r = await this.pool.query<{ kode: string; nama: string; base_url: string; hmac_rahasia: string; ip_diizinkan: string[]; status: string }>(
      'SELECT kode, nama, base_url, hmac_rahasia, ip_diizinkan, status FROM integrasi.mitra_siplah WHERE kode = $1', [kode]);
    const m = r.rows[0];
    if (!m || m.status !== 'AKTIF') throw new GalatHttp(403, 'MITRA_NONAKTIF', 'Mitra tidak aktif');
    const ip = normalIp(req.ip);
    if (!m.ip_diizinkan.map(normalIp).includes(ip)) throw new GalatHttp(403, 'IP_TIDAK_DIIZINKAN', `Alamat ${ip} tidak terdaftar untuk Mitra ${kode}`);

    const ts = String(req.headers['x-timestamp'] ?? '');
    const sig = String(req.headers['x-signature'] ?? '').toLowerCase();
    if (!/^\d{10}$/.test(ts) || !/^[0-9a-f]{64}$/.test(sig)) throw new GalatHttp(401, 'TANDA_TANGAN_WAJIB', 'X-Timestamp (detik Unix) dan X-Signature (HMAC-SHA256 hex) wajib');
    if (Math.abs(Date.now() / 1000 - Number(ts)) > UMUR_PESAN_DETIK) throw new GalatHttp(401, 'PESAN_KEDALUWARSA', 'Umur pesan melebihi 5 menit');
    const body = req.rawBody?.toString('utf8') ?? '';
    if (!samaWaktuKonstan(tandaTangan(m.hmac_rahasia, ts, body), sig)) throw new GalatHttp(401, 'TANDA_TANGAN_TIDAK_VALID', 'Tanda tangan HMAC tidak cocok');
    req.mitra = { kode: m.kode, nama: m.nama, baseUrl: m.base_url, hmacRahasia: m.hmac_rahasia };
    return true;
  }
}

export const Mitra = createParamDecorator((_: unknown, c: ExecutionContext) => c.switchToHttp().getRequest<ReqMitra>().mitra!);
