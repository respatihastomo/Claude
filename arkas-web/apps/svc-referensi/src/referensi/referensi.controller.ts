import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Ctx, GalatHttp, Izinkan, RequestContext, ScopeGuard, ZodPipe } from '@arkas/common-ms';
import { Npsn, PajakDaerahInput } from '@arkas/kontrak';
import { SLUG } from './deskriptor';
import { ReferensiService } from './referensi.service';

const Filter = z.object({ aktif: z.enum(['true', 'false']).optional(), sumberDanaKode: z.string().optional(), wilayahKode: z.string().optional() });
const entitas = (slug: string) => {
  const e = SLUG[slug];
  if (!e) throw new GalatHttp(404, 'REFERENSI_TIDAK_DIKENAL', `Referensi ${slug} tidak dikenal`);
  return e;
};

/** 11.2.2 Referensi, 11.2.4 sekolah & sumber dana, 11.2.15 Dinas — dirutekan API Gateway ke svc-referensi. */
@Controller('api/v1')
@UseGuards(ScopeGuard)
export class ReferensiController {
  constructor(@Inject(ReferensiService) private readonly svc: ReferensiService) {}

  @Get('referensi/:slug')
  async daftar(@Ctx() ctx: RequestContext, @Param('slug') slug: string, @Query(new ZodPipe(Filter)) f: z.infer<typeof Filter>) {
    return { data: await this.svc.daftar(ctx, entitas(slug), { ...f, aktif: f.aktif === undefined ? undefined : f.aktif === 'true' }) };
  }

  /** UC-19: tambah/ubah baris referensi (Balai SDSP). 201 bila berubah, 200 bila isinya sama (tanpa event baru). */
  @Put('admin/referensi/:slug')
  @Izinkan('SUPER_ADMIN')
  async simpan(@Ctx() ctx: RequestContext, @Param('slug') slug: string, @Body() isi: unknown, @Res({ passthrough: true }) res: Response) {
    const r = await this.svc.simpan(ctx, entitas(slug), isi);
    res.status(r.berubah ? 201 : 200);
    return r.data;
  }

  /** Menerbitkan ulang seluruh referensi sebagai ReferensiDiubah (mengisi proyeksi layanan baru). */
  @Post('admin/referensi/terbit-ulang')
  @HttpCode(202)
  @Izinkan('SUPER_ADMIN')
  terbitUlang(@Ctx() ctx: RequestContext) {
    return this.svc.terbitUlang(ctx);
  }

  @Get('sekolah/:npsn')
  sekolah(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string) {
    return this.svc.sekolah(ctx, npsn);
  }

  /** UC-02: sumber dana yang dapat dipilih sekolah (sesuai jenjangnya). */
  @Get('sekolah/:npsn/sumber-dana')
  async sumberDana(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string) {
    return { data: await this.svc.sumberDanaSekolah(ctx, npsn) };
  }

  @Get('dinas/sekolah')
  @Izinkan('ADMIN_DINAS', 'VERIFIKATOR_DINAS')
  async sekolahDinas(@Ctx() ctx: RequestContext) {
    return { data: await this.svc.sekolahDinas(ctx) };
  }

  @Get('dinas/konfigurasi-pajak')
  @Izinkan('ADMIN_DINAS')
  async konfigurasiPajak(@Ctx() ctx: RequestContext) {
    return { data: await this.svc.konfigurasiPajak(ctx) };
  }

  /** UC-32: tetapkan atau bebaskan pajak daerah (SSPD) untuk wilayah Dinas. */
  @Put('dinas/konfigurasi-pajak')
  @Izinkan('ADMIN_DINAS')
  aturPajak(@Ctx() ctx: RequestContext, @Body(new ZodPipe(PajakDaerahInput)) i: PajakDaerahInput) {
    return this.svc.aturPajakDaerah(ctx, i);
  }
}
