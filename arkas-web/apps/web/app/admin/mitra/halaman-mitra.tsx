'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeDto } from '@arkas/kontrak';
import { Kepala } from '@/components/kepala';
import { Laci } from '@/components/laci';
import { Bidang, Kartu, Masukan, Spanduk, Tombol, cx } from '@/components/ui';
import { api, GalatApi } from '@/lib/api';
import { rupiah, tanggal } from '@/lib/format';

type Mitra = { kode: string; nama: string; baseUrl: string; clientId: string; ipDiizinkan: string[]; status: 'AKTIF' | 'NONAKTIF'; pembukaan: Record<string, number> | null; jumlahTransaksi: number };
type Sel = { id: string; sumberDanaKode: string; mitraKode: string; versi: number; target: 'BUKA' | 'TUTUP'; status: string; percobaan: number; galatTerakhir: string | null; dikonfirmasiAt: string | null };
type Matriks = { sumberDana: Array<{ kode: string; nama: string; kategori: string; aktif: boolean }>; mitra: Array<{ kode: string; nama: string; status: string }>; sel: Sel[] };
type Rahasia = { kode: string; clientId: string; clientSecret: string; hmacRahasia: string };
type TrxMitra = { id: string; mitraKode: string; transactionId: string; npsn: string; tanggal: string; namaToko: string; total: number; status: string; jumlahItem: number; itemTanpaBaris: number };

const WARNA: Record<string, string> = {
  MENUNGGU: 'bg-canvas text-muted ring-line', TERKIRIM: 'bg-warning/10 text-warning ring-warning/30', DIBUKA: 'bg-success/10 text-success ring-success/30',
  GAGAL: 'bg-danger/10 text-danger ring-danger/30', DITUTUP: 'bg-canvas text-muted ring-line',
};
const LABEL: Record<string, string> = { MENUNGGU: 'Menunggu dikirim', TERKIRIM: 'Terkirim, menunggu konfirmasi', DIBUKA: 'Dibuka', GAGAL: 'Gagal', DITUTUP: 'Ditutup' };

