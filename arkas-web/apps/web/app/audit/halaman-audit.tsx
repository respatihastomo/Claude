'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MeDto } from '@arkas/kontrak';
import { Kepala } from '@/components/kepala';
import { Bidang, Kartu, Pilihan, Spanduk, Tombol, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { LABEL_PERAN } from '@/lib/peran';

type Jejak = {
  tahun: number; rantai: string; urutan: number; eventId: string; layanan: string; tabel: string; aksi: 'INSERT' | 'UPDATE' | 'DELETE'; kunci: string;
  npsn: string | null; pelakuId: string | null; peran: string | null; ip: string | null; alasan: string | null;
  sebelum: Record<string, unknown> | null; sesudah: Record<string, unknown> | null; terjadiAt: string; hashSebelum: string; hash: string;
};
type Rantai = { rantai: string; jumlah: number; hashKepala: string; terakhirAt: string };
type Verifikasi = { rantai: string; utuh: boolean; diperiksa: number; hashKepala: string | null; rusak: { urutan: number; alasan: string } | null; diperiksaAt: string };

const LAYANAN: Record<string, string> = {
  'svc-penatausahaan': 'Penatausahaan', 'svc-perencanaan': 'Perencanaan', 'svc-referensi': 'Referensi', 'svc-identitas': 'Identitas', 'svc-pelaporan': 'Pelaporan',
};
const TABEL: Record<string, string> = {
  transaksi: 'Transaksi BKU', periode: 'Periode buku kas', pajak: 'Pajak', rekonsiliasi: 'Rekonsiliasi', pagu: 'Pagu', kertas_kerja: 'Kertas kerja RKAS',
  baris_kertas_kerja: 'Baris RKAS', verifikasi: 'Penelaahan RKAS', catatan_baris: 'Catatan penelaahan', pengguna: 'Pengguna', peran_pengguna: 'Peran pengguna',
  laporan: 'Laporan', komponen: 'Komponen', tarif_pajak: 'Tarif pajak', kode_rekening: 'Kode rekening', satuan_pendidikan: 'Satuan pendidikan',
  wilayah: 'Wilayah', jenjang: 'Jenjang', direktorat: 'Direktorat', sumber_dana: 'Sumber dana', sumber_dana_jenjang: 'Sumber dana per jenjang',
};
const AKSI = { INSERT: { label: 'dibuat', warna: 'bg-success' }, UPDATE: { label: 'diubah', warna: 'bg-primary' }, DELETE: { label: 'dihapus', warna: 'bg-danger' } };
const ALASAN_RUSAK: Record<string, string> = {
  ISI_BERUBAH: 'isi entri berubah setelah dicatat', TAUTAN_RUSAK: 'tautan ke entri sebelumnya tidak cocok',
  URUTAN_TERPUTUS: 'ada entri yang hilang di tengah rantai', ENTRI_HILANG: 'entri terakhir hilang (tidak cocok dengan kepala rantai)',
};
const waktu = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Jakarta' });
const namaRantai = (r: string) => (r === 'NASIONAL' ? 'Nasional (tanpa sekolah)' : `Sekolah ${r}`);
const tampil = (v: unknown) => (v === undefined ? '—' : v === null ? '(kosong)' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const sama = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function HalamanAudit({ me }: { me: MeDto & { peranAktif: NonNullable<MeDto['peranAktif']> } }) {
  const kepsek = me.peranAktif.peran === 'KEPSEK';
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [rantai, setRantai] = useState(kepsek ? me.peranAktif.npsn ?? '' : '');
  const [layanan, setLayanan] = useState('');
  const [aksi, setAksi] = useState('');
  const [halaman, setHalaman] = useState(1);
  const ukuran = 20;

  const daftarRantai = useQuery({ queryKey: ['audit-rantai', tahun], queryFn: async () => (await api<{ data: Rantai[] }>(`/audit/rantai?tahun=${tahun}`)).data.data });
  const verif = useQuery({
    queryKey: ['audit-verifikasi', tahun, rantai],
    queryFn: async () => (await api<{ utuh: boolean; data: Verifikasi[] }>(`/audit/verifikasi?tahun=${tahun}${rantai ? `&rantai=${rantai}` : ''}`)).data,
  });
  const q = new URLSearchParams({ tahun: String(tahun), halaman: String(halaman), ukuran: String(ukuran) });
  if (rantai) q.set('rantai', rantai);
  if (layanan) q.set('layanan', layanan);
  if (aksi) q.set('aksi', aksi);
  const jejak = useQuery({ queryKey: ['audit-jejak', q.toString()], queryFn: async () => (await api<{ data: Jejak[]; total: number }>(`/audit/jejak?${q}`)).data });
  const rusak = verif.data?.data.filter((v) => !v.utuh) ?? [];
  const jumlahHalaman = Math.max(1, Math.ceil((jejak.data?.total ?? 0) / ukuran));
  const ubah = <T,>(f: (v: T) => void) => (v: T) => { f(v); setHalaman(1); };

  return (
    <>
      <Kepala judul="Jejak audit" me={me} npsn={me.peranAktif.npsn ?? undefined} />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        {/* Lencana verifikasi rantai hash SHA-256 */}
        <Kartu className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span aria-hidden className={cx('mt-0.5 flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white',
                verif.isLoading ? 'bg-muted' : rusak.length ? 'bg-danger' : 'bg-success')}>{verif.isLoading ? '…' : rusak.length ? '!' : '✓'}</span>
              <div>
                <p className="font-display text-base font-bold" data-testid="status-verifikasi">
                  {verif.isLoading ? 'Memeriksa rantai hash…' : rusak.length ? `Rantai rusak terdeteksi (${rusak.length})` : 'Terverifikasi utuh'}
                </p>
                <p className="text-sm text-muted">
                  {verif.data ? `${verif.data.data.length} rantai · ${verif.data.data.reduce((a, v) => a + v.diperiksa, 0)} entri dihitung ulang dengan SHA-256` : 'Setiap entri dihitung ulang dan dicocokkan dengan entri sebelumnya.'}
                </p>
              </div>
            </div>
            <Tombol varian="sekunder" onClick={() => verif.refetch()} memuat={verif.isFetching}>Periksa ulang</Tombol>
          </div>
          {rusak.map((v) => (
            <div key={v.rantai} className="mt-3">
              <Spanduk nada="bahaya" judul={`${namaRantai(v.rantai)}: rusak mulai entri #${v.rusak!.urutan}`}>
                Penyebab: {ALASAN_RUSAK[v.rusak!.alasan] ?? v.rusak!.alasan}. Entri sesudahnya tidak dapat dipercaya. Laporkan ke Balai SDSP dan simpan hasil pemeriksaan ini.
              </Spanduk>
            </div>
          ))}
          {verif.data && verif.data.data.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted hover:text-ink">Rincian per rantai &amp; hash kepala (jangkar)</summary>
              <table className="mt-2 w-full text-left text-xs">
                <thead className="text-muted"><tr><th className="py-1 pr-3">Rantai</th><th className="pr-3">Entri</th><th className="pr-3">Status</th><th>Hash kepala</th></tr></thead>
                <tbody>
                  {verif.data.data.map((v) => (
                    <tr key={v.rantai} className="border-t border-line">
                      <td className="py-1 pr-3">{namaRantai(v.rantai)}</td><td className="pr-3 tabular-nums">{v.diperiksa}</td>
                      <td className={cx('pr-3 font-medium', v.utuh ? 'text-success' : 'text-danger')}>{v.utuh ? 'Utuh' : `Rusak #${v.rusak?.urutan}`}</td>
                      <td className="break-all font-mono">{v.hashKepala}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </Kartu>

        <Kartu className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Bidang label="Tahun">
              <Pilihan value={tahun} onChange={(e) => ubah(setTahun)(Number(e.target.value))}>
                {[0, 1, 2].map((d) => new Date().getFullYear() - d).map((t) => <option key={t} value={t}>{t}</option>)}
              </Pilihan>
            </Bidang>
            <Bidang label="Rantai" bantuan={kepsek ? 'Kepala Sekolah hanya melihat jejak sekolahnya' : 'Satu rantai per sekolah, ditambah rantai nasional'}>
              <Pilihan value={rantai} disabled={kepsek} onChange={(e) => ubah(setRantai)(e.target.value)}>
                {!kepsek && <option value="">Semua rantai</option>}
                {(daftarRantai.data ?? []).map((r) => <option key={r.rantai} value={r.rantai}>{namaRantai(r.rantai)} · {r.jumlah} entri</option>)}
                {kepsek && !(daftarRantai.data ?? []).length && <option value={rantai}>{namaRantai(rantai)}</option>}
              </Pilihan>
            </Bidang>
            <Bidang label="Layanan">
              <Pilihan value={layanan} onChange={(e) => ubah(setLayanan)(e.target.value)}>
                <option value="">Semua layanan</option>
                {Object.entries(LAYANAN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Pilihan>
            </Bidang>
            <Bidang label="Jenis perubahan">
              <Pilihan value={aksi} onChange={(e) => ubah(setAksi)(e.target.value)}>
                <option value="">Semua</option><option value="INSERT">Dibuat</option><option value="UPDATE">Diubah</option><option value="DELETE">Dihapus</option>
              </Pilihan>
            </Bidang>
          </div>
        </Kartu>

        <Kartu className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Linimasa</h2>
            <p className="text-sm text-muted">{jejak.data ? `${jejak.data.total} entri` : ''}</p>
          </div>
          {jejak.isError && <Spanduk nada="bahaya" judul="Jejak tidak dapat dimuat">{(jejak.error as Error).message}</Spanduk>}
          {jejak.data && jejak.data.data.length === 0 && <p className="py-8 text-center text-sm text-muted">Belum ada jejak untuk saringan ini.</p>}
          <ol className="relative ml-3 border-l border-line">
            {(jejak.data?.data ?? []).map((j) => <EntriJejak key={`${j.rantai}-${j.urutan}`} j={j} rusakDari={verif.data?.data.find((v) => v.rantai === j.rantai)?.rusak?.urutan} />)}
          </ol>
          {jumlahHalaman > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2 text-sm">
              <Tombol varian="sekunder" disabled={halaman <= 1} onClick={() => setHalaman(halaman - 1)}>Sebelumnya</Tombol>
              <span className="text-muted">Halaman {halaman} dari {jumlahHalaman}</span>
              <Tombol varian="sekunder" disabled={halaman >= jumlahHalaman} onClick={() => setHalaman(halaman + 1)}>Berikutnya</Tombol>
            </div>
          )}
        </Kartu>
      </main>
    </>
  );
}

function EntriJejak({ j, rusakDari }: { j: Jejak; rusakDari?: number }) {
  const [buka, setBuka] = useState(false);
  const [semua, setSemua] = useState(false);
  const a = AKSI[j.aksi];
  const tercemar = rusakDari !== undefined && j.urutan >= rusakDari;
  const kolom = [...new Set([...Object.keys(j.sebelum ?? {}), ...Object.keys(j.sesudah ?? {})])];
  const berubah = kolom.filter((k) => !sama(j.sebelum?.[k], j.sesudah?.[k]));
  const tampilKolom = j.aksi === 'UPDATE' && !semua ? berubah : kolom;
  return (
    <li className="mb-4 ml-5" data-testid="entri-jejak">
      <span aria-hidden className={cx('absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-surface', tercemar ? 'bg-danger' : a.warna)} />
      <div className={cx('rounded-ctl border p-3', tercemar ? 'border-danger/40 bg-danger/5' : 'border-line')}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm">
            <span className="font-semibold">{TABEL[j.tabel] ?? j.tabel} {a.label}</span>
            <span className="text-muted"> · {j.kunci}</span>
          </p>
          <time className="text-xs text-muted" dateTime={j.terjadiAt}>{waktu.format(new Date(j.terjadiAt))}</time>
        </div>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <span className="rounded bg-canvas px-1.5 py-0.5 text-ink">{LAYANAN[j.layanan] ?? j.layanan}</span>
          <span title={j.pelakuId ?? undefined}>Oleh: {j.pelakuId ? `${LABEL_PERAN[j.peran ?? ''] ?? j.peran} (ID …${j.pelakuId.slice(-6)})` : 'Sistem'}</span>
          {j.ip && <span>IP {j.ip}</span>}
          <span>{namaRantai(j.rantai)} #{j.urutan}</span>
          <span className="font-mono" title={`hash ${j.hash}\nsebelumnya ${j.hashSebelum}`}>SHA-256 {j.hash.slice(0, 12)}…</span>
        </p>
        {j.alasan && <p className="mt-1 text-sm"><span className="text-muted">Alasan:</span> {j.alasan}</p>}
        <button onClick={() => setBuka(!buka)} className="mt-2 text-sm font-medium text-primary hover:underline" aria-expanded={buka}>
          {buka ? 'Sembunyikan perubahan' : j.aksi === 'UPDATE' ? `Lihat perubahan (${berubah.length} kolom)` : 'Lihat isi'}
        </button>
        {buka && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead className="text-muted"><tr><th className="py-1 pr-3">Kolom</th><th className="pr-3">Sebelum</th><th>Sesudah</th></tr></thead>
              <tbody>
                {tampilKolom.map((k) => {
                  const beda = !sama(j.sebelum?.[k], j.sesudah?.[k]);
                  return (
                    <tr key={k} className="border-t border-line align-top">
                      <td className="py-1 pr-3 font-mono text-muted">{k}</td>
                      <td className={cx('break-all pr-3 font-mono', beda && j.sebelum && 'bg-danger/10 text-danger line-through decoration-danger/40')}>{j.sebelum ? tampil(j.sebelum[k]) : '—'}</td>
                      <td className={cx('break-all font-mono', beda && j.sesudah && 'bg-success/10 text-success')}>{j.sesudah ? tampil(j.sesudah[k]) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {j.aksi === 'UPDATE' && kolom.length > berubah.length && (
              <button onClick={() => setSemua(!semua)} className="mt-1 text-xs text-muted hover:text-ink">{semua ? 'Hanya kolom yang berubah' : `Tampilkan semua ${kolom.length} kolom`}</button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
