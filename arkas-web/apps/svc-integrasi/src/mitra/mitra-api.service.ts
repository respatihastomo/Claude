import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { AturanError, bolehBelanja, keRupiah, keSen, Pembukaan } from '@arkas/aturan';
import { GalatHttp, tulisOutbox } from '@arkas/common-ms';
import {
  KonfirmasiPembukaanInput, PembukaanDikonfirmasiData, TOPIK, TransaksiMitraDibatalkanData, TransaksiMitraDiterimaData, TransaksiMitraInput, ValidasiKeranjangInput,
} from '@arkas/kontrak';
import { z } from 'zod';
import { KONFIGURASI, POOL_WORKER, SKEMA } from '../infra/tokens';
import type { Konfigurasi } from '../config';
import { kunciPembukaan, terapkanPembukaan } from '../pembukaan';
import { MitraTerverifikasi, samaWaktuKonstan, sha256, terbitkanTokenMitra, UMUR_TOKEN_DETIK } from './keamanan';

type Buku = { npsn: string; tahun: number; sumberDanaKode: string };
interface BarisAnggaran {
  baris_id: string; akar_baris_id: string; versi: number; kode_rekening: string; kegiatan: string; uraian: string;
  volume: string; satuan: string | null; harga_satuan: string; total: string; terpakai: string;
}
/** Hash kanonik (kunci diurutkan) untuk mendeteksi transaction_id yang dipakai ulang dengan isi berbeda. */
function hashKanonik(v: unknown): string {
  const urut = (x: unknown): unknown => Array.isArray(x) ? x.map(urut) : x && typeof x === 'object'
    ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, urut((x as Record<string, unknown>)[k])])) : x;
  return sha256(JSON.stringify(urut(v)));
}

/**
 * UC-35/38: API Mitra SIPLah di ARKAS Web. Berjalan dengan login pekerja (identitas pemanggil = Mitra dari token OAuth2),
 * setiap kueri disaring eksplisit dengan mitra_kode. Semua tulis + outbox dalam satu transaksi lokal.
 */
@Injectable()
export class MitraApiService {
  constructor(@Inject(POOL_WORKER) private readonly pool: Pool, @Inject(KONFIGURASI) private readonly cfg: Konfigurasi) {}

  private async tx<T>(f: (tx: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.peran', 'SISTEM', true)`);
      const r = await f(c);
      await c.query('COMMIT');
      return r;
    } catch (e) { await c.query('ROLLBACK').catch(() => undefined); throw e; } finally { c.release(); }
  }

  async token(clientId: string, clientSecret: string) {
    const r = await this.pool.query<{ kode: string; client_secret_hash: string; status: string }>(
      'SELECT kode, client_secret_hash, status FROM integrasi.mitra_siplah WHERE client_id = $1', [clientId]);
    const m = r.rows[0];
    // pembanding tetap dijalankan walau client_id salah agar waktu respons tidak membocorkan keberadaan klien
    const ok = samaWaktuKonstan(sha256(clientSecret), m?.client_secret_hash ?? '0'.repeat(64)) && !!m;
    if (!ok) throw new GalatHttp(401, 'KLIEN_TIDAK_VALID', 'client_id atau client_secret salah');
    if (m.status !== 'AKTIF') throw new GalatHttp(403, 'MITRA_NONAKTIF', 'Mitra tidak aktif');
    return { access_token: await terbitkanTokenMitra(this.cfg.mitraTokenSecret, m.kode), token_type: 'Bearer', expires_in: UMUR_TOKEN_DETIK };
  }

  private async pastikanDibuka(c: PoolClient, mitra: string, sumberDanaKode: string) {
    const r = await c.query<Pembukaan & { versi: number }>(
      'SELECT status, versi, target FROM integrasi.pembukaan_sumber_dana WHERE mitra_kode = $1 AND sumber_dana_kode = $2', [mitra, sumberDanaKode]);
    if (!bolehBelanja(r.rows[0])) {
      throw new AturanError('SUMBER_DANA_BELUM_DIBUKA', `Sumber dana ${sumberDanaKode} belum dikonfirmasi DIBUKA untuk Mitra ini`, { status: r.rows[0]?.status ?? null, target: r.rows[0]?.target ?? null });
    }
  }

  private async barisAnggaran(c: PoolClient, b: Buku): Promise<BarisAnggaran[]> {
    return (await c.query<BarisAnggaran>(
      `SELECT r.baris_id, r.akar_baris_id, r.versi, r.kode_rekening, r.kegiatan, r.uraian, r.volume, r.satuan, r.harga_satuan, r.total,
              coalesce((SELECT sum(i.jumlah) FROM integrasi.item_mitra i JOIN integrasi.transaksi_mitra t ON t.id = i.transaksi_id
                        WHERE i.akar_baris_id = r.akar_baris_id AND t.status = 'DITERIMA'), 0) AS terpakai
       FROM integrasi.rkas_anggaran_mitra r
       WHERE r.npsn = $1 AND r.tahun = $2 AND r.sumber_dana_kode = $3 AND r.aktif ORDER BY r.kegiatan, r.uraian`,
      [b.npsn, b.tahun, b.sumberDanaKode])).rows;
  }

