import { Controller, ForbiddenException, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Ctx, GalatHttp, Izinkan, PERAN_SEKOLAH, RequestContext, ScopeGuard, ZodPipe } from '@arkas/common-ms';
import { Npsn, SumberDanaKode, Tahun } from '@arkas/kontrak';
import { LaporanService } from './laporan.service';

const FilterLaporan = z.object({ npsn: Npsn, tahun: Tahun, sumberDanaKode: SumberDanaKode });
const etag = (v: number) => `W/"${v}"`;
function ifMatch(v: string | undefined): number {
  if (!v) throw new GalatHttp(428, 'IF_MATCH_WAJIB', 'Header If-Match (ETag laporan) wajib');
  const m = /^(?:W\/)?"(\d+)"$/.exec(v.trim());
  if (!m) throw new GalatHttp(400, 'IF_MATCH_TIDAK_VALID', 'Format If-Match tidak dikenali');
  return Number(m[1]);
}

/** 11.2.12 Pelaporan — /api/v1/laporan* (dirutekan API Gateway ke svc-pelaporan). */
@Controller('api/v1/laporan')
@UseGuards(ScopeGuard)
export class LaporanController {
  constructor(@Inject(LaporanService) private readonly svc: LaporanService) {}

  @Get()
  async daftar(@Ctx() ctx: RequestContext, @Query(new ZodPipe(FilterLaporan)) f: z.infer<typeof FilterLaporan>) {
    // npsn ada di query (bukan path) sehingga cakupan peran sekolah diperiksa di sini; RLS tetap menjadi lapis kedua.
    if (PERAN_SEKOLAH.includes(ctx.peran) && f.npsn !== ctx.npsn) throw new ForbiddenException({ kode: 'DI_LUAR_CAKUPAN', message: 'NPSN di luar cakupan pengguna' });
    return { data: await this.svc.daftar(ctx, f.npsn, f.tahun, f.sumberDanaKode) };
  }

  @Get(':id')
  async ambil(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Res({ passthrough: true }) res: Response) {
    const l = await this.svc.ambil(ctx, id);
    res.setHeader('ETag', etag(l.versi));
    return l;
  }

  /** PDF laporan. ?versi=asli untuk berkas sebelum ditandatangani. */
  @Get(':id/berkas')
  async berkas(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Query('versi') versi: string | undefined, @Res() res: Response) {
    const b = await this.svc.berkas(ctx, id, versi === 'asli' ? 'asli' : 'terkini');
    res.status(200).set({
      'Content-Type': 'application/pdf', 'Content-Length': String(b.isi.length), 'Content-Disposition': `inline; filename="${b.nama}"`,
      ETag: `"${b.sha256}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    }).end(b.isi);
  }

  @Post(':id/tandatangani')
  @HttpCode(200)
  @Izinkan('KEPSEK')
  async tandatangani(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Headers('if-match') im: string | undefined, @Res({ passthrough: true }) res: Response) {
    const l = await this.svc.tandatangani(ctx, id, ifMatch(im));
    res.setHeader('ETag', etag(l.versi));
    return l;
  }
}
