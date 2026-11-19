'use client';
import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeDto } from '@arkas/kontrak';
import { Kepala } from '@/components/kepala';
import { LencanaBantuan } from '@/components/status-bantuan';
import { Kartu, Masukan, Pilihan, Spanduk, Tombol, cx } from '@/components/ui';
import { api, GalatApi } from '@/lib/api';
import { rupiah, tanggal } from '@/lib/format';
import { unggahBerkas } from '@/lib/unggah';

type Dok = { id: string; jenis: 'JUKNIS' | 'PANDUAN'; namaBerkas: string; ukuran: number; status: string; catatan: string | null; diunggahAt: string };
type Detail = {
  kode: string; nama: string; direktoratKode: string; tahun: number; jenjang: string[]; status: string; pengajuanMulai: string | null; pengajuanSelesai: string | null; catatanBalai: string | null;
  kelengkapan: { kurang: string[]; statusJuknis: string | null; statusPanduan: string | null; totalNilai: number; jumlahPenerima: number; jumlahKomponen: number };
  dokumen: Dok[]; komponen: Array<{ kode: string; nama: string; maksPersen: number | null }>;
  penerima: Array<{ npsn: string; nama: string | null; jenjang: string | null; nilai: number; disalurkan: number }>;
  pks: Array<{ id: string; bankKode: string; namaBank: string; nomor: string; tanggal: string }>;
  penyaluran: Array<{ id: string; npsn: string; tahap: number; tanggal: string; nilai: number; bankKode: string; nomorReferensi: string }>;
  impor: Array<{ id: string; namaBerkas: string; status: string; jumlahOk: number; galat: Array<{ baris: number; npsn: string | null; pesan: string }>; dibuatAt: string }>;
};
type Pengajuan = { id: string; npsn: string; namaSekolah: string | null; status: string; nilaiRab: number | null; dokumen: Record<string, { namaBerkas: string }> | null; catatan: string | null };

const LANGKAH = ['Dokumen', 'Komponen & penerima', 'Diajukan ke Balai', 'Disahkan', 'Penyaluran'];

