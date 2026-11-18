import type { PoolClient } from 'pg';
import type { KomponenAturan } from '@arkas/aturan';
import type { BarisKertasKerjaDto, KertasKerjaDto, PaguDto } from '@arkas/kontrak';

const n = (v: string | number | null | undefined) => (v === null || v === undefined ? 0 : Number(v));
const iso = (d: Date | null) => d?.toISOString() ?? null;
export interface Buku { npsn: string; tahun: number; sumberDanaKode: string }

interface BarisKk {
  id: string; npsn: string; tahun: number; sumber_dana_kode: string; versi: number; status: KertasKerjaDto['status']; asal_kertas_kerja_id: string | null;
  row_version: number; dibuat_oleh: string; diajukan_oleh: string | null; diajukan_at: Date | null; disahkan_oleh: string | null; disahkan_at: Date | null;
  catatan_kembali: string | null; nama: string | null;
}
const keKk = (k: BarisKk): KertasKerjaDto => ({
  id: k.id, npsn: k.npsn, namaSekolah: k.nama, tahun: k.tahun, sumberDanaKode: k.sumber_dana_kode, versi: k.versi, status: k.status,
  asalKertasKerjaId: k.asal_kertas_kerja_id, rowVersion: k.row_version, dibuatOleh: k.dibuat_oleh, diajukanOleh: k.diajukan_oleh,
  diajukanAt: iso(k.diajukan_at), disahkanOleh: k.disahkan_oleh, disahkanAt: iso(k.disahkan_at), catatanKembali: k.catatan_kembali,
});
const SQL_KK = `SELECT k.*, s.nama FROM perencanaan.kertas_kerja k LEFT JOIN perencanaan.ref_sekolah_lokal s USING (npsn)`;

export async function pagu(tx: PoolClient, b: Buku): Promise<PaguDto | undefined> {
  const r = await tx.query(`SELECT * FROM perencanaan.pagu WHERE npsn = $1 AND tahun = $2 AND sumber_dana_kode = $3`, [b.npsn, b.tahun, b.sumberDanaKode]);
  const p = r.rows[0];
  return p && { npsn: p.npsn, tahun: p.tahun, sumberDanaKode: p.sumber_dana_kode, nilai: n(p.nilai), ditetapkanAt: p.ditetapkan_at.toISOString() };
}

export async function daftar(tx: PoolClient, b: Buku): Promise<KertasKerjaDto[]> {
  const r = await tx.query<BarisKk>(`${SQL_KK} WHERE k.npsn = $1 AND k.tahun = $2 AND k.sumber_dana_kode = $3 ORDER BY k.versi DESC`, [b.npsn, b.tahun, b.sumberDanaKode]);
  return r.rows.map(keKk);
}
export async function daftarDiajukan(tx: PoolClient): Promise<KertasKerjaDto[]> {
  const r = await tx.query<BarisKk>(`${SQL_KK} WHERE k.status = 'DIAJUKAN' ORDER BY k.diajukan_at`);
  return r.rows.map(keKk);
}
export async function ambil(tx: PoolClient, id: string, kunci = false): Promise<KertasKerjaDto | undefined> {
  const r = await tx.query<BarisKk>(`${SQL_KK} WHERE k.id = $1 ${kunci ? 'FOR UPDATE OF k' : ''}`, [id]);
  return r.rows[0] && keKk(r.rows[0]);
}
export async function terbuka(tx: PoolClient, b: Buku, status: string[]): Promise<KertasKerjaDto | undefined> {
  const r = await tx.query<BarisKk>(`${SQL_KK} WHERE k.npsn = $1 AND k.tahun = $2 AND k.sumber_dana_kode = $3 AND k.status = ANY($4) ORDER BY k.versi DESC LIMIT 1`,
    [b.npsn, b.tahun, b.sumberDanaKode, status]);
  return r.rows[0] && keKk(r.rows[0]);
}
export async function buat(tx: PoolClient, b: Buku, versi: number, oleh: string, asal: string | null): Promise<string> {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO perencanaan.kertas_kerja (npsn, tahun, sumber_dana_kode, versi, dibuat_oleh, asal_kertas_kerja_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [b.npsn, b.tahun, b.sumberDanaKode, versi, oleh, asal],
  );
  return r.rows[0].id;
}
/** Menaikkan row_version (trigger) — dipanggil setiap baris berubah agar If-Match menjaga seluruh kertas kerja. */
export async function sentuh(tx: PoolClient, id: string): Promise<void> {
  await tx.query(`UPDATE perencanaan.kertas_kerja SET status = status WHERE id = $1`, [id]);
}
export async function ubahStatus(tx: PoolClient, id: string, kolom: Record<string, unknown>): Promise<void> {
  const k = Object.keys(kolom);
  await tx.query(`UPDATE perencanaan.kertas_kerja SET ${k.map((x, i) => `${x} = $${i + 2}`).join(', ')} WHERE id = $1`, [id, ...k.map((x) => kolom[x])]);
}

export async function komponen(tx: PoolClient, sd: string): Promise<KomponenAturan[]> {
  const r = await tx.query(`SELECT kode, nama, maks_persen, min_persen FROM perencanaan.ref_komponen_lokal WHERE sumber_dana_kode = $1 AND aktif ORDER BY kode`, [sd]);
  return r.rows.map((x) => ({ kode: x.kode, nama: x.nama, maksPersen: x.maks_persen === null ? null : n(x.maks_persen), minPersen: x.min_persen === null ? null : n(x.min_persen) }));
}

