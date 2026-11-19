'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { MeDto } from '@arkas/kontrak';
import { Kepala } from '@/components/kepala';
import { Laci } from '@/components/laci';
import { LencanaBantuan } from '@/components/status-bantuan';
import { Bidang, Kartu, Masukan, Spanduk, Tombol } from '@/components/ui';
import { api, GalatApi } from '@/lib/api';
import { rupiah } from '@/lib/format';

type Sd = { kode: string; nama: string; direktoratKode: string; tahun: number; jenjang: string[]; status: string; jumlahPenerima: number; totalNilai: number; totalDisalurkan: number };

export function HalamanDaftarBantuan({ me }: { me: MeDto & { peranAktif: NonNullable<MeDto['peranAktif']> } }) {
  const direktorat = me.peranAktif.peran === 'ADMIN_DIREKTORAT';
  const [laci, setLaci] = useState(false);
  const q = useQuery({ queryKey: ['bantuan'], queryFn: async () => (await api<{ data: Sd[] }>('/sumber-dana')).data.data });
  const tugas: Record<string, (s: Sd) => boolean> = {
    SUPER_ADMIN: (s) => s.status === 'DIAJUKAN', ADMIN_DIREKTORAT: (s) => s.status === 'DRAF' || s.status === 'DIKEMBALIKAN',
  };
  const perlu = (q.data ?? []).filter(tugas[me.peranAktif.peran] ?? (() => false));
  return (
    <>
      <Kepala judul="Bantuan Pemerintah" me={me} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        {perlu.length > 0 && (
          <Spanduk nada="peringatan" judul={me.peranAktif.peran === 'SUPER_ADMIN' ? `${perlu.length} sumber dana menunggu verifikasi Bapak/Ibu` : `${perlu.length} sumber dana perlu dilengkapi`}>
            {perlu.map((s) => s.nama).join(', ')}
          </Spanduk>
        )}
        <Kartu>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="font-display text-base font-bold">Sumber dana Bantuan Pemerintah</h2>
              <p className="text-sm text-muted">Direktorat menyusun dan mengajukan; Ditjen menyetujui juknis; Balai SDSP memverifikasi dan mengesahkan.</p>
            </div>
            {direktorat && <Tombol onClick={() => setLaci(true)}>+ Sumber dana baru</Tombol>}
          </div>
          {q.data && !q.data.length && <p className="p-8 text-center text-sm text-muted">Belum ada sumber dana bantuan.</p>}
          {!!q.data?.length && (
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-2">Sumber dana</th><th className="px-3">Direktorat</th><th className="px-3 text-right">Penerima</th><th className="px-3 text-right">Nilai</th><th className="px-3 text-right">Disalurkan</th><th className="px-3">Status</th></tr></thead>
              <tbody>
                {q.data.map((s) => (
                  <tr key={s.kode} className="border-t border-line hover:bg-canvas/60">
                    <td className="px-4 py-2.5"><Link href={`/bantuan/${s.kode}`} className="font-medium text-primary hover:underline">{s.nama}</Link><span className="block text-xs text-muted">{s.kode} · {s.tahun} · {s.jenjang.join(', ')}</span></td>
                    <td className="px-3">{s.direktoratKode}</td>
                    <td className="angka px-3 text-right">{s.jumlahPenerima}</td>
                    <td className="angka px-3 text-right">{rupiah(s.totalNilai)}</td>
                    <td className="angka px-3 text-right">{rupiah(s.totalDisalurkan)}</td>
                    <td className="px-3"><LencanaBantuan status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Kartu>
      </main>
      {direktorat && <FormBaru terbuka={laci} onTutup={() => setLaci(false)} direktorat={me.peranAktif.direktoratKode ?? ''} />}
    </>
  );
}

function FormBaru({ terbuka, onTutup, direktorat }: { terbuka: boolean; onTutup: () => void; direktorat: string }) {
  const router = useRouter();
  const tahun = new Date().getFullYear();
  const [f, setF] = useState({ kode: '', nama: '', tahun: String(tahun), jenjang: direktorat, pengajuanMulai: '', pengajuanSelesai: '' });
  const buat = useMutation({
    mutationFn: async () => (await api<{ kode: string }>('/sumber-dana', { method: 'POST', json: {
      kode: f.kode.trim().toUpperCase(), nama: f.nama, direktoratKode: direktorat, tahun: Number(f.tahun), jenjang: f.jenjang.split(/[\s,]+/).filter(Boolean).map((j) => j.toUpperCase()),
      pengajuanMulai: f.pengajuanMulai || null, pengajuanSelesai: f.pengajuanSelesai || null,
    } })).data,
    onSuccess: (r) => router.push(`/bantuan/${r.kode}`),
  });
  const g = buat.error instanceof GalatApi ? buat.error : undefined;
  const gk = (k: string) => g?.problem.galat?.find((x) => x.path.startsWith(k))?.pesan;
  return (
    <Laci terbuka={terbuka} onTutup={onTutup} judul="Sumber dana bantuan baru" lebar="max-w-lg"
      kaki={<div className="flex justify-end gap-2"><Tombol varian="hantu" onClick={onTutup}>Batal</Tombol><Tombol memuat={buat.isPending} onClick={() => buat.mutate()}>Buat draf</Tombol></div>}>
      <div className="space-y-4">
        {g && <Spanduk nada="bahaya" judul={g.problem.detail ?? g.problem.title} />}
        <Bidang label="Kode" bantuan="Huruf kapital, angka, garis bawah; mis. BANPER_TIK_SMP" galat={gk('kode')}><Masukan value={f.kode} onChange={(e) => setF({ ...f, kode: e.target.value.toUpperCase() })} /></Bidang>
        <Bidang label="Nama bantuan" galat={gk('nama')}><Masukan value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} placeholder="Bantuan Peralatan TIK SMP" /></Bidang>
        <div className="grid grid-cols-2 gap-3">
          <Bidang label="Tahun anggaran" galat={gk('tahun')}><Masukan type="number" value={f.tahun} onChange={(e) => setF({ ...f, tahun: e.target.value })} /></Bidang>
          <Bidang label="Jenjang sasaran" bantuan="Pisahkan dengan koma" galat={gk('jenjang')}><Masukan value={f.jenjang} onChange={(e) => setF({ ...f, jenjang: e.target.value })} /></Bidang>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Bidang label="Masa pengajuan sekolah mulai"><Masukan type="date" value={f.pengajuanMulai} onChange={(e) => setF({ ...f, pengajuanMulai: e.target.value })} /></Bidang>
          <Bidang label="Selesai" galat={gk('pengajuanSelesai')}><Masukan type="date" value={f.pengajuanSelesai} onChange={(e) => setF({ ...f, pengajuanSelesai: e.target.value })} /></Bidang>
        </div>
        <p className="text-sm text-muted">Direktorat: <b>{direktorat}</b>. Setelah draf dibuat, unggah juknis dan panduan, isi komponen dan penerima, lalu ajukan ke Balai SDSP.</p>
      </div>
    </Laci>
  );
}
