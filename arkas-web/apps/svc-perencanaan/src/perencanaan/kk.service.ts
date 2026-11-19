import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AturanError, jadwalMerata, keRupiah, keSen, validasiKertasKerja } from '@arkas/aturan';
import { DbContextService, GalatHttp, RequestContext, tulisOutbox } from '@arkas/common-ms';
import {
  AktifkanKertasKerjaInput, BarisKertasKerjaInput, CatatanInput, DetailKertasKerjaDto, KertasKerjaDiajukanData, KertasKerjaDisahkanData,
  KertasKerjaDto, KomponenDto, PaguDto, TOPIK,
} from '@arkas/kontrak';
import type { PoolClient } from 'pg';
import { SKEMA } from '../infra/tokens';
import * as repo from './kk.repo';

const PERAN_PENELAAH: Record<string, string> = { BOSP_REG: 'VERIFIKATOR_DINAS', BOSP_KIN: 'VERIFIKATOR_DINAS', BOSP_AFIRMASI: 'VERIFIKATOR_DINAS' };

/** UC-03..UC-09 — kertas kerja (RKAS): aktifkan, susun, validasi, ajukan, telaah, sahkan, perubahan. */
@Injectable()
export class KertasKerjaService {
  constructor(@Inject(DbContextService) private readonly db: DbContextService) {}

  pagu(ctx: RequestContext, b: repo.Buku): Promise<PaguDto> {
    return this.db.run(ctx, async (tx) => {
      const p = await repo.pagu(tx, b);
      if (!p) throw new GalatHttp(404, 'PAGU_BELUM_DITETAPKAN', 'Pagu sumber dana ini belum ditetapkan untuk sekolah');
      return p;
    });
  }

  daftar(ctx: RequestContext, b: repo.Buku): Promise<KertasKerjaDto[]> {
    return this.db.run(ctx, (tx) => repo.daftar(tx, b));
  }

  penelaahan(ctx: RequestContext): Promise<KertasKerjaDto[]> {
    return this.db.run(ctx, (tx) => repo.daftarDiajukan(tx));
  }

  detail(ctx: RequestContext, id: string): Promise<DetailKertasKerjaDto> {
    return this.db.run(ctx, async (tx) => this.muatDetail(tx, await this.wajibAda(tx, id)));
  }

  komponen(ctx: RequestContext, id: string): Promise<KomponenDto[]> {
    return this.db.run(ctx, async (tx) =>
      (await repo.komponen(tx, (await this.wajibAda(tx, id)).sumberDanaKode)).map((k) => ({ ...k, maksPersen: k.maksPersen ?? null, minPersen: k.minPersen ?? null })));
  }

  /** UC-03: buka versi 1 (DRAF). Mengembalikan versi terbuka yang ada bila sudah diaktifkan. */
  aktifkan(ctx: RequestContext, npsn: string, i: AktifkanKertasKerjaInput): Promise<{ kk: DetailKertasKerjaDto; baru: boolean }> {
    const b = { npsn, tahun: i.tahun, sumberDanaKode: i.sumberDanaKode };
    return this.db.run(ctx, async (tx) => {
      await this.kunciBuku(tx, b);
      if (!(await repo.pagu(tx, b))) throw new AturanError('PAGU_BELUM_DITETAPKAN', 'Pagu sumber dana ini belum ditetapkan untuk sekolah');
      const ada = await repo.terbuka(tx, b, ['DRAF', 'DIAJUKAN']);
      if (ada) return { kk: await this.muatDetail(tx, ada), baru: false };
      if (await repo.terbuka(tx, b, ['DISAHKAN'])) throw new AturanError('SUDAH_DISAHKAN', 'Kertas kerja sudah disahkan; gunakan pergeseran/perubahan');
      const id = await repo.buat(tx, b, 1, ctx.penggunaId, null);
      return { kk: await this.muatDetail(tx, (await repo.ambil(tx, id))!), baru: true };
    });
  }

