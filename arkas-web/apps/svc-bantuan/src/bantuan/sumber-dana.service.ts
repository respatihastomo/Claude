import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { AturanError, bolehUbahSumberDana, cekKelengkapan, putuskanDokumen, StatusSumberDanaBantuan, transisiSumberDanaBantuan } from '@arkas/aturan';
import { DbContextService, GalatHttp, RequestContext, tulisOutbox } from '@arkas/common-ms';
import { PenyaluranDicatatData, PenyaluranInput, SumberDanaBantuanInput, SumberDanaDisahkanData, TOPIK } from '@arkas/kontrak';
import { PENYIMPANAN, SKEMA } from '../infra/tokens';
import type { PenyimpananBerkas } from '../infra/penyimpanan';
import { kunciBerkas, namaAman, periksaBerkas } from './berkas';

type Tx = PoolClient;
const wajibPeran = (ctx: RequestContext, ...p: string[]) => { if (!p.includes(ctx.peran)) throw new GalatHttp(403, 'PERAN_TIDAK_DIIZINKAN', `Aksi ini untuk ${p.join('/')}`); };

/** UC-21–29 svc-bantuan. Semua akses lewat RLS (boleh_lihat per direktorat/ditjen/sekolah); aturan status di @arkas/aturan. */
@Injectable()
export class SumberDanaService {
  constructor(@Inject(DbContextService) private readonly db: DbContextService, @Inject(PENYIMPANAN) private readonly berkas: PenyimpananBerkas) {}

  private async ambil(tx: Tx, kode: string, kunci = false) {
    const r = await tx.query<{ kode: string; nama: string; direktorat_kode: string; tahun: number; jenjang: string[]; status: StatusSumberDanaBantuan; pengajuan_mulai: string | null; pengajuan_selesai: string | null }>(
      `SELECT kode, nama, direktorat_kode, tahun, jenjang, status, pengajuan_mulai::text, pengajuan_selesai::text FROM banper.sumber_dana_bantuan WHERE kode = $1 ${kunci ? 'FOR UPDATE' : ''}`, [kode]);
    if (!r.rows[0]) throw new GalatHttp(404, 'SUMBER_DANA_TIDAK_DITEMUKAN', `Sumber dana ${kode} tidak ditemukan`);
    return r.rows[0];
  }
  private async bisaDiubah(tx: Tx, ctx: RequestContext, kode: string) {
    wajibPeran(ctx, 'ADMIN_DIREKTORAT');
    const s = await this.ambil(tx, kode, true);
    if (!bolehUbahSumberDana(s.status)) throw new AturanError('SUMBER_DANA_TERKUNCI', `Sumber dana berstatus ${s.status} tidak dapat diubah`);
    return s;
  }
  private async kelengkapan(tx: Tx, kode: string) {
    const r = (await tx.query<{ juknis: string | null; panduan: string | null; komponen: number; penerima: number; total: string | null }>(
      `SELECT (SELECT status FROM banper.dokumen WHERE sumber_dana_kode = $1 AND jenis = 'JUKNIS' ORDER BY diunggah_at DESC LIMIT 1) juknis,
              (SELECT status FROM banper.dokumen WHERE sumber_dana_kode = $1 AND jenis = 'PANDUAN' ORDER BY diunggah_at DESC LIMIT 1) panduan,
              (SELECT count(*)::int FROM banper.komponen_bantuan WHERE sumber_dana_kode = $1) komponen,
              (SELECT count(*)::int FROM banper.penerima WHERE sumber_dana_kode = $1) penerima,
              (SELECT sum(nilai) FROM banper.penerima WHERE sumber_dana_kode = $1) total`, [kode])).rows[0];
    const k = { juknisDisetujui: r.juknis === 'DISETUJUI', panduanDisahkan: r.panduan === 'DISAHKAN', jumlahKomponen: r.komponen, jumlahPenerima: r.penerima };
    return { ...k, statusJuknis: r.juknis, statusPanduan: r.panduan, totalNilai: Number(r.total ?? 0), kurang: cekKelengkapan(k) };
  }

