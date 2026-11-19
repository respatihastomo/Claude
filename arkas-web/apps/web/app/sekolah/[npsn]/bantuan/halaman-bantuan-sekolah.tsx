'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeDto } from '@arkas/kontrak';
import { Kepala } from '@/components/kepala';
import { LencanaBantuan } from '@/components/status-bantuan';
import { Kartu, Masukan, Spanduk, Tombol, cx } from '@/components/ui';
import { api, GalatApi } from '@/lib/api';
import { rupiah, tanggal } from '@/lib/format';
import { unggahBerkas } from '@/lib/unggah';

type Pengajuan = { id: string; status: string; nilaiRab: number | null; dokumen: Record<string, { namaBerkas: string }> | null; catatan: string | null; riwayat: Array<{ status: string; oleh: string; catatan?: string; at: string }> };
type Bantuan = { kode: string; nama: string; tahun: number; nilai: number; disalurkan: number; pengajuanMulai: string | null; pengajuanSelesai: string | null; dalamMasa: boolean; pengajuan: Pengajuan | null; komponen: Array<{ kode: string; nama: string }> | null };
const DOK = [
  { j: 'PKS', l: 'Perjanjian Kerja Sama (PKS)', ket: 'ditandatangani Kepala Sekolah & direktorat' },
  { j: 'RAB', l: 'Rencana Anggaran Biaya (RAB)', ket: 'total tidak boleh melebihi nilai bantuan' },
  { j: 'SPTJM', l: 'Surat Pernyataan Tanggung Jawab Mutlak', ket: 'pernyataan Kepala Sekolah' },
] as const;

export function HalamanBantuanSekolah({ me, npsn }: { me: MeDto & { peranAktif: NonNullable<MeDto['peranAktif']> }; npsn: string }) {
  const q = useQuery({ queryKey: ['bantuan-sekolah', npsn], queryFn: async () => (await api<{ data: Bantuan[] }>(`/sekolah/${npsn}/pengajuan-bantuan`)).data.data });
  return (
    <>
      <Kepala judul="Bantuan Pemerintah" me={me} npsn={npsn} />
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <p className="text-sm text-muted">Bantuan di sini muncul setelah disahkan Balai SDSP dan mencantumkan sekolah sebagai penerima. Sekolah mengajukan PKS, RAB, dan SPTJM pada masa pengajuan.</p>
        {q.data && !q.data.length && <Kartu className="p-8 text-center text-sm text-muted">Sekolah belum tercantum sebagai penerima Bantuan Pemerintah.</Kartu>}
        {q.data?.map((b) => <KartuBantuan key={b.kode} b={b} peran={me.peranAktif.peran} npsn={npsn} />)}
      </main>
    </>
  );
}

