import { AturanError, Sen, bulatkanKeBawahRupiah, keRupiah, keSen } from './uang';

/**
 * Kode 7 — hitungPajak (packages/aturan/src/hitung-pajak.ts)
 *
 * Fungsi murni: tidak membaca basis data. svc-penatausahaan memberi `aturan` dari
 * tabel proyeksi lokal tatausaha.ref_rekening_pajak_lokal (sakelar pajak per kode rekening + tarif).
 *
 * Model perhitungan:
 *  - PPN  : harga belanja dianggap SUDAH termasuk PPN. DPP = bruto / (1 + tarif). PPN = DPP x tarif.
 *  - PPh 21, PPh 23 : dasar = DPP bila rekening itu juga kena PPN, selain itu bruto.
 *                     Bila penjual tidak punya NPWP dipakai `tarifTanpaNpwp` (mis. PPh 23 2% -> 4%).
 *  - SSPD (pajak daerah, mis. pajak restoran) : dasar = bruto.
 *  - Setiap nilai pajak dibulatkan ke bawah ke rupiah penuh.
 *  - Maksimal `batasJenis` (default 2) jenis pajak berbeda dalam satu transaksi.
 */
export const JENIS_PAJAK = ['PPN', 'PPH21', 'PPH23', 'SSPD'] as const;
export type JenisPajak = (typeof JENIS_PAJAK)[number];

export interface AturanPajakRekening {
  jenis: JenisPajak;
  /** contoh 0.11 untuk 11% */
  tarif: number;
  /** tarif bila penjual tidak ber-NPWP; null = sama dengan tarif */
  tarifTanpaNpwp?: number | null;
}

export interface ItemPajakInput {
  kodeRekening: string;
  /** jumlah bruto item dalam rupiah */
  jumlah: number;
}

export interface HitungPajakInput {
  items: ItemPajakInput[];
  /** kode rekening -> daftar pajak yang aktif untuk rekening tersebut */
  aturan: Record<string, AturanPajakRekening[] | undefined>;
  penjualPunyaNpwp: boolean;
  batasJenis?: number;
}

export interface RincianPajak {
  jenis: JenisPajak;
  tarif: number;
  dpp: number;
  nilai: number;
}

export interface HasilPajak {
  nilaiBruto: number;
  totalPajak: number;
  /** yang dibayarkan ke penjual = bruto - seluruh pajak yang dipungut/dipotong bendahara */
  nilaiNetto: number;
  pajak: RincianPajak[];
}

const URUTAN: Record<JenisPajak, number> = { PPN: 0, PPH21: 1, PPH23: 2, SSPD: 3 };

export function hitungPajak(input: HitungPajakInput): HasilPajak {
  const batas = input.batasJenis ?? 2;
  const kumpulan = new Map<string, { jenis: JenisPajak; tarif: number; dpp: Sen; nilai: Sen }>();
  let brutoTotal: Sen = 0;

  for (const item of input.items) {
    const bruto = keSen(item.jumlah);
    if (bruto <= 0) throw new AturanError('JUMLAH_TIDAK_POSITIF', 'Jumlah item harus lebih dari nol', { kodeRekening: item.kodeRekening });
    brutoTotal += bruto;

    const aturan = input.aturan[item.kodeRekening] ?? [];
    const ppn = aturan.find((a) => a.jenis === 'PPN');
    const dppPpn: Sen = ppn ? Math.round(bruto / (1 + ppn.tarif)) : bruto;

    for (const a of aturan) {
      const tarif = !input.penjualPunyaNpwp && a.tarifTanpaNpwp != null ? a.tarifTanpaNpwp : a.tarif;
      if (!(tarif > 0 && tarif < 1)) throw new AturanError('TARIF_TIDAK_VALID', `Tarif ${a.jenis} tidak valid`, { kodeRekening: item.kodeRekening, tarif });
      const dasar: Sen = a.jenis === 'SSPD' ? bruto : dppPpn;
      const kunci = `${a.jenis}|${tarif}`;
      const lama = kumpulan.get(kunci) ?? { jenis: a.jenis, tarif, dpp: 0, nilai: 0 };
      lama.dpp += dasar;
      kumpulan.set(kunci, lama);
    }
  }

  const jenisBerbeda = new Set([...kumpulan.values()].map((k) => k.jenis));
  if (jenisBerbeda.size > batas) {
    throw new AturanError('PAJAK_MELEBIHI_BATAS_JENIS', `Satu transaksi maksimal ${batas} jenis pajak; ditemukan ${jenisBerbeda.size}`, {
      jenis: [...jenisBerbeda],
    });
  }

  const pajak: RincianPajak[] = [...kumpulan.values()]
    .map((k) => ({ ...k, nilai: bulatkanKeBawahRupiah(Math.round(k.dpp * k.tarif)) }))
    .sort((a, b) => URUTAN[a.jenis] - URUTAN[b.jenis] || a.tarif - b.tarif)
    .map((k) => ({ jenis: k.jenis, tarif: k.tarif, dpp: keRupiah(k.dpp), nilai: keRupiah(k.nilai) }));

  const totalSen = pajak.reduce((s, p) => s + keSen(p.nilai), 0);
  return { nilaiBruto: keRupiah(brutoTotal), totalPajak: keRupiah(totalSen), nilaiNetto: keRupiah(brutoTotal - totalSen), pajak };
}
