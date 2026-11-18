import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { Cakupan, periksaPemberianPeran, PeranDiberikan, RujukanCakupan } from '@arkas/aturan';
import { DbContextService, GalatHttp, RequestContext, tulisOutbox } from '@arkas/common-ms';
import { CakupanInput, PenggunaDibuatData, PenggunaDto, PeranDiubahData, TambahPenggunaInput, TOPIK } from '@arkas/kontrak';
import { SKEMA } from '../infra/tokens';
import * as repo from '../auth/repo';

/** UC-20 / SK-12 — pengelolaan pengguna & peran berjenjang sesuai cakupan peran aktif pengelola. */
@Injectable()
export class PenggunaService {
  constructor(@Inject(DbContextService) private readonly db: DbContextService) {}

  /** Pengguna yang memiliki setidaknya satu peran dalam cakupan pengelola (RLS). */
  daftar(ctx: RequestContext): Promise<PenggunaDto[]> {
    return this.db.run(ctx, async (tx) => {
      const ids = (await tx.query<{ pengguna_id: string }>(`SELECT DISTINCT pengguna_id FROM auth.peran_pengguna WHERE pengguna_id::text <> $1`, [ctx.penggunaId])).rows;
      return repo.penggunaDto(tx, ids.map((x) => x.pengguna_id)); // peran yang tampil sudah dibatasi RLS
    });
  }

  /** Buat pengguna baru (atau pakai yang sudah ada berdasarkan email) lalu beri satu peran. */
  tambah(ctx: RequestContext, i: TambahPenggunaInput): Promise<PenggunaDto> {
    return this.db.run(ctx, async (tx) => {
      // Cari pengguna lewat fungsi pemilik agar email yang belum terlihat (di luar cakupan) tetap dapat ditautkan tanpa membocorkan data.
      const ada = (await tx.query<{ id: string }>(`SELECT id FROM auth.pengguna WHERE email = $1`, [i.email])).rows[0];
      let id = ada?.id;
      if (!id) {
        const terpakai = await this.emailTerdaftar(tx, i.email);
        if (terpakai) throw new GalatHttp(409, 'EMAIL_SUDAH_TERDAFTAR', 'Email sudah terdaftar untuk pengguna di luar cakupan Anda; minta pengelolanya memberi peran');
        id = randomUUID();
        await this.periksa(tx, ctx, id, i.peran);
        await tx.query(`INSERT INTO auth.pengguna (id, email, nama, dibuat_oleh) VALUES ($1,$2,$3,$4)`, [id, i.email, i.nama, ctx.penggunaId]);
        const data: PenggunaDibuatData = { penggunaId: id, dibuatOleh: ctx.penggunaId, at: new Date().toISOString() };
        await tulisOutbox(tx, SKEMA, { topik: TOPIK.PENGGUNA_DIBUAT, tipe: 'PenggunaDibuat', agregatId: id, correlationId: ctx.requestId, payload: data });
      }
      await this.beriDalamTx(tx, ctx, id, i.peran);
      return (await repo.penggunaDto(tx, [id]))[0];
    });
  }

  beri(ctx: RequestContext, penggunaId: string, c: CakupanInput): Promise<PenggunaDto> {
    return this.db.run(ctx, async (tx) => {
      const ada = (await tx.query(`SELECT 1 FROM auth.pengguna WHERE id = $1`, [penggunaId])).rowCount;
      if (!ada) throw new GalatHttp(404, 'PENGGUNA_TIDAK_DITEMUKAN', 'Pengguna tidak ditemukan dalam cakupan Anda');
      await this.beriDalamTx(tx, ctx, penggunaId, c);
      return (await repo.penggunaDto(tx, [penggunaId]))[0];
    });
  }

  cabut(ctx: RequestContext, penggunaId: string, peranId: string, alasan: string): Promise<PenggunaDto> {
    return this.db.run(ctx, async (tx) => {
      const r = (await tx.query(`SELECT * FROM auth.peran_pengguna WHERE id = $1 AND pengguna_id = $2`, [peranId, penggunaId])).rows[0];
      if (!r) throw new GalatHttp(404, 'PERAN_TIDAK_DITEMUKAN', 'Peran tidak ditemukan dalam cakupan Anda');
      if (r.dicabut_at) throw new GalatHttp(409, 'PERAN_SUDAH_DICABUT', 'Peran sudah dicabut');
      await this.periksa(tx, ctx, penggunaId, { peran: r.peran, npsn: r.npsn ?? undefined, wilayahKode: r.wilayah_kode ?? undefined,
        direktoratKode: r.direktorat_kode ?? undefined, ditjenKode: r.ditjen_kode ?? undefined, berlakuSampai: r.berlaku_sampai?.toISOString() }, true);
      await tx.query(`UPDATE auth.peran_pengguna SET dicabut_oleh = $2, dicabut_at = now(), alasan_cabut = $3 WHERE id = $1`, [peranId, ctx.penggunaId, alasan]);
      await this.terbitPeranDiubah(tx, ctx, penggunaId, peranId, 'CABUT', r, alasan);
      return (await repo.penggunaDto(tx, [penggunaId]))[0];
    });
  }

