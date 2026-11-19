import { Inject, Injectable } from '@nestjs/common';
import { AturanError } from '@arkas/aturan';
import { DbContextService, GalatHttp, RequestContext } from '@arkas/common-ms';
import { EntitasReferensi, InputReferensi, PajakDaerahInput, SekolahDto, SumberDanaDto, TarifPajakDto } from '@arkas/kontrak';
import type { PoolClient } from 'pg';
import { DESKRIPTOR } from './deskriptor';

const NUMERIK = new Set(['maks_persen', 'min_persen', 'tarif', 'tarif_tanpa_npwp']);
/** Baris tabel -> objek API camelCase sesuai deskriptor (+ versi). */
function keApi(e: EntitasReferensi, r: Record<string, unknown>) {
  const d = DESKRIPTOR[e];
  const o: Record<string, unknown> = { versi: Number(r.versi) };
  for (const [api, kol] of Object.entries(d.kolom)) o[api] = r[kol] !== null && NUMERIK.has(kol) ? Number(r[kol]) : r[kol];
  return o;
}

/** UC-02, UC-19, UC-32 — data induk & referensi. */
@Injectable()
export class ReferensiService {
  constructor(@Inject(DbContextService) private readonly db: DbContextService) {}

  daftar(ctx: RequestContext, e: EntitasReferensi, f: { aktif?: boolean; sumberDanaKode?: string; wilayahKode?: string }) {
    const d = DESKRIPTOR[e];
    const syarat: string[] = []; const nilai: unknown[] = [];
    if (f.aktif !== undefined) { nilai.push(f.aktif); syarat.push(`aktif = $${nilai.length}`); }
    if (f.sumberDanaKode && d.kolom.sumberDanaKode) { nilai.push(f.sumberDanaKode); syarat.push(`sumber_dana_kode = $${nilai.length}`); }
    if (f.wilayahKode && d.kolom.wilayahKode) { nilai.push(f.wilayahKode); syarat.push(`wilayah_kode LIKE $${nilai.length} || '%'`); }
    return this.db.run(ctx, async (tx) => (await tx.query(
      `SELECT * FROM ref.${d.tabel} ${syarat.length ? `WHERE ${syarat.join(' AND ')}` : ''} ORDER BY ${d.urut}`, nilai,
    )).rows.map((r) => keApi(e, r)));
  }

  /** UC-19: Balai menambah/mengubah satu baris (nonaktifkan dengan aktif=false). Hanya baris yang benar-benar berubah menaikkan versi. */
  simpan(ctx: RequestContext, e: EntitasReferensi, isi: unknown) {
    const d = DESKRIPTOR[e];
    const data = InputReferensi[e].parse(isi) as Record<string, unknown>;
    const kol = Object.entries(d.kolom);
    const extra = e === 'TARIF_PAJAK' ? { diubah_oleh: ctx.penggunaId, diubah_at: new Date() } : {};
    const semua = [...kol.map(([api, k]) => [k, data[api]] as const), ...Object.entries(extra)];
    const ubah = semua.filter(([k]) => !d.kunci.includes(k));
    const bandingkan = ubah.filter(([k]) => k !== 'diubah_at' && k !== 'diubah_oleh').map(([k]) => k);
    return this.db.run(ctx, async (tx) => {
      const r = await tx.query(
        `INSERT INTO ref.${d.tabel} (${semua.map(([k]) => k).join(', ')}) VALUES (${semua.map((_, i) => `$${i + 1}`).join(', ')})
         ON CONFLICT (${d.kunci.join(', ')}) DO UPDATE SET ${ubah.map(([k]) => `${k} = EXCLUDED.${k}`).join(', ')}
         WHERE (${bandingkan.map((k) => `ref.${d.tabel}.${k}`).join(', ')}) IS DISTINCT FROM (${bandingkan.map((k) => `EXCLUDED.${k}`).join(', ')})
         RETURNING *`,
        semua.map(([, v]) => v),
      );
      if (r.rows[0]) return { berubah: true, data: keApi(e, r.rows[0]) };
      const ada = await tx.query(`SELECT * FROM ref.${d.tabel} WHERE ${d.kunci.map((k, i) => `${k} = $${i + 1}`).join(' AND ')}`,
        d.kunci.map((k) => semua.find(([kk]) => kk === k)![1]));
      return { berubah: false, data: keApi(e, ada.rows[0]) };
    });
  }

