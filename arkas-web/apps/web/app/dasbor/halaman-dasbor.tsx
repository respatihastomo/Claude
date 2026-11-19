'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { MeDto } from '@arkas/kontrak';
import { Kepala } from '@/components/kepala';
import { BatangHpp, BilahSerapan, KATEGORI_HPP, KodeHpp, LegendaHpp } from '@/components/hpp';
import { Kartu, Pilihan, Spanduk, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { BULAN, rupiah } from '@/lib/format';

type Baris = { kode: string; nama: string | null; jenjang?: string; bulanDitutup?: number; jumlahSekolah: number; rencana: number; realisasi: number; persen: number; terlambat: number; hppMelebihi: number; hppDiLuar: number };
type Serapan = { tingkat: 'PROVINSI' | 'KABUPATEN' | 'SEKOLAH'; induk: string | null; namaInduk: string; bulanWajibTutup: number; total: { jumlahSekolah: number; rencana: number; realisasi: number; persen: number; terlambat: number }; data: Baris[] };
type HppAgregat = { data: Array<{ jenjang: string; kategori: KodeHpp; jumlah: number; nilai: number }>; pembukaanGagal: Array<{ sumberDanaKode: string; mitraKode: string; versi: number }> };

export function HalamanDasbor({ me }: { me: MeDto & { peranAktif: NonNullable<MeDto['peranAktif']> } }) {
  const dinas = ['ADMIN_DINAS', 'VERIFIKATOR_DINAS'].includes(me.peranAktif.peran);
  const tahunIni = new Date().getFullYear();
  const [tahun, setTahun] = useState(tahunIni);
  const [jejak, setJejak] = useState<Array<{ kode: string; nama: string }>>([]);
  const induk = jejak.at(-1)?.kode;
  const qs = `tahun=${tahun}&sumberDanaKode=BOSP_REG`;
  const s = useQuery({ queryKey: ['serapan', tahun, induk], queryFn: async () => (await api<Serapan>(`/dasbor/serapan?${qs}${induk ? `&induk=${induk}` : ''}`)).data });
  const h = useQuery({ queryKey: ['dasbor-hpp', tahun], queryFn: async () => (await api<HppAgregat>(`/dasbor/hpp?${qs}`)).data });
  const t = s.data?.total;
  const perJenjang = Object.entries((h.data?.data ?? []).reduce<Record<string, Partial<Record<KodeHpp, number>>>>((a, x) => {
    (a[x.jenjang] ??= {})[x.kategori] = x.jumlah; return a;
  }, {}));

  return (
    <>
      <Kepala judul="Pemantauan BOSP" me={me} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <nav aria-label="Tingkat wilayah" className="flex flex-wrap items-center gap-1 text-sm">
            <button className={cx('rounded px-1.5 py-0.5', jejak.length ? 'text-primary hover:underline' : 'font-semibold')} onClick={() => setJejak([])}>{dinas ? (s.data?.namaInduk ?? 'Wilayah saya') : 'Nasional'}</button>
            {jejak.map((j, i) => (
              <span key={j.kode} className="flex items-center gap-1"><span className="text-muted">›</span>
                <button className={cx('rounded px-1.5 py-0.5', i < jejak.length - 1 ? 'text-primary hover:underline' : 'font-semibold')} onClick={() => setJejak(jejak.slice(0, i + 1))}>{j.nama}</button>
              </span>
            ))}
          </nav>
          <label className="flex items-center gap-2 text-sm"><span className="text-muted">Tahun</span>
            <Pilihan className="h-9 w-28" value={tahun} onChange={(e) => { setTahun(Number(e.target.value)); setJejak([]); }}>
              {[0, 1, 2].map((d) => tahunIni - d).map((y) => <option key={y} value={y}>{y}</option>)}
            </Pilihan>
          </label>
        </div>

        {!!h.data?.pembukaanGagal.length && (
          <Spanduk nada="bahaya" judul={`${h.data.pembukaanGagal.length} pembukaan sumber dana di Mitra SIPLah gagal`}>
            {h.data.pembukaanGagal.map((g) => `${g.sumberDanaKode} di ${g.mitraKode}`).join(', ')}. Sekolah belum bisa berbelanja di Mitra tersebut; periksa halaman Mitra SIPLah.
          </Spanduk>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi judul="Sekolah dengan RKAS disahkan" nilai={t ? t.jumlahSekolah.toLocaleString('id-ID') : '—'} />
          <Kpi judul="Serapan anggaran" nilai={t ? `${t.persen.toLocaleString('id-ID')}%` : '—'} ket={t ? `${rupiah(t.realisasi)} dari ${rupiah(t.rencana)}` : undefined} />
          <Kpi judul="Belanja disetujui" nilai={t ? rupiah(t.realisasi) : '—'} ket="Hanya belanja yang sudah disetujui Kepala Sekolah" />
          <Kpi judul="Terlambat tutup buku" nilai={t ? t.terlambat.toLocaleString('id-ID') : '—'} nada={t?.terlambat ? 'peringatan' : undefined}
            ket={s.data ? (s.data.bulanWajibTutup ? `Belum menutup buku s.d. ${BULAN[s.data.bulanWajibTutup - 1]}` : 'Belum ada bulan yang wajib ditutup') : undefined} />
        </div>

        <Kartu>
          <div className="border-b border-line px-4 py-3">
            <h2 className="font-display text-base font-bold">Serapan & kepatuhan per {s.data?.tingkat === 'SEKOLAH' ? 'sekolah' : s.data?.tingkat === 'KABUPATEN' ? 'kabupaten/kota' : 'provinsi'}</h2>
            <p className="text-sm text-muted">{s.data?.tingkat === 'SEKOLAH' ? 'Pilih sekolah untuk menelusuri HPP-nya.' : 'Pilih baris untuk melihat rincian di bawahnya.'}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-2">{s.data?.tingkat === 'SEKOLAH' ? 'Sekolah' : 'Wilayah'}</th>{s.data?.tingkat !== 'SEKOLAH' && <th className="px-3 text-right">Sekolah</th>}
                  <th className="px-3 text-right">Rencana</th><th className="px-3 text-right">Realisasi</th><th className="px-3">Serapan</th>
                  <th className="px-3">{s.data?.tingkat === 'SEKOLAH' ? 'Buku ditutup s.d.' : 'Terlambat'}</th><th className="px-3">Catatan HPP</th></tr>
              </thead>
              <tbody>
                {s.data?.data.map((b) => (
                  <tr key={b.kode} className="border-t border-line hover:bg-canvas/60" data-testid="baris-serapan">
                    <td className="px-4 py-2.5">
                      {s.data!.tingkat === 'SEKOLAH'
                        ? <Link className="font-medium text-primary hover:underline" href={`/sekolah/${b.kode}/hpp?tahun=${tahun}`}>{b.nama}</Link>
                        : <button className="text-left font-medium text-primary hover:underline" onClick={() => setJejak([...jejak, { kode: b.kode, nama: b.nama ?? b.kode }])}>{b.nama ?? b.kode}</button>}
                      <span className="block text-xs text-muted">{b.kode}{b.jenjang ? ` · ${b.jenjang}` : ''}</span>
                    </td>
                    {s.data!.tingkat !== 'SEKOLAH' && <td className="angka px-3 text-right">{b.jumlahSekolah}</td>}
                    <td className="angka px-3 text-right">{rupiah(b.rencana)}</td>
                    <td className="angka px-3 text-right">{rupiah(b.realisasi)}</td>
                    <td className="px-3"><BilahSerapan persen={b.persen} /></td>
                    <td className="px-3">{s.data!.tingkat === 'SEKOLAH'
                      ? <span className={cx(b.terlambat ? 'font-medium text-warning' : '')}>{b.bulanDitutup ? BULAN[b.bulanDitutup - 1] : 'Belum ada'}{b.terlambat ? ' · terlambat' : ''}</span>
                      : <span className={cx(b.terlambat ? 'font-medium text-warning' : 'text-muted')}>{b.terlambat ? `${b.terlambat} sekolah` : 'Tidak ada'}</span>}</td>
                    <td className="px-3 text-xs">
                      {b.hppMelebihi > 0 && <span className="mr-2 text-warning">▲ {s.data!.tingkat === 'SEKOLAH' ? 'melebihi rencana' : `${b.hppMelebihi} melebihi`}</span>}
                      {b.hppDiLuar > 0 && <span className="text-danger">! {s.data!.tingkat === 'SEKOLAH' ? 'di luar rencana' : `${b.hppDiLuar} di luar rencana`}</span>}
                      {!b.hppMelebihi && !b.hppDiLuar && <span className="text-muted">—</span>}
                    </td>
                  </tr>
                ))}
                {s.data && !s.data.data.length && <tr><td colSpan={7} className="p-6 text-center text-muted">Belum ada data untuk tahun ini.</td></tr>}
              </tbody>
            </table>
          </div>
        </Kartu>

        <Kartu className="p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold">Pemetaan belanja SIPLah terhadap rencana (HPP) per jenjang</h2>
              <p className="text-sm text-muted">Jumlah baris RKAS dan item belanja Mitra per kategori.</p>
            </div>
            <LegendaHpp />
          </div>
          {!perJenjang.length ? <p className="py-4 text-center text-sm text-muted">Belum ada HPP yang dihitung.</p> : (
            <table className="w-full text-sm">
              <thead className="sr-only"><tr><th>Jenjang</th><th>Distribusi</th>{KATEGORI_HPP.map((k) => <th key={k.k}>{k.label}</th>)}</tr></thead>
              <tbody>
                {perJenjang.map(([j, n]) => (
                  <tr key={j}>
                    <td className="w-16 py-2 pr-3 font-medium">{j}</td>
                    <td className="py-2 pr-4"><BatangHpp nilai={n} label={`Jenjang ${j}`} /></td>
                    {KATEGORI_HPP.map((k) => <td key={k.k} className="angka w-20 whitespace-nowrap py-2 text-right text-xs text-muted" title={k.label}>{n[k.k] ?? 0}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Kartu>
      </main>
    </>
  );
}

function Kpi({ judul, nilai, ket, nada }: { judul: string; nilai: string; ket?: string; nada?: 'peringatan' }) {
  return (
    <Kartu className="p-4">
      <p className="text-sm text-muted">{judul}</p>
      <p className={cx('mt-1 font-display text-2xl font-bold', nada === 'peringatan' && 'text-warning')}>{nilai}</p>
      {ket && <p className="mt-1 text-xs text-muted">{ket}</p>}
    </Kartu>
  );
}
