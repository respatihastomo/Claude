const rp = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const rupiah = (n: number) => rp.format(n);
const tgl = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const tanggal = (s: string) => tgl.format(new Date(`${s}T00:00:00Z`));
export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export function hariIni(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export const persen = (a: number, b: number) => (b <= 0 ? 0 : Math.min(100, Math.round((a / b) * 1000) / 10));