export function HalamanDetailBantuan({ me, kode }: { me: MeDto & { peranAktif: NonNullable<MeDto['peranAktif']> }; kode: string }) {
  const peran = me.peranAktif.peran;
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['bantuan', kode], queryFn: async () => (await api<Detail>(`/sumber-dana/${kode}`)).data,
    refetchInterval: (x) => (x.state.data?.impor.some((i) => i.status === 'MENUNGGU') ? 1500 : false) });
  const d = q.data;
  const segar = () => qc.invalidateQueries({ queryKey: ['bantuan', kode] });
  const aksi = useMutation({
    mutationFn: async (a: { path: string; metode?: 'POST' | 'PUT' | 'DELETE'; json?: unknown; berkas?: File; query?: Record<string, string | number | undefined> }) =>
      a.berkas ? unggahBerkas(a.path, a.berkas, a.query) : (await api(a.path, { method: a.metode ?? 'POST', json: a.metode === 'DELETE' ? undefined : (a.json ?? {}) })).data,
    onSuccess: segar,
  });
  const g = aksi.error instanceof GalatApi ? aksi.error : undefined;
  const bisaUbah = peran === 'ADMIN_DIREKTORAT' && (d?.status === 'DRAF' || d?.status === 'DIKEMBALIKAN');
  const langkah = !d ? 0 : d.status === 'DISAHKAN' ? (d.penyaluran.length ? 4 : 3) : d.status === 'DIAJUKAN' ? 2 : d.kelengkapan.statusJuknis === 'DISETUJUI' && d.kelengkapan.statusPanduan === 'DISAHKAN' ? 1 : 0;

  return (
    <>
      <Kepala judul={d?.nama ?? kode} me={me} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted"><Link href="/bantuan" className="text-primary hover:underline">Bantuan Pemerintah</Link> › {kode} · {d?.tahun} · Direktorat {d?.direktoratKode} · jenjang {d?.jenjang.join(', ')}</p>
          {d && <LencanaBantuan status={d.status} />}
        </div>
        <ol className="grid grid-cols-5 gap-2 text-xs" aria-label="Tahapan">
          {LANGKAH.map((l, i) => (
            <li key={l} className={cx('rounded-ctl border px-2 py-1.5 text-center', i < langkah ? 'border-success/40 bg-success/10 text-success' : i === langkah ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-line text-muted')}>
              {i < langkah ? '✓ ' : `${i + 1}. `}{l}
            </li>
          ))}
        </ol>
        {g && <Spanduk nada="bahaya" judul={g.problem.detail ?? g.problem.title}>{(g.problem.rincian as { kurang?: string[] } | undefined)?.kurang?.join('; ') ?? `Kode: ${g.problem.kode}`}</Spanduk>}
        {d?.status === 'DIKEMBALIKAN' && d.catatanBalai && <Spanduk nada="peringatan" judul="Dikembalikan Balai SDSP">{d.catatanBalai}</Spanduk>}

        {d && (
          <Kartu className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold">Kelengkapan</h2>
                {d.kelengkapan.kurang.length ? (
                  <ul className="mt-1 list-disc pl-5 text-sm text-warning">{d.kelengkapan.kurang.map((k) => <li key={k}>{k}</li>)}</ul>
                ) : <p className="mt-1 text-sm text-success">✓ Lengkap: {d.kelengkapan.jumlahPenerima} penerima, total {rupiah(d.kelengkapan.totalNilai)}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {bisaUbah && <Tombol disabled={d.kelengkapan.kurang.length > 0} memuat={aksi.isPending} onClick={() => aksi.mutate({ path: `/sumber-dana/${kode}/ajukan` })}>Ajukan ke Balai SDSP</Tombol>}
                {peran === 'SUPER_ADMIN' && d.status === 'DIAJUKAN' && <>
                  <Tombol varian="bahaya" onClick={() => { const c = window.prompt('Catatan pengembalian untuk direktorat:')?.trim(); if (c && c.length >= 3) aksi.mutate({ path: `/sumber-dana/${kode}/kembalikan`, json: { catatan: c } }); }}>Kembalikan</Tombol>
                  <Tombol onClick={() => window.confirm(`Sahkan ${d.nama}? Pagu dibentuk untuk ${d.kelengkapan.jumlahPenerima} sekolah dan sumber dana dibuka di semua Mitra SIPLah.`) && aksi.mutate({ path: `/sumber-dana/${kode}/sahkan` })}>Sahkan</Tombol>
                </>}
              </div>
            </div>
          </Kartu>
        )}

        {d && (
          <Bagian judul="Dokumen" ket="Juknis disetujui Admin Ditjen; panduan pelaksanaan disahkan direktorat setelah juknis disetujui. Hanya PDF, maks 10 MB.">
            <div className="grid gap-3 md:grid-cols-2">
              {(['JUKNIS', 'PANDUAN'] as const).map((j) => {
                const dok = d.dokumen.find((x) => x.jenis === j);
                const pemutus = j === 'JUKNIS' ? 'ADMIN_DITJEN' : 'ADMIN_DIREKTORAT';
                return (
                  <div key={j} className="rounded-ctl border border-line p-3" data-testid={`dokumen-${j}`}>
                    <div className="flex items-center justify-between"><p className="font-medium">{j === 'JUKNIS' ? 'Petunjuk teknis (juknis)' : 'Panduan pelaksanaan'}</p>{dok && <LencanaBantuan status={dok.status} />}</div>
                    {dok ? <p className="mt-1 text-sm"><a className="text-primary hover:underline" href={`/api/v1/dokumen/${dok.id}/berkas`}>{dok.namaBerkas}</a> <span className="text-xs text-muted">· {Math.ceil(dok.ukuran / 1024)} KB · {tanggal(dok.diunggahAt.slice(0, 10))}</span></p>
                      : <p className="mt-1 text-sm text-muted">Belum diunggah.</p>}
                    {dok?.catatan && <p className="mt-1 text-sm text-danger">Catatan: {dok.catatan}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {bisaUbah && <PilihBerkas label={dok ? 'Unggah versi baru' : 'Unggah PDF'} terima=".pdf,application/pdf" onPilih={(f) => aksi.mutate({ path: `/sumber-dana/${kode}/dokumen/${j}`, berkas: f })} />}
                      {dok?.status === 'DIUNGGAH' && peran === pemutus && bisaUbahStatus(d.status) && <>
                        <Tombol className="h-9" onClick={() => aksi.mutate({ path: `/dokumen/${dok.id}/keputusan`, json: { setuju: true } })}>{j === 'JUKNIS' ? 'Setujui' : 'Sahkan'}</Tombol>
                        <Tombol varian="bahaya" className="h-9" onClick={() => { const c = window.prompt('Alasan penolakan:')?.trim(); if (c) aksi.mutate({ path: `/dokumen/${dok.id}/keputusan`, json: { setuju: false, catatan: c } }); }}>Tolak</Tombol>
                      </>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Bagian>
        )}

        {d && (
          <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
            <Bagian judul="Komponen bantuan" ket="Dipakai sekolah menyusun kertas kerja bantuan.">
              <ul className="divide-y divide-line text-sm">
                {d.komponen.map((k) => (
                  <li key={k.kode} className="flex items-center justify-between py-1.5"><span>{k.kode}. {k.nama}{k.maksPersen ? <span className="text-muted"> · maks {k.maksPersen}%</span> : null}</span>
                    {bisaUbah && <button className="text-xs text-danger hover:underline" onClick={() => aksi.mutate({ path: `/sumber-dana/${kode}/komponen/${k.kode}`, metode: 'DELETE' })}>Hapus</button>}</li>
                ))}
                {!d.komponen.length && <li className="py-2 text-muted">Belum ada komponen.</li>}
              </ul>
              {bisaUbah && <FormBaris kolom={[{ k: 'kode', l: 'Kode', w: 'w-16', p: '01' }, { k: 'nama', l: 'Nama komponen', p: 'Pengadaan laptop' }, { k: 'maks', l: 'Maks %', w: 'w-20', p: '80' }]}
                onSimpan={(v) => aksi.mutate({ path: `/sumber-dana/${kode}/komponen/${v.kode}`, metode: 'PUT', json: { nama: v.nama, maksPersen: v.maks ? Number(v.maks) : null } })} />}
            </Bagian>

            <Bagian judul={`Penerima (${d.penerima.length})`} ket="NPSN harus terdaftar di Dapodik dan jenjangnya sesuai sasaran. Isi satu per satu atau impor Excel.">
              {bisaUbah && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <a className="text-sm text-primary hover:underline" href={`/api/v1/sumber-dana/${kode}/penerima/templat`}>Unduh templat Excel</a>
                  <PilihBerkas label="Impor Excel" terima=".xlsx" onPilih={(f) => aksi.mutate({ path: `/impor/penerima/${kode}`, berkas: f })} />
                </div>
              )}
              {d.impor[0] && (
                <div className="mb-3" data-testid="hasil-impor">
                  {d.impor[0].status === 'MENUNGGU' ? <Spanduk nada="info" judul={`Memproses ${d.impor[0].namaBerkas}…`} />
                    : d.impor[0].status === 'SELESAI' ? <Spanduk nada="sukses" judul={`Impor ${d.impor[0].namaBerkas} berhasil: ${d.impor[0].jumlahOk} penerima`} />
                      : <Spanduk nada="bahaya" judul={`Impor ${d.impor[0].namaBerkas} ditolak (${d.impor[0].galat.length} kesalahan). Tidak ada data yang diubah.`}>
                        <ul className="mt-1 max-h-40 overflow-y-auto text-xs">{d.impor[0].galat.map((x, i) => <li key={i}>{x.baris ? `Baris ${x.baris}` : 'Berkas'}{x.npsn ? ` (${x.npsn})` : ''}: {x.pesan}</li>)}</ul>
                      </Spanduk>}
                </div>
              )}
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted"><tr><th className="py-1.5">Sekolah</th><th className="text-right">Nilai</th><th className="text-right">Disalurkan</th><th /></tr></thead>
                  <tbody>
                    {d.penerima.map((p) => (
                      <tr key={p.npsn} className="border-t border-line">
                        <td className="py-1.5">{p.nama ?? '—'}<span className="block text-xs text-muted">{p.npsn} · {p.jenjang}</span></td>
                        <td className="angka text-right">{rupiah(p.nilai)}</td><td className="angka text-right">{rupiah(p.disalurkan)}</td>
                        <td className="text-right">{bisaUbah && <button className="text-xs text-danger hover:underline" onClick={() => aksi.mutate({ path: `/sumber-dana/${kode}/penerima/${p.npsn}`, metode: 'DELETE' })}>Hapus</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {bisaUbah && <FormBaris kolom={[{ k: 'npsn', l: 'NPSN', w: 'w-32', p: '20100001' }, { k: 'nilai', l: 'Nilai (Rp)', p: '50000000' }]}
                onSimpan={(v) => aksi.mutate({ path: `/sumber-dana/${kode}/penerima/${v.npsn}`, metode: 'PUT', json: { nilai: Number(v.nilai) } })} />}
            </Bagian>
          </div>
        )}

        {d?.status === 'DISAHKAN' && <Penyaluran d={d} kode={kode} bolehUbah={peran === 'ADMIN_DIREKTORAT'} aksi={(a) => aksi.mutate(a)} />}
        {d?.status === 'DISAHKAN' && <PengajuanSekolah kode={kode} peran={peran} />}
      </main>
    </>
  );
}

const bisaUbahStatus = (s: string) => s === 'DRAF' || s === 'DIKEMBALIKAN';

function Bagian({ judul, ket, children }: { judul: string; ket?: string; children: ReactNode }) {
  return (
    <Kartu>
      <div className="border-b border-line px-4 py-3"><h2 className="font-display text-base font-bold">{judul}</h2>{ket && <p className="text-sm text-muted">{ket}</p>}</div>
      <div className="p-4">{children}</div>
    </Kartu>
  );
}

function PilihBerkas({ label, terima, onPilih }: { label: string; terima: string; onPilih: (f: File) => void }) {
  return (
    <label className="inline-flex h-9 cursor-pointer items-center rounded-ctl border border-line bg-surface px-3 text-sm font-semibold hover:bg-canvas">
      {label}<input type="file" accept={terima} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPilih(f); e.target.value = ''; }} />
    </label>
  );
}

function FormBaris({ kolom, onSimpan }: { kolom: Array<{ k: string; l: string; w?: string; p?: string }>; onSimpan: (v: Record<string, string>) => void }) {
  const [v, setV] = useState<Record<string, string>>({});
  return (
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); onSimpan(v); setV({}); }}>
      {kolom.map((c) => <label key={c.k} className={cx('text-xs text-muted', c.w ?? 'flex-1')}>{c.l}<Masukan className="h-9" value={v[c.k] ?? ''} placeholder={c.p} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} /></label>)}
      <Tombol type="submit" varian="sekunder" className="h-9">Simpan</Tombol>
    </form>
  );
}

function Penyaluran({ d, kode, bolehUbah, aksi }: { d: Detail; kode: string; bolehUbah: boolean; aksi: (a: { path: string; json?: unknown }) => void }) {
  const bank = useQuery({ queryKey: ['bank'], queryFn: async () => (await api<{ data: Array<{ kode: string; nama: string }> }>('/bank')).data.data });
  const [pks, setPks] = useState({ bankKode: '', nomor: '', tanggal: '' });
  const [s, setS] = useState({ npsn: '', tahap: '1', tanggal: '', nilai: '', bankKode: '', nomorReferensi: '' });
  return (
    <Bagian judul="Penyaluran" ket="Sekolah penerima menerima dana lewat bank penyalur yang punya PKS dengan direktorat. Total penyaluran tidak boleh melebihi nilai bantuan.">
      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <div>
          <p className="mb-1 text-sm font-semibold">PKS bank penyalur</p>
          <ul className="text-sm">{d.pks.map((p) => <li key={p.id} className="border-t border-line py-1.5">{p.namaBank}<span className="block text-xs text-muted">{p.nomor} · {tanggal(p.tanggal)}</span></li>)}
            {!d.pks.length && <li className="text-muted">Belum ada PKS.</li>}</ul>
          {bolehUbah && (
            <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); aksi({ path: `/sumber-dana/${kode}/pks-bank`, json: pks }); }}>
              <Pilihan aria-label="Bank" className="h-9" value={pks.bankKode} onChange={(e) => setPks({ ...pks, bankKode: e.target.value })}><option value="">Pilih bank…</option>{bank.data?.map((b) => <option key={b.kode} value={b.kode}>{b.nama}</option>)}</Pilihan>
              <div className="flex gap-2"><Masukan aria-label="Nomor PKS" className="h-9" placeholder="Nomor PKS" value={pks.nomor} onChange={(e) => setPks({ ...pks, nomor: e.target.value })} />
                <Masukan aria-label="Tanggal PKS" type="date" className="h-9 w-40" value={pks.tanggal} onChange={(e) => setPks({ ...pks, tanggal: e.target.value })} /></div>
              <Tombol type="submit" varian="sekunder" className="h-9">Simpan PKS</Tombol>
            </form>
          )}
        </div>
        <div>
          {bolehUbah && (
            <form className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-6" onSubmit={(e) => { e.preventDefault(); aksi({ path: `/sumber-dana/${kode}/penyaluran`, json: { ...s, tahap: Number(s.tahap), nilai: Number(s.nilai) } }); }}>
              <Pilihan aria-label="Sekolah" className="col-span-2 h-9" value={s.npsn} onChange={(e) => setS({ ...s, npsn: e.target.value })}><option value="">Sekolah…</option>{d.penerima.map((p) => <option key={p.npsn} value={p.npsn}>{p.nama ?? p.npsn} (sisa {rupiah(p.nilai - p.disalurkan)})</option>)}</Pilihan>
              <Pilihan aria-label="Tahap" className="h-9" value={s.tahap} onChange={(e) => setS({ ...s, tahap: e.target.value })}>{[1, 2, 3, 4].map((t) => <option key={t} value={t}>Tahap {t}</option>)}</Pilihan>
              <Masukan aria-label="Tanggal salur" type="date" className="h-9" value={s.tanggal} onChange={(e) => setS({ ...s, tanggal: e.target.value })} />
              <Masukan aria-label="Nilai salur" className="h-9" placeholder="Nilai (Rp)" value={s.nilai} onChange={(e) => setS({ ...s, nilai: e.target.value })} />
              <Pilihan aria-label="Bank penyalur" className="h-9" value={s.bankKode} onChange={(e) => setS({ ...s, bankKode: e.target.value })}><option value="">Bank…</option>{d.pks.map((p) => <option key={p.bankKode} value={p.bankKode}>{p.bankKode}</option>)}</Pilihan>
              <Masukan aria-label="Nomor referensi" className="col-span-2 h-9 sm:col-span-4" placeholder="Nomor referensi transfer" value={s.nomorReferensi} onChange={(e) => setS({ ...s, nomorReferensi: e.target.value })} />
              <Tombol type="submit" className="col-span-2 h-9">Catat penyaluran</Tombol>
            </form>
          )}
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-1.5">Tanggal</th><th>Sekolah</th><th>Tahap</th><th>Bank</th><th className="text-right">Nilai</th></tr></thead>
            <tbody>{d.penyaluran.map((p) => <tr key={p.id} className="border-t border-line"><td className="py-1.5">{tanggal(p.tanggal)}</td><td>{d.penerima.find((x) => x.npsn === p.npsn)?.nama ?? p.npsn}</td><td>{p.tahap}</td><td>{p.bankKode}<span className="block text-xs text-muted">{p.nomorReferensi}</span></td><td className="angka text-right">{rupiah(p.nilai)}</td></tr>)}</tbody>
          </table>
          {!d.penyaluran.length && <p className="text-sm text-muted">Belum ada penyaluran.</p>}
        </div>
      </div>
    </Bagian>
  );
}

function PengajuanSekolah({ kode, peran }: { kode: string; peran: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['pengajuan', kode], queryFn: async () => (await api<{ data: Pengajuan[] }>(`/sumber-dana/${kode}/pengajuan`)).data.data, enabled: ['TIM_KERJA', 'ADMIN_DIREKTORAT', 'SUPER_ADMIN', 'PEMANTAU', 'AUDITOR'].includes(peran) });
  const putus = useMutation({
    mutationFn: async (a: { id: string; keputusan: string; catatan?: string }) => (await api(`/pengajuan-bantuan/${a.id}/keputusan`, { method: 'POST', json: { keputusan: a.keputusan, catatan: a.catatan } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pengajuan', kode] }),
  });
  const g = putus.error instanceof GalatApi ? putus.error : undefined;
  const penelaah = peran === 'TIM_KERJA' || peran === 'ADMIN_DIREKTORAT';
  if (!q.data) return null;
  return (
    <Bagian judul={`Pengajuan sekolah (${q.data.length})`} ket="Sekolah penerima mengunggah PKS, RAB, dan SPTJM; Tim Kerja atau Admin Direktorat memutuskan.">
      {g && <Spanduk nada="bahaya" judul={g.problem.detail ?? g.problem.title} />}
      {!q.data.length && <p className="text-sm text-muted">Belum ada pengajuan.</p>}
      <ul className="divide-y divide-line">
        {q.data.map((p) => (
          <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5 text-sm" data-testid="pengajuan-sekolah">
            <div>
              <p className="font-medium">{p.namaSekolah ?? p.npsn} <span className="text-xs text-muted">{p.npsn}</span></p>
              <p className="text-xs text-muted">RAB {p.nilaiRab ? rupiah(p.nilaiRab) : '—'} · {['PKS', 'RAB', 'SPTJM'].map((j) => p.dokumen?.[j]
                ? <a key={j} className="mr-2 text-primary hover:underline" href={`/api/v1/pengajuan-bantuan/${p.id}/dokumen/${j}`}>{j}</a> : <span key={j} className="mr-2">{j} belum</span>)}</p>
              {p.catatan && <p className="text-xs">Catatan: {p.catatan}</p>}
            </div>
            <div className="flex items-center gap-2">
              <LencanaBantuan status={p.status} />
              {penelaah && p.status === 'DIAJUKAN' && <>
                <Tombol className="h-8 px-2 text-xs" onClick={() => putus.mutate({ id: p.id, keputusan: 'SETUJUI', catatan: 'Dokumen lengkap dan sesuai' })}>Setujui</Tombol>
                <Tombol varian="sekunder" className="h-8 px-2 text-xs" onClick={() => { const c = window.prompt('Catatan perbaikan:')?.trim(); if (c) putus.mutate({ id: p.id, keputusan: 'KEMBALIKAN', catatan: c }); }}>Kembalikan</Tombol>
                <Tombol varian="bahaya" className="h-8 px-2 text-xs" onClick={() => { const c = window.prompt('Alasan penolakan:')?.trim(); if (c) putus.mutate({ id: p.id, keputusan: 'TOLAK', catatan: c }); }}>Tolak</Tombol>
              </>}
            </div>
          </li>
        ))}
      </ul>
    </Bagian>
  );
}
