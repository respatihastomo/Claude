import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DbContextService, GalatHttp, RequestContext } from '@arkas/common-ms';
import { DaftarMitraInput } from '@arkas/kontrak';
import { z } from 'zod';
import { UbahMitraInput } from '@arkas/kontrak';
import { bukaSumberDana, kunciPembukaan, terapkanPembukaan, tutupSumberDana } from '../pembukaan';
import { rahasiaAcak, sha256 } from '../mitra/keamanan';

/** UC-34, UC-37, UC-39 (Balai SDSP) + pemantauan transaksi Mitra (Pemantau/Auditor baca saja). RLS di db_integrasi. */
@Injectable()
export class AdminIntegrasiService {
  constructor(@Inject(DbContextService) private readonly db: DbContextService) {}

  daftarMitra(ctx: RequestContext) {
    return this.db.run(ctx, async (tx) => (await tx.query(
      `SELECT m.kode, m.nama, m.base_url AS "baseUrl", m.client_id AS "clientId", m.ip_diizinkan AS "ipDiizinkan", m.status, m.dibuat_at AS "dibuatAt",
              (SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM integrasi.pembukaan_sumber_dana p WHERE p.mitra_kode = m.kode GROUP BY status) x) AS pembukaan,
              (SELECT count(*)::int FROM integrasi.transaksi_mitra t WHERE t.mitra_kode = m.kode) AS "jumlahTransaksi"
       FROM integrasi.mitra_siplah m ORDER BY m.kode`)).rows);
  }

  private kredensial(kode: string) {
    return { clientId: `${kode.toLowerCase().replace(/_/g, '-')}-${randomBytes(3).toString('hex')}`, clientSecret: rahasiaAcak(32), hmacRahasia: rahasiaAcak(32) };
  }

