'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BarisRkasDto, TransaksiDto, TransaksiMitraMasukDto } from '@arkas/kontrak';
import { api, GalatApi } from '@/lib/api';
import { rupiah, tanggal } from '@/lib/format';
import { Buku, kunciBuku, useRkas } from '@/lib/hooks';
import { Pilihan, Spanduk, Tombol, cx } from './ui';

/**
 * UC-12 Transaksi SIPLah masuk: pesanan yang dibayar lewat Mitra SIPLah dikirim otomatis ke ARKAS (svc-integrasi).
 * Bendahara memetakan item yang belum punya baris RKAS lalu mencatatnya ke BKU sebagai belanja non-tunai;
 * Kepala Sekolah tetap menyetujuinya seperti belanja biasa. Pesanan yang dibatalkan/diretur di Mitra ditandai.
 */
export function PanelSiplah({ buku, peran, bolehCatat }: { buku: Buku; peran: string; bolehCatat: boolean }) {
  const q = useQuery({
    queryKey: [...kunciBuku(buku), 'siplah'],
    queryFn: async () => (await api<{ data: TransaksiMitraMasukDto[] }>(`/sekolah/${buku.npsn}/transaksi-mitra?tahun=${buku.tahun}&sumberDanaKode=${buku.sumberDanaKode}`)).data.data,
    refetchInterval: 15_000,
  });
  const bendahara = peran === 'BENDAHARA';
  const rkas = useRkas(buku, bendahara);
  const menunggu = (q.data ?? []).filter((t) => t.status === 'MENUNGGU');
  const perluTindak = (q.data ?? []).filter((t) => t.status === 'DICATAT' && t.statusMitra !== 'DITERIMA' && t.statusTransaksi !== 'DITOLAK');
  if (!menunggu.length && !perluTindak.length) return null;
  return (
    <section aria-label="Transaksi SIPLah" className="rounded-card border border-primary/30 bg-primary/5">
      <div className="border-b border-primary/20 px-4 py-3">
        <p className="text-sm font-semibold text-primary">{menunggu.length ? `${menunggu.length} transaksi SIPLah menunggu dicatat ke BKU` : 'Pesanan SIPLah perlu ditindaklanjuti'}</p>
        <p className="text-sm text-muted">
          {bendahara ? 'Dikirim otomatis oleh Mitra SIPLah. Pastikan setiap barang terpetakan ke baris RKAS, lalu catat; Kepala Sekolah menyetujuinya seperti belanja biasa.'
            : 'Dikirim otomatis oleh Mitra SIPLah. Bendahara mencatatnya ke BKU, lalu Bapak/Ibu menyetujuinya seperti belanja biasa.'}
        </p>
      </div>
      <ul className="divide-y divide-primary/15">
        {perluTindak.map((t) => (
          <li key={t.id} className="px-4 py-3" data-testid="siplah-batal">
            <Spanduk nada="peringatan" judul={`Pesanan ${t.transactionId} ${t.statusMitra === 'RETUR' ? 'diretur' : 'dibatalkan'} di Mitra`}>
              {t.alasanBatal} · {rupiah(t.total)}. {t.statusTransaksi === 'DICATAT'
                ? (peran === 'KEPSEK' ? 'Tolak belanja ini di tabel BKU agar tidak masuk pembukuan.' : 'Kepala Sekolah perlu menolak belanja ini di BKU.')
                : 'Belanja sudah disetujui; catat pengembalian dana sebagai penerimaan setelah dana kembali ke rekening sekolah.'}
            </Spanduk>
          </li>
        ))}
        {menunggu.map((t) => <ItemSiplah key={t.id} t={t} buku={buku} rkas={rkas.data ?? []} bolehCatat={bendahara && bolehCatat} />)}
      </ul>
    </section>
  );
}

function ItemSiplah({ t, buku, rkas, bolehCatat }: { t: TransaksiMitraMasukDto; buku: Buku; rkas: BarisRkasDto[]; bolehCatat: boolean }) {
  const qc = useQueryClient();
  const [peta, setPeta] = useState<Record<string, string>>({});
  const catat = useMutation({
    mutationFn: async () => (await api<{ transaksi: TransaksiDto }>(`/transaksi-mitra/${t.id}/catat`, {
      method: 'POST', json: { pemetaan: Object.entries(peta).filter(([, b]) => b).map(([itemId, barisId]) => ({ itemId, barisId })) },
    })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: kunciBuku(buku) }),
  });
  const kurang = t.items.filter((i) => !i.barisId && !peta[i.itemId]).length;
  const g = catat.error instanceof GalatApi ? catat.error : undefined;
  return (
    <li className="space-y-2 px-4 py-3" data-testid="siplah-menunggu">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="font-medium text-ink">{t.namaToko} <span className="angka ml-2 text-muted">{rupiah(t.total)}</span></p>
        <p className="text-xs text-muted">{tanggal(t.tanggal)} · <span className="angka">{t.transactionId}</span> · {t.mitraKode}</p>
      </div>
      <table className="w-full text-left text-xs">
        <thead className="text-muted"><tr><th className="py-1 pr-2">Barang</th><th className="pr-2 text-right">Jumlah</th><th className="w-1/2">Baris RKAS</th></tr></thead>
        <tbody>
          {t.items.map((i) => {
            const b = rkas.find((r) => r.barisId === (peta[i.itemId] || i.barisId));
            const calon = [...rkas].sort((x, y) => Number(y.kodeRekening === i.kodeRekening) - Number(x.kodeRekening === i.kodeRekening));
            return (
              <tr key={i.itemId} className="border-t border-primary/10 align-middle">
                <td className="py-1.5 pr-2">{i.uraian}<span className="block text-muted">{i.volume} {i.satuan ?? ''} × {rupiah(i.hargaSatuan)}</span></td>
                <td className="angka pr-2 text-right">{rupiah(i.jumlah)}</td>
                <td>
                  {i.barisId ? <span className="text-ink">{b ? `${b.kegiatan} · ${b.uraian}` : 'Baris RKAS dari Mitra'} <span className="text-success">✓</span></span>
                    : bolehCatat ? (
                      <Pilihan aria-label={`Baris RKAS untuk ${i.uraian}`} value={peta[i.itemId] ?? ''} onChange={(e) => setPeta({ ...peta, [i.itemId]: e.target.value })}
                        className={cx('h-9 text-xs', !peta[i.itemId] && 'border-warning')}>
                        <option value="">Pilih baris RKAS…</option>
                        {calon.map((r) => <option key={r.barisId} value={r.barisId}>{r.kodeRekening === i.kodeRekening ? '★ ' : ''}{r.kegiatan} · {r.uraian} (sisa {rupiah(r.sisa)})</option>)}
                      </Pilihan>
                    ) : <span className="text-warning">Belum dipetakan</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {g && <Spanduk nada="bahaya" judul={g.problem.detail ?? g.problem.title}>Kode: {g.problem.kode}</Spanduk>}
      {bolehCatat && (
        <div className="flex items-center justify-end gap-3">
          {kurang > 0 && <span className="text-xs text-warning">{kurang} barang belum dipetakan</span>}
          <Tombol className="h-9" disabled={kurang > 0} memuat={catat.isPending} onClick={() => catat.mutate()}>Catat ke BKU</Tombol>
        </div>
      )}
    </li>
  );
}
