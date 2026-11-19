import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Ctx, Izinkan, RequestContext, ScopeGuard, ZodPipe } from '@arkas/common-ms';
import { CatatTransaksiMitraInput, FilterBuku, Npsn } from '@arkas/kontrak';
import { TransaksiMitraService } from './transaksi-mitra.service';

/** 11.2.10: /sekolah/{npsn}/transaksi-mitra, /transaksi-mitra/{id}/catat (UC-12). */
@Controller('api/v1')
@UseGuards(ScopeGuard)
export class TransaksiMitraController {
  constructor(@Inject(TransaksiMitraService) private readonly svc: TransaksiMitraService) {}

  @Get('sekolah/:npsn/transaksi-mitra')
  async daftar(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Query(new ZodPipe(FilterBuku)) f: FilterBuku) {
    return { data: await this.svc.daftar(ctx, npsn, f) };
  }

  /** SK-09: penyaluran Bantuan Pemerintah yang sudah diterima dari svc-bantuan (draf penerimaan). */
  @Get('sekolah/:npsn/penyaluran-bantuan')
  async penyaluran(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string) {
    return { data: await this.svc.penyaluran(ctx, npsn) };
  }

  @Post('transaksi-mitra/:id/catat')
  @Izinkan('BENDAHARA')
  catat(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodPipe(CatatTransaksiMitraInput)) i: CatatTransaksiMitraInput) {
    return this.svc.catat(ctx, id, i);
  }
}
