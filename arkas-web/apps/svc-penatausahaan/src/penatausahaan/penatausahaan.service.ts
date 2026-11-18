import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AturanError, cekPemisahanTugas, hitungPajak, HasilPajak, keRupiah, keSen, transisiTransaksi, validasiSetorPajak } from '@arkas/aturan';
import { DbContextService, GalatHttp, RequestContext, tulisOutbox } from '@arkas/common-ms';
import {
  BarisBkpPajakDto, BarisBkuDto, BarisRkasDto, BuatTransaksiInput, FilterBuku, FilterPajak, PajakDto, RingkasanBukuDto,
  SetorPajakInput, SimulasiPajakInput, TOPIK,
  TransaksiDisetujuiData, TransaksiDto,
} from '@arkas/kontrak';
import { SKEMA } from '../infra/tokens';
import { bulanDari, hariIniJakarta } from '../infra/waktu';
import * as repo from './penatausahaan.repo';

export interface HasilCatat { transaksi: TransaksiDto; replay: boolean }

/** Hash kanonik body permintaan untuk mendeteksi Idempotency-Key yang dipakai ulang dengan isi berbeda. */
function hashKanonik(v: unknown): string {
  const urut = (x: unknown): unknown =>
    Array.isArray(x) ? x.map(urut) : x && typeof x === 'object'
      ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, urut((x as Record<string, unknown>)[k])])) : x;
  return createHash('sha256').update(JSON.stringify(urut(v))).digest('hex');
}

const r2 = (x: number) => keRupiah(keSen(x));
const NAMA_PAJAK: Record<string, string> = { PPN: 'PPN', PPH21: 'PPh 21', PPH23: 'PPh 23', SSPD: 'pajak daerah' };

@Injectable()
export class PenatausahaanService {
  constructor(@Inject(DbContextService) private readonly db: DbContextService) {}

  // ---------- UC-10 / UC-11: catat transaksi ----------
  async catat(ctx: RequestContext, npsn: string, input: BuatTransaksiInput, idempotencyKey: string): Promise<HasilCatat> {
    const buku: repo.Buku = { npsn, tahun: input.tahun, sumberDanaKode: input.sumberDanaKode };
    const hash = hashKanonik(input);
    if (Number(input.tanggal.slice(0, 4)) !== input.tahun) throw new AturanError('TANGGAL_DI_LUAR_TAHUN', 'Tanggal transaksi harus di tahun anggaran buku');
    if (input.tanggal > hariIniJakarta()) throw new AturanError('TANGGAL_DI_MASA_DEPAN', 'Tanggal transaksi tidak boleh melewati hari ini');

    return this.db.run(ctx, async (tx) => {
      await repo.kunciBuku(tx, buku);

      const lama = await repo.cariIdempoten(tx, buku, idempotencyKey);
      if (lama) {
        if (lama.idempotency_hash !== hash) {
          throw new AturanError('IDEMPOTENCY_KEY_DIPAKAI_ULANG', 'Idempotency-Key sudah dipakai untuk permintaan dengan isi berbeda');
        }
        return { transaksi: (await repo.ambilTransaksi(tx, lama.id))!, replay: true };
      }

      const periode = await repo.cariPeriode(tx, buku, bulanDari(input.tanggal));
      if (!periode) throw new AturanError('PERIODE_BELUM_DIBUKA', `Periode bulan ${bulanDari(input.tanggal)} belum dibuka (RKAS belum disahkan?)`);
      if (periode.status !== 'BUKA') throw new AturanError('PERIODE_TERTUTUP', periode.status === 'DIAJUKAN' ? 'Periode sedang diajukan untuk ditutup' : 'Periode buku kas sudah ditutup');

      const saldo = await repo.saldo(tx, buku);
      const dasar = {
        buku, periodeId: periode.id, jenis: input.jenis, tanggal: input.tanggal, uraian: input.uraian,
        dibuatOleh: ctx.penggunaId, idempotencyKey, idempotencyHash: hash,
      };

      if (input.jenis !== 'BELANJA') {
        const nilai = r2(input.nilai);
        if (input.jenis === 'TARIK_TUNAI') this.cekSaldo('BANK', saldo.tersedia.bank, nilai);
        if (input.jenis === 'SETOR_TUNAI') this.cekSaldo('TUNAI', saldo.tersedia.tunai, nilai);
        const id = await repo.simpanTransaksi(tx, {
          ...dasar, caraBayar: null, noBukti: input.noBukti ?? null, namaToko: null, penjualPunyaNpwp: null, nilaiBruto: nilai, totalPajak: 0,
        });
        return { transaksi: (await repo.ambilTransaksi(tx, id))!, replay: false };
      }

      // BELANJA — Langkah 2: rujuk baris RKAS disahkan; Langkah 3: pajak otomatis.
      const { baris, hasil, items } = await this.hitungBelanja(tx, buku, input.items, input.penjualPunyaNpwp);
      const terpakaiBaru = new Map<string, number>();
      for (const it of items) {
        const b = baris.get(it.barisId)!;
        const sudah = (terpakaiBaru.get(b.akar_baris_id) ?? keSen(b.terpakai)) + keSen(it.jumlah);
        terpakaiBaru.set(b.akar_baris_id, sudah);
        if (sudah > keSen(b.total)) {
          throw new AturanError('MELEBIHI_ANGGARAN', `Belanja "${b.uraian}" melebihi sisa anggaran`, {
            barisId: b.baris_id, anggaran: Number(b.total), terpakai: Number(b.terpakai), sisa: keRupiah(keSen(b.total) - keSen(b.terpakai)),
          });
        }
      }
      const bukuKas = input.caraBayar === 'TUNAI' ? 'TUNAI' : 'BANK';
      this.cekSaldo(bukuKas, bukuKas === 'TUNAI' ? saldo.tersedia.tunai : saldo.tersedia.bank, hasil.nilaiNetto);

      const id = await repo.simpanTransaksi(tx, {
        ...dasar, caraBayar: input.caraBayar, noBukti: input.noBukti, namaToko: input.namaToko,
        penjualPunyaNpwp: input.penjualPunyaNpwp, nilaiBruto: hasil.nilaiBruto, totalPajak: hasil.totalPajak,
      });
      for (const it of items) {
        const b = baris.get(it.barisId)!;
        await repo.simpanItem(tx, buku, id, { ...it, akarBarisId: b.akar_baris_id, kodeRekening: b.kode_rekening, satuan: it.satuan ?? b.satuan });
      }
      for (const p of hasil.pajak) await repo.simpanPajak(tx, buku, id, p);
      return { transaksi: (await repo.ambilTransaksi(tx, id))!, replay: false };
    });
  }

