import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodPipe } from '@arkas/common-ms';
import { KonfirmasiPembukaanInput, Npsn, StatusTransaksiMitraInput, SumberDanaKode, Tahun, TokenMitraInput, TransaksiMitraInput, ValidasiKeranjangInput } from '@arkas/kontrak';
import { Mitra, MitraGuard, MitraTerverifikasi } from './keamanan';
import { MitraApiService } from './mitra-api.service';

const tahunIni = () => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric' }).format(new Date()));
const QAnggaran = z.object({ tahun: Tahun.default(tahunIni), sumberDanaKode: SumberDanaKode });
const QSekolah = z.object({ tahun: Tahun.default(tahunIni), kursor: z.string().regex(/^\d{8}$/).optional(), batas: z.coerce.number().int().min(1).max(500).default(500) });

/** 11.2.18 API Mitra SIPLah di ARKAS Web (/mitra/v1). */
@Controller('mitra/v1')
export class MitraApiController {
  constructor(@Inject(MitraApiService) private readonly svc: MitraApiService) {}

  /** OAuth2 client credentials (JSON atau x-www-form-urlencoded). Satu-satunya rute tanpa token & HMAC. */
  @Post('oauth/token')
  @HttpCode(200)
  token(@Body(new ZodPipe(TokenMitraInput)) b: z.infer<typeof TokenMitraInput>, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.svc.token(b.client_id, b.client_secret);
  }

  @Get('sekolah/:npsn/anggaran')
  @UseGuards(MitraGuard)
  anggaran(@Mitra() m: MitraTerverifikasi, @Param('npsn', new ZodPipe(Npsn)) npsn: string, @Query(new ZodPipe(QAnggaran)) q: z.infer<typeof QAnggaran>) {
    return this.svc.anggaran(m, { npsn, tahun: q.tahun, sumberDanaKode: q.sumberDanaKode });
  }

  @Post('validasi-keranjang')
  @HttpCode(200)
  @UseGuards(MitraGuard)
  validasi(@Mitra() m: MitraTerverifikasi, @Body(new ZodPipe(ValidasiKeranjangInput)) k: ValidasiKeranjangInput) {
    return this.svc.validasiKeranjang(m, k);
  }

  @Post('transaksi')
  @UseGuards(MitraGuard)
  async transaksi(@Mitra() m: MitraTerverifikasi, @Body(new ZodPipe(TransaksiMitraInput)) t: TransaksiMitraInput, @Res({ passthrough: true }) res: Response) {
    const { replay, hasil } = await this.svc.terimaTransaksi(m, t);
    res.status(replay ? 200 : 202);
    if (replay) res.setHeader('Idempotent-Replayed', 'true');
    return hasil;
  }

  @Post('transaksi/:transactionId/status')
  @HttpCode(200)
  @UseGuards(MitraGuard)
  status(@Mitra() m: MitraTerverifikasi, @Param('transactionId') id: string, @Body(new ZodPipe(StatusTransaksiMitraInput)) s: z.infer<typeof StatusTransaksiMitraInput>) {
    return this.svc.ubahStatus(m, id, s);
  }

  @Get('sumber-dana')
  @UseGuards(MitraGuard)
  sumberDana(@Mitra() m: MitraTerverifikasi) {
    return this.svc.sumberDana(m);
  }

  @Get('sumber-dana/:kode/sekolah')
  @UseGuards(MitraGuard)
  sekolah(@Mitra() m: MitraTerverifikasi, @Param('kode', new ZodPipe(SumberDanaKode)) kode: string, @Query(new ZodPipe(QSekolah)) q: z.infer<typeof QSekolah>) {
    return this.svc.sekolahBerhak(m, kode, q);
  }

  @Post('sumber-dana/:kode/konfirmasi')
  @HttpCode(200)
  @UseGuards(MitraGuard)
  konfirmasi(@Mitra() m: MitraTerverifikasi, @Param('kode', new ZodPipe(SumberDanaKode)) kode: string, @Body(new ZodPipe(KonfirmasiPembukaanInput)) k: z.infer<typeof KonfirmasiPembukaanInput>) {
    return this.svc.konfirmasi(m, kode, k);
  }
}
