'use client';
import { cx } from './ui';

const W: Record<string, [string, string]> = {
  DRAF: ['Draf', 'bg-canvas text-muted ring-line'], DIAJUKAN: ['Diajukan ke Balai', 'bg-warning/10 text-warning ring-warning/30'],
  DIKEMBALIKAN: ['Dikembalikan', 'bg-danger/10 text-danger ring-danger/30'], DISAHKAN: ['Disahkan', 'bg-success/10 text-success ring-success/30'],
  DIUNGGAH: ['Menunggu keputusan', 'bg-warning/10 text-warning ring-warning/30'], DISETUJUI: ['Disetujui', 'bg-success/10 text-success ring-success/30'],
  DITOLAK: ['Ditolak', 'bg-danger/10 text-danger ring-danger/30'], MENUNGGU: ['Diproses', 'bg-canvas text-muted ring-line'],
  SELESAI: ['Berhasil', 'bg-success/10 text-success ring-success/30'], GAGAL: ['Gagal', 'bg-danger/10 text-danger ring-danger/30'],
};
export function LencanaBantuan({ status, label }: { status: string; label?: string }) {
  const [l, c] = W[status] ?? [status, 'bg-canvas text-muted ring-line'];
  return <span className={cx('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', c)}>{label ?? l}</span>;
}
