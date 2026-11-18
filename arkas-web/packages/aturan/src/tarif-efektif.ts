import type { AturanPajakRekening, JenisPajak } from './hitung-pajak';

/**
 * UC-32 — tarif pajak efektif untuk sekolah: per (kode rekening, jenis) dipakai baris dengan wilayah PALING SPESIFIK
 * yang menjadi awalan wilayah sekolah ('' = nasional). Baris wilayah yang nonaktif berarti "tidak dipungut di wilayah ini"
 * (mis. Dinas membebaskan pajak daerah), sehingga menutup tarif nasional.
 */
export interface KandidatTarif {
  kodeRekening: string;
  jenis: JenisPajak;
  tarif: number;
  tarifTanpaNpwp: number | null;
  /** '' = nasional; selain itu kode wilayah (2/4/6 digit) */
  wilayahKode: string;
  aktif: boolean;
}

export function pilihTarifEfektif(kandidat: KandidatTarif[], wilayahSekolah: string | null | undefined): Record<string, AturanPajakRekening[]> {
  const terbaik = new Map<string, KandidatTarif>();
  for (const k of kandidat) {
    const berlaku = k.wilayahKode === '' || (!!wilayahSekolah && wilayahSekolah.startsWith(k.wilayahKode));
    if (!berlaku) continue;
    const kunci = `${k.kodeRekening}|${k.jenis}`;
    const lama = terbaik.get(kunci);
    if (!lama || k.wilayahKode.length > lama.wilayahKode.length) terbaik.set(kunci, k);
  }
  const hasil: Record<string, AturanPajakRekening[]> = {};
  for (const k of [...terbaik.values()].filter((x) => x.aktif).sort((a, b) => a.jenis.localeCompare(b.jenis))) {
    (hasil[k.kodeRekening] ??= []).push({ jenis: k.jenis, tarif: k.tarif, tarifTanpaNpwp: k.tarifTanpaNpwp });
  }
  return hasil;
}
