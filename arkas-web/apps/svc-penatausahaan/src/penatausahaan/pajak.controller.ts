import { Body, Controller, Get, Headers, Inject, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Ctx, Izinkan, RequestContext, ScopeGuard, ZodPipe } from '@arkas/common-ms';
import { FilterBuku, FilterPajak, Npsn, SetorPajakInput } from '@arkas/kontrak';
import { PenatausahaanService } from './penatausahaan.service';
import { etag, wajibIdempotencyKey } from './http-util';

/** 11.2.10 Penatausahaan — /api/v1/sekolah/{npsn}/pajak* dan /bkp/pajak (UC-14). */
@Controller('api/v1/sekolah/:npsn')
@UseGuards(ScopeGuard)
export class PajakController {
  constructor(@Inject(PenatausahaanService) private readonly svc: PenatausahaanService) {}

  /** Daftar pajak dipungut/disetor; ?status=DIPUNGUT untuk pajak terutang. */
  @Get('pajak')
  async daftar(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Query(new ZodPipe(FilterPajak)) f: FilterPajak) {
    return { data: await this.svc.pajak(ctx, npsn, f) };
  }

  /** Catat setor pajak dengan NTPN. Menghasilkan transaksi SETOR_PAJAK (DICATAT) yang menunggu persetujuan Kepala Sekolah. */
  @Post('pajak/setor')
  @Izinkan('BENDAHARA')
  async setor(
    @Ctx() ctx: RequestContext,
    @Param('npsn', new ZodPipe(Npsn)) npsn: string,
    @Headers('idempotency-key') kunci: string | undefined,
    @Body(new ZodPipe(SetorPajakInput)) input: SetorPajakInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { transaksi, replay } = await this.svc.setorPajak(ctx, npsn, input, wajibIdempotencyKey(kunci));
    res.status(replay ? 200 : 201).setHeader('ETag', etag(transaksi.versi)).setHeader('Location', `/api/v1/transaksi/${transaksi.id}`);
    if (replay) res.setHeader('Idempotent-Replayed', 'true');
    return transaksi;
  }

  /** Buku Kas Pembantu Pajak. */
  @Get('bkp/pajak')
  async bkp(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Query(new ZodPipe(FilterBuku)) f: FilterBuku) {
    return { data: await this.svc.bkpPajak(ctx, npsn, f) };
  }
}