  // ---------- Langkah 3 wizard: simulasi pajak tanpa menyimpan ----------
  async simulasiPajak(ctx: RequestContext, npsn: string, input: SimulasiPajakInput): Promise<HasilPajak> {
    const buku = { npsn, tahun: input.tahun, sumberDanaKode: input.sumberDanaKode };
    return this.db.run(ctx, async (tx) => {
      const items = input.items.map((i) => ({ ...i, uraian: '-', satuan: undefined }));
      return (await this.hitungBelanja(tx, buku, items, input.penjualPunyaNpwp)).hasil;
    });
  }

  private async hitungBelanja(
    tx: Parameters<Parameters<DbContextService['run']>[1]>[0], buku: repo.Buku,
    masukan: Array<{ barisId: string; uraian: string; volume: number; satuan?: string; hargaSatuan: number }>, npwp: boolean,
  ) {
    const baris = await repo.barisRkasUntuk(tx, buku, [...new Set(masukan.map((i) => i.barisId))]);
    const hilang = masukan.filter((i) => !baris.has(i.barisId)).map((i) => i.barisId);
    if (hilang.length) throw new AturanError('BARIS_RKAS_TIDAK_SAH', 'Baris RKAS tidak ditemukan di RKAS yang disahkan untuk buku ini', { barisId: hilang });
    const items = masukan.map((i) => ({
      barisId: i.barisId, uraian: i.uraian, volume: i.volume, satuan: i.satuan ?? null, hargaSatuan: r2(i.hargaSatuan),
      jumlah: keRupiah(Math.round(i.volume * keSen(i.hargaSatuan))),
    }));
    const aturan = await repo.aturanPajak(tx, [...new Set([...baris.values()].map((b) => b.kode_rekening))], buku.npsn);
    const hasil = hitungPajak({
      items: items.map((i) => ({ kodeRekening: baris.get(i.barisId)!.kode_rekening, jumlah: i.jumlah })),
      aturan, penjualPunyaNpwp: npwp,
    });
    return { baris, hasil, items };
  }

