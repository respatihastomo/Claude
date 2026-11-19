import { Inject, Injectable } from '@nestjs/common';
import { AturanError, dalamMasaPengajuan, StatusPengajuanSekolah, transisiPengajuanSekolah } from '@arkas/aturan';
import { DbContextService, GalatHttp, RequestContext, tulisOutbox } from '@arkas/common-ms';
import { PengajuanSekolahDiputuskanData, TOPIK } from '@arkas/kontrak';
import { PENYIMPANAN, SKEMA } from '../infra/tokens';
import type { PenyimpananBerkas } from '../infra/penyimpanan';
import { kunciBerkas, namaAman, periksaBerkas } from './berkas';

export const DOKUMEN_PENGAJUAN = ['PKS', 'RAB', 'SPTJM'] as const;
type JenisDok = (typeof DOKUMEN_PENGAJUAN)[number];
const hariIni = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const KOLOM = `p.id, p.sumber_dana_kode AS "sumberDanaKode", p.npsn, s.nama AS "namaSekolah", p.status, p.nilai_rab::float8 AS "nilaiRab",
  (SELECT jsonb_object_agg(k, v - 'kunci') FROM jsonb_each(p.dokumen) x(k, v)) AS dokumen, p.catatan, p.riwayat, p.diajukan_at AS "diajukanAt", p.diputuskan_at AS "diputuskanAt"`;

/** UC-17 (sekolah: PKS, RAB, SPTJM) & UC-18 (Tim Kerja/Direktorat memverifikasi). Fitur 15: masa pengajuan, satu pengajuan aktif. */
@Injectable()
export class PengajuanService {
  constructor(@Inject(DbContextService) private readonly db: DbContextService, @Inject(PENYIMPANAN) private readonly berkas: PenyimpananBerkas) {}

  /** Bantuan yang sudah disahkan dan mencantumkan sekolah ini sebagai penerima (RLS), beserta pengajuannya. */
  bantuanSekolah(ctx: RequestContext, npsn: string) {
    if (ctx.npsn !== npsn) throw new GalatHttp(403, 'DI_LUAR_CAKUPAN', 'Sekolah di luar cakupan Anda');
    return this.db.run(ctx, async (tx) => (await tx.query(
      `SELECT s.kode, s.nama, s.tahun, s.pengajuan_mulai::text AS "pengajuanMulai", s.pengajuan_selesai::text AS "pengajuanSelesai", p.nilai::float8 AS nilai,
              coalesce((SELECT sum(nilai) FROM banper.penyaluran y WHERE y.sumber_dana_kode = s.kode AND y.npsn = p.npsn), 0)::float8 AS disalurkan,
              (SELECT to_jsonb(x) FROM (SELECT ${KOLOM} FROM banper.pengajuan_sekolah p LEFT JOIN banper.ref_sekolah_lokal s ON s.npsn = p.npsn
                 WHERE p.sumber_dana_kode = sd.kode AND p.npsn = $1 ORDER BY (p.status = 'DITOLAK'), p.diubah_at DESC LIMIT 1) x) AS pengajuan,
              (SELECT jsonb_agg(jsonb_build_object('kode', k.kode, 'nama', k.nama, 'maksPersen', k.maks_persen) ORDER BY k.kode) FROM banper.komponen_bantuan k WHERE k.sumber_dana_kode = s.kode) AS komponen
       FROM banper.sumber_dana_bantuan s JOIN banper.penerima p ON p.sumber_dana_kode = s.kode AND p.npsn = $1, LATERAL (SELECT s.kode) sd
       WHERE s.status = 'DISAHKAN' ORDER BY s.tahun DESC, s.kode`, [npsn])).rows.map((r) => ({ ...r, dalamMasa: dalamMasaPengajuan(hariIni(), r.pengajuanMulai, r.pengajuanSelesai) })));
  }

