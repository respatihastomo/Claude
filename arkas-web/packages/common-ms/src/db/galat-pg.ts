import { AturanError } from '@arkas/aturan';

/** Kode galat yang dilempar trigger integritas (30_triggers.sql) lewat RAISE EXCEPTION '<KODE>'. */
const KODE_TRIGGER = new Set([
  'PERIODE_TIDAK_SESUAI', 'PERIODE_TERTUTUP', 'HAPUS_DILARANG', 'TRANSAKSI_FINAL',
  'BARIS_RKAS_TIDAK_SAH', 'JUMLAH_TIDAK_SESUAI', 'MELEBIHI_ANGGARAN',
  'PAJAK_TIDAK_DAPAT_DIUBAH', 'PAJAK_BELUM_SAH', 'SETOR_PAJAK_TIDAK_SESUAI', 'PAJAK_SUDAH_DISETOR',
  'REKONSILIASI_TERKUNCI', 'PERIODE_TIDAK_DAPAT_DIUBAH', 'TRANSISI_PERIODE_TIDAK_SAH', 'PERIODE_FINAL', 'MASIH_ADA_TRANSAKSI_MENUNGGU',
  'PERIODE_SEBELUMNYA_BELUM_DITUTUP', 'REKONSILIASI_BELUM_ADA', 'PEMISAHAN_TUGAS',
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
  // Pada tabel berpartisi, constraint yang dilaporkan adalah indeks partisi (mis. transaksi_2026_ntpn_tahun_idx);
  // `detail` tidak tersedia bagi role tanpa hak SELECT pada kolom kunci, jadi dicocokkan dari nama indeks.
  if (pe.code === '23505' && (pe.constraint === 'ux_transaksi_ntpn' || /^transaksi_\d{4}_ntpn_tahun_idx$/.test(pe.constraint ?? ''))) {
    return new AturanError('NTPN_SUDAH_DIPAKAI', 'NTPN ini sudah dipakai untuk setoran lain');
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