  terbitUlang(ctx: RequestContext): Promise<{ jumlah: number }> {
    return this.db.run(ctx, async (tx) => ({ jumlah: (await tx.query<{ n: number }>(`SELECT ref.terbit_ulang($1::uuid) AS n`, [ctx.requestId])).rows[0].n }));
  }

  // ---------- 11.2.4: profil sekolah & sumber dana (UC-02) ----------
  sekolah(ctx: RequestContext, npsn: string): Promise<SekolahDto> {
    return this.db.run(ctx, async (tx) => {
      const s = await this.ambilSekolah(tx, npsn);
      if (!s) throw new GalatHttp(404, 'SEKOLAH_TIDAK_DITEMUKAN', 'Satuan pendidikan tidak ditemukan');
      return s;
    });
  }

  sumberDanaSekolah(ctx: RequestContext, npsn: string): Promise<SumberDanaDto[]> {
    return this.db.run(ctx, async (tx) => {
      const s = await this.ambilSekolah(tx, npsn);
      if (!s) throw new GalatHttp(404, 'SEKOLAH_TIDAK_DITEMUKAN', 'Satuan pendidikan tidak ditemukan');
      const r = await tx.query(
        `SELECT d.* FROM ref.sumber_dana d JOIN ref.sumber_dana_jenjang j ON j.sumber_dana_kode = d.kode
         WHERE j.jenjang_kode = $1 AND d.aktif ORDER BY d.kategori, d.kode`, [s.jenjangKode]);
      return r.rows.map((x) => ({ kode: x.kode, nama: x.nama, kategori: x.kategori, direktoratKode: x.direktorat_kode, aktif: x.aktif }));
    });
  }

  // ---------- 11.2.15: Dinas ----------
  sekolahDinas(ctx: RequestContext): Promise<SekolahDto[]> {
    return this.db.run(ctx, async (tx) => (await tx.query(
      `SELECT s.*, w.nama AS nama_wilayah FROM ref.satuan_pendidikan s JOIN ref.wilayah w ON w.kode = s.wilayah_kode
       WHERE s.wilayah_kode LIKE $1 || '%' ORDER BY s.wilayah_kode, s.nama`, [ctx.wilayahKode],
    )).rows.map(keSekolah));
  }

  /** Tarif nasional + penimpaan SSPD di wilayah Dinas (dan wilayah induknya), untuk halaman konfigurasi pajak daerah. */
  konfigurasiPajak(ctx: RequestContext): Promise<TarifPajakDto[]> {
    return this.db.run(ctx, async (tx) => (await tx.query(
      `SELECT t.*, r.nama AS nama_rekening FROM ref.tarif_pajak t JOIN ref.kode_rekening r ON r.kode = t.kode_rekening
       WHERE t.wilayah_kode = '' OR $1 LIKE t.wilayah_kode || '%' OR t.wilayah_kode LIKE $1 || '%'
       ORDER BY t.kode_rekening, t.jenis, length(t.wilayah_kode), t.wilayah_kode`, [ctx.wilayahKode ?? ''],
    )).rows.map(keTarif));
  }

