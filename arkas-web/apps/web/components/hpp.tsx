'use client';
import { cx } from './ui';

/** Kategori HPP sebagai status: warna selalu disertai label (tidak bergantung warna saja). */
export const KATEGORI_HPP = [
  { k: 'SESUAI', label: 'Sesuai rencana', warna: 'bg-success', teks: 'text-success', ikon: '✓' },
  { k: 'MELEBIHI_RENCANA', label: 'Melebihi rencana', warna: 'bg-warning', teks: 'text-warning', ikon: '▲' },
  { k: 'DI_LUAR_RENCANA', label: 'Di luar rencana', warna: 'bg-danger', teks: 'text-danger', ikon: '!' },
  { k: 'BELUM_DIBELANJAKAN', label: 'Belum dibelanjakan', warna: 'bg-muted/40', teks: 'text-muted', ikon: '○' },
] as const;
export type KodeHpp = (typeof KATEGORI_HPP)[number]['k'];

export function LencanaHpp({ kategori }: { kategori: string }) {
  const k = KATEGORI_HPP.find((x) => x.k === kategori);
  if (!k) return <span>{kategori}</span>;
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-current/30', k.teks)}><span aria-hidden>{k.ikon}</span>{k.label}</span>;
}

/** Batang bertumpuk 100% dengan celah 2px antarsegmen; judul per segmen sebagai tooltip. */
export function BatangHpp({ nilai, label }: { nilai: Partial<Record<KodeHpp, number>>; label: string }) {
  const total = KATEGORI_HPP.reduce((a, k) => a + (nilai[k.k] ?? 0), 0);
  return (
    <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded bg-canvas" role="img"
      aria-label={`${label}: ${KATEGORI_HPP.map((k) => `${k.label} ${nilai[k.k] ?? 0}`).join(', ')}`}>
      {total > 0 && KATEGORI_HPP.filter((k) => nilai[k.k]).map((k) => (
        <div key={k.k} className={cx('h-full first:rounded-l last:rounded-r', k.warna)} style={{ width: `${((nilai[k.k] ?? 0) / total) * 100}%` }} title={`${k.label}: ${nilai[k.k]}`} />
      ))}
    </div>
  );
}

export function LegendaHpp() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legenda kategori HPP">
      {KATEGORI_HPP.map((k) => <li key={k.k} className="flex items-center gap-1.5"><span className={cx('h-2.5 w-2.5 rounded-sm', k.warna)} aria-hidden />{k.label}</li>)}
    </ul>
  );
}

/** Bilah serapan satu seri: angka persen selalu tertulis di sampingnya. */
export function BilahSerapan({ persen }: { persen: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-canvas" aria-hidden><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, persen)}%` }} /></div>
      <span className="angka w-12 text-right text-sm">{persen.toLocaleString('id-ID')}%</span>
    </div>
  );
}
