'use client';
import type { BarisBkuDto } from '@arkas/kontrak';
import { rupiah, tanggal } from '@/lib/format';
import { LencanaStatus, Tombol, cx } from './ui';

export function TabelBku({ baris, bolehPutuskan, onPutuskan, sibuk }: {
  baris: BarisBkuDto[]; bolehPutuskan: boolean; sibuk?: string; onPutuskan: (id: string, aksi: 'setujui' | 'tolak') => void;
}) {
  if (!baris.length) return <p className="p-8 text-center text-sm text-muted">Belum ada transaksi di buku ini.</p>;
  const pertama = new Set<string>();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Tanggal</th>
            <th className="px-4 py-2.5 font-semibold">No. bukti</th>
            <th className="px-4 py-2.5 font-semibold">Uraian</th>
            <th className="px-4 py-2.5 font-semibold">Buku</th>
            <th className="px-4 py-2.5 text-right font-semibold">Penerimaan</th>
            <th className="px-4 py-2.5 text-right font-semibold">Pengeluaran</th>
            <th className="px-4 py-2.5 text-right font-semibold">Saldo</th>
            <th className="px-4 py-2.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b, i) => {
            const awal = !pertama.has(b.transaksiId);
            pertama.add(b.transaksiId);
            return (
              <tr key={`${b.transaksiId}-${i}`} className={cx('border-t border-line', b.status === 'DICATAT' && 'bg-warning/5')}>
                <td className="angka whitespace-nowrap px-4 py-2.5">{awal ? tanggal(b.tanggal) : ''}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">{awal ? b.noBukti ?? '—' : ''}</td>
                <td className="px-4 py-2.5">
                  <span className={cx(!awal && 'pl-3 text-muted')}>{b.uraian}</span>
                  {b.kodeRekening && <span className="angka ml-2 text-xs text-muted">{b.kodeRekening}</span>}
                </td>
                <td className="px-4 py-2.5 text-muted">{b.buku === 'TUNAI' ? 'Tunai' : 'Bank'}</td>
                <td className="angka whitespace-nowrap px-4 py-2.5 text-right">{b.penerimaan ? rupiah(b.penerimaan) : ''}</td>
                <td className="angka whitespace-nowrap px-4 py-2.5 text-right">{b.pengeluaran ? rupiah(b.pengeluaran) : ''}</td>
                <td className="angka whitespace-nowrap px-4 py-2.5 text-right font-medium">{b.saldo === null ? '—' : rupiah(b.saldo)}</td>
                <td className="px-4 py-2.5">
                  {awal && (
                    <div className="flex items-center gap-2">
                      <LencanaStatus status={b.status} />
                      {bolehPutuskan && b.status === 'DICATAT' && (
                        <>
                          <Tombol className="h-8 px-3" memuat={sibuk === `${b.transaksiId}:setujui`} onClick={() => onPutuskan(b.transaksiId, 'setujui')}>Setujui</Tombol>
                          <Tombol className="h-8 px-3" varian="bahaya" memuat={sibuk === `${b.transaksiId}:tolak`} onClick={() => onPutuskan(b.transaksiId, 'tolak')}>Tolak</Tombol>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
