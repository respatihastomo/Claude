import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Ctx, Izinkan, RequestContext, ScopeGuard, ZodPipe } from '@arkas/common-ms';
import { DaftarMitraInput, Npsn, SumberDanaKode, UbahMitraInput } from '@arkas/kontrak';
import { AdminIntegrasiService } from './admin.service';

const KodeMitra = z.string().regex(/^[A-Z0-9_]{3,20}$/);
const QTransaksi = z.object({ npsn: Npsn.optional(), mitraKode: KodeMitra.optional(), status: z.enum(['DITERIMA', 'DIBATALKAN', 'RETUR']).optional(), halaman: z.coerce.number().int().min(1).default(1) });

/** 11.2.17 Integrasi (Balai SDSP; Pemantau & Auditor membaca). */
@Controller('api/v1')
@UseGuards(ScopeGuard)
export class AdminIntegrasiController {
  constructor(@Inject(AdminIntegrasiService) private readonly svc: AdminIntegrasiService) {}

  @Get('admin/mitra-siplah')
  @Izinkan('SUPER_ADMIN', 'PEMANTAU', 'AUDITOR')
  async mitra(@Ctx() ctx: RequestContext) { return { data: await this.svc.daftarMitra(ctx) }; }

  /** UC-34 — 201 dengan rahasia yang ditampilkan SEKALI. */
  @Post('admin/mitra-siplah')
  @Izinkan('SUPER_ADMIN')
  daftarkan(@Ctx() ctx: RequestContext, @Body(new ZodPipe(DaftarMitraInput)) i: DaftarMitraInput) { return this.svc.daftarkan(ctx, i); }

  @Put('admin/mitra-siplah/:kode')
  @Izinkan('SUPER_ADMIN')
  ubah(@Ctx() ctx: RequestContext, @Param('kode', new ZodPipe(KodeMitra)) kode: string, @Body(new ZodPipe(UbahMitraInput)) u: z.infer<typeof UbahMitraInput>) {
    return this.svc.ubahMitra(ctx, kode, u);
  }

  @Post('admin/mitra-siplah/:kode/rotasi-rahasia')
  @HttpCode(200)
  @Izinkan('SUPER_ADMIN')
  rotasi(@Ctx() ctx: RequestContext, @Param('kode', new ZodPipe(KodeMitra)) kode: string) { return this.svc.rotasiRahasia(ctx, kode); }

  @Get('pembukaan-sumber-dana')
  @Izinkan('SUPER_ADMIN', 'PEMANTAU', 'AUDITOR')
  matriks(@Ctx() ctx: RequestContext) { return this.svc.matriks(ctx); }

  @Get('pembukaan-sumber-dana/:id/riwayat')
  @Izinkan('SUPER_ADMIN', 'PEMANTAU', 'AUDITOR')
  async riwayat(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string) { return { data: await this.svc.riwayat(ctx, id) }; }

  /** UC-39: kirim ulang pembukaan yang GAGAL. */
  @Post('pembukaan-sumber-dana/:id/kirim-ulang')
  @HttpCode(200)
  @Izinkan('SUPER_ADMIN')
  kirimUlang(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string) { return this.svc.kirimUlang(ctx, id); }

  /** UC-39: tutup sumber dana di semua Mitra (masa belanja berakhir). */
  @Post('sumber-dana/:kode/tutup')
  @HttpCode(200)
  @Izinkan('SUPER_ADMIN')
  tutup(@Ctx() ctx: RequestContext, @Param('kode', new ZodPipe(SumberDanaKode)) kode: string, @Body(new ZodPipe(z.object({ alasan: z.string().trim().min(3).max(300) }))) b: { alasan: string }) {
    return this.svc.tutup(ctx, kode, b.alasan);
  }

  @Get('integrasi/transaksi-mitra')
  @Izinkan('SUPER_ADMIN', 'PEMANTAU', 'AUDITOR')
  async transaksi(@Ctx() ctx: RequestContext, @Query(new ZodPipe(QTransaksi)) q: z.infer<typeof QTransaksi>) { return { data: await this.svc.transaksiMitra(ctx, q) }; }
}
