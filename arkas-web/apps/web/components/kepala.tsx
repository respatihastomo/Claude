'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MeDto } from '@arkas/kontrak';
import { cakupanTeks, LABEL_PERAN } from '@/lib/peran';
import { cx } from './ui';

export type PeranUi = string;

/** Kepala halaman: modul sesuai peran aktif, pemilih peran aktif (UC-01, svc-identitas), dan keluar. */
export function Kepala({ judul, me, npsn }: { judul: string; me: MeDto; npsn?: string }) {
  const path = usePathname();
  const aktif = me.peranAktif;
  async function gantiPeran(id: string) {
    const r = await fetch('/api/v1/me/peran-aktif', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ peranPenggunaId: id }) });
    if (r.ok) window.location.assign('/');
  }
  async function keluar() {
    await fetch('/api/v1/auth/keluar', { method: 'POST' });
    window.location.assign('/masuk');
  }
  const menu = [
    ...(npsn ? [{ href: `/sekolah/${npsn}/perencanaan`, label: 'Penganggaran (RKAS)' }] : []),
    ...(npsn && aktif?.npsn ? [{ href: `/sekolah/${npsn}/penatausahaan/bku`, label: 'Penatausahaan' }] : []),
    ...(aktif && ['VERIFIKATOR_DINAS', 'TIM_KERJA'].includes(aktif.peran) ? [{ href: '/penelaahan', label: 'Penelaahan' }] : []),
    ...(aktif && ['SUPER_ADMIN', 'ADMIN_DITJEN', 'ADMIN_DIREKTORAT', 'ADMIN_DINAS', 'OPERATOR'].includes(aktif.peran) ? [{ href: '/admin/pengguna', label: 'Kelola pengguna' }] : []),
    ...(aktif?.peran === 'ADMIN_DINAS' ? [{ href: '/dinas/pajak-daerah', label: 'Pajak daerah' }] : []),
    ...(aktif?.peran === 'SUPER_ADMIN' ? [{ href: '/admin/referensi', label: 'Referensi' }] : []),
    ...(aktif && ['AUDITOR', 'SUPER_ADMIN', 'KEPSEK'].includes(aktif.peran) ? [{ href: '/audit', label: 'Jejak audit' }] : []),
  ];
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">ARKAS Web</p>
          <h1 className="font-display text-lg font-bold">{judul}</h1>
          {aktif && <p className="text-xs text-muted">{cakupanTeks(aktif)}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-sm text-muted md:inline">{me.nama}</span>
          <label className="sr-only" htmlFor="peran">Peran aktif</label>
          <select id="peran" value={aktif?.id ?? ''} onChange={(e) => gantiPeran(e.target.value)} className="h-9 max-w-[16rem] rounded-ctl border border-line bg-surface px-2 text-sm">
            {me.peran.map((p) => <option key={p.id} value={p.id}>{LABEL_PERAN[p.peran] ?? p.peran} · {cakupanTeks(p)}</option>)}
          </select>
          <button onClick={keluar} className="h-9 rounded-ctl px-3 text-sm text-muted hover:bg-canvas hover:text-ink">Keluar</button>
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
