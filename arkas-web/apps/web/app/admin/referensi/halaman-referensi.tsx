'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeDto } from '@arkas/kontrak';
import { Kepala } from '@/components/kepala';
import { Laci } from '@/components/laci';
import { Bidang, Kartu, Masukan, Pilihan, Spanduk, Tombol, cx } from '@/components/ui';
import { api, GalatApi } from '@/lib/api';

type Baris = Record<string, unknown>;
type Opsi = { nilai: string; label: string };
/** Jenis kolom formulir: teks biasa, persen (komponen, disimpan apa adanya), tarif (persen di layar, pecahan di API), pilihan. */
type Kolom = {
  k: string; label: string; jenis: 'teks' | 'persen' | 'tarif' | 'pilihan';
  kunci?: boolean; opsional?: boolean; bantuan?: string; placeholder?: string; pola?: [RegExp, string];
  opsi?: Opsi[] | { dari: string; nilai: string; label: (b: Baris) => string; kosong?: string };
};
type Tab = { slug: string; nama: string; tunggal: string; tampil: string[]; kolom: Kolom[] };

const STATUS_SEKOLAH: Opsi[] = [{ nilai: 'NEGERI', label: 'Negeri' }, { nilai: 'SWASTA', label: 'Swasta' }];
const JENIS_PAJAK: Opsi[] = ['PPN', 'PPH21', 'PPH23', 'SSPD'].map((j) => ({ nilai: j, label: j === 'SSPD' ? 'SSPD (pajak daerah)' : j.replace('PPH', 'PPh ') }));
const KATEGORI: Opsi[] = [{ nilai: 'BOSP', label: 'BOSP' }, { nilai: 'BANPER', label: 'Bantuan pemerintah' }];

