import type { PoolClient } from 'pg';
import type { PeranPenggunaDto, PenggunaDto } from '@arkas/kontrak';
import { peranBerlaku } from '@arkas/aturan';

/** Kueri identitas & sesi. Dipanggil dengan koneksi pekerja (alur masuk belum punya konteks pengguna) atau API (RLS). */
export interface BarisPengguna { id: string; email: string; nama: string; status: 'AKTIF' | 'NONAKTIF' }

export async function penggunaSso(tx: PoolClient, iss: string, sub: string): Promise<BarisPengguna | undefined> {
  return (await tx.query<BarisPengguna>(`SELECT id, email, nama, status FROM auth.pengguna WHERE sso_issuer = $1 AND sso_sub = $2`, [iss, sub])).rows[0];
}
export async function penggunaEmail(tx: PoolClient, email: string): Promise<(BarisPengguna & { sso_sub: string | null }) | undefined> {
  return (await tx.query(`SELECT id, email, nama, status, sso_sub FROM auth.pengguna WHERE email = $1`, [email])).rows[0];
}
export async function tautkanSso(tx: PoolClient, id: string, iss: string, sub: string): Promise<void> {
  await tx.query(`UPDATE auth.pengguna SET sso_issuer = $2, sso_sub = $3 WHERE id = $1 AND sso_sub IS NULL`, [id, iss, sub]);
}

export async function daftarPeran(tx: PoolClient, penggunaIds: string[], sekarang = new Date()): Promise<Map<string, PeranPenggunaDto[]>> {
  const r = await tx.query(
    `SELECT p.*, s.nama AS nama_sekolah FROM auth.peran_pengguna p LEFT JOIN auth.ref_sekolah_lokal s USING (npsn)
     WHERE p.pengguna_id = ANY($1::uuid[]) ORDER BY p.dicabut_at NULLS FIRST, p.diberikan_at`,
    [penggunaIds],
  );
  const m = new Map<string, PeranPenggunaDto[]>();
  for (const x of r.rows) {
    const dto: PeranPenggunaDto = {
      id: x.id, peran: x.peran, npsn: x.npsn, namaSekolah: x.nama_sekolah, wilayahKode: x.wilayah_kode, direktoratKode: x.direktorat_kode,
      ditjenKode: x.ditjen_kode, berlakuSampai: x.berlaku_sampai?.toISOString() ?? null, diberikanAt: x.diberikan_at.toISOString(),
      dicabutAt: x.dicabut_at?.toISOString() ?? null,
      berlaku: peranBerlaku({ berlakuSampai: x.berlaku_sampai?.toISOString(), dicabut: !!x.dicabut_at }, sekarang),
    };
    m.set(x.pengguna_id, [...(m.get(x.pengguna_id) ?? []), dto]);
  }
  return m;
}

export async function penggunaDto(tx: PoolClient, ids: string[]): Promise<PenggunaDto[]> {
  if (!ids.length) return [];
  const p = await tx.query<BarisPengguna>(`SELECT id, email, nama, status FROM auth.pengguna WHERE id = ANY($1::uuid[]) ORDER BY nama`, [ids]);
  const peran = await daftarPeran(tx, p.rows.map((x) => x.id));
  return p.rows.map((x) => ({ ...x, peran: peran.get(x.id) ?? [] }));
}

// ---------- sesi ----------
export interface BarisSesi { id: string; pengguna_id: string; peran_aktif_id: string | null; kedaluwarsa_at: Date; status: 'AKTIF' | 'NONAKTIF' }

export async function buatSesi(tx: PoolClient, d: { hash: string; penggunaId: string; peranAktifId: string | null; metode: 'SSO' | 'DEV'; ttlJam: number; ip?: string; ua?: string }) {
  const r = await tx.query<{ id: string; kedaluwarsa_at: Date }>(
    `INSERT INTO auth.sesi (token_hash, pengguna_id, peran_aktif_id, metode, kedaluwarsa_at, ip, user_agent)
     VALUES ($1,$2,$3,$4, now() + make_interval(hours => $5), $6, $7) RETURNING id, kedaluwarsa_at`,
    [d.hash, d.penggunaId, d.peranAktifId, d.metode, d.ttlJam, d.ip ?? null, d.ua?.slice(0, 300) ?? null],
  );
  await tx.query(`UPDATE auth.pengguna SET masuk_terakhir_at = now() WHERE id = $1`, [d.penggunaId]);
  return r.rows[0];
}

/** Sesi berlaku: belum dicabut, belum kedaluwarsa, tidak menganggur melewati batas, pengguna aktif. Menyentuh terakhir_at. */
export async function sesiBerlaku(tx: PoolClient, hash: string, idleMenit: number): Promise<BarisSesi | undefined> {
  const r = await tx.query<BarisSesi>(
    `UPDATE auth.sesi s SET terakhir_at = now() FROM auth.pengguna p
     WHERE s.token_hash = $1 AND p.id = s.pengguna_id AND s.dicabut_at IS NULL AND s.kedaluwarsa_at > now()
       AND s.terakhir_at > now() - make_interval(mins => $2) AND p.status = 'AKTIF'
     RETURNING s.id, s.pengguna_id, s.peran_aktif_id, s.kedaluwarsa_at, p.status`,
    [hash, idleMenit],
  );
  return r.rows[0];
}
export async function setPeranAktif(tx: PoolClient, sesiId: string, peranId: string): Promise<void> {
  await tx.query(`UPDATE auth.sesi SET peran_aktif_id = $2 WHERE id = $1`, [sesiId, peranId]);
}
export async function cabutSesi(tx: PoolClient, hash: string): Promise<void> {
  await tx.query(`UPDATE auth.sesi SET dicabut_at = now() WHERE token_hash = $1 AND dicabut_at IS NULL`, [hash]);
}
export async function direktoratDitjen(tx: PoolClient, ditjen: string): Promise<string[]> {
  return (await tx.query<{ kode: string }>(`SELECT kode FROM auth.ref_direktorat_lokal WHERE ditjen_kode = $1 ORDER BY kode`, [ditjen])).rows.map((x) => x.kode);
}
