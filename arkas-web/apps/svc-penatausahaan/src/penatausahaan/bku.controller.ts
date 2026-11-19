import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Ctx, Izinkan, RequestContext, ScopeGuard, ZodPipe } from '@arkas/common-ms';
import { BuatTransaksiInput, FilterBuku, Npsn, SimulasiPajakInput } from '@arkas/kontrak';
import { PenatausahaanService } from './penatausahaan.service';
import { etag, wajibIdempotencyKey } from './http-util';

const FilterBku = FilterBuku.extend({ buku: z.enum(['TUNAI', 'BANK']).optional() });

/** 11.2.10 Penatausahaan — /api/v1/sekolah/{npsn}/bku* (dirutekan API Gateway ke svc-penatausahaan). */
@Controller('api/v1/sekolah/:npsn/bku')
@UseGuards(ScopeGuard)
export class BkuController {
  constructor(@Inject(PenatausahaanService) private readonly svc: PenatausahaanService) {}

  /** Daftar Buku Kas Umum (atau BKP Tunai/Bank dengan ?buku=) beserta saldo berjalan. */
  @Get()
  async daftar(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Query(new ZodPipe(FilterBku)) f: z.infer<typeof FilterBku>) {
    return { data: await this.svc.bku(ctx, npsn, f) };
  }

  @Get('ringkasan')
  ringkasan(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Query(new ZodPipe(FilterBuku)) f: FilterBuku) {
    return this.svc.ringkasan(ctx, npsn, f);
  }

  /** Transaksi yang ditolak Kepala Sekolah pada periode yang masih buka, beserta alasannya. */
  @Get('ditolak')
  async ditolak(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Query(new ZodPipe(FilterBuku)) f: FilterBuku) {
    return { data: await this.svc.ditolak(ctx, npsn, f) };
  }

  /** Baris RKAS yang disahkan (proyeksi lokal) dengan realisasi & sisa — sumber AccountCodePicker Langkah 2. */
  @Get('rkas')
  async rkas(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Query(new ZodPipe(FilterBuku)) f: FilterBuku) {
    return { data: await this.svc.rkas(ctx, npsn, f) };
  }

  @Post('simulasi-pajak')
  @HttpCode(200)
  @Izinkan('BENDAHARA')
  simulasi(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Body(new ZodPipe(SimulasiPajakInput)) input: SimulasiPajakInput) {
    return this.svc.simulasiPajak(ctx, npsn, input);
  }

  /** UC-10 / UC-11: catat penerimaan, tarik/setor tunai, atau belanja. Wajib Idempotency-Key. */
  @Post()
  @Izinkan('BENDAHARA')
  async catat(
    @Ctx() ctx: RequestContext,
    @Param('npsn', new ZodPipe(Npsn)) npsn: string,
    @Headers('idempotency-key') kunci: string | undefined,
    @Body(new ZodPipe(BuatTransaksiInput)) input: BuatTransaksiInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { transaksi, replay } = await this.svc.catat(ctx, npsn, input, wajibIdempotencyKey(kunci));
    res.status(replay ? 200 : 201).setHeader('ETag', etag(transaksi.versi)).setHeader('Location', `/api/v1/transaksi/${transaksi.id}`);
    if (replay) res.setHeader('Idempotent-Replayed', 'true');
    return transaksi;
  }
}