  private cekSaldo(buku: 'TUNAI' | 'BANK', tersedia: number, dibutuhkan: number): void {
    if (keSen(dibutuhkan) > keSen(tersedia)) {
      throw new AturanError('SALDO_TIDAK_CUKUP', `Saldo ${buku === 'TUNAI' ? 'tunai' : 'bank'} tidak cukup`, {
        buku, tersedia, dibutuhkan, ...(buku === 'TUNAI' ? { saran: 'TARIK_TUNAI' } : {}),
      });
    }
  }

  // ---------- UC-13: putuskan (setujui / tolak) ----------
  async setujui(ctx: RequestContext, id: string, versi: number): Promise<TransaksiDto> {
    return this.putuskan(ctx, id, versi, 'SETUJUI', null);
  }

  async tolak(ctx: RequestContext, id: string, versi: number, alasan: string): Promise<TransaksiDto> {
    return this.putuskan(ctx, id, versi, 'TOLAK', alasan);
  }

  private async putuskan(ctx: RequestContext, id: string, versi: number, aksi: 'SETUJUI' | 'TOLAK', alasan: string | null) {
    return this.db.run(ctx, async (tx) => {
      const t = await repo.ambilTransaksi(tx, id, true);
      if (!t) throw new GalatHttp(404, 'TRANSAKSI_TIDAK_DITEMUKAN', 'Transaksi tidak ditemukan');
      if (t.versi !== versi) throw new GalatHttp(412, 'VERSI_BERUBAH', 'Transaksi telah berubah; muat ulang lalu coba lagi', { versiTerkini: t.versi });
      const ke = transisiTransaksi(t.status, aksi);
      cekPemisahanTugas(t.dibuatOleh, ctx.penggunaId);
      await repo.putuskan(tx, id, ke as 'DISETUJUI' | 'DITOLAK', ctx.penggunaId, alasan);
      // Setoran pajak ditolak (mis. NTPN salah): pajak kembali terutang dan dapat disetor ulang.
      if (ke === 'DITOLAK' && t.jenis === 'SETOR_PAJAK') await repo.lepaskanPajak(tx, id);
      const baru = (await repo.ambilTransaksi(tx, id))!;

      if (ke === 'DISETUJUI') {
        const data: TransaksiDisetujuiData = {
          transaksiId: baru.id, npsn: baru.npsn, tahun: baru.tahun, sumberDanaKode: baru.sumberDanaKode, jenis: baru.jenis,
          tanggal: baru.tanggal, nilaiBruto: baru.nilaiBruto, totalPajak: baru.totalPajak, ntpn: baru.ntpn,
          disetujuiOleh: ctx.penggunaId, disetujuiAt: baru.diputuskanAt!,
          uraian: baru.uraian, noBukti: baru.noBukti, caraBayar: baru.caraBayar, namaToko: baru.namaToko,
          items: baru.items.map((i) => ({ barisId: i.barisId, kodeRekening: i.kodeRekening, jumlah: i.jumlah, uraian: i.uraian })),
          pajak: baru.pajak.map((p) => ({ jenis: p.jenis, nilai: p.nilai })),
        };
        await tulisOutbox(tx, SKEMA, {
          topik: TOPIK.TRANSAKSI_DISETUJUI, tipe: 'TransaksiDisetujui', agregatId: baru.id, correlationId: ctx.requestId, payload: data,
        });
      }
      return baru;
    });
  }