const TAB: Tab[] = [
  { slug: 'komponen', nama: 'Komponen BOSP', tunggal: 'komponen', tampil: ['sumberDanaKode', 'kode', 'nama', 'maksPersen', 'minPersen'], kolom: [
    { k: 'sumberDanaKode', label: 'Sumber dana', jenis: 'pilihan', kunci: true, opsi: { dari: 'sumber-dana', nilai: 'kode', label: (b) => `${b.kode} · ${b.nama}` } },
    { k: 'kode', label: 'Kode komponen', jenis: 'teks', kunci: true, placeholder: '13', bantuan: '2 digit, misalnya 13', pola: [/^\d{2}$/, 'Kode komponen harus 2 digit'] },
    { k: 'nama', label: 'Nama komponen', jenis: 'teks' },
    { k: 'maksPersen', label: 'Batas maksimal (% dari pagu)', jenis: 'persen', opsional: true, bantuan: 'Kosongkan bila tanpa batas' },
    { k: 'minPersen', label: 'Batas minimal (% dari pagu)', jenis: 'persen', opsional: true, bantuan: 'Kosongkan bila tanpa batas' },
  ] },
  { slug: 'tarif-pajak', nama: 'Tarif pajak', tunggal: 'tarif pajak', tampil: ['kodeRekening', 'jenis', 'wilayahKode', 'tarif', 'tarifTanpaNpwp', 'dasarHukum'], kolom: [
    { k: 'kodeRekening', label: 'Kode rekening', jenis: 'pilihan', kunci: true, opsi: { dari: 'kode-rekening', nilai: 'kode', label: (b) => `${b.kode} · ${b.nama}` } },
    { k: 'jenis', label: 'Jenis pajak', jenis: 'pilihan', kunci: true, opsi: JENIS_PAJAK },
    { k: 'wilayahKode', label: 'Wilayah', jenis: 'pilihan', kunci: true, opsional: true, bantuan: 'Tarif nasional dari Balai selalu berlaku untuk semua wilayah; tarif daerah diatur Dinas',
      opsi: [{ nilai: '', label: 'Nasional (semua wilayah)' }] },
    { k: 'tarif', label: 'Tarif (%)', jenis: 'tarif', placeholder: '11' },
    { k: 'tarifTanpaNpwp', label: 'Tarif bila penyedia tanpa NPWP (%)', jenis: 'tarif', opsional: true, bantuan: 'Khusus PPh; kosongkan bila sama' },
    { k: 'dasarHukum', label: 'Dasar hukum', jenis: 'teks', opsional: true, placeholder: 'mis. PMK No. ... Tahun ...' },
  ] },
  { slug: 'kode-rekening', nama: 'Kode rekening', tunggal: 'kode rekening', tampil: ['kode', 'nama'], kolom: [
    { k: 'kode', label: 'Kode rekening', jenis: 'teks', kunci: true, placeholder: '5.1.02.01.01.0029', bantuan: 'Format angka bertitik, misalnya 5.1.02.01.01.0029', pola: [/^\d(\.\d{1,4}){3,6}$/, 'Kode rekening harus angka bertitik, misalnya 5.1.02.01.01.0029'] },
    { k: 'nama', label: 'Nama rekening', jenis: 'teks' },
  ] },
  { slug: 'sekolah', nama: 'Satuan pendidikan', tunggal: 'satuan pendidikan', tampil: ['npsn', 'nama', 'jenjangKode', 'wilayahKode', 'statusSekolah'], kolom: [
    { k: 'npsn', label: 'NPSN', jenis: 'teks', kunci: true, placeholder: '20100003', bantuan: '8 digit', pola: [/^\d{8}$/, 'NPSN harus 8 digit angka'] },
    { k: 'nama', label: 'Nama sekolah', jenis: 'teks' },
    { k: 'jenjangKode', label: 'Jenjang', jenis: 'pilihan', opsi: { dari: 'jenjang', nilai: 'kode', label: (b) => `${b.kode} · ${b.nama}` } },
    { k: 'wilayahKode', label: 'Wilayah (kabupaten/kota)', jenis: 'pilihan', opsi: { dari: 'wilayah', nilai: 'kode', label: (b) => `${b.kode} · ${b.nama}` } },
    { k: 'statusSekolah', label: 'Status', jenis: 'pilihan', opsi: STATUS_SEKOLAH },
  ] },
  { slug: 'wilayah', nama: 'Wilayah', tunggal: 'wilayah', tampil: ['kode', 'nama', 'indukKode'], kolom: [
    { k: 'kode', label: 'Kode wilayah', jenis: 'teks', kunci: true, placeholder: '3203', bantuan: 'Provinsi 2 digit, kabupaten/kota 4 digit', pola: [/^\d{2}(\d{2}){0,2}$/, 'Kode wilayah harus 2, 4, atau 6 digit'] },
    { k: 'nama', label: 'Nama wilayah', jenis: 'teks' },
    { k: 'indukKode', label: 'Induk', jenis: 'pilihan', opsional: true, opsi: { dari: 'wilayah', nilai: 'kode', label: (b) => `${b.kode} · ${b.nama}`, kosong: '(tidak ada, provinsi)' } },
  ] },
  { slug: 'jenjang', nama: 'Jenjang', tunggal: 'jenjang', tampil: ['kode', 'nama'], kolom: [
    { k: 'kode', label: 'Kode jenjang', jenis: 'teks', kunci: true, placeholder: 'SLB', bantuan: '2–6 huruf kapital', pola: [/^[A-Z]{2,6}$/, 'Kode jenjang harus 2–6 huruf kapital'] },
    { k: 'nama', label: 'Nama jenjang', jenis: 'teks' },
  ] },
  { slug: 'direktorat', nama: 'Direktorat', tunggal: 'direktorat', tampil: ['kode', 'nama', 'ditjenKode'], kolom: [
    { k: 'kode', label: 'Kode direktorat', jenis: 'teks', kunci: true, placeholder: 'SMA', pola: [/^[A-Z0-9_]{2,20}$/, 'Kode direktorat: huruf kapital/angka/garis bawah'] },
    { k: 'nama', label: 'Nama direktorat', jenis: 'teks' },
    { k: 'ditjenKode', label: 'Kode ditjen', jenis: 'teks', placeholder: 'PAUDDIKDASMEN', pola: [/^[A-Z0-9_]{2,20}$/, 'Kode ditjen: huruf kapital/angka/garis bawah'] },
    { k: 'ditjenNama', label: 'Nama ditjen', jenis: 'teks' },
  ] },
  { slug: 'sumber-dana', nama: 'Sumber dana', tunggal: 'sumber dana', tampil: ['kode', 'nama', 'kategori'], kolom: [
    { k: 'kode', label: 'Kode sumber dana', jenis: 'teks', kunci: true, placeholder: 'BOSP_KIN', pola: [/^[A-Z0-9_]{2,20}$/, 'Kode sumber dana: huruf kapital/angka/garis bawah'] },
    { k: 'nama', label: 'Nama sumber dana', jenis: 'teks' },
    { k: 'kategori', label: 'Kategori', jenis: 'pilihan', opsi: KATEGORI },
    { k: 'direktoratKode', label: 'Direktorat pengampu', jenis: 'pilihan', opsional: true, opsi: { dari: 'direktorat', nilai: 'kode', label: (b) => `${b.kode} · ${b.nama}`, kosong: '(tidak ada)' } },
  ] },
];

