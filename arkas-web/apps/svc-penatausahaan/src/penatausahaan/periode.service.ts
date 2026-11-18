import { Inject, Injectable } from '@nestjs/common';
import { akhirBulan, AturanError, bulanBerikut, cekKesiapanTutup, validasiRekonsiliasi } from '@arkas/aturan';
import { DbContextService, GalatHttp, RequestContext, tulisOutbox } from '@arkas/common-ms';
import { AjukanTutupInput, DetailPeriodeDto, FilterBuku, PeriodeDitutupData, PeriodeDto, TOPIK } from '@arkas/kontrak';
import type { PoolClient } from 'pg';
import type { Konfigurasi } from '../config';
import { KONFIGURASI, SKEMA } from '../infra/tokens';
import { hariIniJakarta } from '../infra/waktu';
import { kunciBuku } from './penatausahaan.repo';
import * as repo from './periode.repo';

/** UC-15 — penutupan buku kas bulanan, rekonsiliasi rekening koran & pemeriksaan kas (SK-05). */
@Injectable()
export class PeriodeService {
  constructor(@Inject(DbContextService) private readonly db: DbContextService, @Inject(KONFIGURASI) private readonly cfg: Konfigurasi) {}

  daftar(ctx: RequestContext, npsn: string, f: FilterBuku): Promise<PeriodeDto[]> {
    return this.db.run(ctx, (tx) => repo.daftarPeriode(tx, { npsn, tahun: f.tahun, sumberDanaKode: f.sumberDanaKode }));
  }

  detail(ctx: RequestContext, id: string): Promise<DetailPeriodeDto> {
    return this.db.run(ctx, async (tx) => this.muatDetail(tx, await this.wajibAda(tx, id)));
  }

  /** Bendahara: simpan rekonsiliasi & hitung kas, lalu ajukan penutupan (BUKA -> DIAJUKAN). */
  ajukan(ctx: RequestContext, id: string, versi: number, input: AjukanTutupInput): Promise<DetailPeriodeDto> {
    return this.db.run(ctx, async (tx) => {
      const p0 = await this.wajibAda(tx, id);
      const buku = { npsn: p0.npsn, tahun: p0.tahun, sumberDanaKode: p0.sumberDanaKode };
      await kunciBuku(tx, buku); // menyerialkan dengan pencatatan transaksi di buku yang sama
      const p = (await repo.ambilPeriode(tx, id, true))!;
      this.cekVersi(p, versi);
      if (p.status !== 'BUKA') throw new AturanError('STATUS_PERIODE_TIDAK_SESUAI', `Periode berstatus ${p.status} tidak dapat diajukan`);

      const kesiapan = this.kesiapan(p, await repo.dataKesiapan(tx, p));
      const gagal = kesiapan.syarat.find((s) => !s.ok);
      if (gagal) throw new AturanError(gagal.kode, gagal.pesan);

      const ringkasan = await repo.ringkasanBulan(tx, buku, p.bulan);
      const rek = {
        saldoBukuBank: ringkasan.bank.saldoAkhir, saldoRekeningKoran: input.saldoRekeningKoran, penjelasanBank: input.penjelasanBank || null,
        saldoBukuTunai: ringkasan.tunai.saldoAkhir, kasFisik: input.kasFisik, penjelasanKas: input.penjelasanKas || null,
      };
      const { selisihBank, selisihKas } = validasiRekonsiliasi(rek);
      await repo.simpanRekonsiliasi(tx, p, {
        ...rek, penjelasanBank: selisihBank ? rek.penjelasanBank : null, penjelasanKas: selisihKas ? rek.penjelasanKas : null, ringkasan, oleh: ctx.penggunaId,
      });
      await repo.ajukan(tx, id, ctx.penggunaId);
      return this.muatDetail(tx, (await repo.ambilPeriode(tx, id))!);
    });
  }

