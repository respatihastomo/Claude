'use client';
import { ButtonHTMLAttributes, forwardRef, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

type Varian = 'utama' | 'sekunder' | 'bahaya' | 'hantu';
export const Tombol = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { varian?: Varian; memuat?: boolean }>(
  function Tombol({ varian = 'utama', memuat, className, children, disabled, ...p }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || memuat}
        className={cx(
          'inline-flex h-10 items-center justify-center gap-2 rounded-ctl px-4 text-sm font-semibold transition duration-150 ease-quint disabled:cursor-not-allowed disabled:opacity-50',
          varian === 'utama' && 'bg-primary text-primary-ink hover:bg-primary/90 active:scale-[0.98]',
          varian === 'sekunder' && 'border border-line bg-surface text-ink hover:bg-canvas',
          varian === 'bahaya' && 'border border-danger/40 bg-surface text-danger hover:bg-danger/5',
          varian === 'hantu' && 'text-muted hover:bg-canvas hover:text-ink',
          className,
        )}
        {...p}
      >
        {memuat && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
        {children}
      </button>
    );
  },
);

export function Kartu({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('rounded-card border border-line bg-surface shadow-sm', className)}>{children}</section>;
}

const WARNA_STATUS: Record<string, string> = {
  DICATAT: 'bg-warning/10 text-warning ring-warning/30',
  DISETUJUI: 'bg-success/10 text-success ring-success/30',
  DITOLAK: 'bg-danger/10 text-danger ring-danger/30',
  BUKA: 'bg-success/10 text-success ring-success/30',
  DITUTUP: 'bg-canvas text-muted ring-line',
};
const LABEL_STATUS: Record<string, string> = { DICATAT: 'Menunggu persetujuan', DISETUJUI: 'Disetujui', DITOLAK: 'Ditolak', BUKA: 'Periode buka', DITUTUP: 'Periode ditutup' };
export function LencanaStatus({ status }: { status: string }) {
  return (
    <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', WARNA_STATUS[status] ?? 'bg-canvas text-muted ring-line')}>
      {LABEL_STATUS[status] ?? status}
    </span>
  );
}

export function Bidang({ label, bantuan, galat, children }: { label: string; bantuan?: string; galat?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {galat ? <span className="mt-1 block text-xs text-danger">{galat}</span> : bantuan ? <span className="mt-1 block text-xs text-muted">{bantuan}</span> : null}
    </label>
  );
}

const kelasInput = 'h-10 w-full rounded-ctl border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';
export const Masukan = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Masukan({ className, ...p }, ref) {
  return <input ref={ref} className={cx(kelasInput, className)} {...p} />;
});
export function Pilihan({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(kelasInput, 'pr-8', className)} {...p} />;
}

export function Spanduk({ nada = 'info', judul, children, aksi }: { nada?: 'info' | 'peringatan' | 'bahaya' | 'sukses'; judul: string; children?: ReactNode; aksi?: ReactNode }) {
  const warna = { info: 'border-primary/30 bg-primary/5', peringatan: 'border-warning/40 bg-warning/10', bahaya: 'border-danger/40 bg-danger/5', sukses: 'border-success/40 bg-success/10' }[nada];
  const teks = { info: 'text-primary', peringatan: 'text-warning', bahaya: 'text-danger', sukses: 'text-success' }[nada];
  return (
    <div role={nada === 'bahaya' ? 'alert' : 'status'} className={cx('flex flex-wrap items-start justify-between gap-3 rounded-ctl border p-3', warna)}>
      <div className="min-w-0">
        <p className={cx('text-sm font-semibold', teks)}>{judul}</p>
        {children && <div className="mt-0.5 text-sm text-ink">{children}</div>}
      </div>
      {aksi}
    </div>
  );
}

export function BilahSisa({ terpakai, anggaran }: { terpakai: number; anggaran: number }) {
  const p = anggaran <= 0 ? 0 : Math.min(100, (terpakai / anggaran) * 100);
  const warna = p >= 100 ? 'bg-danger' : p >= 85 ? 'bg-warning' : 'bg-success';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)} aria-label="Pemakaian anggaran">
      <div className={cx('h-full rounded-full transition-[width] duration-300 ease-quint', warna)} style={{ width: `${p}%` }} />
    </div>
  );
}

export { cx };