  /** GET /mitra/v1/sekolah/{npsn}/anggaran — rencana yang disahkan & sisa (dikurangi belanja Mitra yang diterima). */
  anggaran(mitra: MitraTerverifikasi, b: Buku) {
    return this.tx(async (c) => {
      await this.pastikanDibuka(c, mitra.kode, b.sumberDanaKode);
      const s = (await c.query<{ nama: string; jenjang_kode: string }>('SELECT nama, jenjang_kode FROM integrasi.ref_sekolah_lokal WHERE npsn = $1', [b.npsn])).rows[0];
      const baris = await this.barisAnggaran(c, b);
      if (!baris.length) throw new GalatHttp(404, 'RKAS_BELUM_DISAHKAN', `Belum ada RKAS ${b.sumberDanaKode} ${b.tahun} yang disahkan untuk NPSN ${b.npsn}`);
      const data = baris.map((r) => ({
        barisId: r.baris_id, kodeRekening: r.kode_rekening, kegiatan: r.kegiatan, uraian: r.uraian, volume: Number(r.volume), satuan: r.satuan,
        hargaSatuan: Number(r.harga_satuan), total: Number(r.total), terpakai: Number(r.terpakai), sisa: keRupiah(keSen(r.total) - keSen(r.terpakai)),
      }));
      return {
        npsn: b.npsn, namaSekolah: s?.nama ?? null, jenjang: s?.jenjang_kode ?? null, tahun: b.tahun, sumberDanaKode: b.sumberDanaKode, versiRkas: baris[0].versi,
        totalAnggaran: keRupiah(data.reduce((a, x) => a + keSen(x.total), 0)), totalSisa: keRupiah(data.reduce((a, x) => a + keSen(x.sisa), 0)), baris: data,
      };
    });
  }

  /** POST /mitra/v1/validasi-keranjang — cek tiap item terhadap sisa baris (ID baris, atau gabungan baris sekode rekening). */
  validasiKeranjang(mitra: MitraTerverifikasi, k: ValidasiKeranjangInput) {
    return this.tx(async (c) => {
      await this.pastikanDibuka(c, mitra.kode, k.sumberDanaKode);
      const baris = await this.barisAnggaran(c, k);
      const sisa = new Map(baris.map((r) => [r.baris_id, keSen(r.total) - keSen(r.terpakai)]));
      const items = k.items.map((it) => {
        const kandidat = it.barisId ? baris.filter((r) => r.baris_id === it.barisId) : baris.filter((r) => r.kode_rekening === it.kodeRekening);
        if (!kandidat.length) {
          return { itemId: it.itemId, ok: false, kode: it.barisId ? 'BARIS_RKAS_TIDAK_SAH' : 'DI_LUAR_RENCANA', sisa: 0,
            pesan: it.barisId ? 'Baris RKAS tidak ada di RKAS yang disahkan' : `Kode rekening ${it.kodeRekening} tidak ada di RKAS sekolah` };
        }
        let perlu = keSen(it.jumlah);
        const tersedia = kandidat.reduce((a, r) => a + Math.max(0, sisa.get(r.baris_id)!), 0);
        if (perlu > tersedia) return { itemId: it.itemId, ok: false, kode: 'MELEBIHI_SISA_ANGGARAN', sisa: keRupiah(tersedia), pesan: 'Nilai melebihi sisa anggaran di RKAS' };
        for (const r of kandidat) { const pakai = Math.min(perlu, Math.max(0, sisa.get(r.baris_id)!)); sisa.set(r.baris_id, sisa.get(r.baris_id)! - pakai); perlu -= pakai; }
        return { itemId: it.itemId, ok: true, kode: 'OK', sisa: keRupiah(tersedia - keSen(it.jumlah)) };
      });
      return { valid: items.every((i) => i.ok), items };
    });
  }

