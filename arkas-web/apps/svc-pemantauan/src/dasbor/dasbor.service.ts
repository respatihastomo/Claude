import { Inject, Injectable } from '@nestjs/common';
import { DbContextService, GalatHttp, RequestContext } from '@arkas/common-ms';

const NASIONAL = ['SUPER_ADMIN', 'PEMANTAU', 'AUDITOR'];
const bulanIni = () => {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).format(new Date()).split('-').map(Number);
  return { tahun: y, bulan: m };
};
/** Bulan terakhir yang semestinya sudah ditutup: bulan lalu (tahun berjalan) atau Desember (tahun lampau). */
export function bulanWajibTutup(tahun: number, kini = bulanIni()): number {
  if (tahun < kini.tahun) return 12;
  if (tahun > kini.tahun) return 0;
  return kini.bulan - 1;
}

/** UC-30 serapan & kepatuhan; UC-33 HPP. RLS membatasi sekolah yang terlihat sesuai peran (sekolah/Dinas/pusat). */
@Injectable()
export class DasborService {
  constructor(@Inject(DbContextService) private readonly db: DbContextService) {}

  /**
   * Serapan per wilayah dengan drill-down: tanpa induk -> provinsi; induk 2 digit -> kabupaten/kota; induk 4 digit -> sekolah.
   * Dinas tidak bisa naik di atas wilayahnya. Agregat wilayah tidak menampilkan data pribadi.
   */
  serapan(ctx: RequestContext, q: { tahun: number; sumberDanaKode: string; induk?: string }) {
    let induk = q.induk ?? '';
    if (!NASIONAL.includes(ctx.peran)) {
      const w = ctx.wilayahKode ?? '';
      if (!induk.startsWith(w)) induk = w;
    }
    const tingkat = induk.length >= 4 ? 'SEKOLAH' : induk.length === 2 ? 'KABUPATEN' : 'PROVINSI';
    const panjang = tingkat === 'PROVINSI' ? 2 : 4;
    const wajib = bulanWajibTutup(q.tahun);
    return this.db.run(ctx, async (tx) => {
      const r = await tx.query(
        `WITH s AS (
           SELECT sk.npsn, sk.nama, sk.wilayah_kode, sk.jenjang_kode,
             coalesce((SELECT sum(total) FROM pemantauan.rencana_sah_lokal r WHERE r.npsn = sk.npsn AND r.tahun = $1 AND r.sumber_dana_kode = $2 AND r.aktif), 0) AS rencana,
             coalesce((SELECT sum(nilai) FROM pemantauan.realisasi_lokal x WHERE x.npsn = sk.npsn AND x.tahun = $1 AND x.sumber_dana_kode = $2), 0) AS realisasi,
             coalesce((SELECT max(bulan) FROM pemantauan.periode_lokal p WHERE p.npsn = sk.npsn AND p.tahun = $1 AND p.sumber_dana_kode = $2), 0) AS ditutup,
             (SELECT ringkasan FROM pemantauan.hpp_ringkas h WHERE h.npsn = sk.npsn AND h.tahun = $1 AND h.sumber_dana_kode = $2) AS hpp
           FROM pemantauan.ref_sekolah_lokal sk WHERE sk.aktif AND sk.wilayah_kode LIKE $3 || '%'
         )
         SELECT ${tingkat === 'SEKOLAH' ? `s.npsn AS kode, s.nama, s.jenjang_kode AS jenjang, s.ditutup::int AS "bulanDitutup",` : `left(s.wilayah_kode, ${panjang}) AS kode, w.nama,`}
           count(*) FILTER (WHERE s.rencana > 0)::int AS "jumlahSekolah",
           sum(s.rencana)::float8 AS rencana, sum(s.realisasi)::float8 AS realisasi,
           count(*) FILTER (WHERE s.rencana > 0 AND s.ditutup < $4)::int AS terlambat,
           count(*) FILTER (WHERE (s.hpp -> 'MELEBIHI_RENCANA' ->> 'jumlah')::int > 0)::int AS "hppMelebihi",
           count(*) FILTER (WHERE (s.hpp -> 'DI_LUAR_RENCANA' ->> 'jumlah')::int > 0)::int AS "hppDiLuar"
         FROM s ${tingkat === 'SEKOLAH' ? '' : `LEFT JOIN pemantauan.ref_wilayah_lokal w ON w.kode = left(s.wilayah_kode, ${panjang})`}
         GROUP BY 1, 2${tingkat === 'SEKOLAH' ? ', 3, 4' : ''} ORDER BY 1`,
        [q.tahun, q.sumberDanaKode, induk, wajib]);
      const data = r.rows.map((x) => ({ ...x, persen: x.rencana > 0 ? Math.round((x.realisasi / x.rencana) * 1000) / 10 : 0 }));
      const total = data.reduce((a, x) => ({ jumlahSekolah: a.jumlahSekolah + x.jumlahSekolah, rencana: a.rencana + x.rencana, realisasi: a.realisasi + x.realisasi, terlambat: a.terlambat + x.terlambat }),
        { jumlahSekolah: 0, rencana: 0, realisasi: 0, terlambat: 0 });
      const namaInduk = induk ? (await tx.query<{ nama: string }>('SELECT nama FROM pemantauan.ref_wilayah_lokal WHERE kode = $1', [induk])).rows[0]?.nama ?? induk : 'Nasional';
      return { tingkat, induk: induk || null, namaInduk, bulanWajibTutup: wajib, total: { ...total, persen: total.rencana > 0 ? Math.round((total.realisasi / total.rencana) * 1000) / 10 : 0 }, data };
    });
  }