export function HalamanMitra({ me }: { me: MeDto & { peranAktif: NonNullable<MeDto['peranAktif']> } }) {
  const balai = me.peranAktif.peran === 'SUPER_ADMIN';
  const qc = useQueryClient();
  const [laci, setLaci] = useState(false);
  const [rahasia, setRahasia] = useState<Rahasia | null>(null);
  const mitra = useQuery({ queryKey: ['mitra'], queryFn: async () => (await api<{ data: Mitra[] }>('/admin/mitra-siplah')).data.data, refetchInterval: 5000 });
  const matriks = useQuery({ queryKey: ['matriks'], queryFn: async () => (await api<Matriks>('/pembukaan-sumber-dana')).data, refetchInterval: 3000 });
  const trx = useQuery({ queryKey: ['trx-mitra'], queryFn: async () => (await api<{ data: TrxMitra[] }>('/integrasi/transaksi-mitra')).data.data, refetchInterval: 5000 });
  const segarkan = () => { void qc.invalidateQueries({ queryKey: ['mitra'] }); void qc.invalidateQueries({ queryKey: ['matriks'] }); };
  const aksi = useMutation({
    mutationFn: async (a: { path: string; json?: unknown; metode?: 'POST' | 'PUT' }) => (await api<unknown>(a.path, { method: a.metode ?? 'POST', json: a.json ?? {} })).data,
    onSuccess: (d, a) => { if (a.path.endsWith('rotasi-rahasia')) setRahasia(d as Rahasia); segarkan(); },
  });
  const g = aksi.error instanceof GalatApi ? aksi.error : undefined;
  const sel = (sd: string, m: string) => matriks.data?.sel.find((s) => s.sumberDanaKode === sd && s.mitraKode === m);

  return (
    <>
      <Kepala judul="Mitra SIPLah" me={me} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        {g && <Spanduk nada="bahaya" judul={g.problem.detail ?? g.problem.title}>Kode: {g.problem.kode}</Spanduk>}
        {rahasia && (
          <Spanduk nada="peringatan" judul={`Kredensial ${rahasia.kode} — simpan sekarang, tidak akan ditampilkan lagi`}
            aksi={<Tombol varian="sekunder" className="h-9" onClick={() => setRahasia(null)}>Sudah disimpan</Tombol>}>
            <dl className="mt-1 grid gap-x-3 gap-y-1 font-mono text-xs sm:grid-cols-[auto_1fr]" data-testid="kredensial">
              <dt className="text-muted">client_id</dt><dd className="break-all">{rahasia.clientId}</dd>
              <dt className="text-muted">client_secret</dt><dd className="break-all">{rahasia.clientSecret}</dd>
              <dt className="text-muted">rahasia HMAC</dt><dd className="break-all">{rahasia.hmacRahasia}</dd>
            </dl>
            <p className="mt-1 text-xs">Serahkan ke Mitra lewat saluran aman. Bila bocor, tekan <b>Rotasi rahasia</b>.</p>
          </Spanduk>
        )}

        <Kartu>
          <div className="border-b border-line px-4 py-3">
            <h2 className="font-display text-base font-bold">Pembukaan sumber dana di Mitra</h2>
            <p className="text-sm text-muted">Setiap sumber dana yang disahkan otomatis dibuka di semua Mitra aktif. Sekolah baru bisa belanja setelah Mitra mengonfirmasi <b>Dibuka</b>.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm" aria-label="Matriks pembukaan">
              <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-2">Sumber dana</th>{matriks.data?.mitra.map((m) => <th key={m.kode} className="px-3 py-2">{m.nama}<span className="block normal-case text-[11px]">{m.kode}{m.status !== 'AKTIF' ? ' · nonaktif' : ''}</span></th>)}{balai && <th />}</tr>
              </thead>
              <tbody>
                {matriks.data?.sumberDana.map((sd) => (
                  <tr key={sd.kode} className="border-t border-line align-top">
                    <td className="px-4 py-2.5"><p className="font-medium">{sd.nama}</p><p className="text-xs text-muted">{sd.kode} · {sd.kategori}{!sd.aktif && ' · nonaktif'}</p></td>
                    {matriks.data!.mitra.map((m) => {
                      const s = sel(sd.kode, m.kode);
                      return (
                        <td key={m.kode} className="px-3 py-2.5" data-testid={`sel-${sd.kode}-${m.kode}`}>
                          {s ? (
                            <div className="space-y-1">
                              <span className={cx('inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', WARNA[s.status])}>{LABEL[s.status] ?? s.status}</span>
                              <p className="text-[11px] text-muted">versi {s.versi}{s.target === 'TUTUP' && s.status !== 'DITUTUP' ? ' · penutupan' : ''}{s.percobaan > 0 && s.status === 'MENUNGGU' ? ` · percobaan ${s.percobaan}` : ''}</p>
                              {s.status === 'GAGAL' && <p className="max-w-[16rem] truncate text-[11px] text-danger" title={s.galatTerakhir ?? ''}>{s.galatTerakhir}</p>}
                              {balai && s.status === 'GAGAL' && <Tombol varian="sekunder" className="h-8 px-2 text-xs" onClick={() => aksi.mutate({ path: `/pembukaan-sumber-dana/${s.id}/kirim-ulang` })}>Kirim ulang</Tombol>}
                            </div>
                          ) : <span className="text-xs text-muted">—</span>}
                        </td>
                      );
                    })}
                    {balai && (
                      <td className="px-3 py-2.5 text-right">
                        {matriks.data!.sel.some((s) => s.sumberDanaKode === sd.kode && s.target === 'BUKA') && (
                          <Tombol varian="bahaya" className="h-8 px-2 text-xs" onClick={() => {
                            const alasan = window.prompt(`Tutup ${sd.nama} di semua Mitra? Sekolah tidak bisa lagi berbelanja dengan sumber dana ini. Alasan:`)?.trim();
                            if (alasan && alasan.length >= 3) aksi.mutate({ path: `/sumber-dana/${sd.kode}/tutup`, json: { alasan } });
                          }}>Tutup di semua Mitra</Tombol>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Kartu>

        <Kartu>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="font-display text-base font-bold">Mitra terdaftar</h2>
              <p className="text-sm text-muted">Mitra memanggil ARKAS dengan token OAuth2, dari alamat IP terdaftar, dan setiap pesan ditandatangani HMAC.</p>
            </div>
            {balai && <Tombol onClick={() => setLaci(true)}>+ Daftarkan Mitra</Tombol>}
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-2">Mitra</th><th className="px-3">Alamat & IP</th><th className="px-3">Transaksi</th><th className="px-3">Status</th>{balai && <th />}</tr></thead>
            <tbody>
              {mitra.data?.map((m) => (
                <tr key={m.kode} className="border-t border-line align-top">
                  <td className="px-4 py-2.5"><p className="font-medium">{m.nama}</p><p className="font-mono text-xs text-muted">{m.kode} · {m.clientId}</p></td>
                  <td className="px-3 py-2.5 text-xs"><p className="font-mono">{m.baseUrl}</p><p className="text-muted">{m.ipDiizinkan.join(', ')}</p></td>
                  <td className="angka px-3 py-2.5">{m.jumlahTransaksi}</td>
                  <td className="px-3 py-2.5"><span className={cx('rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', m.status === 'AKTIF' ? WARNA.DIBUKA : WARNA.DITUTUP)}>{m.status === 'AKTIF' ? 'Aktif' : 'Nonaktif'}</span></td>
                  {balai && (
                    <td className="space-x-2 whitespace-nowrap px-3 py-2.5 text-right">
                      <Tombol varian="hantu" className="h-8 px-2 text-xs" onClick={() => window.confirm(`Buat rahasia baru untuk ${m.nama}? Rahasia lama langsung tidak berlaku.`) && aksi.mutate({ path: `/admin/mitra-siplah/${m.kode}/rotasi-rahasia` })}>Rotasi rahasia</Tombol>
                      <Tombol varian="sekunder" className="h-8 px-2 text-xs" onClick={() => aksi.mutate({ path: `/admin/mitra-siplah/${m.kode}`, metode: 'PUT', json: { status: m.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF' } })}>
                        {m.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}
                      </Tombol>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Kartu>

        <Kartu>
          <div className="border-b border-line px-4 py-3"><h2 className="font-display text-base font-bold">Transaksi dari Mitra (terbaru)</h2></div>
          {!trx.data?.length ? <p className="p-6 text-center text-sm text-muted">Belum ada transaksi dari Mitra.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="bg-canvas text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-2">Tanggal</th><th className="px-3">Transaksi</th><th className="px-3">Sekolah</th><th className="px-3">Toko</th><th className="px-3 text-right">Nilai</th><th className="px-3">Status</th></tr></thead>
                <tbody>
                  {trx.data.map((t) => (
                    <tr key={t.id} className="border-t border-line">
                      <td className="px-4 py-2">{tanggal(t.tanggal)}</td>
                      <td className="px-3 font-mono text-xs">{t.mitraKode}<br />{t.transactionId}</td>
                      <td className="px-3">{t.npsn}</td>
                      <td className="px-3">{t.namaToko}<span className="block text-xs text-muted">{t.jumlahItem} barang{t.itemTanpaBaris ? `, ${t.itemTanpaBaris} perlu dipetakan sekolah` : ''}</span></td>
                      <td className="angka px-3 text-right">{rupiah(t.total)}</td>
                      <td className="px-3 text-xs">{t.status === 'DITERIMA' ? 'Diterima' : t.status === 'RETUR' ? 'Diretur' : 'Dibatalkan'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Kartu>
      </main>
      <FormDaftar terbuka={laci} onTutup={() => setLaci(false)} onSelesai={(r) => { setLaci(false); setRahasia(r); segarkan(); }} />
    </>
  );
}

function FormDaftar({ terbuka, onTutup, onSelesai }: { terbuka: boolean; onTutup: () => void; onSelesai: (r: Rahasia) => void }) {
  const [f, setF] = useState({ kode: '', nama: '', baseUrl: 'https://', ip: '' });
  const daftar = useMutation({
    mutationFn: async () => (await api<Rahasia>('/admin/mitra-siplah', { method: 'POST', json: { kode: f.kode.trim().toUpperCase(), nama: f.nama, baseUrl: f.baseUrl.trim(), ipDiizinkan: f.ip.split(/[\s,]+/).filter(Boolean) } })).data,
    onSuccess: (r) => { setF({ kode: '', nama: '', baseUrl: 'https://', ip: '' }); onSelesai(r); },
  });
  const g = daftar.error instanceof GalatApi ? daftar.error : undefined;
  const galatKolom = (k: string) => g?.problem.galat?.find((x) => x.path.startsWith(k))?.pesan;
  return (
    <Laci terbuka={terbuka} onTutup={onTutup} judul="Daftarkan Mitra SIPLah" lebar="max-w-lg"
      kaki={<div className="flex justify-end gap-2"><Tombol varian="hantu" onClick={onTutup}>Batal</Tombol><Tombol memuat={daftar.isPending} onClick={() => daftar.mutate()}>Daftarkan</Tombol></div>}>
      <div className="space-y-4">
        {g && <Spanduk nada="bahaya" judul={g.problem.detail ?? g.problem.title} />}
        <Bidang label="Kode Mitra" bantuan="3–20 huruf kapital, angka, atau garis bawah, mis. TOKOLADANG" galat={galatKolom('kode')}>
          <Masukan value={f.kode} onChange={(e) => setF({ ...f, kode: e.target.value.toUpperCase() })} placeholder="MITRA_A" />
        </Bidang>
        <Bidang label="Nama Mitra" galat={galatKolom('nama')}><Masukan value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} /></Bidang>
        <Bidang label="Alamat dasar API Mitra" bantuan="ARKAS memanggil {alamat}/arkas/v1/sumber-dana untuk membuka & menutup sumber dana" galat={galatKolom('baseUrl')}>
          <Masukan value={f.baseUrl} onChange={(e) => setF({ ...f, baseUrl: e.target.value })} />
        </Bidang>
        <Bidang label="Alamat IP yang diizinkan" bantuan="Pisahkan dengan koma. Panggilan dari IP lain ditolak." galat={galatKolom('ipDiizinkan')}>
          <Masukan value={f.ip} onChange={(e) => setF({ ...f, ip: e.target.value })} placeholder="203.0.113.10, 203.0.113.11" />
        </Bidang>
        <p className="text-sm text-muted">Setelah didaftarkan, ARKAS membuat <b>client_id</b>, <b>client_secret</b>, dan <b>rahasia HMAC</b>. Ketiganya hanya ditampilkan sekali. Semua sumber dana yang aktif langsung dikirim ke Mitra ini untuk dibuka.</p>
      </div>
    </Laci>
  );
}
