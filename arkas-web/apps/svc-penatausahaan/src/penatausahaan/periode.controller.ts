import { Body, Controller, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Ctx, Izinkan, RequestContext, ScopeGuard, ZodPipe } from '@arkas/common-ms';
import { AjukanTutupInput, FilterBuku, Npsn, TolakInput } from '@arkas/kontrak';
import { z } from 'zod';
import { PeriodeService } from './periode.service';
import { etag, wajibIfMatch } from './http-util';

/** 11.2.11 Penutupan Buku Kas — /api/v1/sekolah/{npsn}/periode dan /api/v1/periode/* */
@Controller('api/v1')
@UseGuards(ScopeGuard)
export class PeriodeController {
  constructor(@Inject(PeriodeService) private readonly svc: PeriodeService) {}

  @Get('sekolah/:npsn/periode')
  async daftar(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Query(new ZodPipe(FilterBuku)) f: FilterBuku) {
    return { data: await this.svc.daftar(ctx, npsn, f) };
  }

  /** Detail periode: ringkasan BKU bulan itu, daftar periksa kesiapan, dan rekonsiliasi (berita acara pemeriksaan kas). */
  @Get('periode/:id')
  async detail(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Res({ passthrough: true }) res: Response) {
    const d = await this.svc.detail(ctx, id);
    res.setHeader('ETag', etag(d.versi));
    return d;
  }

  @Post('periode/:id/ajukan-tutup')
  @HttpCode(200)
  @Izinkan('BENDAHARA')
  async ajukan(
    @Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Headers('if-match') ifMatch: string | undefined,
    @Body(new ZodPipe(AjukanTutupInput)) input: AjukanTutupInput, @Res({ passthrough: true }) res: Response,
  ) {
    const d = await this.svc.ajukan(ctx, id, wajibIfMatch(ifMatch), input);
    res.setHeader('ETag', etag(d.versi));
    return d;
  }

  @Post('periode/:id/setujui')
  @HttpCode(200)
  @Izinkan('KEPSEK')
  async setujui(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Headers('if-match') ifMatch: string | undefined, @Res({ passthrough: true }) res: Response) {
    const d = await this.svc.setujui(ctx, id, wajibIfMatch(ifMatch));
    res.setHeader('ETag', etag(d.versi));
    return d;
  }

  @Post('periode/:id/kembalikan')
  @HttpCode(200)
  @Izinkan('KEPSEK')
  async kembalikan(
    @Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Headers('if-match') ifMatch: string | undefined,
    @Body(new ZodPipe(TolakInput)) b: z.infer<typeof TolakInput>, @Res({ passthrough: true }) res: Response,
  ) {
    const d = await this.svc.kembalikan(ctx, id, wajibIfMatch(ifMatch), b.alasan);
    res.setHeader('ETag', etag(d.versi));
    return d;
  }
}
