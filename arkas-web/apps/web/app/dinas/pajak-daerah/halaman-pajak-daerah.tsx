'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeDto, TarifPajakDto } from '@arkas/kontrak';
import { Kepala } from '@/components/kepala';
import { Laci } from '@/components/laci';
import { Bidang, Kartu, Masukan, Spanduk, Tombol, cx } from '@/components/ui';
import { api, GalatApi } from '@/lib/api';

const persen = (x: number) => `${(x * 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;

/** UC-32 — Admin Dinas menetapkan atau membebaskan pajak daerah (SSPD) untuk wilayahnya. */
export function HalamanPajakDaerah({ me }: { me: MeDto }) {
  const wilayah = me.peranAktif!.wilayahKode!;
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['pajak-daerah'], queryFn: async () => (await api<{ data: TarifPajakDto[] }>('/dinas/konfigurasi-pajak')).data.data });
  const sspd = useMemo(() => {
    const m = new Map<string, { nasional?: TarifPajakDto; wilayah: TarifPajakDto[] }>();
    for (const t of (data.data ?? []).filter((x) => x.jenis === 'SSPD')) {
      const e = m.get(t.kodeRekening) ?? { wilayah: [] };
      if (t.wilayahKode === '') e.nasional = t; else e.wilayah.push(t);
      m.set(t.kodeRekening, e);
    }
    return [...m.entries()];
  }, [data.data]);
  const [form, setForm] = useState<{ kodeRekening: string; nama: string; tarif: string; bebas: boolean; dasarHukum: string } | null>(null);
  const simpan = useMutation({
    mutationFn: async () => (await api<TarifPajakDto>('/dinas/konfigurasi-pajak', { method: 'PUT', json: {
      kodeRekening: form!.kodeRekening, wilayahKode: wilayah, tarif: form!.bebas ? null : Number(form!.tarif) / 100, dasarHukum: form!.dasarHukum,
    } })).data,
    onSuccess: () => { setForm(null); void qc.invalidateQueries({ queryKey: ['pajak-daerah'] }); },
  });
  const efektif = (e: { nasional?: TarifPajakDto; wilayah: TarifPajakDto[] }) => {
    const w = e.wilayah.filter((x) => wilayah.startsWith(x.wilayahKode)).sort((a, b) => b.wilayahKode.length - a.wilayahKode.length)[0];
    const t = w ?? e.nasional;
    return !t ? '—' : t.aktif ? persen(t.tarif) : 'Tidak dipungut';
  };

  return (
    <div className="min-h-screen">
      <Kepala judul="Pajak daerah (SSPD)" me={me} />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <p className="text-sm text-muted">Tarif pajak daerah yang ditetapkan untuk wilayah <b>{wilayah}</b> otomatis dipakai saat sekolah di wilayah ini mencatat belanja (menggantikan tarif nasional).</p>
        {data.error instanceof GalatApi && <Spanduk nada="bahaya" judul={data.error.problem.detail ?? data.error.problem.title} />}
        <Kartu className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-2.5 font-semibold">Kode rekening</th><th className="px-4 py-2.5 text-right font-semibold">Tarif nasional</th>
                <th className="px-4 py-2.5 text-right font-semibold">Wilayah {wilayah}</th><th className="px-4 py-2.5 text-right font-semibold">Berlaku di sekolah</th><th className="px-4 py-2.5" /></tr>
            </thead>
            <tbody>
              {sspd.map(([kode, e]) => {
                const sendiri = e.wilayah.find((x) => x.wilayahKode === wilayah);
                const nama = (e.nasional ?? e.wilayah[0]).namaRekening;
                return (
                  <tr key={kode} className="border-t border-line">
                    <td className="px-4 py-2.5"><span className="angka text-xs text-muted">{kode}</span><br />{nama}</td>
                    <td className="angka px-4 py-2.5 text-right">{e.nasional ? persen(e.nasional.tarif) : '—'}</td>
                    <td className={cx('angka px-4 py-2.5 text-right', sendiri && 'font-semibold')}>
                      {sendiri ? (sendiri.aktif ? persen(sendiri.tarif) : 'Dibebaskan') : <span className="text-muted">ikut nasional</span>}
                      {sendiri?.dasarHukum && <span className="block text-xs font-normal text-muted">{sendiri.dasarHukum}</span>}
                    </td>
                    <td className="angka px-4 py-2.5 text-right">{efektif(e)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Tombol varian="sekunder" className="h-8" onClick={() => { simpan.reset(); setForm({ kodeRekening: kode, nama, tarif: String(((sendiri?.tarif ?? e.nasional?.tarif ?? 0.1) * 100)), bebas: sendiri ? !sendiri.aktif : false, dasarHukum: sendiri?.dasarHukum ?? '' }); }}>Atur</Tombol>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Kartu>
      </main>
      <Laci terbuka={!!form} onTutup={() => setForm(null)} judul="Atur pajak daerah" lebar="max-w-md"
        kaki={<div className="flex justify-end gap-2"><Tombol varian="sekunder" onClick={() => setForm(null)}>Batal</Tombol>
          <Tombol memuat={simpan.isPending} disabled={!form || form.dasarHukum.trim().length < 3 || (!form.bebas && !(Number(form.tarif) > 0 && Number(form.tarif) < 100))} onClick={() => simpan.mutate()}>Simpan</Tombol></div>}>
        {form && (
          <div className="space-y-4">
            <p className="text-sm"><span className="angka text-muted">{form.kodeRekening}</span><br />{form.nama}</p>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={form.bebas} onChange={(e) => setForm({ ...form, bebas: e.target.checked })} /> Tidak dipungut di wilayah {wilayah}</label>
            {!form.bebas && <Bidang label="Tarif (%)"><Masukan inputMode="decimal" className="angka" value={form.tarif} onChange={(e) => setForm({ ...form, tarif: e.target.value })} /></Bidang>}
            <Bidang label="Dasar hukum (Perda/Perkada)" bantuan="Wajib dicatat untuk jejak audit"><Masukan value={form.dasarHukum} onChange={(e) => setForm({ ...form, dasarHukum: e.target.value })} /></Bidang>
            {simpan.error instanceof GalatApi && <Spanduk nada="bahaya" judul={simpan.error.problem.detail ?? simpan.error.problem.title} />}
          </div>
        )}
      </Laci>
    </div>
  );
}
