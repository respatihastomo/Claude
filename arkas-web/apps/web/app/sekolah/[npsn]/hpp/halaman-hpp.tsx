'use client';
import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MeDto } from '@arkas/kontrak';
import { Kepala } from '@/components/kepala';
import { KATEGORI_HPP, KodeHpp, LencanaHpp } from '@/components/hpp';
import { Kartu, Spanduk, cx } from '@/components/ui';
import { api, GalatApi } from '@/lib/api';
import { rupiah, tanggal } from '@/lib/format';

type Hpp = {
  sekolah: { npsn: string; nama?: string; jenjang?: string };
  ringkasan: (Record<KodeHpp, { jumlah: number; nilai: number }> & { rencana: number; belanja: number }) | null; versiRkas: number | null; dihitungAt: string | null;
  baris: Array<{ barisId: string; kodeRekening: string; kegiatan: string; uraian: string; rencana: number; belanja: number; selisih: number; kategori: KodeHpp }>;
  item: Array<{ barisId: string | null; cara: 'ID_BARIS' | 'KODE_REKENING' | 'TIDAK_COCOK'; jumlah: number; mitraKode: string; transactionId: string; tanggal: string; kodeRekening: string; uraian: string }>;
};
const CARA = { ID_BARIS: 'dipilih dari RKAS di Mitra', KODE_REKENING: 'dicocokkan lewat kode rekening', TIDAK_COCOK: 'tidak ada di RKAS' };
const waktu = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });

export function HalamanHpp({ me, npsn, tahun }: { me: MeDto & { peranAktif: NonNullable<MeDto['peranAktif']> }; npsn: string; tahun: number }) {
  const [buka, setBuka] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['hpp', npsn, tahun], queryFn: async () => (await api<Hpp>(`/hpp/sekolah/${npsn}?tahun=${tahun}&sumberDanaKode=BOSP_REG`)).data, retry: false });
  const d = q.data;
  const g = q.error instanceof GalatApi ? q.error : undefined;
  const diLuar = d?.item.filter((i) => i.cara === 'TIDAK_COCOK') ?? [];
  const sekolahSendiri = me.peranAktif.npsn === npsn;
  return (
    <>
      <Kepala judul={`Pemetaan Pembelanjaan (HPP) — BOSP Reguler ${tahun}`} me={me} npsn={sekolahSendiri ? npsn : undefined} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        {g && <Spanduk nada="bahaya" judul={g.problem.detail ?? g.problem.title}>Kode: {g.problem.kode}</Spanduk>}
        {d && <p className="text-sm text-muted">{d.sekolah.nama ?? npsn} ({npsn}) · RKAS versi {d.versiRkas ?? '—'} · dihitung {d.dihitungAt ? waktu.format(new Date(d.dihitungAt)) : '—'}.
          HPP membandingkan rencana di RKAS yang disahkan dengan belanja sekolah di Mitra SIPLah.</p>}
        {d && !d.ringkasan && <Spanduk nada="info" judul="HPP belum tersedia">HPP dihitung otomatis setelah RKAS disahkan dan setiap ada belanja di Mitra SIPLah.</Spanduk>}

        {d?.ringkasan && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {KATEGORI_HPP.map((k) => (
              <Kartu key={k.k} className="p-4">
                <p className={cx('flex items-center gap-1.5 text-sm font-medium', k.teks)}><span aria-hidden>{k.ikon}</span>{k.label}</p>
                <p className="mt-1 font-display text-2xl font-bold">{d.ringkasan![k.k].jumlah} <span className="text-sm font-normal text-muted">{k.k === 'DI_LUAR_RENCANA' ? 'item' : 'baris'}</span></p>
                <p className="angka text-xs text-muted">{rupiah(d.ringkasan![k.k].nilai)}</p>
              </Kartu>
            ))}
          </div>
        )}

        {diLuar.length > 0 && (
          <Spanduk nada="bahaya" judul={`${diLuar.length} belanja SIPLah tidak ada di RKAS`}>
            {diLuar.map((i) => `${i.uraian} (${rupiah(i.jumlah)}, ${i.kodeRekening})`).join('; ')}. Pertimbangkan pergeseran RKAS atau minta klarifikasi sekolah.
          </Spanduk>
        )}

        {d && d.baris.length > 0 && (
          <Kartu>
            <div className="border-b border-line px-4 py-3"><h2 className="font-display text-base font-bold">Per baris RKAS</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="bg-canvas text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-2">Baris RKAS</th><th className="px-3 text-right">Rencana</th><th className="px-3 text-right">Belanja SIPLah</th><th className="px-3 text-right">Selisih</th><th className="px-3">Kategori</th></tr></thead>
                <tbody>
                  {d.baris.map((b) => {
                    const item = d.item.filter((i) => i.barisId === b.barisId);
                    return (
                      <Fragment key={b.barisId}>
                        <tr className="border-t border-line align-top" data-testid="hpp-baris">
                          <td className="px-4 py-2.5">
                            <p className="font-medium">{b.uraian}</p><p className="text-xs text-muted">{b.kegiatan} · {b.kodeRekening}</p>
                            {item.length > 0 && <button className="mt-1 text-xs text-primary hover:underline" aria-expanded={buka === b.barisId} onClick={() => setBuka(buka === b.barisId ? null : b.barisId)}>{buka === b.barisId ? 'Sembunyikan' : `${item.length} belanja`}</button>}
                          </td>
                          <td className="angka px-3 py-2.5 text-right">{rupiah(b.rencana)}</td>
                          <td className="angka px-3 py-2.5 text-right">{rupiah(b.belanja)}</td>
                          <td className={cx('angka px-3 py-2.5 text-right', b.selisih < 0 && 'text-warning')}>{rupiah(b.selisih)}</td>
                          <td className="px-3 py-2.5"><LencanaHpp kategori={b.kategori} /></td>
                        </tr>
                        {buka === b.barisId && item.map((i) => (
                          <tr key={`${i.transactionId}-${i.uraian}`} className="bg-canvas/50 text-xs">
                            <td className="py-1.5 pl-8 pr-3" colSpan={2}>{i.uraian}<span className="block text-muted">{tanggal(i.tanggal)} · {i.mitraKode} · {i.transactionId} · {CARA[i.cara]}</span></td>
                            <td className="angka px-3 py-1.5 text-right">{rupiah(i.jumlah)}</td><td colSpan={2} />
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Kartu>
        )}
      </main>
    </>
  );
}