  /** Distribusi kategori HPP per jenjang. Pusat membaca MV agregat; Dinas dihitung dari ringkasan sekolah di wilayahnya. */
  hppAgregat(ctx: RequestContext, q: { tahun: number; sumberDanaKode: string }) {
    return this.db.run(ctx, async (tx) => {
      const nasional = NASIONAL.includes(ctx.peran);
      const r = nasional
        ? await tx.query(`SELECT jenjang_kode AS jenjang, kategori, sum(jumlah)::int AS jumlah, sum(nilai)::float8 AS nilai FROM pemantauan.mv_hpp_jenjang
            WHERE tahun = $1 AND sumber_dana_kode = $2 GROUP BY 1, 2 ORDER BY 1, 2`, [q.tahun, q.sumberDanaKode])
        : await tx.query(`SELECT s.jenjang_kode AS jenjang, k.kategori, sum((h.ringkasan -> k.kategori ->> 'jumlah')::int)::int AS jumlah, sum((h.ringkasan -> k.kategori ->> 'nilai')::numeric)::float8 AS nilai
            FROM pemantauan.hpp_ringkas h JOIN pemantauan.ref_sekolah_lokal s ON s.npsn = h.npsn
            CROSS JOIN (VALUES ('SESUAI'), ('MELEBIHI_RENCANA'), ('DI_LUAR_RENCANA'), ('BELUM_DIBELANJAKAN')) k(kategori)
            WHERE h.tahun = $1 AND h.sumber_dana_kode = $2 GROUP BY 1, 2 ORDER BY 1, 2`, [q.tahun, q.sumberDanaKode]);
      const alarm = nasional ? (await tx.query(`SELECT sumber_dana_kode AS "sumberDanaKode", mitra_kode AS "mitraKode", versi, at FROM pemantauan.pembukaan_lokal WHERE status = 'GAGAL' ORDER BY at DESC`)).rows : [];
      return { data: r.rows, pembukaanGagal: alarm };
    });
  }

  /** UC-33 menelusuri HPP satu sekolah: ringkasan, kategori per baris, dan item belanja Mitra yang dicocokkan. */
  hppSekolah(ctx: RequestContext, npsn: string, q: { tahun: number; sumberDanaKode: string }) {
    return this.db.run(ctx, async (tx) => {
      if (!(await tx.query<{ ok: boolean }>('SELECT pemantauan.boleh_akses($1) ok', [npsn])).rows[0].ok) throw new GalatHttp(403, 'DI_LUAR_CAKUPAN', 'Sekolah di luar cakupan Anda');
      const p = [npsn, q.tahun, q.sumberDanaKode];
      const s = (await tx.query('SELECT npsn, nama, jenjang_kode AS jenjang, wilayah_kode AS "wilayahKode" FROM pemantauan.ref_sekolah_lokal WHERE npsn = $1', [npsn])).rows[0] ?? { npsn };
      const ring = (await tx.query('SELECT ringkasan, versi_rkas AS "versiRkas", dihitung_at AS "dihitungAt" FROM pemantauan.hpp_ringkas WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3', p)).rows[0] ?? null;
      const baris = (await tx.query(
        `SELECT baris_id AS "barisId", kode_rekening AS "kodeRekening", kegiatan, uraian, rencana::float8, belanja::float8, selisih::float8, kategori
         FROM pemantauan.hpp_baris WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3
         ORDER BY CASE kategori WHEN 'MELEBIHI_RENCANA' THEN 0 WHEN 'SESUAI' THEN 1 ELSE 2 END, kegiatan, uraian`, p)).rows;
      const item = (await tx.query(
        `SELECT c.baris_id AS "barisId", c.cara, c.jumlah::float8, b.mitra_kode AS "mitraKode", b.transaction_id AS "transactionId", b.tanggal::text, b.kode_rekening AS "kodeRekening", b.uraian
         FROM pemantauan.hpp_cocok c JOIN pemantauan.belanja_mitra_lokal b ON b.transaksi_mitra_id = c.transaksi_mitra_id AND b.item_id = c.item_id
         WHERE c.npsn = $1 AND c.tahun = $2 AND c.sumber_dana_kode = $3 ORDER BY b.tanggal DESC, b.transaction_id`, p)).rows;
      return { sekolah: s, ...(ring ?? { ringkasan: null, versiRkas: null, dihitungAt: null }), baris, item };
    });
  }
}