  /** POST /mitra/v1/transaksi — idempoten per (mitra, transactionId); 202 baru, 200 ulangan identik, 409 isi berbeda. */
  terimaTransaksi(mitra: MitraTerverifikasi, t: TransaksiMitraInput) {
    if (Number(t.tanggal.slice(0, 4)) !== t.tahun) throw new AturanError('TANGGAL_DI_LUAR_TAHUN', 'Tanggal transaksi harus di tahun anggaran');
    const hash = hashKanonik(t);
    return this.tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`mitra:${mitra.kode}:${t.transactionId}`]);
      const lama = (await c.query<{ id: string; payload_hash: string; status: string; diterima_at: Date }>(
        'SELECT id, payload_hash, status, diterima_at FROM integrasi.transaksi_mitra WHERE mitra_kode = $1 AND transaction_id = $2', [mitra.kode, t.transactionId])).rows[0];
      if (lama) {
        if (lama.payload_hash !== hash) throw new GalatHttp(409, 'TRANSACTION_ID_DIPAKAI_ULANG', 'transactionId sudah dipakai untuk transaksi dengan isi berbeda');
        return { replay: true, hasil: { id: lama.id, transactionId: t.transactionId, status: lama.status, diterimaAt: lama.diterima_at.toISOString() } };
      }
      await this.pastikanDibuka(c, mitra.kode, t.sumberDanaKode);
      const baris = new Map((await this.barisAnggaran(c, t)).map((r) => [r.baris_id, r]));
      if (!baris.size) throw new AturanError('RKAS_BELUM_DISAHKAN', `Belum ada RKAS ${t.sumberDanaKode} ${t.tahun} yang disahkan untuk NPSN ${t.npsn}`);
      const asing = t.items.filter((i) => i.barisId && !baris.has(i.barisId)).map((i) => i.itemId);
      if (asing.length) throw new AturanError('BARIS_RKAS_TIDAK_SAH', 'barisId tidak ada di RKAS yang disahkan sekolah ini', { itemId: asing });

      const items = t.items.map((i) => ({ ...i, jumlah: keRupiah(Math.round(i.volume * keSen(i.hargaSatuan))) }));
      const total = keRupiah(items.reduce((a, i) => a + keSen(i.jumlah), 0));
      const r = await c.query<{ id: string; diterima_at: Date }>(
        `INSERT INTO integrasi.transaksi_mitra (mitra_kode, transaction_id, npsn, tahun, sumber_dana_kode, tanggal, nama_toko, penjual_punya_npwp, total, payload_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, diterima_at`,
        [mitra.kode, t.transactionId, t.npsn, t.tahun, t.sumberDanaKode, t.tanggal, t.namaToko, t.penjualPunyaNpwp, total, hash]);
      const { id, diterima_at } = r.rows[0];
      for (const i of items) {
        await c.query(
          `INSERT INTO integrasi.item_mitra (transaksi_id, item_id, baris_id, akar_baris_id, kode_rekening, uraian, volume, satuan, harga_satuan, jumlah)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, i.itemId, i.barisId, i.barisId ? baris.get(i.barisId)!.akar_baris_id : null, i.kodeRekening, i.uraian, i.volume, i.satuan, i.hargaSatuan, i.jumlah]);
      }
      const ev: TransaksiMitraDiterimaData = {
        transaksiMitraId: id, mitraKode: mitra.kode, transactionId: t.transactionId, npsn: t.npsn, tahun: t.tahun, sumberDanaKode: t.sumberDanaKode,
        tanggal: t.tanggal, namaToko: t.namaToko, penjualPunyaNpwp: t.penjualPunyaNpwp, total, items, diterimaAt: diterima_at.toISOString(),
      };
      await tulisOutbox(c, SKEMA, { topik: TOPIK.TRANSAKSI_MITRA_DITERIMA, tipe: 'TransaksiMitraDiterima', agregatId: id, payload: ev });
      return { replay: false, hasil: { id, transactionId: t.transactionId, status: 'DITERIMA', diterimaAt: ev.diterimaAt } };
    });
  }

  /** POST /mitra/v1/transaksi/{transactionId}/status — pembatalan/retur (kompensasi saga). */
  ubahStatus(mitra: MitraTerverifikasi, transactionId: string, s: { status: 'DIBATALKAN' | 'RETUR'; alasan: string }) {
    return this.tx(async (c) => {
      const t = (await c.query<{ id: string; status: string; npsn: string; tahun: number; sumber_dana_kode: string }>(
        `SELECT id, status, npsn, tahun, sumber_dana_kode FROM integrasi.transaksi_mitra WHERE mitra_kode = $1 AND transaction_id = $2 FOR UPDATE`,
        [mitra.kode, transactionId])).rows[0];
      if (!t) throw new GalatHttp(404, 'TRANSAKSI_TIDAK_DITEMUKAN', `transactionId ${transactionId} tidak dikenal`);
      if (t.status === s.status) return { id: t.id, transactionId, status: t.status };
      if (t.status !== 'DITERIMA') throw new GalatHttp(409, 'TRANSAKSI_MITRA_FINAL', `Transaksi sudah ${t.status}`);
      const at = new Date().toISOString();
      await c.query(`UPDATE integrasi.transaksi_mitra SET status = $2, alasan_batal = $3, dibatalkan_at = $4 WHERE id = $1`, [t.id, s.status, s.alasan, at]);
      const ev: TransaksiMitraDibatalkanData = {
        transaksiMitraId: t.id, mitraKode: mitra.kode, transactionId, npsn: t.npsn, tahun: t.tahun, sumberDanaKode: t.sumber_dana_kode, status: s.status, alasan: s.alasan, at,
      };
      await tulisOutbox(c, SKEMA, { topik: TOPIK.TRANSAKSI_MITRA_DIBATALKAN, tipe: 'TransaksiMitraDibatalkan', agregatId: t.id, payload: ev });
      return { id: t.id, transactionId, status: s.status };
    });
  }

  /** GET /mitra/v1/sumber-dana — status pembukaan semua sumber dana di Mitra ini. */
  async sumberDana(mitra: MitraTerverifikasi) {
    const r = await this.pool.query(
      `SELECT p.sumber_dana_kode AS kode, s.nama, s.kategori, p.versi, p.target, p.status, p.dikonfirmasi_at AS "dikonfirmasiAt"
       FROM integrasi.pembukaan_sumber_dana p LEFT JOIN integrasi.sumber_dana_lokal s ON s.kode = p.sumber_dana_kode
       WHERE p.mitra_kode = $1 ORDER BY p.sumber_dana_kode`, [mitra.kode]);
    return { data: r.rows };
  }

  /** GET /mitra/v1/sumber-dana/{kode}/sekolah — sekolah berhak, berhalaman (kursor = NPSN terakhir). */
  async sekolahBerhak(mitra: MitraTerverifikasi, kode: string, q: { tahun: number; kursor?: string; batas: number }) {
    const p = (await this.pool.query<{ target: string }>('SELECT target FROM integrasi.pembukaan_sumber_dana WHERE mitra_kode = $1 AND sumber_dana_kode = $2', [mitra.kode, kode])).rows[0];
    if (!p || p.target !== 'BUKA') throw new GalatHttp(404, 'PEMBUKAAN_TIDAK_ADA', `Sumber dana ${kode} tidak sedang dibuka untuk Mitra ini`);
    const r = await this.pool.query<{ npsn: string; jenjang: string | null; nilai: string }>(
      `SELECT b.npsn, s.jenjang_kode AS jenjang, b.nilai FROM integrasi.sekolah_berhak_lokal b LEFT JOIN integrasi.ref_sekolah_lokal s ON s.npsn = b.npsn
       WHERE b.sumber_dana_kode = $1 AND b.tahun = $2 AND ($3::text IS NULL OR b.npsn > $3) ORDER BY b.npsn LIMIT $4`,
      [kode, q.tahun, q.kursor ?? null, q.batas + 1]);
    const ada = r.rows.length > q.batas;
    const data = r.rows.slice(0, q.batas).map((x) => ({ npsn: x.npsn, jenjang: x.jenjang, nilai: Number(x.nilai), status: 'BERHAK' }));
    return { data, pagination: { kursorBerikut: ada ? data[data.length - 1].npsn : null, batas: q.batas } };
  }

  /** POST /mitra/v1/sumber-dana/{kode}/konfirmasi — 7.2.4 Terima konfirmasi pembukaan (transisiPembukaan). */
  konfirmasi(mitra: MitraTerverifikasi, kode: string, k: z.infer<typeof KonfirmasiPembukaanInput>) {
    return this.tx(async (c) => {
      const [b] = await kunciPembukaan(c, 'mitra_kode = $1 AND sumber_dana_kode = $2', [mitra.kode, kode]);
      if (!b) throw new GalatHttp(404, 'PEMBUKAAN_TIDAK_ADA', `Tidak ada pembukaan ${kode} untuk Mitra ini`);
      let baru: Pembukaan;
      try {
        baru = await terapkanPembukaan(c, b, { aksi: 'KONFIRMASI', status: k.status, versi: k.versi }, `MITRA:${mitra.kode}`, k.catatan);
      } catch (e) {
        if (e instanceof AturanError && e.kode === 'VERSI_USANG') throw new GalatHttp(409, e.kode, e.message, e.detail as Record<string, unknown>);
        throw e;
      }
      if (baru.status !== b.status) {
        await c.query('UPDATE integrasi.pembukaan_sumber_dana SET dikonfirmasi_at = now() WHERE id = $1', [b.id]);
        const ev: PembukaanDikonfirmasiData = { sumberDanaKode: kode, mitraKode: mitra.kode, versi: baru.versi, status: k.status, at: new Date().toISOString() };
        await tulisOutbox(c, SKEMA, { topik: TOPIK.PEMBUKAAN_DIKONFIRMASI, tipe: 'PembukaanDikonfirmasi', agregatId: `${kode}:${mitra.kode}`, payload: ev });
      }
      return { status: baru.status, versiDikonfirmasi: baru.versi };
    });
  }
}
