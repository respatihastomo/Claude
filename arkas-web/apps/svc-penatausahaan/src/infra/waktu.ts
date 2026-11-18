/** Tanggal hari ini menurut zona waktu Asia/Jakarta (YYYY-MM-DD). */
export function hariIniJakarta(sekarang: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(sekarang);
}

export function bulanDari(tanggal: string): number {
  return Number(tanggal.slice(5, 7));
}