  daftar(ctx: RequestContext) {
    return this.db.run(ctx, async (tx) => (await tx.query(
      `SELECT s.kode, s.nama, s.direktorat_kode AS "direktoratKode", s.tahun, s.jenjang, s.status, s.diubah_at AS "diubahAt",
              (SELECT count(*)::int FROM banper.penerima p WHERE p.sumber_dana_kode = s.kode) AS "jumlahPenerima",
              (SELECT coalesce(sum(nilai), 0)::float8 FROM banper.penerima p WHERE p.sumber_dana_kode = s.kode) AS "totalNilai",
              (SELECT coalesce(sum(nilai), 0)::float8 FROM banper.penyaluran y WHERE y.sumber_dana_kode = s.kode) AS "totalDisalurkan"
       FROM banper.sumber_dana_bantuan s ORDER BY s.tahun DESC, s.kode`)).rows);
  }

  detail(ctx: RequestContext, kode: string) {
    return this.db.run(ctx, async (tx) => {
      const s = (await tx.query(
        `SELECT kode, nama, direktorat_kode AS "direktoratKode", tahun, jenjang, status, pengajuan_mulai::text AS "pengajuanMulai", pengajuan_selesai::text AS "pengajuanSelesai",
                catatan_balai AS "catatanBalai", diajukan_at AS "diajukanAt", disahkan_at AS "disahkanAt" FROM banper.sumber_dana_bantuan WHERE kode = $1`, [kode])).rows[0];
      if (!s) throw new GalatHttp(404, 'SUMBER_DANA_TIDAK_DITEMUKAN', `Sumber dana ${kode} tidak ditemukan`);
      const q = async (sql: string) => (await tx.query(sql, [kode])).rows;
      return {
        ...s,
        kelengkapan: await this.kelengkapan(tx, kode),
        dokumen: await q(`SELECT id, jenis, nama_berkas AS "namaBerkas", ukuran, sha256, status, catatan, diunggah_at AS "diunggahAt", diputuskan_at AS "diputuskanAt"
                          FROM banper.dokumen WHERE sumber_dana_kode = $1 ORDER BY diunggah_at DESC`),
        komponen: await q(`SELECT kode, nama, maks_persen::float8 AS "maksPersen" FROM banper.komponen_bantuan WHERE sumber_dana_kode = $1 ORDER BY kode`),
        penerima: await q(`SELECT p.npsn, s.nama, s.jenjang_kode AS jenjang, s.wilayah_kode AS "wilayahKode", p.nilai::float8 AS nilai,
                             coalesce((SELECT sum(nilai) FROM banper.penyaluran y WHERE y.sumber_dana_kode = p.sumber_dana_kode AND y.npsn = p.npsn), 0)::float8 AS disalurkan
                           FROM banper.penerima p LEFT JOIN banper.ref_sekolah_lokal s ON s.npsn = p.npsn WHERE p.sumber_dana_kode = $1 ORDER BY p.npsn`),
        pks: await q(`SELECT k.id, k.bank_kode AS "bankKode", b.nama AS "namaBank", k.nomor, k.tanggal::text FROM banper.pks_bank k JOIN banper.ref_bank b ON b.kode = k.bank_kode WHERE k.sumber_dana_kode = $1 ORDER BY k.tanggal`),
        penyaluran: await q(`SELECT id, npsn, tahap, tanggal::text, nilai::float8, bank_kode AS "bankKode", nomor_referensi AS "nomorReferensi" FROM banper.penyaluran WHERE sumber_dana_kode = $1 ORDER BY tanggal DESC, npsn`),
        impor: await q(`SELECT id, nama_berkas AS "namaBerkas", status, jumlah_ok AS "jumlahOk", galat, dibuat_at AS "dibuatAt" FROM banper.impor_penerima WHERE sumber_dana_kode = $1 ORDER BY dibuat_at DESC LIMIT 5`),
      };
    });
  }

