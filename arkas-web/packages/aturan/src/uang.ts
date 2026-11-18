/**
 * Semua perhitungan uang dilakukan dalam satuan SEN (bilangan bulat) agar bebas galat floating point.
 * Nilai di API dan basis data adalah rupiah dengan 2 desimal (numeric(18,2)).
 */
export type Sen = number;

export function keSen(rupiah: number | string): Sen {
  const n = typeof rupiah === 'string' ? Number(rupiah) : rupiah;
  if (!Number.isFinite(n)) throw new AturanError('NILAI_TIDAK_VALID', `Nilai uang tidak valid: ${rupiah}`);
  return Math.round(n * 100);
}

export function keRupiah(sen: Sen): number {
  return sen / 100;
}

/** Pembulatan ke bawah ke satuan rupiah penuh (praktik pembulatan PPh/PPN pada bukti potong). */
export function bulatkanKeBawahRupiah(sen: Sen): Sen {
  return Math.floor(sen / 100) * 100;
}

export class AturanError extends Error {
  constructor(public readonly kode: string, message: string, public readonly detail?: Record<string, unknown>) {
    super(message);
    this.name = 'AturanError';
  }
}
