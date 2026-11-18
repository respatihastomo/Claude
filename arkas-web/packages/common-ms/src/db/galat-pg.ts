import { AturanError } from '@arkas/aturan';

/** Kode galat yang dilempar trigger integritas (30_triggers.sql) lewat RAISE EXCEPTION '<KODE>'. */
const KODE_TRIGGER = new Set([
  'PERIODE_TIDAK_SESUAI', 'PERIODE_TERTUTUP', 'HAPUS_DILARANG', 'TRANSAKSI_FINAL',
  'BARIS_RKAS_TIDAK_SAH', 'JUMLAH_TIDAK_SESUAI', 'MELEBIHI_ANGGARAN',
]);

interface PgError { code?: string; message?: string; detail?: string; constraint?: string }

export class AksesDitolakDbError extends Error {
  readonly kode = 'DITOLAK_RLS';
}

/** Mengubah galat PostgreSQL yang bermakna domain menjadi AturanError (-> 422) atau penolakan RLS (-> 403). */
export function terjemahkanGalatPg(e: unknown): unknown {
  const pe = e as PgError;
  if (!pe || typeof pe !== 'object' || !pe.code) return e;
  if (pe.code === 'P0001' && pe.message && KODE_TRIGGER.has(pe.message)) {
    let detail: Record<string, unknown> | undefined;
    try { detail = pe.detail ? JSON.parse(pe.detail) : undefined; } catch { detail = { keterangan: pe.detail }; }
    return new AturanError(pe.message, pe.detail && !detail?.barisId ? pe.detail : pesanBawaan(pe.message), detail);
  }
  if (pe.code === '42501' && /row-level security/.test(pe.message ?? '')) {
    return new AksesDitolakDbError('Ditolak kebijakan akses data (RLS)');
  }
  return e;
}

function pesanBawaan(kode: string): string {
  switch (kode) {
    case 'MELEBIHI_ANGGARAN': return 'Nilai belanja melebihi sisa anggaran baris RKAS yang disahkan';
    case 'PERIODE_TERTUTUP': return 'Periode buku kas sudah ditutup';
    default: return kode;
  }
}
