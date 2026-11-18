'use client';
import type { RingkasKomponenDto } from '@arkas/kontrak';
import { rupiah } from '@/lib/format';
import { cx } from './ui';

/** Kode 19 — bilah kepatuhan komponen juknis: persen dari pagu dengan garis penanda batas maksimum/minimum. */
export function ComplianceBar({ k }: { k: RingkasKomponenDto }) {
  const skala = Math.max(100, k.maksPersen ?? 0);
  const lebar = Math.min(100, (k.persen / skala) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate">{k.kode}. {k.nama}</span>
        <span className={cx('angka shrink-0 font-semibold', !k.ok && 'text-danger')}>{k.persen.toLocaleString('id-ID')}%</span>
      </div>
      <div className="relative mt-1 h-2 rounded-full bg-canvas" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={k.persen} aria-label={`${k.nama} ${k.persen}% dari pagu`}>
        <div className={cx('h-full rounded-full transition-[width] duration-300 ease-quint', k.ok ? 'bg-primary' : 'bg-danger')} style={{ width: `${lebar}%` }} />
        {k.maksPersen != null && <span className="absolute -top-1 h-4 w-0.5 bg-danger" style={{ left: `${(k.maksPersen / skala) * 100}%` }} title={`Batas maks ${k.maksPersen}%`} />}
        {k.minPersen != null && <span className="absolute -top-1 h-4 w-0.5 bg-warning" style={{ left: `${(k.minPersen / skala) * 100}%` }} title={`Batas min ${k.minPersen}%`} />}
      </div>
      <p className="angka mt-0.5 text-xs text-muted">{rupiah(k.total)}{k.maksPersen != null && ` · maks ${k.maksPersen}%`}{k.minPersen != null && ` · min ${k.minPersen}%`}</p>
    </div>
  );
}