  private async ambil(tx: Parameters<Parameters<DbContextService['run']>[1]>[0], id: string) {
    const r = (await tx.query<{ id: string; sumber_dana_kode: string; npsn: string; status: StatusPengajuanSekolah; nilai_rab: string | null; dokumen: Record<string, { kunci: string }>; mulai: string | null; selesai: string | null; nilai: string | null }>(
      `SELECT p.id, p.sumber_dana_kode, p.npsn, p.status, p.nilai_rab, p.dokumen, s.pengajuan_mulai::text mulai, s.pengajuan_selesai::text selesai,
              (SELECT nilai FROM banper.penerima x WHERE x.sumber_dana_kode = p.sumber_dana_kode AND x.npsn = p.npsn) nilai
       FROM banper.pengajuan_sekolah p JOIN banper.sumber_dana_bantuan s ON s.kode = p.sumber_dana_kode WHERE p.id = $1 FOR UPDATE OF p`, [id])).rows[0];
    if (!r) throw new GalatHttp(404, 'PENGAJUAN_TIDAK_DITEMUKAN', 'Pengajuan tidak ditemukan');
    return r;
  }
  private cekMasa(mulai: string | null, selesai: string | null) {
    if (!dalamMasaPengajuan(hariIni(), mulai, selesai)) throw new AturanError('DI_LUAR_MASA_PENGAJUAN', mulai ? `Masa pengajuan ${mulai} s.d. ${selesai}` : 'Masa pengajuan belum ditetapkan');
  }

  /** Membuat (atau mengembalikan) pengajuan aktif sekolah untuk satu bantuan. */
  mulai(ctx: RequestContext, kode: string) {
    return this.db.run(ctx, async (tx) => {
      const s = (await tx.query<{ mulai: string | null; selesai: string | null }>(
        `SELECT pengajuan_mulai::text mulai, pengajuan_selesai::text selesai FROM banper.sumber_dana_bantuan WHERE kode = $1 AND status = 'DISAHKAN'`, [kode])).rows[0];
      if (!s) throw new GalatHttp(404, 'BANTUAN_TIDAK_DITEMUKAN', 'Bantuan tidak ditemukan untuk sekolah ini');
      const ada = (await tx.query<{ id: string }>(`SELECT id FROM banper.pengajuan_sekolah WHERE sumber_dana_kode = $1 AND npsn = $2 AND status <> 'DITOLAK'`, [kode, ctx.npsn])).rows[0];
      if (ada) return { id: ada.id, baru: false };
      this.cekMasa(s.mulai, s.selesai);
      const r = await tx.query<{ id: string }>(`INSERT INTO banper.pengajuan_sekolah (sumber_dana_kode, npsn, dibuat_oleh, riwayat) VALUES ($1,$2,$3,$4) RETURNING id`,
        [kode, ctx.npsn, ctx.penggunaId, JSON.stringify([{ status: 'DRAF', oleh: ctx.peran, at: new Date().toISOString() }])]);
      return { id: r.rows[0].id, baru: true };
    });
  }

  async unggah(ctx: RequestContext, id: string, jenis: JenisDok, nama: string | undefined, isi: Buffer | undefined, nilaiRab?: number) {
    const { sha256, ukuran } = periksaBerkas(isi, 'PDF');
    if (jenis === 'RAB' && !(nilaiRab && nilaiRab > 0)) throw new AturanError('NILAI_RAB_WAJIB', 'Total RAB wajib diisi saat mengunggah RAB');
    const kunci = kunciBerkas(`pengajuan/${id}/${jenis}`, 'pdf');
    await this.berkas.simpan(kunci, isi!);
    return this.db.run(ctx, async (tx) => {
      const p = await this.ambil(tx, id);
      if (p.status !== 'DRAF' && p.status !== 'DIKEMBALIKAN') throw new AturanError('PENGAJUAN_TERKUNCI', `Pengajuan berstatus ${p.status}`);
      if (jenis === 'RAB' && Number(nilaiRab) > Number(p.nilai)) throw new AturanError('RAB_MELEBIHI_NILAI', `Total RAB melebihi nilai bantuan ${Number(p.nilai).toLocaleString('id-ID')}`);
      const dok = { kunci, sha256, ukuran, namaBerkas: namaAman(nama, `${jenis.toLowerCase()}.pdf`), at: new Date().toISOString() };
      await tx.query(`UPDATE banper.pengajuan_sekolah SET dokumen = jsonb_set(dokumen, ARRAY[$2], $3::jsonb), nilai_rab = coalesce($4, nilai_rab), diubah_at = now() WHERE id = $1`,
        [id, jenis, JSON.stringify(dok), jenis === 'RAB' ? nilaiRab : null]);
      return { id, jenis, sha256 };
    });
  }