  buat(ctx: RequestContext, i: SumberDanaBantuanInput) {
    wajibPeran(ctx, 'ADMIN_DIREKTORAT');
    if (!ctx.direktoratIds.includes(i.direktoratKode)) throw new GalatHttp(403, 'DI_LUAR_CAKUPAN', `Anda bukan admin direktorat ${i.direktoratKode}`);
    return this.db.run(ctx, async (tx) => {
      if ((await tx.query('SELECT 1 FROM banper.sumber_dana_bantuan WHERE kode = $1', [i.kode])).rowCount) throw new GalatHttp(409, 'KODE_SUDAH_DIPAKAI', `Kode ${i.kode} sudah dipakai`);
      await tx.query(
        `INSERT INTO banper.sumber_dana_bantuan (kode, nama, direktorat_kode, tahun, jenjang, pengajuan_mulai, pengajuan_selesai, dibuat_oleh) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [i.kode, i.nama, i.direktoratKode, i.tahun, i.jenjang, i.pengajuanMulai, i.pengajuanSelesai, ctx.penggunaId]);
      return { kode: i.kode, status: 'DRAF' };
    });
  }

  ubah(ctx: RequestContext, kode: string, i: Omit<SumberDanaBantuanInput, 'kode' | 'direktoratKode'>) {
    return this.db.run(ctx, async (tx) => {
      await this.bisaDiubah(tx, ctx, kode);
      await tx.query(`UPDATE banper.sumber_dana_bantuan SET nama = $2, tahun = $3, jenjang = $4, pengajuan_mulai = $5, pengajuan_selesai = $6, diubah_at = now() WHERE kode = $1`,
        [kode, i.nama, i.tahun, i.jenjang, i.pengajuanMulai, i.pengajuanSelesai]);
      return { kode };
    });
  }

  // ---------- UC-21/22: dokumen juknis & panduan ----------
  async unggahDokumen(ctx: RequestContext, kode: string, jenis: 'JUKNIS' | 'PANDUAN', nama: string | undefined, isi: Buffer | undefined) {
    const { sha256, ukuran } = periksaBerkas(isi, 'PDF');
    const kunci = kunciBerkas(`bantuan/${kode}/${jenis}`, 'pdf');
    await this.berkas.simpan(kunci, isi!);
    return this.db.run(ctx, async (tx) => {
      await this.bisaDiubah(tx, ctx, kode);
      const r = await tx.query<{ id: string }>(
        `INSERT INTO banper.dokumen (sumber_dana_kode, jenis, nama_berkas, berkas_kunci, sha256, ukuran, diunggah_oleh) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [kode, jenis, namaAman(nama, `${jenis.toLowerCase()}.pdf`), kunci, sha256, ukuran, ctx.penggunaId]);
      return { id: r.rows[0].id, jenis, status: 'DIUNGGAH', sha256 };
    });
  }

  async unduhDokumen(ctx: RequestContext, id: string) {
    const d = await this.db.run(ctx, async (tx) => (await tx.query<{ berkas_kunci: string; nama_berkas: string; sha256: string }>(
      'SELECT berkas_kunci, nama_berkas, sha256 FROM banper.dokumen WHERE id = $1', [id])).rows[0]);
    if (!d) throw new GalatHttp(404, 'DOKUMEN_TIDAK_DITEMUKAN', 'Dokumen tidak ditemukan');
    return { isi: await this.berkas.ambil(d.berkas_kunci), nama: d.nama_berkas, sha256: d.sha256 };
  }

