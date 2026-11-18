'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cx } from './ui';

export type PeranUi = 'BENDAHARA' | 'KEPSEK' | 'VERIFIKATOR_DINAS';

/** Kepala halaman bersama: identitas sekolah, navigasi Penganggaran/Penatausahaan, dan pemilih peran (dev, pengganti SSO). */
export function Kepala({ npsn, judul, peran, namaPengguna }: { npsn: string; judul: string; peran: PeranUi; namaPengguna: string }) {
  const router = useRouter();
  const path = usePathname();
  async function gantiPeran(p: string) {
    await fetch('/api/dev/peran', { method: 'POST', body: JSON.stringify({ peran: p }) });
    router.refresh();
  }
  const menu = [
    { href: `/sekolah/${npsn}/perencanaan`, label: 'Penganggaran (RKAS)' },
    { href: `/sekolah/${npsn}/penatausahaan/bku`, label: 'Penatausahaan' },
  ];
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">ARKAS Web</p>
          <h1 className="font-display text-lg font-bold">{judul}</h1>
          <p className="angka text-xs text-muted">NPSN {npsn}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted" htmlFor="peran">Peran aktif (dev)</label>
          <select id="peran" value={peran} onChange={(e) => gantiPeran(e.target.value)} className="h-9 rounded-ctl border border-line bg-surface px-2 text-sm">
            <option value="BENDAHARA">Bendahara</option>
            <option value="KEPSEK">Kepala Sekolah</option>
            <option value="VERIFIKATOR_DINAS">Verifikator Dinas</option>
          </select>
          <span className="hidden text-sm text-muted md:inline">{namaPengguna}</span>
        </div>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-1 px-4 sm:px-6" aria-label="Modul">
        {menu.map((m) => (
          <Link key={m.href} href={m.href} aria-current={path === m.href ? 'page' : undefined}
            className={cx('border-b-2 px-3 py-2 text-sm font-medium', path === m.href ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink')}>
            {m.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