  /** UC-32: Admin Dinas menetapkan (atau membebaskan, tarif=null) pajak daerah SSPD untuk wilayahnya. */
  aturPajakDaerah(ctx: RequestContext, i: PajakDaerahInput): Promise<TarifPajakDto> {
    if (!ctx.wilayahKode || !i.wilayahKode.startsWith(ctx.wilayahKode)) {
      throw new AturanError('DI_LUAR_CAKUPAN', `Wilayah ${i.wilayahKode} di luar kewenangan Dinas ${ctx.wilayahKode ?? '-'}`);
    }
    return this.db.run(ctx, async (tx) => {
      const rek = (await tx.query(`SELECT aktif FROM ref.kode_rekening WHERE kode = $1`, [i.kodeRekening])).rows[0];
      if (!rek?.aktif) throw new AturanError('KODE_REKENING_TIDAK_DIKENAL', `Kode rekening ${i.kodeRekening} tidak dikenal atau nonaktif`);
      if (!(await tx.query(`SELECT 1 FROM ref.wilayah WHERE kode = $1 AND aktif`, [i.wilayahKode])).rowCount) {
        throw new AturanError('WILAYAH_TIDAK_DIKENAL', `Wilayah ${i.wilayahKode} tidak dikenal`);
      }
      // Membebaskan disimpan sebagai baris nonaktif; tarif lama dipertahankan agar tercatat (tarif wajib > 0).
      const lama = (await tx.query(`SELECT tarif FROM ref.tarif_pajak WHERE kode_rekening = $1 AND jenis = 'SSPD' AND wilayah_kode = $2`, [i.kodeRekening, i.wilayahKode])).rows[0];
      const nasional = (await tx.query(`SELECT tarif FROM ref.tarif_pajak WHERE kode_rekening = $1 AND jenis = 'SSPD' AND wilayah_kode = ''`, [i.kodeRekening])).rows[0];
      const tarif = i.tarif ?? Number(lama?.tarif ?? nasional?.tarif ?? 0.1);
      const r = await tx.query(
        `INSERT INTO ref.tarif_pajak (kode_rekening, jenis, wilayah_kode, tarif, dasar_hukum, aktif, diubah_oleh, diubah_at)
         VALUES ($1, 'SSPD', $2, $3, $4, $5, $6, now())
         ON CONFLICT (kode_rekening, jenis, wilayah_kode) DO UPDATE SET tarif = EXCLUDED.tarif, dasar_hukum = EXCLUDED.dasar_hukum,
           aktif = EXCLUDED.aktif, diubah_oleh = EXCLUDED.diubah_oleh, diubah_at = now()
         RETURNING *`,
        [i.kodeRekening, i.wilayahKode, tarif, i.dasarHukum, i.tarif !== null, ctx.penggunaId],
      );
      const nama = (await tx.query(`SELECT nama FROM ref.kode_rekening WHERE kode = $1`, [i.kodeRekening])).rows[0].nama;
      return keTarif({ ...r.rows[0], nama_rekening: nama });
    });
  }

  private async ambilSekolah(tx: PoolClient, npsn: string): Promise<SekolahDto | undefined> {
    const r = await tx.query(`SELECT s.*, w.nama AS nama_wilayah FROM ref.satuan_pendidikan s JOIN ref.wilayah w ON w.kode = s.wilayah_kode WHERE s.npsn = $1`, [npsn]);
    return r.rows[0] && keSekolah(r.rows[0]);
  }
}

const keSekolah = (x: Record<string, any>): SekolahDto => ({
  npsn: x.npsn, nama: x.nama, jenjangKode: x.jenjang_kode, wilayahKode: x.wilayah_kode, namaWilayah: x.nama_wilayah, statusSekolah: x.status_sekolah, aktif: x.aktif,
});
const keTarif = (x: Record<string, any>): TarifPajakDto => ({
  kodeRekening: x.kode_rekening, namaRekening: x.nama_rekening, jenis: x.jenis, wilayahKode: x.wilayah_kode, tarif: Number(x.tarif),
  tarifTanpaNpwp: x.tarif_tanpa_npwp === null ? null : Number(x.tarif_tanpa_npwp), dasarHukum: x.dasar_hukum, aktif: x.aktif,
  versi: Number(x.versi), diubahAt: x.diubah_at.toISOString(),
});