  /** UC-09: versi baru dari yang DISAHKAN; baris disalin dengan asal_baris_id (rantai riwayat & realisasi). */
  perubahan(ctx: RequestContext, npsn: string, i: AktifkanKertasKerjaInput): Promise<DetailKertasKerjaDto> {
    const b = { npsn, tahun: i.tahun, sumberDanaKode: i.sumberDanaKode };
    return this.db.run(ctx, async (tx) => {
      await this.kunciBuku(tx, b);
      if (await repo.terbuka(tx, b, ['DRAF', 'DIAJUKAN'])) throw new AturanError('MASIH_ADA_VERSI_TERBUKA', 'Masih ada kertas kerja DRAF/DIAJUKAN');
      const sah = await repo.terbuka(tx, b, ['DISAHKAN']);
      if (!sah) throw new AturanError('BELUM_ADA_YANG_DISAHKAN', 'Belum ada kertas kerja yang disahkan untuk diubah');
      const id = await repo.buat(tx, b, sah.versi + 1, ctx.penggunaId, sah.id);
      for (const x of await repo.baris(tx, sah.id)) {
        await repo.simpanBaris(tx, id, npsn, { ...x, id: randomUUID(), asalBarisId: x.id, akarBarisId: x.akarBarisId }, true);
      }
      return this.muatDetail(tx, (await repo.ambil(tx, id))!);
    });
  }

  /** UC-04: tambah/ubah/hapus baris (dengan jadwal kas) pada DRAF; If-Match menjaga seluruh kertas kerja. */
  simpanBaris(ctx: RequestContext, id: string, versi: number, i: BarisKertasKerjaInput, barisId?: string): Promise<DetailKertasKerjaDto> {
    return this.ubahDraf(ctx, id, versi, async (tx, kk) => {
      const komponen = (await repo.komponen(tx, kk.sumberDanaKode)).find((k) => k.kode === i.komponenKode);
      if (!komponen) throw new AturanError('KOMPONEN_TIDAK_DIKENAL', `Komponen ${i.komponenKode} tidak dikenal atau nonaktif untuk ${kk.sumberDanaKode}`);
      if (!(await repo.rekeningAktif(tx, i.kodeRekening))) {
        throw new AturanError('KODE_REKENING_TIDAK_DIKENAL', `Kode rekening ${i.kodeRekening} tidak terdaftar atau nonaktif di referensi`);
      }
      const total = keRupiah(Math.round(i.volume * keSen(i.hargaSatuan)));
      const jadwal = i.jadwal ?? jadwalMerata(total);
      if (jadwal.reduce((s, x) => s + keSen(x), 0) !== keSen(total)) {
        throw new AturanError('JADWAL_KAS_TIDAK_SESUAI', `Jumlah jadwal kas harus sama dengan total ${total}`);
      }
      let lama: (Awaited<ReturnType<typeof repo.baris>>)[number] | undefined;
      if (barisId) {
        lama = (await repo.baris(tx, id)).find((x) => x.id === barisId);
        if (!lama) throw new GalatHttp(404, 'BARIS_TIDAK_DITEMUKAN', 'Baris tidak ditemukan di kertas kerja ini');
        if (keSen(total) < keSen(lama.realisasi)) {
          throw new AturanError('DI_BAWAH_REALISASI', `Total baris tidak boleh di bawah realisasinya (${lama.realisasi})`, { realisasi: lama.realisasi });
        }
      }
      const idBaris = barisId ?? randomUUID();
      await repo.simpanBaris(tx, id, kk.npsn, {
        id: idBaris, komponenKode: i.komponenKode, kegiatan: `${komponen.kode}. ${komponen.nama}`, kodeRekening: i.kodeRekening, uraian: i.uraian,
        volume: i.volume, satuan: i.satuan, hargaSatuan: i.hargaSatuan, total, jadwal, asalBarisId: lama?.asalBarisId ?? null, akarBarisId: lama?.akarBarisId ?? idBaris,
      }, !barisId);
    });
  }

  hapusBaris(ctx: RequestContext, id: string, versi: number, barisId: string): Promise<DetailKertasKerjaDto> {
    return this.ubahDraf(ctx, id, versi, async (tx) => {
      const b = (await repo.baris(tx, id)).find((x) => x.id === barisId);
      if (!b) throw new GalatHttp(404, 'BARIS_TIDAK_DITEMUKAN', 'Baris tidak ditemukan di kertas kerja ini');
      if (b.realisasi > 0) throw new AturanError('BARIS_SUDAH_DIREALISASIKAN', 'Baris yang sudah direalisasikan tidak dapat dihapus');
      await repo.hapusBaris(tx, barisId);
    });
  }