export async function baris(tx: PoolClient, kkId: string): Promise<Array<BarisKertasKerjaDto & { akarBarisId: string }>> {
  const r = await tx.query(
    `SELECT b.*, coalesce((SELECT array_agg(j.nilai ORDER BY j.bulan) FROM perencanaan.jadwal_kas j WHERE j.baris_id = b.id), '{}') AS jadwal,
            coalesce((SELECT sum(r.jumlah) FROM perencanaan.realisasi_baris_lokal r JOIN perencanaan.baris_kertas_kerja x ON x.id = r.baris_id
                      WHERE x.akar_baris_id = b.akar_baris_id), 0) AS realisasi
     FROM perencanaan.baris_kertas_kerja b WHERE b.kertas_kerja_id = $1 ORDER BY b.komponen_kode, b.urut, b.dibuat_at`,
    [kkId],
  );
  return r.rows.map((x) => ({
    id: x.id, komponenKode: x.komponen_kode, kegiatan: x.kegiatan, kodeRekening: x.kode_rekening, uraian: x.uraian, volume: n(x.volume),
    satuan: x.satuan, hargaSatuan: n(x.harga_satuan), total: n(x.total), jadwal: (x.jadwal as string[]).map(n), asalBarisId: x.asal_baris_id,
    realisasi: n(x.realisasi), akarBarisId: x.akar_baris_id,
  }));
}

export async function simpanBaris(tx: PoolClient, kkId: string, npsn: string, d: {
  id: string; komponenKode: string; kegiatan: string; kodeRekening: string; uraian: string; volume: number; satuan: string; hargaSatuan: number;
  total: number; jadwal: number[]; asalBarisId: string | null; akarBarisId: string;
}, baru: boolean): Promise<void> {
  if (baru) {
    await tx.query(
      `INSERT INTO perencanaan.baris_kertas_kerja (id, kertas_kerja_id, npsn, komponen_kode, kegiatan, kode_rekening, uraian, volume, satuan, harga_satuan, total, asal_baris_id, akar_baris_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [d.id, kkId, npsn, d.komponenKode, d.kegiatan, d.kodeRekening, d.uraian, d.volume, d.satuan, d.hargaSatuan, d.total, d.asalBarisId, d.akarBarisId],
    );
  } else {
    await tx.query(
      `UPDATE perencanaan.baris_kertas_kerja SET komponen_kode = $2, kegiatan = $3, kode_rekening = $4, uraian = $5, volume = $6, satuan = $7,
         harga_satuan = $8, total = $9 WHERE id = $1`,
      [d.id, d.komponenKode, d.kegiatan, d.kodeRekening, d.uraian, d.volume, d.satuan, d.hargaSatuan, d.total],
    );
    await tx.query(`DELETE FROM perencanaan.jadwal_kas WHERE baris_id = $1`, [d.id]);
  }
  await tx.query(
    `INSERT INTO perencanaan.jadwal_kas (baris_id, bulan, nilai) SELECT $1, b, v FROM unnest($2::numeric[]) WITH ORDINALITY AS t(v, b)`,
    [d.id, d.jadwal],
  );
}
export async function hapusBaris(tx: PoolClient, barisId: string): Promise<void> {
  await tx.query(`DELETE FROM perencanaan.jadwal_kas WHERE baris_id = $1`, [barisId]);
  await tx.query(`DELETE FROM perencanaan.baris_kertas_kerja WHERE id = $1`, [barisId]);
}

export async function catatVerifikasi(tx: PoolClient, kkId: string, oleh: string, peran: string, aksi: string, catatan: string | null): Promise<void> {
  await tx.query(`INSERT INTO perencanaan.verifikasi (kertas_kerja_id, pengguna_id, peran, aksi, catatan) VALUES ($1,$2,$3,$4,$5)`, [kkId, oleh, peran, aksi, catatan]);
}
export async function tambahCatatan(tx: PoolClient, kkId: string, barisId: string | null, oleh: string, peran: string, catatan: string): Promise<void> {
  await tx.query(`INSERT INTO perencanaan.catatan_baris (kertas_kerja_id, baris_id, penulis_id, peran, catatan) VALUES ($1,$2,$3,$4,$5)`, [kkId, barisId, oleh, peran, catatan]);
}
export async function catatanDanRiwayat(tx: PoolClient, kkId: string) {
  const c = await tx.query(`SELECT id, baris_id, peran, catatan, at FROM perencanaan.catatan_baris WHERE kertas_kerja_id = $1 ORDER BY at`, [kkId]);
  const v = await tx.query(`SELECT aksi, peran, catatan, at FROM perencanaan.verifikasi WHERE kertas_kerja_id = $1 ORDER BY at`, [kkId]);
  return {
    catatan: c.rows.map((x) => ({ id: x.id, barisId: x.baris_id, peran: x.peran, catatan: x.catatan, at: x.at.toISOString() })),
    riwayat: v.rows.map((x) => ({ aksi: x.aksi, peran: x.peran, catatan: x.catatan, at: x.at.toISOString() })),
  };
}

export async function rekeningAktif(tx: PoolClient, kode: string): Promise<boolean> {
  return !!(await tx.query(`SELECT 1 FROM perencanaan.ref_rekening_lokal WHERE kode = $1 AND aktif`, [kode])).rowCount;
}
