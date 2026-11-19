import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Ctx, GalatHttp, Izinkan, RequestContext, ScopeGuard, ZodPipe } from '@arkas/common-ms';
import { AktifkanKertasKerjaInput, BarisKertasKerjaInput, CatatanInput, Npsn, SumberDanaKode, Tahun, TolakInput } from '@arkas/kontrak';
import { KertasKerjaService } from './kk.service';

const FilterBuku = z.object({ tahun: Tahun, sumberDanaKode: SumberDanaKode });
const SahkanInput = z.object({ catatan: z.string().trim().max(1000).optional() });
const etag = (v: number) => `W/"${v}"`;
function ifMatch(v: string | undefined): number {
  if (!v) throw new GalatHttp(428, 'IF_MATCH_WAJIB', 'Header If-Match (ETag kertas kerja) wajib');
  const m = /^(?:W\/)?"(\d+)"$/.exec(v.trim());
  if (!m) throw new GalatHttp(400, 'IF_MATCH_TIDAK_VALID', 'Format If-Match tidak dikenali');
  return Number(m[1]);
}

/** 11.2.8 Penganggaran & 11.2.9 Penelaahan dan pengesahan (dirutekan API Gateway ke svc-perencanaan). Kode 8. */
@Controller('api/v1')
@UseGuards(ScopeGuard)
export class KertasKerjaController {
  constructor(@Inject(KertasKerjaService) private readonly svc: KertasKerjaService) {}

  @Get('sekolah/:npsn/pagu')
  pagu(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Query(new ZodPipe(FilterBuku)) f: z.infer<typeof FilterBuku>) {
    return this.svc.pagu(ctx, { npsn, ...f });
  }

  @Get('sekolah/:npsn/kertas-kerja')
  async daftar(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Query(new ZodPipe(FilterBuku)) f: z.infer<typeof FilterBuku>) {
    return { data: await this.svc.daftar(ctx, { npsn, ...f }) };
  }

  @Post('sekolah/:npsn/kertas-kerja')
  @Izinkan('OPERATOR', 'BENDAHARA')
  async aktifkan(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Body(new ZodPipe(AktifkanKertasKerjaInput)) i: AktifkanKertasKerjaInput, @Res({ passthrough: true }) res: Response) {
    const { kk, baru } = await this.svc.aktifkan(ctx, npsn, i);
    res.status(baru ? 201 : 200).setHeader('ETag', etag(kk.rowVersion)).setHeader('Location', `/api/v1/kertas-kerja/${kk.id}`);
    return kk;
  }

  @Post('sekolah/:npsn/kertas-kerja/perubahan')
  @Izinkan('OPERATOR', 'BENDAHARA')
  async perubahan(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Body(new ZodPipe(AktifkanKertasKerjaInput)) i: AktifkanKertasKerjaInput, @Res({ passthrough: true }) res: Response) {
    const kk = await this.svc.perubahan(ctx, npsn, i);
    res.status(201).setHeader('ETag', etag(kk.rowVersion)).setHeader('Location', `/api/v1/kertas-kerja/${kk.id}`);
    return kk;
  }

  @Get('kertas-kerja/:id')
  async detail(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Res({ passthrough: true }) res: Response) {
    const kk = await this.svc.detail(ctx, id);
    res.setHeader('ETag', etag(kk.rowVersion));
    return kk;
  }

  @Get('kertas-kerja/:id/komponen')
  async komponen(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return { data: await this.svc.komponen(ctx, id) };
  }

  @Post('kertas-kerja/:id/baris')
  @Izinkan('OPERATOR', 'BENDAHARA')
  async tambahBaris(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Headers('if-match') im: string | undefined,
    @Body(new ZodPipe(BarisKertasKerjaInput)) i: BarisKertasKerjaInput, @Res({ passthrough: true }) res: Response) {
    return this.kirim(res, await this.svc.simpanBaris(ctx, id, ifMatch(im), i), 201);
  }

  @Put('kertas-kerja/:id/baris/:barisId')
  @Izinkan('OPERATOR', 'BENDAHARA')
  async ubahBaris(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Param('barisId', new ParseUUIDPipe()) barisId: string,
    @Headers('if-match') im: string | undefined, @Body(new ZodPipe(BarisKertasKerjaInput)) i: BarisKertasKerjaInput, @Res({ passthrough: true }) res: Response) {
    return this.kirim(res, await this.svc.simpanBaris(ctx, id, ifMatch(im), i, barisId));
  }

  @Delete('kertas-kerja/:id/baris/:barisId')
  @Izinkan('OPERATOR', 'BENDAHARA')
  async hapusBaris(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Param('barisId', new ParseUUIDPipe()) barisId: string,
    @Headers('if-match') im: string | undefined, @Res({ passthrough: true }) res: Response) {
    return this.kirim(res, await this.svc.hapusBaris(ctx, id, ifMatch(im), barisId));
  }

  @Post('kertas-kerja/:id/ajukan')
  @HttpCode(200)
  @Izinkan('KEPSEK')
  async ajukan(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Headers('if-match') im: string | undefined, @Res({ passthrough: true }) res: Response) {
    return this.kirim(res, await this.svc.ajukan(ctx, id, ifMatch(im)));
  }

  @Get('penelaahan')
  @Izinkan('VERIFIKATOR_DINAS', 'TIM_KERJA')
  async penelaahan(@Ctx() ctx: RequestContext) {
    return { data: await this.svc.penelaahan(ctx) };
  }

  @Post('kertas-kerja/:id/catatan')
  @HttpCode(200)
  @Izinkan('VERIFIKATOR_DINAS', 'TIM_KERJA')
  catatan(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodPipe(CatatanInput)) i: CatatanInput) {
    return this.svc.catatan(ctx, id, i);
  }

  @Post('kertas-kerja/:id/kembalikan')
  @HttpCode(200)
  @Izinkan('VERIFIKATOR_DINAS', 'TIM_KERJA')
  async kembalikan(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Headers('if-match') im: string | undefined,
    @Body(new ZodPipe(TolakInput)) b: z.infer<typeof TolakInput>, @Res({ passthrough: true }) res: Response) {
    return this.kirim(res, await this.svc.kembalikan(ctx, id, ifMatch(im), b.alasan));
  }

  @Post('kertas-kerja/:id/sahkan')
  @HttpCode(200)
  @Izinkan('VERIFIKATOR_DINAS', 'TIM_KERJA')
  async sahkan(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Headers('if-match') im: string | undefined,
    @Body(new ZodPipe(SahkanInput)) b: z.infer<typeof SahkanInput>, @Res({ passthrough: true }) res: Response) {
    return this.kirim(res, await this.svc.sahkan(ctx, id, ifMatch(im), b.catatan));
  }

  private kirim<T extends { rowVersion: number }>(res: Response, kk: T, status = 200): T {
    res.status(status).setHeader('ETag', etag(kk.rowVersion));
    return kk;
  }
}
