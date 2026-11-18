'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeDto, PenggunaDto } from '@arkas/kontrak';
import { Kepala } from '@/components/kepala';
import { Laci } from '@/components/laci';
import { Bidang, Kartu, Masukan, Pilihan, Spanduk, Tombol } from '@/components/ui';
import { api, GalatApi } from '@/lib/api';
import { cakupanTeks, LABEL_PERAN } from '@/lib/peran';

/** Matriks berjenjang (sama dengan aturan MATRIKS_PEMBERIAN di packages/aturan; server tetap memvalidasi). */
const BOLEH: Record<string, string[]> = {
  SUPER_ADMIN: ['ADMIN_DINAS', 'ADMIN_DITJEN', 'PEMANTAU', 'AUDITOR', 'SUPER_ADMIN'],
  ADMIN_DITJEN: ['ADMIN_DIREKTORAT'],
  ADMIN_DIREKTORAT: ['TIM_KERJA'],
  ADMIN_DINAS: ['VERIFIKATOR_DINAS', 'OPERATOR', 'ADMIN_DINAS'],
  OPERATOR: ['BENDAHARA', 'KEPSEK', 'KOMITE'],
};
const JENIS: Record<string, 'npsn' | 'wilayahKode' | 'direktoratKode' | 'ditjenKode' | null> = {
  OPERATOR: 'npsn', BENDAHARA: 'npsn', KEPSEK: 'npsn', KOMITE: 'npsn', VERIFIKATOR_DINAS: 'wilayahKode', ADMIN_DINAS: 'wilayahKode',
  ADMIN_DIREKTORAT: 'direktoratKode', TIM_KERJA: 'direktoratKode', ADMIN_DITJEN: 'ditjenKode', SUPER_ADMIN: null, PEMANTAU: null, AUDITOR: null,
};
const LABEL_CAKUPAN = { npsn: 'NPSN sekolah', wilayahKode: 'Kode wilayah', direktoratKode: 'Kode direktorat', ditjenKode: 'Kode ditjen' };

/** UC-20 — kelola pengguna & peran sesuai cakupan peran aktif (SK-12 berjenjang). */
export function HalamanPengguna({ me }: { me: MeDto }) {
  const aktif = me.peranAktif!;
  const qc = useQueryClient();
  const daftar = useQuery({ queryKey: ['pengguna'], queryFn: async () => (await api<{ data: PenggunaDto[] }>('/admin/pengguna')).data.data });
  const pilihan = BOLEH[aktif.peran] ?? [];
  const awal = { email: '', nama: '', peran: pilihan[0] ?? '', cakupan: aktif.npsn ?? aktif.wilayahKode ?? aktif.direktoratKode ?? '', berlakuSampai: '' };
  const [f, setF] = useState(awal);
  const [laci, setLaci] = useState(false);
  const simpan = useMutation({
    mutationFn: async () => {
      const jenis = JENIS[f.peran];
      return (await api<PenggunaDto>('/admin/pengguna', { method: 'POST', json: {
        email: f.email, nama: f.nama,
        peran: { peran: f.peran, ...(jenis ? { [jenis]: f.cakupan.trim() } : {}), ...(f.berlakuSampai ? { berlakuSampai: new Date(`${f.berlakuSampai}T23:59:59+07:00`).toISOString() } : {}) },
      } })).data;
    },
    onSuccess: () => { setLaci(false); setF(awal); void qc.invalidateQueries({ queryKey: ['pengguna'] }); },
  });
  const cabut = useMutation({
    mutationFn: async ({ p, r }: { p: PenggunaDto; r: string }) => {
      const alasan = window.prompt('Alasan pencabutan peran (wajib):')?.trim();
      if (!alasan || alasan.length < 3) return null;
      return (await api<PenggunaDto>(`/admin/pengguna/${p.id}/peran/${r}`, { method: 'DELETE', json: { alasan } })).data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['pengguna'] }),
  });
  const galat = [cabut.error, daftar.error].find((e) => e instanceof GalatApi) as GalatApi | undefined;
  const jenis = JENIS[f.peran];

  return (
    <div className="min-h-screen">
      <Kepala judul="Kelola pengguna" me={me} npsn={aktif.npsn ?? undefined} />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Sebagai <b>{LABEL_PERAN[aktif.peran]}</b> ({cakupanTeks(aktif)}) Anda dapat memberi peran: {pilihan.map((p) => LABEL_PERAN[p]).join(', ')}.</p>
          <Tombol onClick={() => { simpan.reset(); setLaci(true); }}>+ Tambah pengguna</Tombol>
        </div>
        {galat && <Spanduk nada="bahaya" judul={galat.problem.detail ?? galat.problem.title}>Kode: {galat.problem.kode}</Spanduk>}
        <Kartu className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-2.5 font-semibold">Nama</th><th className="px-4 py-2.5 font-semibold">Email</th><th className="px-4 py-2.5 font-semibold">Peran dalam cakupan Anda</th></tr>
            </thead>
            <tbody>
              {(daftar.data ?? []).map((p) => (
                <tr key={p.id} className="border-t border-line align-top">
                  <td className="px-4 py-2.5 font-medium">{p.nama}</td>
                  <td className="px-4 py-2.5 text-muted">{p.email}</td>
                  <td className="px-4 py-2.5">
                    <ul className="space-y-1">
                      {p.peran.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center gap-2">
                          <span className={r.berlaku ? '' : 'text-muted line-through'}>{LABEL_PERAN[r.peran]} · {cakupanTeks(r)}</span>
                          {r.berlaku && pilihan.includes(r.peran) && <button className="text-xs text-danger hover:underline" onClick={() => cabut.mutate({ p, r: r.id })}>Cabut</button>}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Kartu>
      </main>
      <Laci terbuka={laci} onTutup={() => setLaci(false)} judul="Tambah pengguna" lebar="max-w-md"
        kaki={<div className="flex justify-end gap-2"><Tombol varian="sekunder" onClick={() => setLaci(false)}>Batal</Tombol>
          <Tombol memuat={simpan.isPending} disabled={!f.email || f.nama.trim().length < 3 || (jenis !== null && !f.cakupan.trim())} onClick={() => simpan.mutate()}>Simpan</Tombol></div>}>
        <div className="space-y-4">
          <Bidang label="Email (akun SSO)"><Masukan type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Bidang>
          <Bidang label="Nama lengkap"><Masukan value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} /></Bidang>
          <Bidang label="Peran">
            <Pilihan value={f.peran} onChange={(e) => setF({ ...f, peran: e.target.value })}>{pilihan.map((p) => <option key={p} value={p}>{LABEL_PERAN[p]}</option>)}</Pilihan>
          </Bidang>
          {jenis && <Bidang label={LABEL_CAKUPAN[jenis]}><Masukan className="angka" value={f.cakupan} onChange={(e) => setF({ ...f, cakupan: e.target.value })} /></Bidang>}
          {f.peran === 'AUDITOR' && <Bidang label="Berlaku sampai (sesuai surat tugas)"><Masukan type="date" value={f.berlakuSampai} onChange={(e) => setF({ ...f, berlakuSampai: e.target.value })} /></Bidang>}
          <p className="text-xs text-muted">Bila email sudah terdaftar dalam cakupan Anda, peran ditambahkan ke akun tersebut. Pengguna masuk memakai SSO dengan email ini.</p>
          {simpan.error instanceof GalatApi && <Spanduk nada="bahaya" judul={simpan.error.problem.detail ?? simpan.error.problem.title} />}
        </div>
      </Laci>
    </div>
  );
}
