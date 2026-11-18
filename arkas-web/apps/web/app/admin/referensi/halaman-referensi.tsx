'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeDto } from '@arkas/kontrak';
import { Kepala } from '@/components/kepala';
import { Kartu, Spanduk, Tombol, cx } from '@/components/ui';
import { api, GalatApi } from '@/lib/api';

const TAB = [
  ['komponen', 'Komponen BOSP', ['sumberDanaKode', 'kode', 'nama', 'maksPersen', 'minPersen']],
  ['tarif-pajak', 'Tarif pajak', ['kodeRekening', 'jenis', 'wilayahKode', 'tarif', 'tarifTanpaNpwp', 'dasarHukum']],
  ['kode-rekening', 'Kode rekening', ['kode', 'nama']],
  ['sekolah', 'Satuan pendidikan', ['npsn', 'nama', 'jenjangKode', 'wilayahKode', 'statusSekolah']],
  ['wilayah', 'Wilayah', ['kode', 'nama', 'indukKode']],
  ['direktorat', 'Direktorat', ['kode', 'nama', 'ditjenKode']],
  ['sumber-dana', 'Sumber dana', ['kode', 'nama', 'kategori']],
] as const;

const LABEL: Record<string, string> = {
  sumberDanaKode: 'Sumber dana', kode: 'Kode', nama: 'Nama', maksPersen: 'Maks', minPersen: 'Min', kodeRekening: 'Kode rekening',
  jenis: 'Jenis', wilayahKode: 'Wilayah', tarif: 'Tarif', tarifTanpaNpwp: 'Tanpa NPWP', dasarHukum: 'Dasar hukum', npsn: 'NPSN',
  jenjangKode: 'Jenjang', statusSekolah: 'Status', indukKode: 'Induk', ditjenKode: 'Ditjen', kategori: 'Kategori',
};

/** UC-19 — referensi nasional (Balai SDSP). Perubahan menerbitkan ReferensiDiubah ke semua layanan. */
export function HalamanReferensi({ me }: { me: MeDto }) {
  const [tab, setTab] = useState<(typeof TAB)[number]>(TAB[0]);
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['referensi', tab[0]], queryFn: async () => (await api<{ data: Array<Record<string, unknown>> }>(`/referensi/${tab[0]}`)).data.data });
  const terbit = useMutation({ mutationFn: async () => (await api<{ jumlah: number }>('/admin/referensi/terbit-ulang', { method: 'POST' })).data });
  const ubahBatas = useMutation({
    mutationFn: async (k: Record<string, unknown>) => {
      const v = window.prompt(`Batas maksimum (%) untuk ${k.kode}. ${k.nama} — kosongkan untuk tanpa batas:`, k.maksPersen == null ? '' : String(k.maksPersen));
      if (v === null) return null;
      return (await api('/admin/referensi/komponen', { method: 'PUT', json: { sumberDanaKode: k.sumberDanaKode, kode: k.kode, nama: k.nama, maksPersen: v.trim() ? Number(v) : null, minPersen: k.minPersen ?? null, aktif: k.aktif } })).data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['referensi'] }),
  });
  const galat = [data.error, terbit.error, ubahBatas.error].find((e) => e instanceof GalatApi) as GalatApi | undefined;
  const format = (k: string, v: unknown) => (v == null || v === '' ? (k === 'wilayahKode' ? 'Nasional' : '—') : k.startsWith('tarif') ? `${(Number(v) * 100).toLocaleString('id-ID')}%` : k.endsWith('Persen') ? `${v}%` : String(v));

  return (
    <div className="min-h-screen">
      <Kepala judul="Referensi nasional" me={me} />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1" role="tablist">
            {TAB.map((t) => (
              <button key={t[0]} role="tab" aria-selected={t === tab} onClick={() => setTab(t)}
                className={cx('rounded-ctl px-3 py-1.5 text-sm font-medium', t === tab ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-canvas')}>{t[1]}</button>
            ))}
          </div>
          <Tombol varian="sekunder" memuat={terbit.isPending} onClick={() => window.confirm('Terbitkan ulang seluruh referensi ke semua layanan?') && terbit.mutate()}>Terbitkan ulang ke semua layanan</Tombol>
        </div>
        {terbit.data && <Spanduk nada="sukses" judul={`${terbit.data.jumlah} baris referensi diantrekan untuk dikirim ke layanan lain`} />}
        {galat && <Spanduk nada="bahaya" judul={galat.problem.detail ?? galat.problem.title}>Kode: {galat.problem.kode}</Spanduk>}
        <Kartu className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
              <tr>{tab[2].map((k) => <th key={k} className="px-4 py-2.5 font-semibold">{LABEL[k] ?? k}</th>)}<th className="px-4 py-2.5 font-semibold">Versi</th><th className="px-4 py-2.5 font-semibold">Aktif</th><th /></tr>
            </thead>
            <tbody>
              {(data.data ?? []).map((r, i) => (
                <tr key={i} className={cx('border-t border-line', !r.aktif && 'text-muted')}>
                  {tab[2].map((k) => <td key={k} className={cx('px-4 py-2', /kode|npsn|tarif|Persen/.test(k) && 'angka')}>{format(k, r[k])}</td>)}
                  <td className="angka px-4 py-2 text-muted">{String(r.versi)}</td>
                  <td className="px-4 py-2">{r.aktif ? 'Aktif' : 'Nonaktif'}</td>
                  <td className="px-4 py-2 text-right">{tab[0] === 'komponen' && <button className="text-xs text-primary hover:underline" onClick={() => ubahBatas.mutate(r)}>Ubah batas</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Kartu>
      </main>
    </div>
  );
}