const LABEL: Record<string, string> = {
  sumberDanaKode: 'Sumber dana', kode: 'Kode', nama: 'Nama', maksPersen: 'Maks', minPersen: 'Min', kodeRekening: 'Kode rekening',
  jenis: 'Jenis', wilayahKode: 'Wilayah', tarif: 'Tarif', tarifTanpaNpwp: 'Tanpa NPWP', dasarHukum: 'Dasar hukum', npsn: 'NPSN',
  jenjangKode: 'Jenjang', statusSekolah: 'Status', indukKode: 'Induk', ditjenKode: 'Ditjen', kategori: 'Kategori',
};
const angka = (s: string) => Number(s.replace(',', '.'));

/** Isi formulir (string) dari baris API, dan sebaliknya. */
function keFormulir(tab: Tab, b: Baris | null): Record<string, string> {
  const f: Record<string, string> = {};
  for (const c of tab.kolom) {
    const v = b?.[c.k];
    f[c.k] = v == null ? '' : c.jenis === 'tarif' ? String(Math.round(Number(v) * 10000) / 100) : String(v);
  }
  return f;
}
function keApi(tab: Tab, f: Record<string, string>, aktif: boolean): Baris {
  const isi: Baris = { aktif };
  for (const c of tab.kolom) {
    const v = (f[c.k] ?? '').trim();
    if (c.jenis === 'persen') isi[c.k] = v === '' ? null : angka(v);
    else if (c.jenis === 'tarif') isi[c.k] = v === '' ? null : Math.round(angka(v) * 100) / 10000;
    else isi[c.k] = v === '' ? (c.k === 'wilayahKode' && tab.slug === 'tarif-pajak' ? '' : c.opsional ? null : '') : v;
  }
  return isi;
}
function galatFormulir(tab: Tab, f: Record<string, string>): string | null {
  for (const c of tab.kolom) {
    const v = (f[c.k] ?? '').trim();
    if (!c.opsional && v === '') return `${c.label} wajib diisi`;
    if ((c.jenis === 'persen' || c.jenis === 'tarif') && v !== '' && !(angka(v) >= 0 && angka(v) <= 100)) return `${c.label} harus angka 0–100`;
    if (c.pola && v !== '' && !c.pola[0].test(v)) return c.pola[1];
  }
  return null;
}