  /** Kepala Sekolah: setujui berita acara -> DITUTUP, buka bulan berikutnya, terbitkan PeriodeDitutup. */
  setujui(ctx: RequestContext, id: string, versi: number): Promise<DetailPeriodeDto> {
    return this.db.run(ctx, async (tx) => {
      const p = await this.kunciDiajukan(tx, id, versi, 'ditutup');
      if (p.diajukanOleh === ctx.penggunaId) throw new AturanError('PEMISAHAN_TUGAS', 'Penutup periode tidak boleh sama dengan yang mengajukan');
      const rek = (await repo.ambilRekonsiliasi(tx, id))!;
      await repo.tutup(tx, id, ctx.penggunaId);
      const berikut = bulanBerikut(p.bulan);
      const buku = { npsn: p.npsn, tahun: p.tahun, sumberDanaKode: p.sumberDanaKode };
      if (berikut) await repo.bukaPeriode(tx, buku, berikut);
      const sesudah = (await repo.ambilPeriode(tx, id))!;

      const data: PeriodeDitutupData = {
        periodeId: id, npsn: p.npsn, tahun: p.tahun, sumberDanaKode: p.sumberDanaKode, bulan: p.bulan,
        diajukanOleh: p.diajukanOleh!, ditutupOleh: ctx.penggunaId, ditutupAt: sesudah.ditutupAt!, ringkasan: rek.ringkasan,
        rekonsiliasi: {
          saldoRekeningKoran: rek.saldoRekeningKoran, selisihBank: rek.selisihBank, penjelasanBank: rek.penjelasanBank,
          kasFisik: rek.kasFisik, selisihKas: rek.selisihKas, penjelasanKas: rek.penjelasanKas,
        },
        periodeBerikutBulan: berikut,
      };
      await tulisOutbox(tx, SKEMA, { topik: TOPIK.PERIODE_DITUTUP, tipe: 'PeriodeDitutup', agregatId: id, correlationId: ctx.requestId, payload: data });
      return this.muatDetail(tx, sesudah);
    });
  }

  /** Kepala Sekolah: kembalikan ke Bendahara (DIAJUKAN -> BUKA) dengan alasan. */
  kembalikan(ctx: RequestContext, id: string, versi: number, alasan: string): Promise<DetailPeriodeDto> {
    return this.db.run(ctx, async (tx) => {
      await this.kunciDiajukan(tx, id, versi, 'dikembalikan');
      await repo.kembalikan(tx, id, alasan);
      return this.muatDetail(tx, (await repo.ambilPeriode(tx, id))!);
    });
  }

  // ---------- pembantu ----------
  private async wajibAda(tx: PoolClient, id: string, kunci = false): Promise<PeriodeDto> {
    const p = await repo.ambilPeriode(tx, id, kunci);
    if (!p) throw new GalatHttp(404, 'PERIODE_TIDAK_DITEMUKAN', 'Periode tidak ditemukan');
    return p;
  }

  /**
   * Periksa status lebih dulu TANPA kunci: FOR UPDATE tunduk pada kebijakan RLS UPDATE (hanya periode DIAJUKAN),
   * sehingga periode berstatus lain akan tampak "tidak ada" dan pengguna tidak tahu alasannya.
   */
  private async kunciDiajukan(tx: PoolClient, id: string, versi: number, aksi: string): Promise<PeriodeDto> {
    const p = await this.wajibAda(tx, id);
    this.cekVersi(p, versi);
    if (p.status !== 'DIAJUKAN') throw new AturanError('STATUS_PERIODE_TIDAK_SESUAI', `Periode berstatus ${p.status} tidak dapat ${aksi}`);
    const terkunci = await repo.ambilPeriode(tx, id, true);
    if (!terkunci || terkunci.versi !== versi) throw new GalatHttp(412, 'VERSI_BERUBAH', 'Periode telah berubah; muat ulang lalu coba lagi');
    return terkunci;
  }

  private cekVersi(p: PeriodeDto, versi: number): void {
    if (p.versi !== versi) throw new GalatHttp(412, 'VERSI_BERUBAH', 'Periode telah berubah; muat ulang lalu coba lagi', { versiTerkini: p.versi });
  }

  private kesiapan(p: PeriodeDto, d: Awaited<ReturnType<typeof repo.dataKesiapan>>) {
    return cekKesiapanTutup({ tahun: p.tahun, bulan: p.bulan, hariIni: hariIniJakarta(), izinkanSebelumAkhirBulan: this.cfg.tutupSebelumAkhirBulan, ...d });
  }

  private async muatDetail(tx: PoolClient, p: PeriodeDto): Promise<DetailPeriodeDto> {
    const rek = await repo.ambilRekonsiliasi(tx, p.id);
    // Periode BUKA: ringkasan dihitung langsung; setelah diajukan: snapshot yang dibekukan bersama rekonsiliasi.
    const ringkasan = p.status === 'BUKA' || !rek ? await repo.ringkasanBulan(tx, { npsn: p.npsn, tahun: p.tahun, sumberDanaKode: p.sumberDanaKode }, p.bulan) : rek.ringkasan;
    const kesiapan = p.status === 'BUKA' ? this.kesiapan(p, await repo.dataKesiapan(tx, p)) : { siap: false, syarat: [], peringatan: [] };
    const rekonsiliasi = rek ? (({ ringkasan: _r, ...x }) => x)(rek) : null;
    return { ...p, akhirBulan: akhirBulan(p.tahun, p.bulan), ringkasan, kesiapan, rekonsiliasi };
  }
}
