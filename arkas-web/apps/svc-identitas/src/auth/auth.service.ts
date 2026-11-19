import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { jwtVerify, SignJWT } from 'jose';
import { AturanError } from '@arkas/aturan';
import { GalatHttp } from '@arkas/common-ms';
import type { MeDto, PeranPenggunaDto } from '@arkas/kontrak';
import type { Konfigurasi } from '../config';
import { acak, KlienOidc } from '../infra/oidc';
import { PenerbitToken } from '../infra/penerbit';
import { KONFIGURASI, POOL_WORKER } from '../infra/tokens';
import * as repo from './repo';

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
/** Hanya jalur relatif di aplikasi yang sama (mencegah open redirect). */
export const kembaliAman = (k: string | undefined) => (k && /^\/(?![/\\])[\w\-./?=&%#]*$/.test(k) ? k : '/');

interface Transaksi { state: string; nonce: string; verifier: string; kembali: string }

/** UC-01 — masuk lewat SSO, sesi, pilih peran aktif, penerbitan JWT internal. */
@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);
  private readonly rahasia: Uint8Array;

  constructor(
    @Inject(KONFIGURASI) private readonly cfg: Konfigurasi,
    @Inject(POOL_WORKER) private readonly pool: Pool,
    @Inject(PenerbitToken) private readonly penerbit: PenerbitToken,
    @Inject(KlienOidc) private readonly oidc: KlienOidc | null,
  ) {
    this.rahasia = new TextEncoder().encode(cfg.oidcStateSecret);
  }

  private async tx<T>(kerja: (tx: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const h = await kerja(c);
      await c.query('COMMIT');
      return h;
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
  }

  // ---------- SSO ----------
  /** Mulai Authorization Code + PKCE: state/nonce/verifier disimpan dalam cookie bertanda tangan HMAC (10 menit). */
  async mulaiMasuk(kembali?: string): Promise<{ url: string; cookieTransaksi: string }> {
    if (!this.oidc) throw new GalatHttp(404, 'SSO_TIDAK_DIKONFIGURASI', 'SSO belum dikonfigurasi pada lingkungan ini');
    const t: Transaksi = { state: acak(), nonce: acak(), verifier: acak(48), kembali: kembaliAman(kembali) };
    const cookieTransaksi = await new SignJWT({ ...t }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(this.rahasia);
    return { url: await this.oidc.urlOtorisasi(t), cookieTransaksi };
  }

  async selesaiMasuk(q: { code?: string; state?: string; error?: string }, cookieTransaksi: string | undefined, meta: { ip?: string; ua?: string }) {
    if (!this.oidc) throw new GalatHttp(404, 'SSO_TIDAK_DIKONFIGURASI', 'SSO belum dikonfigurasi pada lingkungan ini');
    if (q.error) throw new GalatHttp(401, 'SSO_DITOLAK', `Penyedia identitas menolak: ${q.error}`);
    if (!cookieTransaksi || !q.code || !q.state) throw new GalatHttp(400, 'TRANSAKSI_SSO_TIDAK_VALID', 'Transaksi masuk tidak lengkap atau kedaluwarsa; ulangi masuk');
    let t: Transaksi;
    try {
      t = (await jwtVerify(cookieTransaksi, this.rahasia, { algorithms: ['HS256'] })).payload as unknown as Transaksi;
    } catch {
      throw new GalatHttp(400, 'TRANSAKSI_SSO_TIDAK_VALID', 'Transaksi masuk tidak valid atau kedaluwarsa; ulangi masuk');
    }
    if (t.state !== q.state) throw new GalatHttp(400, 'STATE_TIDAK_COCOK', 'Parameter state tidak cocok (kemungkinan CSRF)');
    let klaim;
    try {
      klaim = await this.oidc.tukarKode(q.code, t.verifier, t.nonce);
    } catch (e) {
      this.log.warn(`SSO gagal: ${e instanceof Error ? e.message : e}`);
      throw new GalatHttp(401, 'SSO_GAGAL', 'Verifikasi identitas dari penyedia SSO gagal');
    }
    const { token } = await this.tx(async (tx) => {
      let p = await repo.penggunaSso(tx, klaim.iss, klaim.sub);
      if (!p && klaim.email && klaim.email_verified) {
        const e = await repo.penggunaEmail(tx, klaim.email);
        if (e && !e.sso_sub) { await repo.tautkanSso(tx, e.id, klaim.iss, klaim.sub); p = e; }
      }
      if (!p) throw new GalatHttp(403, 'PENGGUNA_BELUM_TERDAFTAR', 'Akun SSO ini belum didaftarkan di ARKAS Web; hubungi admin sekolah/Dinas');
      return this.bukaSesi(tx, p, 'SSO', meta);
    });
    return { token, kembali: t.kembali };
  }

  /** HANYA dev (AUTH_DEV_ENABLED): masuk sebagai pengguna terdaftar tanpa SSO. */
  async masukDev(email: string, meta: { ip?: string; ua?: string }): Promise<string> {
    if (!this.cfg.authDev) throw new GalatHttp(404, 'TIDAK_DITEMUKAN', 'Tidak ditemukan');
    return (await this.tx(async (tx) => {
      const p = await repo.penggunaEmail(tx, email);
      if (!p) throw new GalatHttp(403, 'PENGGUNA_BELUM_TERDAFTAR', 'Pengguna tidak terdaftar');
      return this.bukaSesi(tx, p, 'DEV', meta);
    })).token;
  }

  private async bukaSesi(tx: PoolClient, p: repo.BarisPengguna, metode: 'SSO' | 'DEV', meta: { ip?: string; ua?: string }) {
    if (p.status !== 'AKTIF') throw new GalatHttp(403, 'PENGGUNA_NONAKTIF', 'Akun dinonaktifkan');
    const peran = ((await repo.daftarPeran(tx, [p.id])).get(p.id) ?? []).filter((x) => x.berlaku);
    const token = acak(32);
    await repo.buatSesi(tx, { hash: hashToken(token), penggunaId: p.id, peranAktifId: peran.length === 1 ? peran[0].id : null, metode, ttlJam: this.cfg.sesiTtlJam, ...meta });
    return { token };
  }

  // ---------- sesi ----------
  private async wajibSesi(tx: PoolClient, token: string | undefined): Promise<repo.BarisSesi> {
    const s = token ? await repo.sesiBerlaku(tx, hashToken(token), this.cfg.sesiIdleMenit) : undefined;
    if (!s) throw new GalatHttp(401, 'SESI_TIDAK_VALID', 'Sesi tidak ada, kedaluwarsa, atau sudah keluar');
    return s;
  }

  me(token: string | undefined): Promise<MeDto> {
    return this.tx(async (tx) => {
      const s = await this.wajibSesi(tx, token);
      const [p] = await repo.penggunaDto(tx, [s.pengguna_id]);
      const aktif = p.peran.find((x) => x.id === s.peran_aktif_id && x.berlaku) ?? null;
      return { ...p, peran: p.peran.filter((x) => x.berlaku), peranAktif: aktif, sesiKedaluwarsaAt: s.kedaluwarsa_at.toISOString() };
    });
  }

  pilihPeran(token: string | undefined, peranId: string): Promise<MeDto> {
    return this.tx(async (tx) => {
      const s = await this.wajibSesi(tx, token);
      const peran = (await repo.daftarPeran(tx, [s.pengguna_id])).get(s.pengguna_id) ?? [];
      const p = peran.find((x) => x.id === peranId);
      if (!p) throw new GalatHttp(404, 'PERAN_TIDAK_DITEMUKAN', 'Peran tidak dimiliki pengguna ini');
      if (!p.berlaku) throw new AturanError('PERAN_TIDAK_BERLAKU', 'Peran sudah dicabut atau habis masa berlakunya');
      await repo.setPeranAktif(tx, s.id, p.id);
      return undefined;
    }).then(() => this.me(token));
  }

  /** JWT internal untuk peran aktif (dipanggil API Gateway / proxy dengan cookie sesi). */
  terbitkanToken(token: string | undefined): Promise<{ accessToken: string; expiresIn: number; peran: PeranPenggunaDto }> {
    return this.tx(async (tx) => {
      const s = await this.wajibSesi(tx, token);
      const p = ((await repo.daftarPeran(tx, [s.pengguna_id])).get(s.pengguna_id) ?? []).find((x) => x.id === s.peran_aktif_id);
      if (!p || !p.berlaku) throw new GalatHttp(409, 'PERAN_BELUM_DIPILIH', 'Pilih peran aktif terlebih dahulu');
      const direktorat = p.direktoratKode ? [p.direktoratKode] : p.ditjenKode ? await repo.direktoratDitjen(tx, p.ditjenKode) : [];
      const t = await this.penerbit.terbitkan({
        sub: s.pengguna_id, peran: p.peran, npsn: p.npsn ?? undefined, wilayah: p.wilayahKode ?? undefined, direktorat,
        ditjen: p.ditjenKode ?? undefined, sid: s.id,
      });
      return { ...t, peran: p };
    });
  }

  keluar(token: string | undefined): Promise<void> {
    return this.tx(async (tx) => { if (token) await repo.cabutSesi(tx, hashToken(token)); });
  }
}