  /** Rahasia hanya ditampilkan sekali saat dibuat/dirotasi; yang disimpan untuk client_secret hanya hash-nya. */
  daftarkan(ctx: RequestContext, i: DaftarMitraInput) {
    return this.db.run(ctx, async (tx) => {
      const ada = await tx.query('SELECT 1 FROM integrasi.mitra_siplah WHERE kode = $1', [i.kode]);
      if (ada.rowCount) throw new GalatHttp(409, 'MITRA_SUDAH_ADA', `Mitra ${i.kode} sudah terdaftar`);
      const k = this.kredensial(i.kode);
      await tx.query(
        `INSERT INTO integrasi.mitra_siplah (kode, nama, base_url, client_id, client_secret_hash, hmac_rahasia, ip_diizinkan, dibuat_oleh)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [i.kode, i.nama, i.baseUrl.replace(/\/+$/, ''), k.clientId, sha256(k.clientSecret), k.hmacRahasia, i.ipDiizinkan, ctx.penggunaId]);
      // fitur 21: setiap sumber dana yang aktif otomatis dibuka di Mitra baru
      const sd = await tx.query<{ kode: string }>('SELECT kode FROM integrasi.sumber_dana_lokal WHERE aktif ORDER BY kode');
      for (const s of sd.rows) await bukaSumberDana(tx, s.kode, ctx.penggunaId, { naikkanVersi: false, hanyaMitra: i.kode });
      return { kode: i.kode, ...k, pembukaanDibuat: sd.rowCount };
    });
  }

  ubahMitra(ctx: RequestContext, kode: string, u: z.infer<typeof UbahMitraInput>) {
    return this.db.run(ctx, async (tx) => {
      const r = await tx.query(
        `UPDATE integrasi.mitra_siplah SET nama = coalesce($2, nama), base_url = coalesce($3, base_url), ip_diizinkan = coalesce($4, ip_diizinkan),
           status = coalesce($5, status), diubah_at = now() WHERE kode = $1 RETURNING kode, status`,
        [kode, u.nama ?? null, u.baseUrl?.replace(/\/+$/, '') ?? null, u.ipDiizinkan ?? null, u.status ?? null]);
      if (!r.rowCount) throw new GalatHttp(404, 'MITRA_TIDAK_DITEMUKAN', `Mitra ${kode} tidak ditemukan`);
      if (r.rows[0].status === 'AKTIF') {
        const sd = await tx.query<{ kode: string }>('SELECT kode FROM integrasi.sumber_dana_lokal WHERE aktif');
        for (const s of sd.rows) await bukaSumberDana(tx, s.kode, ctx.penggunaId, { naikkanVersi: false, hanyaMitra: kode });
      }
      return r.rows[0];
    });
  }

  rotasiRahasia(ctx: RequestContext, kode: string) {
    return this.db.run(ctx, async (tx) => {
      const k = this.kredensial(kode);
      const r = await tx.query(
        `UPDATE integrasi.mitra_siplah SET client_secret_hash = $2, hmac_rahasia = $3, diubah_at = now() WHERE kode = $1 RETURNING client_id`,
        [kode, sha256(k.clientSecret), k.hmacRahasia]);
      if (!r.rowCount) throw new GalatHttp(404, 'MITRA_TIDAK_DITEMUKAN', `Mitra ${kode} tidak ditemukan`);
      return { kode, clientId: r.rows[0].client_id as string, clientSecret: k.clientSecret, hmacRahasia: k.hmacRahasia };
    });
  }

  /** Matriks pembukaan (sumber dana x Mitra) untuk layar pemantauan Balai. */
  matriks(ctx: RequestContext) {
    return this.db.run(ctx, async (tx) => {
      const sd = (await tx.query(`SELECT kode, nama, kategori, aktif FROM integrasi.sumber_dana_lokal ORDER BY kategori, kode`)).rows;
      const mitra = (await tx.query(`SELECT kode, nama, status FROM integrasi.mitra_siplah ORDER BY kode`)).rows;
      const sel = (await tx.query(
        `SELECT id, sumber_dana_kode AS "sumberDanaKode", mitra_kode AS "mitraKode", versi, target, status, percobaan, galat_terakhir AS "galatTerakhir",
                dikonfirmasi_at AS "dikonfirmasiAt", diubah_at AS "diubahAt" FROM integrasi.pembukaan_sumber_dana`)).rows;
      return { sumberDana: sd, mitra, sel };
    });
  }

  riwayat(ctx: RequestContext, id: string) {
    return this.db.run(ctx, async (tx) => (await tx.query(
      `SELECT versi, dari_status AS "dariStatus", ke_status AS "keStatus", peristiwa, catatan, oleh, at FROM integrasi.pembukaan_riwayat WHERE pembukaan_id = $1 ORDER BY id DESC LIMIT 50`, [id])).rows);
  }

  kirimUlang(ctx: RequestContext, id: string) {
    return this.db.run(ctx, async (tx) => {
      const [b] = await kunciPembukaan(tx, 'id = $1', [id]);
      if (!b) throw new GalatHttp(404, 'PEMBUKAAN_TIDAK_ADA', 'Pembukaan tidak ditemukan');
      return terapkanPembukaan(tx, b, { aksi: 'KIRIM_ULANG' }, ctx.penggunaId, 'Dikirim ulang oleh Balai SDSP');
    });
  }

  tutup(ctx: RequestContext, kode: string, alasan: string) {
    return this.db.run(ctx, async (tx) => ({ sumberDanaKode: kode, ditutup: await tutupSumberDana(tx, kode, ctx.penggunaId, alasan) }));
  }

  transaksiMitra(ctx: RequestContext, f: { npsn?: string; mitraKode?: string; status?: string; halaman: number }) {
    return this.db.run(ctx, async (tx) => {
      const r = await tx.query(
        `SELECT t.id, t.mitra_kode AS "mitraKode", t.transaction_id AS "transactionId", t.npsn, t.tahun, t.sumber_dana_kode AS "sumberDanaKode", t.tanggal::text,
                t.nama_toko AS "namaToko", t.total::float8 AS total, t.status, t.alasan_batal AS "alasanBatal", t.diterima_at AS "diterimaAt",
                (SELECT count(*)::int FROM integrasi.item_mitra i WHERE i.transaksi_id = t.id) AS "jumlahItem",
                (SELECT count(*)::int FROM integrasi.item_mitra i WHERE i.transaksi_id = t.id AND i.baris_id IS NULL) AS "itemTanpaBaris"
         FROM integrasi.transaksi_mitra t
         WHERE ($1::text IS NULL OR t.npsn = $1) AND ($2::text IS NULL OR t.mitra_kode = $2) AND ($3::text IS NULL OR t.status = $3)
         ORDER BY t.diterima_at DESC LIMIT 50 OFFSET $4`, [f.npsn ?? null, f.mitraKode ?? null, f.status ?? null, (f.halaman - 1) * 50]);
      return r.rows;
    });
  }
}