  /** Juknis diputuskan Admin Ditjen (UC-21); panduan disahkan Admin Direktorat (UC-22). Hanya dokumen terbaru per jenis. */
  putuskanDokumen(ctx: RequestContext, id: string, setuju: boolean, catatan?: string) {
    return this.db.run(ctx, async (tx) => {
      const d = (await tx.query<{ sumber_dana_kode: string; jenis: 'JUKNIS' | 'PANDUAN'; status: string; terbaru: boolean }>(
        `SELECT d.sumber_dana_kode, d.jenis, d.status,
                d.id = (SELECT x.id FROM banper.dokumen x WHERE x.sumber_dana_kode = d.sumber_dana_kode AND x.jenis = d.jenis ORDER BY x.diunggah_at DESC LIMIT 1) AS terbaru
         FROM banper.dokumen d WHERE d.id = $1 FOR UPDATE`, [id])).rows[0];
      if (!d) throw new GalatHttp(404, 'DOKUMEN_TIDAK_DITEMUKAN', 'Dokumen tidak ditemukan');
      wajibPeran(ctx, d.jenis === 'JUKNIS' ? 'ADMIN_DITJEN' : 'ADMIN_DIREKTORAT');
      if (!d.terbaru) throw new AturanError('DOKUMEN_USANG', 'Sudah ada dokumen yang lebih baru');
      // baca tanpa kunci: Admin Ditjen tidak berhak UPDATE baris sumber dana (RLS), cukup memastikan statusnya
      const s = await this.ambil(tx, d.sumber_dana_kode);
      if (!bolehUbahSumberDana(s.status)) throw new AturanError('SUMBER_DANA_TERKUNCI', `Sumber dana berstatus ${s.status}`);
      const k = await this.kelengkapan(tx, d.sumber_dana_kode);
      const ke = putuskanDokumen(d.jenis, d.status, setuju, k.juknisDisetujui);
      if (!setuju && !catatan) throw new AturanError('CATATAN_WAJIB', 'Alasan penolakan wajib diisi');
      await tx.query(`UPDATE banper.dokumen SET status = $2, catatan = $3, diputuskan_oleh = $4, diputuskan_at = now() WHERE id = $1`, [id, ke, catatan ?? null, ctx.penggunaId]);
      return { id, status: ke };
    });
  }

  // ---------- UC-29: komponen; UC-25: penerima ----------
  simpanKomponen(ctx: RequestContext, kode: string, k: { kode: string; nama: string; maksPersen: number | null }) {
    return this.db.run(ctx, async (tx) => {
      await this.bisaDiubah(tx, ctx, kode);
      await tx.query(`INSERT INTO banper.komponen_bantuan (sumber_dana_kode, kode, nama, maks_persen) VALUES ($1,$2,$3,$4)
                      ON CONFLICT (sumber_dana_kode, kode) DO UPDATE SET nama = EXCLUDED.nama, maks_persen = EXCLUDED.maks_persen`, [kode, k.kode, k.nama, k.maksPersen]);
      return k;
    });
  }
  hapusKomponen(ctx: RequestContext, kode: string, k: string) {
    return this.db.run(ctx, async (tx) => { await this.bisaDiubah(tx, ctx, kode); await tx.query('DELETE FROM banper.komponen_bantuan WHERE sumber_dana_kode = $1 AND kode = $2', [kode, k]); return { dihapus: k }; });
  }

  /** NPSN wajib ada di data sekolah (Dapodik via svc-referensi) dan jenjangnya termasuk sasaran sumber dana. */
  static async validasiPenerima(tx: Tx, jenjang: string[], npsn: string): Promise<string | null> {
    const s = (await tx.query<{ jenjang_kode: string; aktif: boolean }>('SELECT jenjang_kode, aktif FROM banper.ref_sekolah_lokal WHERE npsn = $1', [npsn])).rows[0];
    if (!s || !s.aktif) return 'NPSN tidak ditemukan di data sekolah (Dapodik)';
    if (!jenjang.includes(s.jenjang_kode)) return `Jenjang sekolah ${s.jenjang_kode} bukan sasaran bantuan (${jenjang.join(', ')})`;
    return null;
  }
  simpanPenerima(ctx: RequestContext, kode: string, p: { npsn: string; nilai: number }) {
    return this.db.run(ctx, async (tx) => {
      const s = await this.bisaDiubah(tx, ctx, kode);
      const g = await SumberDanaService.validasiPenerima(tx, s.jenjang, p.npsn);
      if (g) throw new AturanError('PENERIMA_TIDAK_SAH', g, { npsn: p.npsn });
      await tx.query(`INSERT INTO banper.penerima (sumber_dana_kode, npsn, nilai) VALUES ($1,$2,$3) ON CONFLICT (sumber_dana_kode, npsn) DO UPDATE SET nilai = EXCLUDED.nilai`, [kode, p.npsn, p.nilai]);
      return p;
    });
  }
  hapusPenerima(ctx: RequestContext, kode: string, npsn: string) {
    return this.db.run(ctx, async (tx) => { await this.bisaDiubah(tx, ctx, kode); await tx.query('DELETE FROM banper.penerima WHERE sumber_dana_kode = $1 AND npsn = $2', [kode, npsn]); return { dihapus: npsn }; });
  }

