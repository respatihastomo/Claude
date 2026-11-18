'use client';
import { useEffect, useMemo, useState } from 'react';
import type { BarisKertasKerjaDto } from '@arkas/kontrak';
import { ComplianceBar } from '@/components/compliance-bar';
import type { MeDto } from '@arkas/kontrak';
import { Kepala } from '@/components/kepala';
import { LaciBaris } from '@/components/laci-baris';
import { Kartu, Spanduk, Tombol, cx } from '@/components/ui';
import { GalatApi } from '@/lib/api';
import { rupiah } from '@/lib/format';
import { Buku, useAksiKk, useDaftarKk, useKk, useKomponen, usePenelaahan } from '@/lib/hooks';

const STATUS: Record<string, [string, string]> = {
  DRAF: ['Draf', 'bg-canvas text-muted ring-line'],
  DIAJUKAN: ['Diajukan ke Dinas', 'bg-warning/10 text-warning ring-warning/30'],
  DISAHKAN: ['Disahkan', 'bg-success/10 text-success ring-success/30'],
  DIGANTI: ['Diganti', 'bg-canvas text-muted ring-line'],
};

/** UC-03..UC-09 — penyusunan, pengajuan, penelaahan, dan pengesahan kertas kerja (RKAS). */
export function HalamanPerencanaan({ npsn, tahun, me }: { npsn: string; tahun: number; me: MeDto }) {
  const peran = me.peranAktif!.peran;
  const buku: Buku = { npsn, tahun, sumberDanaKode: 'BOSP_REG' };
  const daftar = useDaftarKk(buku);
  const [dipilih, setDipilih] = useState<string>();
  useEffect(() => { if (daftar.data?.length && !daftar.data.some((k) => k.id === dipilih)) setDipilih(daftar.data[0].id); }, [daftar.data, dipilih]);
  const kk = useKk(dipilih).data;
  const komponen = useKomponen(dipilih).data ?? [];
  const antrean = usePenelaahan(peran === 'VERIFIKATOR_DINAS');
  const aksi = useAksiKk();
  const [laci, setLaci] = useState<{ awal?: BarisKertasKerjaDto } | null>(null);
  const galat = aksi.error instanceof GalatApi ? aksi.error.problem : (daftar.error instanceof GalatApi ? daftar.error.problem : undefined);
  const penyusun = peran === 'BENDAHARA' || peran === 'OPERATOR';
  const bisaUbah = penyusun && kk?.status === 'DRAF';
  const adaTerbuka = daftar.data?.some((k) => k.status === 'DRAF' || k.status === 'DIAJUKAN');

  const kelompok = useMemo(() => {
    const m = new Map<string, BarisKertasKerjaDto[]>();
    for (const b of kk?.baris ?? []) m.set(b.kegiatan, [...(m.get(b.kegiatan) ?? []), b]);
    return [...m.entries()];
  }, [kk]);
  const catatanBaris = (id: string) => kk?.catatan.filter((c) => c.barisId === id) ?? [];
  const jalankan = (a: Parameters<typeof aksi.mutate>[0], selesai?: () => void) => aksi.mutate(a, { onSuccess: (d) => { setDipilih(d.id); selesai?.(); } });

  return (
    <div className="min-h-screen">
      <Kepala npsn={npsn} judul={`Kertas Kerja (RKAS) — BOSP Reguler ${tahun}`} me={me} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        {peran === 'VERIFIKATOR_DINAS' && (
          <Kartu className="p-4">
            <p className="font-display text-base font-bold">Antrean penelaahan wilayah Anda</p>
            {!antrean.data?.length ? <p className="mt-1 text-sm text-muted">Tidak ada kertas kerja yang menunggu penelaahan.</p> : (
              <ul className="mt-2 divide-y divide-line">
                {antrean.data.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{a.namaSekolah} · <span className="angka">{a.npsn}</span> · versi {a.versi}</span>
                    <span className="text-muted">diajukan {a.diajukanAt && new Date(a.diajukanAt).toLocaleDateString('id-ID')}</span>
                  </li>
                ))}
              </ul>
            )}
          </Kartu>
        )}

        {daftar.data && !daftar.data.length && (
          <Kartu className="p-6 text-center">
            <p className="font-display text-lg font-bold">Kertas kerja {tahun} belum diaktifkan</p>
            <p className="mt-1 text-sm text-muted">Aktifkan untuk mulai menyusun RKAS sesuai pagu yang ditetapkan.</p>
            {penyusun && <Tombol className="mt-4" memuat={aksi.isPending} onClick={() => jalankan({ jenis: 'aktifkan', b: buku })}>Aktifkan kertas kerja</Tombol>}
          </Kartu>
        )}

        {kk && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Versi">
                {daftar.data?.map((k) => (
                  <button key={k.id} role="tab" aria-selected={k.id === dipilih} onClick={() => setDipilih(k.id)}
                    className={cx('flex items-center gap-2 rounded-ctl border px-3 py-1.5 text-sm', k.id === dipilih ? 'border-primary bg-primary/5 font-semibold' : 'border-line hover:bg-canvas')}>
                    Versi {k.versi}
                    <span className={cx('rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', STATUS[k.status][1])}>{STATUS[k.status][0]}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {bisaUbah && <Tombol varian="sekunder" onClick={() => { aksi.reset(); setLaci({}); }}>+ Tambah baris</Tombol>}
                {peran === 'KEPSEK' && kk.status === 'DRAF' && (
                  <Tombol disabled={!kk.validasi.valid} memuat={aksi.isPending} onClick={() => window.confirm('Ajukan kertas kerja ke Dinas untuk ditelaah?') && jalankan({ jenis: 'ajukan', kk })}>Ajukan ke Dinas</Tombol>
                )}
                {penyusun && kk.status === 'DISAHKAN' && !adaTerbuka && (
                  <Tombol varian="sekunder" memuat={aksi.isPending} onClick={() => jalankan({ jenis: 'perubahan', b: buku })}>Buat pergeseran/perubahan</Tombol>
                )}
                {peran === 'VERIFIKATOR_DINAS' && kk.status === 'DIAJUKAN' && (
                  <>
                    <Tombol varian="bahaya" onClick={() => { const a = window.prompt('Alasan dikembalikan (wajib):')?.trim(); if (a && a.length >= 3) jalankan({ jenis: 'kembalikan', kk, alasan: a }); }}>Kembalikan</Tombol>
                    <Tombol disabled={!kk.validasi.valid} memuat={aksi.isPending} onClick={() => window.confirm('Sahkan kertas kerja ini? RKAS akan dikirim ke penatausahaan sekolah.') && jalankan({ jenis: 'sahkan', kk })}>Sahkan</Tombol>
                  </>
                )}
              </div>
            </div>

            {kk.catatanKembali && kk.status === 'DRAF' && <Spanduk nada="peringatan" judul="Dikembalikan Verifikator Dinas">{kk.catatanKembali}</Spanduk>}
            {galat && <Spanduk nada="bahaya" judul={galat.detail ?? galat.title}>
              {(galat.rincian as { galat?: Array<{ pesan: string }> } | undefined)?.galat?.map((g, i) => <div key={i}>• {g.pesan}</div>) ?? `Kode: ${galat.kode}`}
            </Spanduk>}

            <div className="grid gap-5 lg:grid-cols-3">
              <Kartu className="space-y-4 p-4 lg:col-span-1">
                <div>
                  <p className="text-sm text-muted">Pagu</p>
                  <p className="angka font-display text-xl font-bold">{rupiah(kk.validasi.pagu)}</p>
                  <p className="angka text-sm">Dianggarkan {rupiah(kk.validasi.totalAnggaran)} · <span className={kk.validasi.sisaPagu ? 'text-warning' : 'text-success'}>sisa {rupiah(kk.validasi.sisaPagu)}</span></p>
                </div>
                <div className="space-y-3">
                  {kk.validasi.komponen.filter((k) => k.total > 0 || k.maksPersen != null || k.minPersen != null).map((k) => <ComplianceBar key={k.kode} k={k} />)}
                </div>
                <div className={cx('rounded-ctl p-3 text-sm', kk.validasi.valid ? 'bg-success/10 text-success' : 'bg-warning/10')}>
                  {kk.validasi.valid ? '✓ Memenuhi aturan juknis' : (
                    <>
                      <p className="font-semibold text-warning">Belum dapat diajukan</p>
                      <ul className="mt-1 space-y-0.5 text-ink">{kk.validasi.galat.map((g, i) => <li key={i}>• {g.pesan}</li>)}</ul>
                    </>
                  )}
                </div>
              </Kartu>

              <Kartu className="overflow-hidden lg:col-span-2">
                {!kk.baris.length ? <p className="p-8 text-center text-sm text-muted">Belum ada baris. {bisaUbah && 'Tambahkan baris sesuai komponen BOSP.'}</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
                        <tr><th className="px-3 py-2 font-semibold">Uraian</th><th className="px-3 py-2 font-semibold">Rekening</th><th className="px-3 py-2 text-right font-semibold">Volume</th>
                          <th className="px-3 py-2 text-right font-semibold">Harga</th><th className="px-3 py-2 text-right font-semibold">Total</th><th className="px-3 py-2 text-right font-semibold">Realisasi</th><th className="w-24 px-3 py-2" /></tr>
                      </thead>
                      {kelompok.map(([kegiatan, rows]) => (
                        <tbody key={kegiatan}>
                          <tr className="border-t border-line bg-canvas/60"><td colSpan={7} className="px-3 py-1.5 text-xs font-semibold">{kegiatan}</td></tr>
                          {rows.map((b) => (
                            <tr key={b.id} className="border-t border-line align-top">
                              <td className="px-3 py-2">{b.uraian}
                                {catatanBaris(b.id).map((c) => <p key={c.id} className="mt-1 rounded bg-warning/10 px-2 py-1 text-xs text-warning">Catatan Dinas: {c.catatan}</p>)}
                              </td>
                              <td className="angka px-3 py-2 text-xs text-muted">{b.kodeRekening}</td>
                              <td className="angka whitespace-nowrap px-3 py-2 text-right">{b.volume.toLocaleString('id-ID')} {b.satuan}</td>
                              <td className="angka whitespace-nowrap px-3 py-2 text-right">{rupiah(b.hargaSatuan)}</td>
                              <td className="angka whitespace-nowrap px-3 py-2 text-right font-medium">{rupiah(b.total)}</td>
                              <td className="angka whitespace-nowrap px-3 py-2 text-right text-muted">{b.realisasi ? rupiah(b.realisasi) : '—'}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-right">
                                {bisaUbah && <button className="text-xs text-primary hover:underline" onClick={() => { aksi.reset(); setLaci({ awal: b }); }}>Ubah</button>}
                                {bisaUbah && !b.realisasi && <button className="ml-2 text-xs text-danger hover:underline" onClick={() => window.confirm(`Hapus "${b.uraian}"?`) && jalankan({ jenis: 'hapus', kk, barisId: b.id })}>Hapus</button>}
                                {peran === 'VERIFIKATOR_DINAS' && kk.status === 'DIAJUKAN' && (
                                  <button className="text-xs text-primary hover:underline" onClick={() => { const c = window.prompt('Catatan untuk baris ini:')?.trim(); if (c && c.length >= 3) jalankan({ jenis: 'catatan', kk, catatan: c, barisId: b.id }); }}>Catatan</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      ))}
                    </table>
                  </div>
                )}
              </Kartu>
            </div>

            {kk.riwayat.length > 0 && (
              <Kartu className="p-4">
                <p className="mb-2 text-sm font-semibold">Riwayat</p>
                <ol className="space-y-1 text-sm">
                  {kk.riwayat.map((r, i) => (
                    <li key={i} className="flex flex-wrap gap-2"><span className="angka text-muted">{new Date(r.at).toLocaleString('id-ID')}</span>
                      <span className="font-medium">{r.aksi}</span><span className="text-muted">oleh {r.peran}</span>{r.catatan && <span>— {r.catatan}</span>}</li>
                  ))}
                </ol>
              </Kartu>
            )}
          </>
        )}
      </main>
      <LaciBaris terbuka={!!laci} komponen={komponen} awal={laci?.awal} memuat={aksi.isPending}
        galat={laci && aksi.error instanceof GalatApi ? aksi.error.problem.detail ?? aksi.error.problem.title : undefined}
        onTutup={() => setLaci(null)}
        onSimpan={(v) => kk && jalankan({ jenis: 'baris', kk, input: v, barisId: laci?.awal?.id }, () => setLaci(null))} />
    </div>
  );
}