  async unduh(ctx: RequestContext, id: string, jenis: JenisDok) {
    const d = await this.db.run(ctx, async (tx) => (await tx.query<{ d: { kunci: string; namaBerkas: string } | null }>('SELECT dokumen -> $2 AS d FROM banper.pengajuan_sekolah WHERE id = $1', [id, jenis])).rows[0]?.d);
    if (!d) throw new GalatHttp(404, 'DOKUMEN_TIDAK_DITEMUKAN', 'Dokumen tidak ditemukan');
    return { isi: await this.berkas.ambil(d.kunci), nama: d.namaBerkas };
  }

  /** SPTJM adalah pernyataan Kepala Sekolah: hanya Kepala Sekolah yang mengajukan. */
  ajukan(ctx: RequestContext, id: string) {
    if (ctx.peran !== 'KEPSEK') throw new GalatHttp(403, 'PERAN_TIDAK_DIIZINKAN', 'Pengajuan diajukan oleh Kepala Sekolah');
    return this.db.run(ctx, async (tx) => {
      const p = await this.ambil(tx, id);
      this.cekMasa(p.mulai, p.selesai);
      const kurang = DOKUMEN_PENGAJUAN.filter((j) => !p.dokumen[j]);
      if (kurang.length) throw new AturanError('DOKUMEN_BELUM_LENGKAP', `Dokumen belum lengkap: ${kurang.join(', ')}`, { kurang });
      const ke = transisiPengajuanSekolah(p.status, 'AJUKAN');
      await tx.query(`UPDATE banper.pengajuan_sekolah SET status = $2::text, diajukan_at = now(), diubah_at = now(),
                        riwayat = riwayat || jsonb_build_array(jsonb_build_object('status', $2::text, 'oleh', 'KEPSEK', 'at', now())) WHERE id = $1`, [id, ke]);
      return { id, status: ke };
    });
  }

  daftarPenelaah(ctx: RequestContext, kode: string) {
    return this.db.run(ctx, async (tx) => (await tx.query(
      `SELECT ${KOLOM} FROM banper.pengajuan_sekolah p LEFT JOIN banper.ref_sekolah_lokal s ON s.npsn = p.npsn WHERE p.sumber_dana_kode = $1
       ORDER BY (p.status = 'DIAJUKAN') DESC, p.diajukan_at NULLS LAST`, [kode])).rows);
  }

  /** UC-18: keputusan Tim Kerja / Admin Direktorat -> PengajuanSekolahDiputuskan. */
  putuskan(ctx: RequestContext, id: string, keputusan: 'SETUJUI' | 'TOLAK' | 'KEMBALIKAN', catatan?: string) {
    if (!['TIM_KERJA', 'ADMIN_DIREKTORAT'].includes(ctx.peran)) throw new GalatHttp(403, 'PERAN_TIDAK_DIIZINKAN', 'Diputuskan oleh Tim Kerja atau Admin Direktorat');
    if (keputusan !== 'SETUJUI' && !catatan) throw new AturanError('CATATAN_WAJIB', 'Catatan wajib diisi untuk penolakan atau pengembalian');
    return this.db.run(ctx, async (tx) => {
      const p = await this.ambil(tx, id);
      const ke = transisiPengajuanSekolah(p.status, keputusan) as PengajuanSekolahDiputuskanData['status'];
      await tx.query(`UPDATE banper.pengajuan_sekolah SET status = $2::text, catatan = $3::text, diputuskan_oleh = $4, diputuskan_at = now(), diubah_at = now(),
                        riwayat = riwayat || jsonb_build_array(jsonb_build_object('status', $2::text, 'oleh', $5::text, 'catatan', $3::text, 'at', now())) WHERE id = $1`,
        [id, ke, catatan ?? null, ctx.penggunaId, ctx.peran]);
      const ev: PengajuanSekolahDiputuskanData = { pengajuanId: id, sumberDanaKode: p.sumber_dana_kode, npsn: p.npsn, status: ke, catatan: catatan ?? null, at: new Date().toISOString() };
      await tulisOutbox(tx, SKEMA, { topik: TOPIK.PENGAJUAN_SEKOLAH_DIPUTUSKAN, tipe: 'PengajuanSekolahDiputuskan', agregatId: id, correlationId: ctx.requestId, payload: ev });
      return { id, status: ke };
    });
  }
}
