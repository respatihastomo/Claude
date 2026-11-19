'use client';
import { useEffect, useState } from 'react';
import type { DetailPeriodeDto, PeriodeDto } from '@arkas/kontrak';
import { GalatApi } from '@/lib/api';
import { BULAN, rupiah, tanggal } from '@/lib/format';
import { Buku, useAksiPeriode, useDetailPeriode, usePeriode } from '@/lib/hooks';
import { Bidang, LencanaStatus, Masukan, Spanduk, Tombol, cx } from './ui';

const angka = (s: string) => Number(s.replace(/[^\d.]/g, '') || 0);

/** UC-15 — Penutupan buku kas: daftar periksa, rekonsiliasi rekening koran, hitung kas, berita acara, dan persetujuan Kepala Sekolah. */
export function PanelPenutupan({ buku, peran }: { buku: Buku; peran: 'BENDAHARA' | 'KEPSEK' }) {
  const daftar = usePeriode(buku);
  const [dipilih, setDipilih] = useState<string>();
  useEffect(() => {
    if (!dipilih && daftar.data?.length) setDipilih((daftar.data.find((p) => p.status !== 'DITUTUP') ?? daftar.data.at(-1)!).id);
  }, [daftar.data, dipilih]);
  const detail = useDetailPeriode(buku, dipilih);
  const d = detail.data?.data;

  if (daftar.data && !daftar.data.length) return <p className="p-8 text-center text-sm text-muted">Belum ada periode. Periode dibuka setelah RKAS disahkan.</p>;
  return (
    <div className="space-y-5 p-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Periode">
        {(daftar.data ?? []).map((p: PeriodeDto) => (
          <button key={p.id} role="tab" aria-selected={p.id === dipilih} onClick={() => setDipilih(p.id)}
            className={cx('flex items-center gap-2 rounded-ctl border px-3 py-1.5 text-sm', p.id === dipilih ? 'border-primary bg-primary/5 font-semibold' : 'border-line hover:bg-canvas')}>
            {BULAN[p.bulan - 1]} <LencanaStatus status={p.status} />
          </button>
        ))}
      </div>
      {d && <DetailPeriode buku={buku} peran={peran} d={d} etag={detail.data!.etag ?? ''} />}
    </div>
  );
}