  /** UC-05/06: Kepala Sekolah mengajukan; wajib lolos validasi juknis. */
  ajukan(ctx: RequestContext, id: string, versi: number): Promise<DetailKertasKerjaDto> {
    return this.db.run(ctx, async (tx) => {
      const kk = await this.siapkanTransisi(tx, id, versi, 'DRAF');
      const d = await this.muatDetail(tx, kk);
      if (!d.validasi.valid) throw new AturanError('VALIDASI_KERTAS_KERJA', 'Kertas kerja belum memenuhi aturan juknis', { galat: d.validasi.galat });
      await repo.ubahStatus(tx, id, { status: 'DIAJUKAN', diajukan_oleh: ctx.penggunaId, diajukan_at: new Date(), catatan_kembali: null });
      await repo.catatVerifikasi(tx, id, ctx.penggunaId, ctx.peran, 'AJUKAN', null);
      const baru = (await repo.ambil(tx, id))!;
      const data: KertasKerjaDiajukanData = {
        kertasKerjaId: id, npsn: kk.npsn, tahun: kk.tahun, sumberDanaKode: kk.sumberDanaKode, versi: kk.versi,
        totalAnggaran: d.validasi.totalAnggaran, diajukanOleh: ctx.penggunaId, diajukanAt: baru.diajukanAt!,
      };
      await tulisOutbox(tx, SKEMA, { topik: TOPIK.KERTAS_KERJA_DIAJUKAN, tipe: 'KertasKerjaDiajukan', agregatId: id, correlationId: ctx.requestId, payload: data });
      return this.muatDetail(tx, baru);
    });
  }

  catatan(ctx: RequestContext, id: string, i: CatatanInput): Promise<DetailKertasKerjaDto> {
    return this.db.run(ctx, async (tx) => {
      const kk = await this.wajibAda(tx, id);
      if (kk.status !== 'DIAJUKAN') throw new AturanError('STATUS_TIDAK_SESUAI', 'Catatan penelaahan hanya untuk kertas kerja DIAJUKAN');
      await repo.tambahCatatan(tx, id, i.barisId ?? null, ctx.penggunaId, ctx.peran, i.catatan);
      return this.muatDetail(tx, kk);
    });
  }

  /** UC-07: Verifikator Dinas mengembalikan untuk diperbaiki. */
  kembalikan(ctx: RequestContext, id: string, versi: number, alasan: string): Promise<DetailKertasKerjaDto> {
    return this.db.run(ctx, async (tx) => {
      const kk = await this.siapkanTransisi(tx, id, versi, 'DIAJUKAN');
      this.cekPenelaah(ctx, kk);
      await repo.ubahStatus(tx, id, { status: 'DRAF', catatan_kembali: alasan });
      await repo.catatVerifikasi(tx, id, ctx.penggunaId, ctx.peran, 'KEMBALIKAN', alasan);
      return this.muatDetail(tx, (await repo.ambil(tx, id))!);
    });
  }

  /** Kode 9 — pengesahan dengan Transactional Outbox: kunci versi, versi lama DIGANTI, terbit KertasKerjaDisahkan. */
  sahkan(ctx: RequestContext, id: string, versi: number, catatan?: string): Promise<DetailKertasKerjaDto> {
    return this.db.run(ctx, async (tx) => {
      const kk = await this.siapkanTransisi(tx, id, versi, 'DIAJUKAN');
      this.cekPenelaah(ctx, kk);
      const d = await this.muatDetail(tx, kk);
      if (!d.validasi.valid) throw new AturanError('VALIDASI_KERTAS_KERJA', 'Kertas kerja belum memenuhi aturan juknis', { galat: d.validasi.galat });
      const lama = await repo.terbuka(tx, kk, ['DISAHKAN']);
      if (lama) await repo.ubahStatus(tx, lama.id, { status: 'DIGANTI' });
      await repo.ubahStatus(tx, id, { status: 'DISAHKAN', disahkan_oleh: ctx.penggunaId, disahkan_at: new Date() });
      await repo.catatVerifikasi(tx, id, ctx.penggunaId, ctx.peran, 'SAHKAN', catatan ?? null);
      const data: KertasKerjaDisahkanData = {
        kertasKerjaId: id, npsn: kk.npsn, tahun: kk.tahun, sumberDanaKode: kk.sumberDanaKode, versi: kk.versi,
        baris: d.baris.map((b) => ({
          id: b.id, kodeRekening: b.kodeRekening, kegiatan: b.kegiatan, uraian: b.uraian, volume: b.volume, satuan: b.satuan,
          hargaSatuan: b.hargaSatuan, total: b.total, asalBarisId: b.asalBarisId,
        })),
      };
      await tulisOutbox(tx, SKEMA, { topik: TOPIK.KERTAS_KERJA_DISAHKAN, tipe: 'KertasKerjaDisahkan', agregatId: id, correlationId: ctx.requestId, payload: data });
      return this.muatDetail(tx, (await repo.ambil(tx, id))!);
    });
  }

