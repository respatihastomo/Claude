import { Body, Controller, Get, HttpCode, Inject, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodPipe } from '@arkas/common-ms';
import { MasukDevInput, PilihPeranInput } from '@arkas/kontrak';
import { z } from 'zod';
import type { Konfigurasi } from '../config';
import { PenerbitToken } from '../infra/penerbit';
import { KONFIGURASI } from '../infra/tokens';
import { AuthService } from './auth.service';
import { bacaCookie, COOKIE_OIDC, COOKIE_SESI, hapusCookie, pasangCookie } from './cookie';

const meta = (req: Request) => ({ ip: req.ip, ua: req.headers['user-agent'] });

/** 11.2.1 Autentikasi dan sesi — /api/v1/auth/*, /api/v1/me*, dan JWKS. */
@Controller()
export class AuthController {
  constructor(@Inject(AuthService) private readonly svc: AuthService, @Inject(PenerbitToken) private readonly penerbit: PenerbitToken,
    @Inject(KONFIGURASI) private readonly cfg: Konfigurasi) {}

  @Get('.well-known/jwks.json')
  jwks(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return this.penerbit.jwks();
  }

  /** Metode masuk yang tersedia (UI menampilkan tombol sesuai konfigurasi). */
  @Get('api/v1/auth/metode')
  metode() {
    return { sso: !!this.cfg.oidc, dev: this.cfg.authDev };
  }

  @Get('api/v1/auth/masuk')
  async masuk(@Query('kembali') kembali: string | undefined, @Res() res: Response) {
    const { url, cookieTransaksi } = await this.svc.mulaiMasuk(kembali);
    pasangCookie(res, COOKIE_OIDC, cookieTransaksi, { secure: this.cfg.cookieSecure, maxAgeDetik: 600, path: '/api/v1/auth' });
    res.redirect(302, url);
  }

  @Get('api/v1/auth/callback')
  async callback(@Query() q: { code?: string; state?: string; error?: string }, @Req() req: Request, @Res() res: Response) {
    const { token, kembali } = await this.svc.selesaiMasuk(q, bacaCookie(req, COOKIE_OIDC), meta(req));
    hapusCookie(res, COOKIE_OIDC, this.cfg.cookieSecure, '/api/v1/auth');
    pasangCookie(res, COOKIE_SESI, token, { secure: this.cfg.cookieSecure, maxAgeDetik: this.cfg.sesiTtlJam * 3600 });
    res.redirect(302, kembali);
  }

  @Post('api/v1/auth/dev-masuk')
  @HttpCode(204)
  async devMasuk(@Body(new ZodPipe(MasukDevInput)) b: z.infer<typeof MasukDevInput>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    pasangCookie(res, COOKIE_SESI, await this.svc.masukDev(b.email, meta(req)), { secure: this.cfg.cookieSecure, maxAgeDetik: this.cfg.sesiTtlJam * 3600 });
  }

  @Post('api/v1/auth/keluar')
  @HttpCode(204)
  async keluar(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.svc.keluar(bacaCookie(req, COOKIE_SESI));
    hapusCookie(res, COOKIE_SESI, this.cfg.cookieSecure);
  }

  @Post('api/v1/auth/token')
  @HttpCode(200)
  async token(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.svc.terbitkanToken(bacaCookie(req, COOKIE_SESI));
  }

  @Get('api/v1/me')
  me(@Req() req: Request) {
    return this.svc.me(bacaCookie(req, COOKIE_SESI));
  }

  @Put('api/v1/me/peran-aktif')
  pilih(@Req() req: Request, @Body(new ZodPipe(PilihPeranInput)) b: z.infer<typeof PilihPeranInput>) {
    return this.svc.pilihPeran(bacaCookie(req, COOKIE_SESI), b.peranPenggunaId);
  }
}
