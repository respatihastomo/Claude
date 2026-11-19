import { Inject, Injectable } from '@nestjs/common';
import { DbContextService, RequestContext } from '@arkas/common-ms';

export interface FilterJejak {
  tahun: number; rantai?: string; layanan?: string; tabel?: string; kunci?: string; pelakuId?: string; aksi?: string;
  dari?: string; sampai?: string; halaman: number; ukuran: number;
}
type AlasanRusak = 'URUTAN_TERPUTUS' | 'TAUTAN_RUSAK' | 'ISI_BERUBAH' | 'ENTRI_HILANG';
export interface HasilVerifikasi {
  tahun: number; rantai: string; utuh: boolean; diperiksa: number; hashKepala: string | null;
  rusak: { urutan: number; alasan: AlasanRusak } | null; diperiksaAt: string;
}

const KOLOM = `tahun, rantai, urutan, event_id AS "eventId", layanan, tabel, aksi, kunci, npsn, pelaku_id AS "pelakuId", peran, ip,
  request_id AS "requestId", alasan, sebelum, sesudah, terjadi_at AS "terjadiAt", dicatat_at AS "dicatatAt", hash_sebelum AS "hashSebelum", hash`;

/** UC-31 Memeriksa jejak audit. Semua baca lewat RLS (boleh_akses per rantai). */
@Injectable()
export class AuditService {
  constructor(@Inject(DbContextService) private readonly db: DbContextService) {}

  daftar(ctx: RequestContext, f: FilterJejak) {
    return this.db.run(ctx, async (tx) => {
      const syarat = ['tahun = $1'];
      const p: unknown[] = [f.tahun];
      const tambah = (sql: string, v: unknown) => { p.push(v); syarat.push(sql.replace('?', `$${p.length}`)); };
      if (f.rantai) tambah('rantai = ?', f.rantai);
      if (f.layanan) tambah('layanan = ?', f.layanan);
      if (f.tabel) tambah('tabel = ?', f.tabel);
      if (f.kunci) tambah('kunci = ?', f.kunci);
      if (f.pelakuId) tambah('pelaku_id = ?::uuid', f.pelakuId);
      if (f.aksi) tambah('aksi = ?', f.aksi);
      if (f.dari) tambah('terjadi_at >= ?::timestamptz', f.dari);
      if (f.sampai) tambah('terjadi_at < ?::timestamptz', f.sampai);
      const where = syarat.join(' AND ');
      const total = (await tx.query<{ n: string }>(`SELECT count(*) n FROM audit.jejak WHERE ${where}`, p)).rows[0].n;
      const data = (await tx.query(
        `SELECT ${KOLOM} FROM audit.jejak WHERE ${where} ORDER BY terjadi_at DESC, rantai, urutan DESC LIMIT ${f.ukuran} OFFSET ${(f.halaman - 1) * f.ukuran}`, p,
      )).rows.map((r) => ({ ...r, urutan: Number(r.urutan) }));
      return { data, total: Number(total), halaman: f.halaman, ukuran: f.ukuran };
    });
  }

  rantai(ctx: RequestContext, tahun: number) {
    return this.db.run(ctx, async (tx) => (await tx.query(
      `SELECT k.rantai, k.urutan::int AS jumlah, k.hash AS "hashKepala", k.diubah_at AS "terakhirAt"
       FROM audit.kepala_rantai k WHERE k.tahun = $1 ORDER BY (k.rantai = 'NASIONAL') DESC, k.rantai`, [tahun],
    )).rows);
  }

  /** Verifikasi satu rantai, atau semua rantai yang boleh diakses pada tahun itu. */
  verifikasi(ctx: RequestContext, tahun: number, rantai?: string): Promise<HasilVerifikasi[]> {
    return this.db.run(ctx, async (tx) => {
      const daftar = rantai ? [rantai] : (await tx.query<{ rantai: string }>(
        'SELECT rantai FROM audit.kepala_rantai WHERE tahun = $1 ORDER BY rantai', [tahun])).rows.map((r) => r.rantai);
      const hasil: HasilVerifikasi[] = [];
      for (const r of daftar) {
        // RLS menyaring baris jejak; tanpa akses, kepala rantai juga tak terlihat sehingga hasilnya kosong (bukan rusak).
        const boleh = (await tx.query<{ ok: boolean }>('SELECT audit.boleh_akses($1) ok', [r])).rows[0].ok;
        if (!boleh) continue;
        const v = (await tx.query<{ diperiksa: string; rusak_urutan: string | null; alasan: AlasanRusak | null; hash_kepala: string | null }>(
          'SELECT * FROM audit.verifikasi_rantai($1::smallint, $2)', [tahun, r])).rows[0];
        hasil.push({
          tahun, rantai: r, utuh: v.alasan === null, diperiksa: Number(v.diperiksa), hashKepala: v.hash_kepala,
          rusak: v.alasan === null ? null : { urutan: Number(v.rusak_urutan), alasan: v.alasan }, diperiksaAt: new Date().toISOString(),
        });
      }
      return hasil;
    });
  }
}
