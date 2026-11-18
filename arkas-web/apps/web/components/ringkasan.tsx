'use client';
import type { RingkasanBukuDto } from '@arkas/kontrak';
import { BULAN, persen, rupiah } from '@/lib/format';
import { BilahSisa, Kartu, LencanaStatus } from './ui';

export function Ringkasan({ r }: { r?: RingkasanBukuDto }) {
  const ubin = [
    { label: 'Saldo tunai', nilai: r?.saldo.tunai, catatan: r ? `Tersedia ${rupiah(r.saldoTersedia.tunai)}` : '' },
    { label: 'Saldo bank', nilai: r?.saldo.bank, catatan: r ? `Tersedia ${rupiah(r.saldoTersedia.bank)}` : '' },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {ubin.map((u) => (
        <Kartu key={u.label} className="p-4">
          <p className="text-sm text-muted">{u.label}</p>
          <p className="angka mt-1 font-display text-xl font-bold">{u.nilai === undefined ? '—' : rupiah(u.nilai)}</p>
          <p className="angka mt-1 text-xs text-muted">{u.catatan}</p>
        </Kartu>
      ))}
      <Kartu className="p-4">
        <p className="text-sm text-muted">Realisasi terhadap pagu</p>
        <p className="angka mt-1 font-display text-xl font-bold">{r ? `${persen(r.realisasi, r.pagu).toLocaleString("id-ID")}%` : "—"}</p>
        <div className="mt-2"><BilahSisa terpakai={r?.realisasi ?? 0} anggaran={r?.pagu ?? 0} /></div>
        <p className="angka mt-1 text-xs text-muted">{r ? `${rupiah(r.realisasi)} dari ${rupiah(r.pagu)}` : ''}</p>
      </Kartu>
      <Kartu className="p-4">
        <p className="text-sm text-muted">Periode berjalan</p>
        <p className="mt-1 font-display text-xl font-bold">{r?.periodeBerjalan ? BULAN[r.periodeBerjalan.bulan - 1] : 'Belum dibuka'}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {r?.periodeBerjalan && <LencanaStatus status={r.periodeBerjalan.status} />}
          {!!r?.menungguPersetujuan && <span className="text-xs font-medium text-warning">{r.menungguPersetujuan} menunggu persetujuan</span>}
        </div>
        <p className="angka mt-1 text-xs text-muted">{r ? (r.pajakTerutang > 0 ? `Pajak belum disetor ${rupiah(r.pajakTerutang)}` : 'Semua pajak sudah disetor') : ''}</p>
      </Kartu>
    </div>
  );
}
