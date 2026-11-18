import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Ctx, Izinkan, RequestContext, ScopeGuard, ZodPipe } from '@arkas/common-ms';
import { CabutPeranInput, CakupanInput, TambahPenggunaInput } from '@arkas/kontrak';
import { PenggunaService } from './pengguna.service';

const PENGELOLA = ['SUPER_ADMIN', 'ADMIN_DITJEN', 'ADMIN_DIREKTORAT', 'ADMIN_DINAS', 'OPERATOR'] as const;

/** 11.2.3 Pengguna dan hak akses — /api/v1/admin/pengguna* (UC-20). */
@Controller('api/v1/admin/pengguna')
@UseGuards(ScopeGuard)
@Izinkan(...PENGELOLA)
export class PenggunaController {
  constructor(@Inject(PenggunaService) private readonly svc: PenggunaService) {}

  @Get()
  async daftar(@Ctx() ctx: RequestContext) {
    return { data: await this.svc.daftar(ctx) };
  }

  @Post()
  tambah(@Ctx() ctx: RequestContext, @Body(new ZodPipe(TambahPenggunaInput)) i: TambahPenggunaInput) {
    return this.svc.tambah(ctx, i);
  }

  @Post(':id/peran')
  beri(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodPipe(CakupanInput)) c: CakupanInput) {
    return this.svc.beri(ctx, id, c);
  }

  @Delete(':id/peran/:peranId')
  @HttpCode(200)
  cabut(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Param('peranId', new ParseUUIDPipe()) peranId: string,
    @Body(new ZodPipe(CabutPeranInput)) b: z.infer<typeof CabutPeranInput>) {
    return this.svc.cabut(ctx, id, peranId, b.alasan);
  }
}