function KartuBantuan({ b, peran, npsn }: { b: Bantuan; peran: string; npsn: string }) {
  const qc = useQueryClient();
  const [rab, setRab] = useState(b.pengajuan?.nilaiRab ? String(b.pengajuan.nilaiRab) : '');
  const segar = () => qc.invalidateQueries({ queryKey: ['bantuan-sekolah', npsn] });
  const aksi = useMutation({
    mutationFn: async (a: { path: string; json?: unknown; berkas?: File; query?: Record<string, string | number | undefined> }) =>
      a.berkas ? unggahBerkas(a.path, a.berkas, a.query) : (await api(a.path, { method: 'POST', json: a.json ?? {} })).data,
    onSuccess: segar,
  });
  const g = aksi.error instanceof GalatApi ? aksi.error : undefined;
  const p = b.pengajuan;
  const penyusun = peran === 'OPERATOR' || peran === 'KEPSEK';
  const bisaUbah = penyusun && p && (p.status === 'DRAF' || p.status === 'DIKEMBALIKAN');
  const lengkap = DOK.every((d) => p?.dokumen?.[d.j]);
  return (
    <Kartu>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="font-display text-base font-bold">{b.nama}</h2>
          <p className="text-sm text-muted">{b.kode} · {b.tahun} · nilai {rupiah(b.nilai)} · disalurkan {rupiah(b.disalurkan)}</p>
          <p className="text-xs text-muted">Masa pengajuan: {b.pengajuanMulai ? `${tanggal(b.pengajuanMulai)} – ${tanggal(b.pengajuanSelesai!)}` : 'belum ditetapkan'}{b.dalamMasa ? ' (sedang berjalan)' : ''}</p>
        </div>
        {p ? <LencanaBantuan status={p.status} /> : <LencanaBantuan status="DRAF" label="Belum mengajukan" />}
      </div>
      <div className="space-y-3 p-4">
        {g && <Spanduk nada="bahaya" judul={g.problem.detail ?? g.problem.title} />}
        {p?.status === 'DIKEMBALIKAN' && <Spanduk nada="peringatan" judul="Pengajuan dikembalikan untuk diperbaiki">{p.catatan}</Spanduk>}
        {p?.status === 'DITOLAK' && <Spanduk nada="bahaya" judul="Pengajuan ditolak">{p.catatan}</Spanduk>}
        {p?.status === 'DISETUJUI' && <Spanduk nada="sukses" judul="Pengajuan disetujui">Sekolah dapat menyusun kertas kerja bantuan sesuai komponen: {b.komponen?.map((k) => k.nama).join(', ')}.</Spanduk>}
        {!p && (penyusun ? (
          <Tombol disabled={!b.dalamMasa} onClick={() => aksi.mutate({ path: '/pengajuan-bantuan', json: { sumberDanaKode: b.kode } })}>{b.dalamMasa ? 'Mulai pengajuan' : 'Di luar masa pengajuan'}</Tombol>
        ) : <p className="text-sm text-muted">Operator atau Kepala Sekolah dapat memulai pengajuan.</p>)}
        {p && (
          <ul className="divide-y divide-line rounded-ctl border border-line">
            {DOK.map((d) => {
              const ada = p.dokumen?.[d.j];
              return (
                <li key={d.j} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm" data-testid={`dok-${d.j}`}>
                  <div><p className="font-medium"><span className={cx('mr-1.5', ada ? 'text-success' : 'text-muted')} aria-hidden>{ada ? '✓' : '○'}</span>{d.l}</p>
                    <p className="text-xs text-muted">{ada ? <a className="text-primary hover:underline" href={`/api/v1/pengajuan-bantuan/${p.id}/dokumen/${d.j}`}>{ada.namaBerkas}</a> : d.ket}</p></div>
                  {bisaUbah && (
                    <div className="flex items-center gap-2">
                      {d.j === 'RAB' && <Masukan aria-label="Total RAB (Rp)" className="h-9 w-40" placeholder="Total RAB (Rp)" value={rab} onChange={(e) => setRab(e.target.value)} />}
                      <label className="inline-flex h-9 cursor-pointer items-center rounded-ctl border border-line bg-surface px-3 text-sm font-semibold hover:bg-canvas">
                        {ada ? 'Ganti' : 'Unggah PDF'}
                        <input type="file" accept=".pdf,application/pdf" className="sr-only" aria-label={`Unggah ${d.j}`}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) aksi.mutate({ path: `/pengajuan-bantuan/${p.id}/dokumen/${d.j}`, berkas: f, query: d.j === 'RAB' ? { nilaiRab: rab.replace(/\D/g, '') } : {} }); e.target.value = ''; }} />
                      </label>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {bisaUbah && (
          <div className="flex items-center justify-end gap-3">
            {peran !== 'KEPSEK' && <span className="text-xs text-muted">Kepala Sekolah yang menekan Ajukan (SPTJM).</span>}
            {peran === 'KEPSEK' && <Tombol disabled={!lengkap} memuat={aksi.isPending} onClick={() => aksi.mutate({ path: `/pengajuan-bantuan/${p!.id}/ajukan` })}>Ajukan ke direktorat</Tombol>}
          </div>
        )}
        {p && p.riwayat.length > 1 && (
          <details className="text-xs text-muted"><summary className="cursor-pointer">Riwayat keputusan</summary>
            <ul className="mt-1 space-y-0.5">{p.riwayat.map((r, i) => <li key={i}>{new Date(r.at).toLocaleString('id-ID')} · {r.status} · {r.oleh}{r.catatan ? ` · ${r.catatan}` : ''}</li>)}</ul>
          </details>
        )}
      </div>
    </Kartu>
  );
}
