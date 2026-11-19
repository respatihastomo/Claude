import { Body, Controller, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Ctx, GalatHttp, Izinkan, RequestContext, ScopeGuard, ZodPipe } from '@arkas/common-ms';
import { KeputusanInput, TolakInput } from '@arkas/kontrak';
import { z } from 'zod';
import { PenatausahaanService } from './penatausahaan.service';
import { etag, wajibIfMatch } from './http-util';

/** 11.2.10 Penatausahaan — /api/v1/transaksi/* */
@Controller('api/v1/transaksi')
@UseGuards(ScopeGuard)
export class TransaksiController {
  constructor(@Inject(PenatausahaanService) private readonly svc: PenatausahaanService) {}

  @Get(':id')
  async ambil(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Res({ passthrough: true }) res: Response) {
    const t = await this.svc.ambil(ctx, id);
    if (!t) throw new GalatHttp(404, 'TRANSAKSI_TIDAK_DITEMUKAN', 'Transaksi tidak ditemukan');
    res.setHeader('ETag', etag(t.versi));
    return t;
  }

  /** UC-13: Kepala Sekolah menyetujui transaksi -> DISETUJUI, terbit TransaksiDisetujui (outbox). */
  @Post(':id/setujui')
  @HttpCode(200)
  @Izinkan('KEPSEK')
  async setujui(
    @Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Headers('if-match') ifMatch: string | undefined,
    @Body(new ZodPipe(KeputusanInput)) _b: z.infer<typeof KeputusanInput>, @Res({ passthrough: true }) res: Response,
  ) {
    const t = await this.svc.setujui(ctx, id, wajibIfMatch(ifMatch));
    res.setHeader('ETag', etag(t.versi));
    return t;
  }

  @Post(':id/tolak')
  @HttpCode(200)
  @Izinkan('KEPSEK')
  async tolak(
    @Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Headers('if-match') ifMatch: string | undefined,
    @Body(new ZodPipe(TolakInput)) b: z.infer<typeof TolakInput>, @Res({ passthrough: true }) res: Response,
  ) {
    const t = await this.svc.tolak(ctx, id, wajibIfMatch(ifMatch), b.alasan);
    res.setHeader('ETag', etag(t.versi));
    return t;
  }
}