  /** SK-07: berkas disimpan & diantrekan; pekerja ImporPenerima memvalidasi seluruh baris lalu menerapkannya (semua atau tidak sama sekali). */
  async imporPenerima(ctx: RequestContext, kode: string, nama: string | undefined, isi: Buffer | undefined) {
    periksaBerkas(isi, 'XLSX');
    const kunci = kunciBerkas(`bantuan/${kode}/impor`, 'xlsx');
    await this.berkas.simpan(kunci, isi!);
    return this.db.run(ctx, async (tx) => {
      await this.bisaDiubah(tx, ctx, kode);
      const r = await tx.query<{ id: string }>(`INSERT INTO banper.impor_penerima (sumber_dana_kode, nama_berkas, berkas_kunci, dibuat_oleh) VALUES ($1,$2,$3,$4) RETURNING id`,
        [kode, namaAman(nama, 'penerima.xlsx'), kunci, ctx.penggunaId]);
      return { id: r.rows[0].id, status: 'MENUNGGU' };
    });
  }
  statusImpor(ctx: RequestContext, id: string) {
    return this.db.run(ctx, async (tx) => {
      const r = (await tx.query(`SELECT id, sumber_dana_kode AS "sumberDanaKode", nama_berkas AS "namaBerkas", status, jumlah_ok AS "jumlahOk", galat, selesai_at AS "selesaiAt" FROM banper.impor_penerima WHERE id = $1`, [id])).rows[0];
      if (!r) throw new GalatHttp(404, 'IMPOR_TIDAK_DITEMUKAN', 'Impor tidak ditemukan');
      return r;
    });
  }

  // ---------- UC-23/24/26: ajukan, kembalikan, sahkan ----------
  ajukan(ctx: RequestContext, kode: string) {
    return this.db.run(ctx, async (tx) => {
      const s = await this.bisaDiubah(tx, ctx, kode);
      const k = await this.kelengkapan(tx, kode);
      if (k.kurang.length) throw new AturanError('BELUM_LENGKAP', 'Sumber dana belum lengkap untuk diajukan', { kurang: k.kurang });
      const ke = transisiSumberDanaBantuan(s.status, 'AJUKAN');
      await tx.query(`UPDATE banper.sumber_dana_bantuan SET status = $2, diajukan_at = now(), diubah_at = now() WHERE kode = $1`, [kode, ke]);
      return { kode, status: ke };
    });
  }
  kembalikan(ctx: RequestContext, kode: string, catatan: string) {
    wajibPeran(ctx, 'SUPER_ADMIN');
    return this.db.run(ctx, async (tx) => {
      const s = await this.ambil(tx, kode, true);
      const ke = transisiSumberDanaBantuan(s.status, 'KEMBALIKAN');
      await tx.query(`UPDATE banper.sumber_dana_bantuan SET status = $2, catatan_balai = $3, diubah_at = now() WHERE kode = $1`, [kode, ke, catatan]);
      return { kode, status: ke };
    });
  }
  /** UC-26: Balai SDSP mengesahkan -> SumberDanaDisahkan (referensi aktif, pagu per penerima, pembukaan di Mitra). */
  sahkan(ctx: RequestContext, kode: string) {
    wajibPeran(ctx, 'SUPER_ADMIN');
    return this.db.run(ctx, async (tx) => {
      const s = await this.ambil(tx, kode, true);
      const ke = transisiSumberDanaBantuan(s.status, 'SAHKAN');
      const k = await this.kelengkapan(tx, kode);
      if (k.kurang.length) throw new AturanError('BELUM_LENGKAP', 'Sumber dana belum lengkap', { kurang: k.kurang });
      await tx.query(`UPDATE banper.sumber_dana_bantuan SET status = $2, disahkan_oleh = $3, disahkan_at = now(), catatan_balai = NULL, diubah_at = now() WHERE kode = $1`, [kode, ke, ctx.penggunaId]);
      const ev: SumberDanaDisahkanData = {
        kode, nama: s.nama, kategori: 'BANPER', direktoratKode: s.direktorat_kode, tahun: s.tahun, jenjang: s.jenjang,
        komponen: (await tx.query<{ kode: string; nama: string; maks: string | null }>('SELECT kode, nama, maks_persen maks FROM banper.komponen_bantuan WHERE sumber_dana_kode = $1 ORDER BY kode', [kode]))
          .rows.map((x) => ({ kode: x.kode, nama: x.nama, maksPersen: x.maks === null ? null : Number(x.maks) })),
        penerima: (await tx.query<{ npsn: string; nilai: string }>('SELECT npsn, nilai FROM banper.penerima WHERE sumber_dana_kode = $1 ORDER BY npsn', [kode])).rows.map((x) => ({ npsn: x.npsn, nilai: Number(x.nilai) })),
        disahkanAt: new Date().toISOString(),
      };
      await tulisOutbox(tx, SKEMA, { topik: TOPIK.SUMBER_DANA_DISAHKAN, tipe: 'SumberDanaDisahkan', agregatId: kode, correlationId: ctx.requestId, payload: ev });
      return { kode, status: ke, penerima: ev.penerima.length };
    });
  }

