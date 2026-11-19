'use client';
import type { TransaksiDitolakDto } from '@arkas/kontrak';
import { rupiah, tanggal } from '@/lib/format';
import { Tombol } from './ui';

const NAMA: Record<TransaksiDitolakDto['jenis'], string> = {
  PENERIMAAN: 'Penerimaan', TARIK_TUNAI: 'Tarik tunai', SETOR_TUNAI: 'Setor tunai', BELANJA: 'Belanja', SETOR_PAJAK: 'Setor pajak',
};

/**
 * Transaksi yang ditolak Kepala Sekolah (periode masih buka). Tidak masuk BKU dan tidak menggerakkan saldo;
 * Bendahara membaca alasannya lalu mencatat ulang dengan data yang benar.
 */
export function PanelDitolak({ data, onCatatUlang, untukBendahara = true }: { data: TransaksiDitolakDto[]; onCatatUlang?: (t: TransaksiDitolakDto) => void; untukBendahara?: boolean }) {
  if (!data.length) return null;
  return (
    <section role="alert" aria-label="Transaksi ditolak" className="rounded-card border border-danger/40 bg-danger/5">
      <div className="border-b border-danger/20 px-4 py-3">
        <p className="text-sm font-semibold text-danger">{data.length} transaksi ditolak Kepala Sekolah</p>
        <p className="text-sm text-muted">Transaksi ini tidak masuk Buku Kas Umum dan tidak mengubah saldo. {untukBendahara ? 'Baca alasannya, perbaiki, lalu catat ulang.' : 'Bendahara melihat alasan yang sama untuk diperbaiki dan dicatat ulang.'}</p>
      </div>
      <ul className="divide-y divide-danger/15">
        {data.map((t) => (
          <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 text-sm">
              <p className="font-medium text-ink">
                {NAMA[t.jenis] ?? t.jenis} · {t.uraian}
                <span className="angka ml-2 text-muted">{rupiah(t.nilaiBruto)}</span>
              </p>
              <p className="text-xs text-muted">
                {tanggal(t.tanggal)}{t.noBukti && <> · <span className="angka">{t.noBukti}</span></>}{t.namaToko && <> · {t.namaToko}</>}
              </p>
              <p className="mt-1 text-ink"><span className="font-semibold text-danger">Alasan:</span> {t.alasanTolak ?? '—'}</p>
            </div>
            {onCatatUlang && <Tombol varian="sekunder" className="h-9" onClick={() => onCatatUlang(t)}>Catat ulang</Tombol>}
          </li>
        ))}
      </ul>
    </section>
  );
}
