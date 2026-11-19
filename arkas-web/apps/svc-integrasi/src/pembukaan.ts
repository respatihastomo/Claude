import type { PoolClient } from 'pg';
import { AksiPembukaan, Pembukaan, transisiPembukaan } from '@arkas/aturan';

export interface BarisPembukaan extends Pembukaan { id: string; sumber_dana_kode: string; mitra_kode: string }

/**
 * Menerapkan satu aksi siklus pembukaan (aturan murni transisiPembukaan) ke baris yang SUDAH dikunci FOR UPDATE,
 * lalu mencatat riwayatnya. Mengembalikan keadaan baru; tidak menulis apa pun bila keadaan tidak berubah.
 */
export async function terapkanPembukaan(tx: PoolClient, b: BarisPembukaan, a: AksiPembukaan, oleh: string, catatan?: string | null): Promise<Pembukaan> {
  const baru = transisiPembukaan({ status: b.status, versi: b.versi, target: b.target }, a);
  if (baru.status === b.status && baru.versi === b.versi && baru.target === b.target) return baru;
  const ulang = baru.status === 'MENUNGGU';
  await tx.query(
    `UPDATE integrasi.pembukaan_sumber_dana SET status = $2, versi = $3, target = $4, diubah_at = now()
       ${ulang ? ', percobaan = 0, berikutnya_at = now(), galat_terakhir = NULL' : ''}
     WHERE id = $1`,
    [b.id, baru.status, baru.versi, baru.target],
  );
  await tx.query(
    `INSERT INTO integrasi.pembukaan_riwayat (pembukaan_id, versi, dari_status, ke_status, peristiwa, catatan, oleh) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [b.id, baru.versi, b.status, baru.status, a.aksi + (a.aksi === 'KONFIRMASI' ? `_${a.status}` : ''), catatan ?? null, oleh],
  );
  return baru;
}

export async function kunciPembukaan(tx: PoolClient, where: string, p: unknown[]): Promise<BarisPembukaan[]> {
  return (await tx.query<BarisPembukaan>(
    `SELECT id, sumber_dana_kode, mitra_kode, status, versi, target FROM integrasi.pembukaan_sumber_dana WHERE ${where} ORDER BY sumber_dana_kode, mitra_kode FOR UPDATE`, p,
  )).rows;
}

/**
 * Sumber dana baru/berubah: pastikan setiap Mitra AKTIF punya baris pembukaan (MENUNGGU, versi 1);
 * baris yang sudah ada dinaikkan versinya (perubahan dikirim ulang) — kecuali bila sedang ditutup.
 * `hanyaMitra` membatasi ke satu Mitra (mis. saat Mitra baru didaftarkan).
 */
export async function bukaSumberDana(tx: PoolClient, kode: string, oleh: string, opsi: { naikkanVersi: boolean; hanyaMitra?: string }): Promise<number> {
  const baru = await tx.query(
    `INSERT INTO integrasi.pembukaan_sumber_dana (sumber_dana_kode, mitra_kode)
     SELECT $1, m.kode FROM integrasi.mitra_siplah m WHERE m.status = 'AKTIF' AND ($2::text IS NULL OR m.kode = $2)
     ON CONFLICT (sumber_dana_kode, mitra_kode) DO NOTHING RETURNING id, mitra_kode`, [kode, opsi.hanyaMitra ?? null]);
  for (const r of baru.rows) {
    await tx.query(`INSERT INTO integrasi.pembukaan_riwayat (pembukaan_id, versi, dari_status, ke_status, peristiwa, oleh) VALUES ($1, 1, NULL, 'MENUNGGU', 'DIBUAT', $2)`, [r.id, oleh]);
  }
  if (opsi.naikkanVersi) {
    const ada = await kunciPembukaan(tx, `sumber_dana_kode = $1 AND target = 'BUKA' AND NOT (id = ANY($2::uuid[]))`, [kode, baru.rows.map((r) => r.id)]);
    for (const b of ada) await terapkanPembukaan(tx, b, { aksi: 'VERSI_BARU' }, oleh, 'Data sumber dana berubah');
  }
  return baru.rowCount ?? 0;
}

export async function tutupSumberDana(tx: PoolClient, kode: string, oleh: string, catatan: string): Promise<number> {
  const ada = await kunciPembukaan(tx, `sumber_dana_kode = $1 AND target = 'BUKA'`, [kode]);
  for (const b of ada) await terapkanPembukaan(tx, b, { aksi: 'TUTUP' }, oleh, catatan);
  return ada.length;
}