  // ---------- UC-27/28: PKS bank & penyaluran ----------
  bank(ctx: RequestContext) { return this.db.run(ctx, async (tx) => (await tx.query('SELECT kode, nama FROM banper.ref_bank ORDER BY nama')).rows); }

  tambahPks(ctx: RequestContext, kode: string, p: { bankKode: string; nomor: string; tanggal: string }) {
    wajibPeran(ctx, 'ADMIN_DIREKTORAT');
    return this.db.run(ctx, async (tx) => {
      await this.ambil(tx, kode);
      const r = await tx.query<{ id: string }>(`INSERT INTO banper.pks_bank (sumber_dana_kode, bank_kode, nomor, tanggal, dibuat_oleh) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (sumber_dana_kode, bank_kode) DO UPDATE SET nomor = EXCLUDED.nomor, tanggal = EXCLUDED.tanggal RETURNING id`, [kode, p.bankKode, p.nomor, p.tanggal, ctx.penggunaId]);
      return { id: r.rows[0].id, ...p };
    });
  }

  /** Trigger cek_penyaluran menegakkan: sumber dana DISAHKAN, PKS bank ada, sekolah penerima sah, total <= nilai bantuan. */
  catatPenyaluran(ctx: RequestContext, kode: string, p: PenyaluranInput) {
    wajibPeran(ctx, 'ADMIN_DIREKTORAT');
    return this.db.run(ctx, async (tx) => {
      const s = await this.ambil(tx, kode);
      const r = await tx.query<{ id: string }>(`INSERT INTO banper.penyaluran (sumber_dana_kode, npsn, tahap, tanggal, nilai, bank_kode, nomor_referensi, dibuat_oleh)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [kode, p.npsn, p.tahap, p.tanggal, p.nilai, p.bankKode, p.nomorReferensi, ctx.penggunaId]);
      const ev: PenyaluranDicatatData = { penyaluranId: r.rows[0].id, sumberDanaKode: kode, npsn: p.npsn, tahun: s.tahun, tahap: p.tahap, tanggal: p.tanggal, nilai: p.nilai, bankKode: p.bankKode, nomorReferensi: p.nomorReferensi };
      await tulisOutbox(tx, SKEMA, { topik: TOPIK.PENYALURAN_DICATAT, tipe: 'PenyaluranDicatat', agregatId: r.rows[0].id, correlationId: ctx.requestId, payload: ev });
      return { id: r.rows[0].id, ...p };
    });
  }
}
