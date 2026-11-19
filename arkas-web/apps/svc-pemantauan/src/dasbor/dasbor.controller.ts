import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Ctx, Izinkan, RequestContext, ScopeGuard, ZodPipe } from '@arkas/common-ms';
import { Npsn, SumberDanaKode, Tahun } from '@arkas/kontrak';
import { DasborService } from './dasbor.service';

const tahunIni = () => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric' }).format(new Date()));
const Q = z.object({ tahun: Tahun.default(tahunIni), sumberDanaKode: SumberDanaKode.default('BOSP_REG') });
const QSerapan = Q.extend({ induk: z.string().regex(/^\d{2}(\d{2})?$/).optional() });

/** 11.2.13 Pemantauan (/dasbor/*) & 11.2.14 HPP (/hpp/*). */
@Controller('api/v1')
@UseGuards(ScopeGuard)
export class DasborController {
  constructor(@Inject(DasborService) private readonly svc: DasborService) {}

  @Get('dasbor/serapan')
  @Izinkan('PEMANTAU', 'SUPER_ADMIN', 'AUDITOR', 'ADMIN_DINAS', 'VERIFIKATOR_DINAS')
  serapan(@Ctx() ctx: RequestContext, @Query(new ZodPipe(QSerapan)) q: z.infer<typeof QSerapan>) { return this.svc.serapan(ctx, q); }

  @Get('dasbor/hpp')
  @Izinkan('PEMANTAU', 'SUPER_ADMIN', 'AUDITOR', 'ADMIN_DINAS', 'VERIFIKATOR_DINAS')
  hpp(@Ctx() ctx: RequestContext, @Query(new ZodPipe(Q)) q: z.infer<typeof Q>) { return this.svc.hppAgregat(ctx, q); }

  @Get('hpp/sekolah/:npsn')
  @Izinkan('OPERATOR', 'BENDAHARA', 'KEPSEK', 'KOMITE', 'PEMANTAU', 'SUPER_ADMIN', 'AUDITOR', 'ADMIN_DINAS', 'VERIFIKATOR_DINAS')
  hppSekolah(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Query(new ZodPipe(Q)) q: z.infer<typeof Q>) { return this.svc.hppSekolah(ctx, npsn, q); }
}
