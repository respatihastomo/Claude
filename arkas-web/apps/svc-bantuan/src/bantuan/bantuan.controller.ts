import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Ctx, Izinkan, RequestContext, ScopeGuard, ZodPipe } from '@arkas/common-ms';
import {
  CatatanBalaiInput, KeputusanDokumenInput, KeputusanPengajuanInput, KomponenBantuanInput, Npsn, PenerimaInput, PenyaluranInput, PksBankInput, SumberDanaBantuanInput,
} from '@arkas/kontrak';
import { JENIS_XLSX } from './berkas';
import { DOKUMEN_PENGAJUAN, PengajuanService } from './pengajuan.service';
import { SumberDanaService } from './sumber-dana.service';
import { buatTemplat } from '../pekerja/impor-penerima';

const Kode = new ZodPipe(z.string().regex(/^[A-Z0-9_]{3,20}$/));
const PUSAT = ['ADMIN_DIREKTORAT', 'ADMIN_DITJEN', 'TIM_KERJA', 'SUPER_ADMIN', 'PEMANTAU', 'AUDITOR'] as const;
const QNama = z.object({ nama: z.string().max(200).optional(), nilaiRab: z.coerce.number().positive().optional() });
const kirimBerkas = (res: Response, isi: Buffer, nama: string, jenis: string) => {
  res.setHeader('Content-Type', jenis);
  res.setHeader('Content-Disposition', `attachment; filename="${nama.replace(/"/g, '')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(isi);
};

/** 11.2.5 Sumber Dana Bantuan Pemerintah, 11.2.6 Penyaluran (pusat). */
@Controller('api/v1')
@UseGuards(ScopeGuard)
export class SumberDanaController {
  constructor(@Inject(SumberDanaService) private readonly svc: SumberDanaService) {}

  @Get('sumber-dana') @Izinkan(...PUSAT)
  async daftar(@Ctx() ctx: RequestContext) { return { data: await this.svc.daftar(ctx) }; }
  @Post('sumber-dana') @Izinkan('ADMIN_DIREKTORAT')
  buat(@Ctx() ctx: RequestContext, @Body(new ZodPipe(SumberDanaBantuanInput)) i: SumberDanaBantuanInput) { return this.svc.buat(ctx, i); }
  @Get('sumber-dana/:kode') @Izinkan(...PUSAT)
  detail(@Ctx() ctx: RequestContext, @Param('kode', Kode) kode: string) { return this.svc.detail(ctx, kode); }
  @Put('sumber-dana/:kode') @Izinkan('ADMIN_DIREKTORAT')
  ubah(@Ctx() ctx: RequestContext, @Param('kode', Kode) kode: string, @Body(new ZodPipe(SumberDanaBantuanInput.omit({ kode: true, direktoratKode: true }))) i: Omit<SumberDanaBantuanInput, 'kode' | 'direktoratKode'>) {
    return this.svc.ubah(ctx, kode, i);
  }

  @Post('sumber-dana/:kode/dokumen/:jenis') @Izinkan('ADMIN_DIREKTORAT')
  unggah(@Ctx() ctx: RequestContext, @Param('kode', Kode) kode: string, @Param('jenis', new ZodPipe(z.enum(['JUKNIS', 'PANDUAN']))) jenis: 'JUKNIS' | 'PANDUAN',
    @Query(new ZodPipe(QNama)) q: z.infer<typeof QNama>, @Body() isi: Buffer) {
    return this.svc.unggahDokumen(ctx, kode, jenis, q.nama, Buffer.isBuffer(isi) ? isi : undefined);
  }
  @Get('dokumen/:id/berkas') @Izinkan(...PUSAT)
  async unduh(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response) {
    const d = await this.svc.unduhDokumen(ctx, id);
    res.setHeader('X-Sha256', d.sha256);
    kirimBerkas(res, d.isi, d.nama, 'application/pdf');
  }
  @Post('dokumen/:id/keputusan') @HttpCode(200) @Izinkan('ADMIN_DITJEN', 'ADMIN_DIREKTORAT')
  putuskan(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodPipe(KeputusanDokumenInput)) k: z.infer<typeof KeputusanDokumenInput>) {
    return this.svc.putuskanDokumen(ctx, id, k.setuju, k.catatan);
  }

  @Put('sumber-dana/:kode/komponen/:k') @Izinkan('ADMIN_DIREKTORAT')
  komponen(@Ctx() ctx: RequestContext, @Param('kode', Kode) kode: string, @Param('k') k: string, @Body(new ZodPipe(KomponenBantuanInput.omit({ kode: true }))) b: { nama: string; maksPersen: number | null }) {
    return this.svc.simpanKomponen(ctx, kode, KomponenBantuanInput.parse({ ...b, kode: k }));
  }
  @Delete('sumber-dana/:kode/komponen/:k') @Izinkan('ADMIN_DIREKTORAT')
  hapusKomponen(@Ctx() ctx: RequestContext, @Param('kode', Kode) kode: string, @Param('k') k: string) { return this.svc.hapusKomponen(ctx, kode, k); }

  @Put('sumber-dana/:kode/penerima/:npsn') @Izinkan('ADMIN_DIREKTORAT')
  penerima(@Ctx() ctx: RequestContext, @Param('kode', Kode) kode: string, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Body(new ZodPipe(PenerimaInput.omit({ npsn: true }))) b: { nilai: number }) {
    return this.svc.simpanPenerima(ctx, kode, { npsn, nilai: b.nilai });
  }
  @Delete('sumber-dana/:kode/penerima/:npsn') @Izinkan('ADMIN_DIREKTORAT')
  hapusPenerima(@Ctx() ctx: RequestContext, @Param('kode', Kode) kode: string, @Param('npsn', new ZodPipe(Npsn)) npsn: string) { return this.svc.hapusPenerima(ctx, kode, npsn); }
  @Get('sumber-dana/:kode/penerima/templat') @Izinkan('ADMIN_DIREKTORAT')
  async templat(@Param('kode', Kode) kode: string, @Res() res: Response) { kirimBerkas(res, await buatTemplat(kode), `templat-penerima-${kode}.xlsx`, JENIS_XLSX); }
  @Post('impor/penerima/:kode') @HttpCode(202) @Izinkan('ADMIN_DIREKTORAT')
  impor(@Ctx() ctx: RequestContext, @Param('kode', Kode) kode: string, @Query(new ZodPipe(QNama)) q: z.infer<typeof QNama>, @Body() isi: Buffer) {
    return this.svc.imporPenerima(ctx, kode, q.nama, Buffer.isBuffer(isi) ? isi : undefined);
  }
  @Get('impor/:id') @Izinkan('ADMIN_DIREKTORAT')
  statusImpor(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string) { return this.svc.statusImpor(ctx, id); }

  @Post('sumber-dana/:kode/ajukan') @HttpCode(200) @Izinkan('ADMIN_DIREKTORAT')
  ajukan(@Ctx() ctx: RequestContext, @Param('kode', Kode) kode: string) { return this.svc.ajukan(ctx, kode); }
  @Post('sumber-dana/:kode/kembalikan') @HttpCode(200) @Izinkan('SUPER_ADMIN')
  kembalikan(@Ctx() ctx: RequestContext, @Param('kode', Kode) kode: string, @Body(new ZodPipe(CatatanBalaiInput)) b: { catatan: string }) { return this.svc.kembalikan(ctx, kode, b.catatan); }
  @Post('sumber-dana/:kode/sahkan') @HttpCode(200) @Izinkan('SUPER_ADMIN')
  sahkan(@Ctx() ctx: RequestContext, @Param('kode', Kode) kode: string) { return this.svc.sahkan(ctx, kode); }

  @Get('bank') @Izinkan(...PUSAT)
  async bank(@Ctx() ctx: RequestContext) { return { data: await this.svc.bank(ctx) }; }
  @Post('sumber-dana/:kode/pks-bank') @Izinkan('ADMIN_DIREKTORAT')
  pks(@Ctx() ctx: RequestContext, @Param('kode', Kode) kode: string, @Body(new ZodPipe(PksBankInput)) p: z.infer<typeof PksBankInput>) { return this.svc.tambahPks(ctx, kode, p); }
  @Post('sumber-dana/:kode/penyaluran') @Izinkan('ADMIN_DIREKTORAT')
  salur(@Ctx() ctx: RequestContext, @Param('kode', Kode) kode: string, @Body(new ZodPipe(PenyaluranInput)) p: PenyaluranInput) { return this.svc.catatPenyaluran(ctx, kode, p); }
}

/** 11.2.7 Pengajuan Bantuan Pemerintah oleh sekolah + penelaahan (UC-17, UC-18). */
@Controller('api/v1')
@UseGuards(ScopeGuard)
export class PengajuanController {
  constructor(@Inject(PengajuanService) private readonly svc: PengajuanService) {}

  @Get('sekolah/:npsn/pengajuan-bantuan') @Izinkan('OPERATOR', 'BENDAHARA', 'KEPSEK', 'KOMITE')
  async bantuan(@Ctx() ctx: RequestContext, @Param('npsn', new ZodPipe(Npsn)) npsn: string) { return { data: await this.svc.bantuanSekolah(ctx, npsn) }; }
  @Post('pengajuan-bantuan') @Izinkan('OPERATOR', 'KEPSEK')
  mulai(@Ctx() ctx: RequestContext, @Body(new ZodPipe(z.object({ sumberDanaKode: z.string().regex(/^[A-Z0-9_]{3,20}$/) }))) b: { sumberDanaKode: string }) { return this.svc.mulai(ctx, b.sumberDanaKode); }
  @Post('pengajuan-bantuan/:id/dokumen/:jenis') @Izinkan('OPERATOR', 'KEPSEK')
  unggah(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Param('jenis', new ZodPipe(z.enum(DOKUMEN_PENGAJUAN))) jenis: (typeof DOKUMEN_PENGAJUAN)[number],
    @Query(new ZodPipe(QNama)) q: z.infer<typeof QNama>, @Body() isi: Buffer) {
    return this.svc.unggah(ctx, id, jenis, q.nama, Buffer.isBuffer(isi) ? isi : undefined, q.nilaiRab);
  }
  @Get('pengajuan-bantuan/:id/dokumen/:jenis') @Izinkan('OPERATOR', 'BENDAHARA', 'KEPSEK', 'KOMITE', ...PUSAT)
  async unduh(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Param('jenis', new ZodPipe(z.enum(DOKUMEN_PENGAJUAN))) jenis: (typeof DOKUMEN_PENGAJUAN)[number], @Res() res: Response) {
    const d = await this.svc.unduh(ctx, id, jenis);
    kirimBerkas(res, d.isi, d.nama, 'application/pdf');
  }
  @Post('pengajuan-bantuan/:id/ajukan') @HttpCode(200) @Izinkan('KEPSEK')
  ajukan(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string) { return this.svc.ajukan(ctx, id); }
  @Get('sumber-dana/:kode/pengajuan') @Izinkan('TIM_KERJA', 'ADMIN_DIREKTORAT', 'SUPER_ADMIN', 'PEMANTAU', 'AUDITOR')
  async penelaah(@Ctx() ctx: RequestContext, @Param('kode', Kode) kode: string) { return { data: await this.svc.daftarPenelaah(ctx, kode) }; }
  @Post('pengajuan-bantuan/:id/keputusan') @HttpCode(200) @Izinkan('TIM_KERJA', 'ADMIN_DIREKTORAT')
  putuskan(@Ctx() ctx: RequestContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodPipe(KeputusanPengajuanInput)) k: z.infer<typeof KeputusanPengajuanInput>) {
    return this.svc.putuskan(ctx, id, k.keputusan, k.catatan);
  }
}
