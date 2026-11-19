import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Ctx, GalatHttp, Izinkan, RequestContext, ScopeGuard, ZodPipe } from '@arkas/common-ms';
import { AuditService } from './audit.service';

const Tahun = z.coerce.number().int().min(2020).max(2100).default(() => new Date().getFullYear());
const Rantai = z.string().regex(/^(NASIONAL|\d{8})$/, 'rantai = NPSN 8 digit atau NASIONAL');
const FilterJejak = z.object({
  tahun: Tahun, rantai: Rantai.optional(), layanan: z.string().regex(/^svc-[a-z]+$/).optional(), tabel: z.string().max(60).optional(),
  kunci: z.string().max(200).optional(), pelakuId: z.string().uuid().optional(), aksi: z.enum(['INSERT', 'UPDATE', 'DELETE']).optional(),
  dari: z.string().datetime({ offset: true }).optional(), sampai: z.string().datetime({ offset: true }).optional(),
  halaman: z.coerce.number().int().min(1).default(1), ukuran: z.coerce.number().int().min(1).max(200).default(50),
});
const FilterVerifikasi = z.object({ tahun: Tahun, rantai: Rantai.optional() });

/** 11.2.16 Audit (/audit*) -> svc-audit. UC-31: Auditor & Balai SDSP (nasional), Kepala Sekolah (sekolahnya). */
@Controller('api/v1/audit')
@UseGuards(ScopeGuard)
@Izinkan('AUDITOR', 'SUPER_ADMIN', 'KEPSEK')
export class AuditController {
  constructor(@Inject(AuditService) private readonly svc: AuditService) {}

  @Get('jejak')
  jejak(@Ctx() ctx: RequestContext, @Query(new ZodPipe(FilterJejak)) f: z.infer<typeof FilterJejak>) {
    this.cakupan(ctx, f.rantai);
    return this.svc.daftar(ctx, f);
  }

  @Get('rantai')
  async rantai(@Ctx() ctx: RequestContext, @Query(new ZodPipe(z.object({ tahun: Tahun }))) q: { tahun: number }) {
    return { data: await this.svc.rantai(ctx, q.tahun) };
  }

  @Get('verifikasi')
  async verifikasi(@Ctx() ctx: RequestContext, @Query(new ZodPipe(FilterVerifikasi)) q: z.infer<typeof FilterVerifikasi>) {
    this.cakupan(ctx, q.rantai);
    const data = await this.svc.verifikasi(ctx, q.tahun, q.rantai);
    return { utuh: data.every((d) => d.utuh), data };
  }

  /** Kepala Sekolah meminta rantai lain -> 403 eksplisit (RLS saja akan memberi hasil kosong yang menyesatkan). */
  private cakupan(ctx: RequestContext, rantai?: string) {
    if (ctx.peran === 'KEPSEK' && rantai && rantai !== ctx.npsn) throw new GalatHttp(403, 'DI_LUAR_CAKUPAN', 'Jejak sekolah lain tidak dapat dibuka');
  }
}
