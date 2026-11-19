import { keRupiah, keSen, type Sen } from './uang';

const rp = (sen: Sen) => `Rp ${keRupiah(sen).toLocaleString('id-ID')}`;

/**
 * Kode 6 — validasiKertasKerja (packages/aturan/src/validasi-kertas-kerja.ts).
 * Fungsi murni: svc-perencanaan memberi batas komponen dari proyeksi lokal perencanaan.ref_komponen_lokal
 * (sumber: svc-referensi) dan realisasi dari perencanaan.realisasi_baris_lokal (event TransaksiDisetujui).
 */
export interface KomponenAturan {
  kode: string;
  nama: string;
  /** batas atas, persen dari pagu (mis. 20 = 20%); null = tanpa batas */
  maksPersen?: number | null;
  /** batas bawah, persen dari pagu; null = tanpa batas */
  minPersen?: number | null;
}

export interface BarisValidasi {
  id: string;
  komponenKode: string;
  kodeRekening: string;
  uraian: string;
  volume: number;
  hargaSatuan: number;
  total: number;
  /** alokasi jadwal kas bulan 1..12 (panjang 12) */
  jadwal: number[];
  /** realisasi akumulatif rantai baris ini (pergeseran tidak boleh di bawahnya) */
  realisasi?: number;
}

export interface GalatValidasi { kode: string; pesan: string; barisId?: string; komponenKode?: string }
export interface RingkasKomponen { kode: string; nama: string; total: number; persen: number; maksPersen: number | null; minPersen: number | null; ok: boolean }
export interface HasilValidasi {
  valid: boolean;
  pagu: number;
  totalAnggaran: number;
  sisaPagu: number;
  galat: GalatValidasi[];
  komponen: RingkasKomponen[];
}

const persen = (bagian: number, utuh: number) => (utuh <= 0 ? 0 : Math.round((bagian / utuh) * 10000) / 100);

export function validasiKertasKerja(i: { pagu: number; baris: BarisValidasi[]; komponen: KomponenAturan[] }): HasilValidasi {
  const galat: GalatValidasi[] = [];
  const peta = new Map(i.komponen.map((k) => [k.kode, k]));
  const totalPerKomponen = new Map<string, number>();
  let total = 0;

  for (const b of i.baris) {
    const t = keSen(b.total);
    total += t;
    if (!peta.has(b.komponenKode)) galat.push({ kode: 'KOMPONEN_TIDAK_DIKENAL', pesan: `Komponen ${b.komponenKode} tidak dikenal`, barisId: b.id });
    totalPerKomponen.set(b.komponenKode, (totalPerKomponen.get(b.komponenKode) ?? 0) + t);
    if (!(b.volume > 0) || !(b.hargaSatuan > 0)) galat.push({ kode: 'NILAI_TIDAK_POSITIF', pesan: `Volume dan harga satuan "${b.uraian}" harus lebih dari nol`, barisId: b.id });
    if (t !== Math.round(b.volume * keSen(b.hargaSatuan))) galat.push({ kode: 'JUMLAH_TIDAK_SESUAI', pesan: `Total "${b.uraian}" harus volume × harga satuan`, barisId: b.id });
    if (b.jadwal.length !== 12 || b.jadwal.some((x) => x < 0)) {
      galat.push({ kode: 'JADWAL_KAS_TIDAK_VALID', pesan: `Jadwal kas "${b.uraian}" harus 12 bulan tanpa nilai negatif`, barisId: b.id });
    } else if (b.jadwal.reduce((s, x) => s + keSen(x), 0) !== t) {
      galat.push({ kode: 'JADWAL_KAS_TIDAK_SESUAI', pesan: `Jumlah jadwal kas "${b.uraian}" harus sama dengan totalnya`, barisId: b.id });
    }
    if (b.realisasi !== undefined && t < keSen(b.realisasi)) {
      galat.push({ kode: 'DI_BAWAH_REALISASI', pesan: `"${b.uraian}" tidak boleh dikurangi di bawah realisasinya (${rp(keSen(b.realisasi))})`, barisId: b.id });
    }
  }

  const pagu = keSen(i.pagu);
  if (total > pagu) galat.push({ kode: 'PAGU_TERLAMPAUI', pesan: `Total anggaran melebihi pagu sebesar ${rp(total - pagu)}` });
  if (total < pagu) galat.push({ kode: 'SISA_PAGU', pesan: `Masih ada pagu yang belum dianggarkan: ${rp(pagu - total)}` });

  const komponen: RingkasKomponen[] = i.komponen.map((k) => {
    const t = totalPerKomponen.get(k.kode) ?? 0;
    const p = persen(t, pagu);
    const lebih = k.maksPersen != null && t * 100 > pagu * k.maksPersen;
    const kurang = k.minPersen != null && t * 100 < pagu * k.minPersen;
    if (lebih) galat.push({ kode: 'KOMPONEN_MELEBIHI_BATAS', pesan: `${k.nama}: ${p}% melebihi batas ${k.maksPersen}% pagu`, komponenKode: k.kode });
    if (kurang) galat.push({ kode: 'KOMPONEN_KURANG_DARI_MINIMUM', pesan: `${k.nama}: ${p}% kurang dari minimum ${k.minPersen}% pagu`, komponenKode: k.kode });
    return { kode: k.kode, nama: k.nama, total: keRupiah(t), persen: p, maksPersen: k.maksPersen ?? null, minPersen: k.minPersen ?? null, ok: !lebih && !kurang };
  });

  return { valid: galat.length === 0, pagu: keRupiah(pagu), totalAnggaran: keRupiah(total), sisaPagu: keRupiah(pagu - total), galat, komponen };
}

/** Membagi total ke 12 bulan secara merata (sisa sen ke bulan terakhir) — bawaan jadwal kas. */
export function jadwalMerata(total: number, bulanMulai = 1): number[] {
  const t = keSen(total);
  const n = 13 - bulanMulai;
  const dasar = Math.floor(t / n);
  return Array.from({ length: 12 }, (_, i) => (i + 1 < bulanMulai ? 0 : keRupiah(i === 11 ? t - dasar * (n - 1) : dasar)));
}