  // ---------- pembantu ----------
  private async beriDalamTx(tx: PoolClient, ctx: RequestContext, penggunaId: string, c: CakupanInput) {
    await this.periksa(tx, ctx, penggunaId, c);
    const id = randomUUID();
    await tx.query(
      `INSERT INTO auth.peran_pengguna (id, pengguna_id, peran, npsn, wilayah_kode, direktorat_kode, ditjen_kode, berlaku_sampai, diberikan_oleh)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, penggunaId, c.peran, c.npsn ?? null, c.wilayahKode ?? null, c.direktoratKode ?? null, c.ditjenKode ?? null, c.berlakuSampai ?? null, ctx.penggunaId],
    );
    await this.terbitPeranDiubah(tx, ctx, penggunaId, id, 'BERI', { peran: c.peran, npsn: c.npsn, wilayah_kode: c.wilayahKode, direktorat_kode: c.direktoratKode, ditjen_kode: c.ditjenKode });
  }

  /** Aturan SK-12 di aplikasi (pesan jelas); RLS dalam_kelola() menjadi lapis kedua di basis data. */
  private async periksa(tx: PoolClient, ctx: RequestContext, targetId: string, c: CakupanInput, cabut = false) {
    const ref = await this.rujukan(tx);
    const pemberi: Cakupan & { penggunaId: string } = {
      penggunaId: ctx.penggunaId, peran: ctx.peran as PeranDiberikan, npsn: ctx.npsn, wilayahKode: ctx.wilayahKode,
      direktoratKode: ctx.direktoratIds[0], ditjenKode: ctx.ditjenKode,
    };
    periksaPemberianPeran(pemberi, { ...c, penggunaId: targetId } as Cakupan & { penggunaId: string }, ref, new Date(), { pencabutan: cabut });
  }

  private async rujukan(tx: PoolClient): Promise<RujukanCakupan> {
    const [w, d, s] = await Promise.all([
      tx.query<{ kode: string }>(`SELECT kode FROM auth.ref_wilayah_lokal`),
      tx.query<{ kode: string; ditjen_kode: string }>(`SELECT kode, ditjen_kode FROM auth.ref_direktorat_lokal`),
      tx.query<{ npsn: string; wilayah_kode: string }>(`SELECT npsn, wilayah_kode FROM auth.ref_sekolah_lokal`),
    ]);
    const wilayah = new Set(w.rows.map((x) => x.kode));
    const dir = new Map(d.rows.map((x) => [x.kode, x.ditjen_kode]));
    const sek = new Map(s.rows.map((x) => [x.npsn, x.wilayah_kode]));
    return { wilayahAda: (k) => wilayah.has(k), ditjenAda: (k) => [...dir.values()].includes(k), ditjenDirektorat: (k) => dir.get(k), wilayahSekolah: (n) => sek.get(n) };
  }

  private async emailTerdaftar(tx: PoolClient, email: string): Promise<boolean> {
    return (await tx.query<{ ada: boolean }>(`SELECT auth.email_terdaftar($1) AS ada`, [email])).rows[0].ada;
  }

  private async terbitPeranDiubah(tx: PoolClient, ctx: RequestContext, penggunaId: string, peranId: string, aksi: 'BERI' | 'CABUT',
    r: { peran: string; npsn?: string | null; wilayah_kode?: string | null; direktorat_kode?: string | null; ditjen_kode?: string | null }, alasan?: string) {
    const data: PeranDiubahData = {
      penggunaId, peranPenggunaId: peranId, aksi, peran: r.peran, npsn: r.npsn ?? null, wilayahKode: r.wilayah_kode ?? null,
      direktoratKode: r.direktorat_kode ?? null, ditjenKode: r.ditjen_kode ?? null, oleh: ctx.penggunaId, at: new Date().toISOString(), ...(alasan ? { alasan } : {}),
    };
    await tulisOutbox(tx, SKEMA, { topik: TOPIK.PERAN_DIUBAH, tipe: 'PeranDiubah', agregatId: penggunaId, correlationId: ctx.requestId, payload: data });
  }
}