/** UC-19 — referensi nasional (Balai SDSP). Setiap perubahan menerbitkan ReferensiDiubah ke semua layanan. */
export function HalamanReferensi({ me }: { me: MeDto }) {
  const [tab, setTab] = useState<Tab>(TAB[0]);
  const [laci, setLaci] = useState<{ asal: Baris | null } | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [aktif, setAktif] = useState(true);
  const [hasil, setHasil] = useState<{ nada: 'sukses' | 'info'; teks: string } | null>(null);
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['referensi', tab.slug], queryFn: async () => (await api<{ data: Baris[] }>(`/referensi/${tab.slug}`)).data.data });
  const sumberOpsi = useMemo(() => [...new Set(tab.kolom.flatMap((c) => (c.opsi && !Array.isArray(c.opsi) ? [c.opsi.dari] : [])))], [tab]);
  const opsiData = useQuery({
    queryKey: ['referensi-opsi', sumberOpsi.join(',')], enabled: !!laci && sumberOpsi.length > 0,
    queryFn: async () => Object.fromEntries(await Promise.all(sumberOpsi.map(async (s) => [s, (await api<{ data: Baris[] }>(`/referensi/${s}?aktif=true`)).data.data] as const))),
  });
  const terbit = useMutation({ mutationFn: async () => (await api<{ jumlah: number }>('/admin/referensi/terbit-ulang', { method: 'POST' })).data });
  const simpan = useMutation({
    mutationFn: async () => api<Baris>(`/admin/referensi/${tab.slug}`, { method: 'PUT', json: keApi(tab, f, aktif) }),
    onSuccess: (r) => {
      setHasil(r.status === 201
        ? { nada: 'sukses', teks: `${tab.nama} tersimpan (versi ${String(r.data.versi)}) dan sedang dikirim ke semua layanan.` }
        : { nada: 'info', teks: 'Tidak ada perubahan; isian sama dengan data yang tersimpan.' });
      setLaci(null);
      void qc.invalidateQueries({ queryKey: ['referensi'] });
      void qc.invalidateQueries({ queryKey: ['referensi-opsi'] });
    },
  });
  const buka = (asal: Baris | null) => { simpan.reset(); setHasil(null); setF(keFormulir(tab, asal)); setAktif(asal ? asal.aktif !== false : true); setLaci({ asal }); };
  const opsiUntuk = (c: Kolom): Opsi[] => {
    if (!c.opsi) return [];
    if (Array.isArray(c.opsi)) return c.opsi;
    const o = c.opsi;
    const daftar = (opsiData.data?.[o.dari] ?? []).filter((b) => !(tab.slug === 'wilayah' && c.k === 'indukKode' && String(b.kode).length !== 2));
    const hasil = daftar.map((b) => ({ nilai: String(b[o.nilai]), label: o.label(b) }));
    const sekarang = f[c.k];
    if (sekarang && !hasil.some((x) => x.nilai === sekarang)) hasil.unshift({ nilai: sekarang, label: `${sekarang} (nonaktif/tidak ditemukan)` });
    return o.kosong !== undefined || c.opsional ? [{ nilai: '', label: o.kosong ?? '(kosong)' }, ...hasil] : [{ nilai: '', label: 'Pilih…' }, ...hasil];
  };
  const salahIsi = laci ? galatFormulir(tab, f) : null;
  const galat = [data.error, terbit.error].find((e) => e instanceof GalatApi) as GalatApi | undefined;
  const format = (k: string, v: unknown) => (v == null || v === '' ? (k === 'wilayahKode' ? 'Nasional' : '—') : k.startsWith('tarif') ? `${(Number(v) * 100).toLocaleString('id-ID')}%` : k.endsWith('Persen') ? `${v}%` : String(v));

  return (
    <div className="min-h-screen">
      <Kepala judul="Referensi nasional" me={me} />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1" role="tablist">
            {TAB.map((t) => (
              <button key={t.slug} role="tab" aria-selected={t === tab} onClick={() => { setTab(t); setHasil(null); }}
                className={cx('rounded-ctl px-3 py-1.5 text-sm font-medium', t === tab ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-canvas')}>{t.nama}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Tombol varian="sekunder" memuat={terbit.isPending} onClick={() => window.confirm('Terbitkan ulang seluruh referensi ke semua layanan?') && terbit.mutate()}>Terbitkan ulang ke semua layanan</Tombol>
            <Tombol onClick={() => buka(null)}>+ Tambah {tab.tunggal}</Tombol>
          </div>
        </div>
        {terbit.data && <Spanduk nada="sukses" judul={`${terbit.data.jumlah} baris referensi diantrekan untuk dikirim ke layanan lain`} />}
        {hasil && <Spanduk nada={hasil.nada} judul={hasil.teks} />}
        {galat && <Spanduk nada="bahaya" judul={galat.problem.detail ?? galat.problem.title}>Kode: {galat.problem.kode}</Spanduk>}
        <Kartu className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
              <tr>{tab.tampil.map((k) => <th key={k} className="px-4 py-2.5 font-semibold">{LABEL[k] ?? k}</th>)}<th className="px-4 py-2.5 font-semibold">Versi</th><th className="px-4 py-2.5 font-semibold">Aktif</th><th /></tr>
            </thead>
            <tbody>
              {(data.data ?? []).map((r, i) => (
                <tr key={i} className={cx('border-t border-line', !r.aktif && 'text-muted')}>
                  {tab.tampil.map((k) => <td key={k} className={cx('px-4 py-2', /kode|npsn|tarif|Persen/i.test(k) && 'angka')}>{format(k, r[k])}</td>)}
                  <td className="angka px-4 py-2 text-muted">{String(r.versi)}</td>
                  <td className="px-4 py-2">{r.aktif ? 'Aktif' : <span className="rounded-full bg-canvas px-2 py-0.5 text-xs">Nonaktif</span>}</td>
                  <td className="px-4 py-2 text-right"><button className="text-xs font-medium text-primary hover:underline" onClick={() => buka(r)}>Ubah</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Kartu>
      </main>

      <Laci terbuka={!!laci} onTutup={() => setLaci(null)} lebar="max-w-lg"
        judul={laci?.asal ? `Ubah ${tab.tunggal}` : `Tambah ${tab.tunggal}`}
        kaki={<div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted">{salahIsi ?? 'Perubahan langsung dikirim ke semua layanan.'}</span>
          <div className="flex gap-2"><Tombol varian="sekunder" onClick={() => setLaci(null)}>Batal</Tombol>
            <Tombol memuat={simpan.isPending} disabled={!!salahIsi} onClick={() => simpan.mutate()}>Simpan</Tombol></div>
        </div>}>
        {laci && (
          <div className="space-y-4">
            {tab.kolom.map((c) => {
              const terkunci = !!laci.asal && !!c.kunci;
              const label = `${c.label}${c.opsional ? ' (opsional)' : ''}`;
              const bantuan = terkunci ? 'Kunci referensi; tidak dapat diubah. Buat baris baru bila perlu kode lain.' : c.bantuan;
              return (
                <Bidang key={c.k} label={label} bantuan={bantuan}>
                  {c.jenis === 'pilihan'
                    ? <Pilihan value={f[c.k] ?? ''} disabled={terkunci} onChange={(e) => setF({ ...f, [c.k]: e.target.value })}>
                        {opsiUntuk(c).map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
                      </Pilihan>
                    : <Masukan value={f[c.k] ?? ''} disabled={terkunci} placeholder={c.placeholder} inputMode={c.jenis === 'teks' ? undefined : 'decimal'}
                        className={cx(c.jenis !== 'teks' && 'angka')} onChange={(e) => setF({ ...f, [c.k]: e.target.value })} />}
                </Bidang>
              );
            })}
            <label className="flex items-start gap-2 rounded-card border border-line p-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
              <span><b>Aktif</b> (bisa dipakai)<span className="block text-xs text-muted">Hapus centang untuk menonaktifkan. Referensi tidak pernah dihapus; data lama tetap terbaca, tapi tidak bisa dipakai untuk transaksi baru.</span></span>
            </label>
            {simpan.error instanceof GalatApi && (
              <Spanduk nada="bahaya" judul={simpan.error.problem.detail ?? simpan.error.problem.title}>
                {(simpan.error.problem as { galat?: Array<{ path: string }> }).galat?.map((g) => (
                  <span key={g.path} className="block">{tab.kolom.find((c) => c.k === g.path)?.label ?? g.path}: isian tidak sesuai format</span>
                ))}
                <span className="block text-xs text-muted">Kode: {simpan.error.problem.kode}</span>
              </Spanduk>
            )}
          </div>
        )}
      </Laci>
    </div>
  );
}
