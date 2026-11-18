'use client';
import { ReactNode, useEffect, useRef } from 'react';
import { cx } from './ui';

/** Laci geser kanan (Slide-Over). BKU tetap terlihat di latar. Esc menutup; fokus dipindah ke laci. */
export function Laci({ terbuka, onTutup, judul, lebar = 'max-w-2xl', children, kaki }: {
  terbuka: boolean; onTutup: () => void; judul: string; lebar?: string; children: ReactNode; kaki?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!terbuka) return;
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onTutup();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [terbuka, onTutup]);
  return (
    <div className={cx('fixed inset-0 z-40', !terbuka && 'pointer-events-none')} aria-hidden={!terbuka}>
      <div className={cx('absolute inset-0 bg-ink/30 transition-opacity duration-200', terbuka ? 'opacity-100' : 'opacity-0')} onClick={onTutup} />
      <div
        ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={judul}
        className={cx('absolute right-0 top-0 flex h-full w-full flex-col bg-surface shadow-lg outline-none transition-transform duration-[280ms] ease-quint', lebar, terbuka ? 'translate-x-0' : 'translate-x-full')}
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-lg font-bold">{judul}</h2>
          <button onClick={onTutup} className="rounded-ctl p-2 text-muted hover:bg-canvas hover:text-ink" aria-label="Tutup">✕</button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {kaki && <footer className="border-t border-line px-6 py-4">{kaki}</footer>}
      </div>
    </div>
  );
}