  // ---------- pembantu ----------
  private async kunciBuku(tx: PoolClient, b: repo.Buku) {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`perencanaan:${b.npsn}:${b.tahun}:${b.sumberDanaKode}`]);
  }

  private async wajibAda(tx: PoolClient, id: string): Promise<KertasKerjaDto> {
    const kk = await repo.ambil(tx, id);
    if (!kk) throw new GalatHttp(404, 'KERTAS_KERJA_TIDAK_DITEMUKAN', 'Kertas kerja tidak ditemukan');
    return kk;
  }

  /** Periksa status & versi TANPA kunci dulu (FOR UPDATE tunduk RLS UPDATE), baru kunci baris. */
  private async siapkanTransisi(tx: PoolClient, id: string, versi: number, status: KertasKerjaDto['status']): Promise<KertasKerjaDto> {
    const kk = await this.wajibAda(tx, id);
    if (kk.rowVersion !== versi) throw new GalatHttp(412, 'VERSI_BERUBAH', 'Kertas kerja telah berubah; muat ulang lalu coba lagi', { versiTerkini: kk.rowVersion });
    if (kk.status !== status) {
      throw new AturanError(status === 'DRAF' ? 'KERTAS_KERJA_TERKUNCI' : 'STATUS_TIDAK_SESUAI', `Kertas kerja berstatus ${kk.status}, diharapkan ${status}`);
    }
    const terkunci = await repo.ambil(tx, id, true);
    if (!terkunci) throw new GalatHttp(403, 'DITOLAK_RLS', 'Peran ini tidak dapat mengubah kertas kerja tersebut');
    if (terkunci.rowVersion !== versi) throw new GalatHttp(412, 'VERSI_BERUBAH', 'Kertas kerja telah berubah; muat ulang lalu coba lagi');
    return terkunci;
  }

  private ubahDraf(ctx: RequestContext, id: string, versi: number, kerja: (tx: PoolClient, kk: KertasKerjaDto) => Promise<void>): Promise<DetailKertasKerjaDto> {
    return this.db.run(ctx, async (tx) => {
      const kk = await this.siapkanTransisi(tx, id, versi, 'DRAF');
      await kerja(tx, kk);
      await repo.sentuh(tx, id);
      return this.muatDetail(tx, (await repo.ambil(tx, id))!);
    });
  }

  private cekPenelaah(ctx: RequestContext, kk: KertasKerjaDto): void {
    const harus = PERAN_PENELAAH[kk.sumberDanaKode] ?? 'TIM_KERJA';
    if (ctx.peran !== harus) throw new GalatHttp(403, 'BUKAN_PENELAAH', `Kertas kerja ${kk.sumberDanaKode} ditelaah oleh ${harus}`);
  }

  private async muatDetail(tx: PoolClient, kk: KertasKerjaDto): Promise<DetailKertasKerjaDto> {
    const [baris, komponen, p, cr] = await Promise.all([
      repo.baris(tx, kk.id), repo.komponen(tx, kk.sumberDanaKode), repo.pagu(tx, kk), repo.catatanDanRiwayat(tx, kk.id),
    ]);
    const validasi = validasiKertasKerja({
      pagu: p?.nilai ?? 0, komponen,
      baris: baris.map((b) => ({ ...b, realisasi: kk.versi > 1 ? b.realisasi : undefined })),
    });
    return { ...kk, baris: baris.map(({ akarBarisId: _a, ...x }) => x), validasi, ...cr };
  }
}