  // ---------- UC-14: setor pajak ----------
  async setorPajak(ctx: RequestContext, npsn: string, input: SetorPajakInput, idempotencyKey: string): Promise<HasilCatat> {
    const buku: repo.Buku = { npsn, tahun: input.tahun, sumberDanaKode: input.sumberDanaKode };
    const hash = hashKanonik({ setorPajak: input });
    if (Number(input.tanggalSetor.slice(0, 4)) !== input.tahun) throw new AturanError('TANGGAL_DI_LUAR_TAHUN', 'Tanggal setor harus di tahun anggaran buku');
    if (input.tanggalSetor > hariIniJakarta()) throw new AturanError('TANGGAL_DI_MASA_DEPAN', 'Tanggal setor tidak boleh melewati hari ini');

    return this.db.run(ctx, async (tx) => {
      await repo.kunciBuku(tx, buku);
      const lama = await repo.cariIdempoten(tx, buku, idempotencyKey);
      if (lama) {
        if (lama.idempotency_hash !== hash) throw new AturanError('IDEMPOTENCY_KEY_DIPAKAI_ULANG', 'Idempotency-Key sudah dipakai untuk permintaan dengan isi berbeda');
        return { transaksi: (await repo.ambilTransaksi(tx, lama.id))!, replay: true };
      }

      const periode = await repo.cariPeriode(tx, buku, bulanDari(input.tanggalSetor));
      if (!periode) throw new AturanError('PERIODE_BELUM_DIBUKA', `Periode bulan ${bulanDari(input.tanggalSetor)} belum dibuka`);
      if (periode.status !== 'BUKA') throw new AturanError('PERIODE_TERTUTUP', periode.status === 'DIAJUKAN' ? 'Periode sedang diajukan untuk ditutup' : 'Periode buku kas sudah ditutup');

      const pajak = await repo.kunciPajak(tx, buku, input.pajakIds);
      const { jenis, nilai } = validasiSetorPajak(
        pajak.map((p) => ({ id: p.id, jenis: p.jenis, nilai: p.nilai, status: p.status, statusBelanja: p.statusBelanja, tanggalBelanja: p.tanggalBelanja })),
        input.pajakIds, input.tanggalSetor,
      );
      const saldo = await repo.saldo(tx, buku);
      const bukuKas = input.caraBayar === 'TUNAI' ? 'TUNAI' : 'BANK';
      this.cekSaldo(bukuKas, bukuKas === 'TUNAI' ? saldo.tersedia.tunai : saldo.tersedia.bank, nilai);

      const id = await repo.simpanTransaksi(tx, {
        buku, periodeId: periode.id, jenis: 'SETOR_PAJAK', tanggal: input.tanggalSetor, caraBayar: input.caraBayar,
        noBukti: input.ntpn, uraian: `Setor ${NAMA_PAJAK[jenis]} (${input.pajakIds.length} bukti pungut)`, namaToko: null,
        penjualPunyaNpwp: null, nilaiBruto: nilai, totalPajak: 0, dibuatOleh: ctx.penggunaId,
        idempotencyKey, idempotencyHash: hash, ntpn: input.ntpn,
      });
      await repo.tautkanPajak(tx, input.pajakIds, id, input.ntpn, input.tanggalSetor);
      return { transaksi: (await repo.ambilTransaksi(tx, id))!, replay: false };
    });
  }

  pajak(ctx: RequestContext, npsn: string, f: FilterPajak): Promise<PajakDto[]> {
    return this.db.run(ctx, (tx) => repo.daftarPajak(tx, { npsn, tahun: f.tahun, sumberDanaKode: f.sumberDanaKode }, f.status));
  }

  bkpPajak(ctx: RequestContext, npsn: string, f: FilterBuku): Promise<BarisBkpPajakDto[]> {
    return this.db.run(ctx, (tx) => repo.daftarBkpPajak(tx, { npsn, tahun: f.tahun, sumberDanaKode: f.sumberDanaKode }, f.bulan));
  }

  // ---------- Bacaan ----------
  ambil(ctx: RequestContext, id: string): Promise<TransaksiDto | undefined> {
    return this.db.run(ctx, (tx) => repo.ambilTransaksi(tx, id));
  }

  bku(ctx: RequestContext, npsn: string, f: FilterBuku & { buku?: 'TUNAI' | 'BANK' }): Promise<BarisBkuDto[]> {
    return this.db.run(ctx, (tx) => repo.daftarBku(tx, { npsn, tahun: f.tahun, sumberDanaKode: f.sumberDanaKode }, f.bulan, f.buku));
  }

  rkas(ctx: RequestContext, npsn: string, f: FilterBuku): Promise<BarisRkasDto[]> {
    return this.db.run(ctx, (tx) => repo.daftarRkas(tx, { npsn, tahun: f.tahun, sumberDanaKode: f.sumberDanaKode }));
  }

  ringkasan(ctx: RequestContext, npsn: string, f: FilterBuku): Promise<RingkasanBukuDto> {
    return this.db.run(ctx, (tx) => repo.ringkasan(tx, { npsn, tahun: f.tahun, sumberDanaKode: f.sumberDanaKode }, bulanDari(hariIniJakarta())));
  }
}