function DetailPeriode({ buku, peran, d, etag }: { buku: Buku; peran: 'BENDAHARA' | 'KEPSEK'; d: DetailPeriodeDto; etag: string }) {
  const aksi = useAksiPeriode(buku);
  const [koran, setKoran] = useState('');
  const [kas, setKas] = useState('');
  const [jelasBank, setJelasBank] = useState('');
  const [jelasKas, setJelasKas] = useState('');
  useEffect(() => {
    setKoran(String(d.rekonsiliasi?.saldoRekeningKoran ?? d.ringkasan.bank.saldoAkhir));
    setKas(String(d.rekonsiliasi?.kasFisik ?? d.ringkasan.tunai.saldoAkhir));
    setJelasBank(d.rekonsiliasi?.penjelasanBank ?? ''); setJelasKas(d.rekonsiliasi?.penjelasanKas ?? ''); aksi.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.id, d.versi]);
  const selisihBank = Math.round((angka(koran) - d.ringkasan.bank.saldoAkhir) * 100) / 100;
  const selisihKas = Math.round((angka(kas) - d.ringkasan.tunai.saldoAkhir) * 100) / 100;
  const galat = aksi.error instanceof GalatApi ? aksi.error.problem : undefined;
  const r = d.ringkasan;
  const namaBulan = `${BULAN[d.bulan - 1]} ${d.tahun}`;
  const bisaAjukan = peran === 'BENDAHARA' && d.status === 'BUKA' && d.kesiapan.siap
    && (selisihBank === 0 || jelasBank.trim().length >= 10) && (selisihKas === 0 || jelasKas.trim().length >= 10);

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold">Buku kas {namaBulan}</h3>
          <LencanaStatus status={d.status} />
        </div>
        {d.alasanKembali && d.status === 'BUKA' && <Spanduk nada="peringatan" judul="Dikembalikan Kepala Sekolah">{d.alasanKembali}</Spanduk>}

        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-3 py-2 font-semibold">Buku</th><th className="px-3 py-2 text-right font-semibold">Saldo awal</th>
                <th className="px-3 py-2 text-right font-semibold">Penerimaan</th><th className="px-3 py-2 text-right font-semibold">Pengeluaran</th>
                <th className="px-3 py-2 text-right font-semibold">Saldo akhir</th></tr>
            </thead>
            <tbody className="angka">
              {([['Kas tunai', r.tunai.saldoAwal, r.tunai.penerimaan, r.tunai.pengeluaran, r.tunai.saldoAkhir],
                ['Bank', r.bank.saldoAwal, r.bank.penerimaan, r.bank.pengeluaran, r.bank.saldoAkhir],
                ['Pajak (BKP)', r.pajak.saldoAwal, r.pajak.dipungut, r.pajak.disetor, r.pajak.saldoAkhir]] as const).map(([n, a, m, k, s]) => (
                <tr key={n} className="border-t border-line">
                  <td className="px-3 py-2 font-sans font-medium">{n}</td><td className="px-3 py-2 text-right">{rupiah(a)}</td>
                  <td className="px-3 py-2 text-right">{rupiah(m)}</td><td className="px-3 py-2 text-right">{rupiah(k)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{rupiah(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-3 py-2 text-xs text-muted">{r.jumlahTransaksi} transaksi disetujui · akhir bulan {tanggal(d.akhirBulan)}{d.status !== 'BUKA' && ' · angka dibekukan saat diajukan'}</p>
        </div>

        {d.status === 'BUKA' && (
          <div className="rounded-card border border-line p-4">
            <p className="mb-2 text-sm font-semibold">Daftar periksa penutupan</p>
            <ul className="space-y-1.5 text-sm">
              {d.kesiapan.syarat.map((s) => (
                <li key={s.kode} className="flex items-start gap-2">
                  <span aria-hidden className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold', s.ok ? 'bg-success text-white' : 'bg-danger/15 text-danger')}>{s.ok ? '✓' : '!'}</span>
                  <span className={s.ok ? '' : 'text-danger'}>{s.pesan}</span>
                </li>
              ))}
              {d.kesiapan.peringatan.map((s) => (
                <li key={s.kode} className="flex items-start gap-2 text-warning">
                  <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-warning/15 text-xs font-bold">i</span>{s.pesan}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4 lg:col-span-2">
        {d.status === 'BUKA' && peran === 'BENDAHARA' && (
          <div className="space-y-4 rounded-card border border-line p-4">
            <p className="font-display text-base font-bold">Rekonsiliasi & hitung kas</p>
            <Bidang label="Saldo rekening koran akhir bulan" bantuan={`Buku bank ${rupiah(r.bank.saldoAkhir)}`}>
              <Masukan inputMode="decimal" className="angka" value={koran} onChange={(e) => setKoran(e.target.value)} />
            </Bidang>
            {selisihBank !== 0 && (
              <Bidang label={`Penjelasan selisih bank (${rupiah(selisihBank)})`} galat={jelasBank.trim().length < 10 ? 'Wajib, minimal 10 karakter' : undefined}>
                <Masukan value={jelasBank} onChange={(e) => setJelasBank(e.target.value)} placeholder="mis. biaya administrasi bank belum dicatat" />
              </Bidang>
            )}
            <Bidang label="Hasil hitung kas fisik" bantuan={`Buku tunai ${rupiah(r.tunai.saldoAkhir)}`}>
              <Masukan inputMode="decimal" className="angka" value={kas} onChange={(e) => setKas(e.target.value)} />
            </Bidang>
            {selisihKas !== 0 && (
              <Bidang label={`Penjelasan selisih kas (${rupiah(selisihKas)})`} galat={jelasKas.trim().length < 10 ? 'Wajib, minimal 10 karakter' : undefined}>
                <Masukan value={jelasKas} onChange={(e) => setJelasKas(e.target.value)} />
              </Bidang>
            )}
            <Tombol className="w-full" disabled={!bisaAjukan} memuat={aksi.isPending}
              onClick={() => aksi.mutate({ id: d.id, aksi: 'ajukan-tutup', etag, body: {
                saldoRekeningKoran: angka(koran), kasFisik: angka(kas), ...(selisihBank ? { penjelasanBank: jelasBank } : {}), ...(selisihKas ? { penjelasanKas: jelasKas } : {}),
              } })}>Ajukan penutupan {namaBulan}</Tombol>
            <p className="text-xs text-muted">Setelah diajukan, transaksi bulan ini dikunci sampai Kepala Sekolah memutuskan.</p>
          </div>
        )}
        {d.status === 'BUKA' && peran === 'KEPSEK' && <Spanduk nada="info" judul="Belum diajukan">Bendahara belum mengajukan penutupan buku bulan ini.</Spanduk>}

        {d.rekonsiliasi && d.status !== 'BUKA' && (
          <div className="rounded-card border border-line p-4">
            <p className="font-display text-base font-bold">Berita acara pemeriksaan kas</p>
            <p className="mb-3 text-xs text-muted">Diajukan {d.diajukanAt ? new Date(d.diajukanAt).toLocaleString('id-ID') : '—'}{d.ditutupAt && ` · ditutup ${new Date(d.ditutupAt).toLocaleString('id-ID')}`}</p>
            <dl className="angka grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <dt className="font-sans text-muted">Saldo buku bank</dt><dd className="text-right">{rupiah(d.rekonsiliasi.saldoBukuBank)}</dd>
              <dt className="font-sans text-muted">Rekening koran</dt><dd className="text-right">{rupiah(d.rekonsiliasi.saldoRekeningKoran)}</dd>
              <dt className="font-sans text-muted">Selisih bank</dt><dd className={cx('text-right font-semibold', d.rekonsiliasi.selisihBank ? 'text-warning' : 'text-success')}>{rupiah(d.rekonsiliasi.selisihBank)}</dd>
              <dt className="font-sans text-muted">Saldo buku tunai</dt><dd className="text-right">{rupiah(d.rekonsiliasi.saldoBukuTunai)}</dd>
              <dt className="font-sans text-muted">Kas fisik</dt><dd className="text-right">{rupiah(d.rekonsiliasi.kasFisik)}</dd>
              <dt className="font-sans text-muted">Selisih kas</dt><dd className={cx('text-right font-semibold', d.rekonsiliasi.selisihKas ? 'text-warning' : 'text-success')}>{rupiah(d.rekonsiliasi.selisihKas)}</dd>
            </dl>
            {d.rekonsiliasi.penjelasanBank && <p className="mt-2 text-sm"><b>Penjelasan bank:</b> {d.rekonsiliasi.penjelasanBank}</p>}
            {d.rekonsiliasi.penjelasanKas && <p className="mt-1 text-sm"><b>Penjelasan kas:</b> {d.rekonsiliasi.penjelasanKas}</p>}
            {d.status === 'DIAJUKAN' && peran === 'KEPSEK' && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Tombol memuat={aksi.isPending && aksi.variables?.aksi === 'setujui'}
                  onClick={() => window.confirm(`Setujui berita acara dan tutup buku ${namaBulan}? Periode akan dikunci permanen.`) && aksi.mutate({ id: d.id, aksi: 'setujui', etag })}>Setujui & tutup buku</Tombol>
                <Tombol varian="bahaya" onClick={() => { const a = window.prompt('Alasan dikembalikan (wajib):')?.trim(); if (a && a.length >= 3) aksi.mutate({ id: d.id, aksi: 'kembalikan', etag, body: { alasan: a } }); }}>Kembalikan</Tombol>
              </div>
            )}
            {d.status === 'DIAJUKAN' && peran === 'BENDAHARA' && <p className="mt-3 text-sm text-warning">Menunggu persetujuan Kepala Sekolah.</p>}
            {d.status === 'DITUTUP' && <p className="mt-3 text-sm text-success">Buku {namaBulan} sudah ditutup dan terkunci. Laporan bulanan diproses svc-pelaporan.</p>}
          </div>
        )}
        {galat && <Spanduk nada="bahaya" judul={galat.detail ?? galat.title}>Kode: {galat.kode}</Spanduk>}
      </div>
    </div>
  );
}
