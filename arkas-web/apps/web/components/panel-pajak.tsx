'use client';
import { useEffect, useMemo, useState } from 'react';
import type { PajakDto, RingkasanBukuDto } from '@arkas/kontrak';
import { GalatApi } from '@/lib/api';
import { hariIni, rupiah, tanggal } from '@/lib/format';
import { Buku, kunciIdempoten, useBkpPajak, usePajak, useSetorPajak } from '@/lib/hooks';
import { Laci } from './laci';
import { Bidang, LencanaStatus, Masukan, Spanduk, Tombol, cx } from './ui';

const NAMA: Record<string, string> = { PPN: 'PPN', PPH21: 'PPh 21', PPH23: 'PPh 23', SSPD: 'Pajak daerah (SSPD)' };

/** UC-14 — daftar pajak terutang, pemilihan untuk setor (satu jenis per setoran), dan Buku Kas Pembantu Pajak. */
export function PanelPajak({ buku, peran, ringkasan }: { buku: Buku; peran: 'BENDAHARA' | 'KEPSEK'; ringkasan?: RingkasanBukuDto }) {
  const pajak = usePajak(buku);
  const bkp = useBkpPajak(buku);
  const [pilih, setPilih] = useState<string[]>([]);
  const [laci, setLaci] = useState(false);
  const terutang = (pajak.data ?? []).filter((p) => p.status === 'DIPUNGUT');
  const dipilih = terutang.filter((p) => pilih.includes(p.id));
  const jenisAktif = dipilih[0]?.jenis;
  const total = dipilih.reduce((s, p) => s + p.nilai, 0);
  const bisaPilih = (p: PajakDto) => peran === 'BENDAHARA' && p.statusBelanja === 'DISETUJUI' && (!jenisAktif || p.jenis === jenisAktif);

  return (
    <div className="divide-y divide-line">
      <section className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold">Pajak belum disetor</h3>
            <p className="text-sm text-muted">Pilih pajak sejenis lalu catat setoran dengan NTPN dari bukti penerimaan negara.</p>
          </div>
          {peran === 'BENDAHARA' && (
            <Tombol disabled={!dipilih.length} onClick={() => setLaci(true)}>
              {dipilih.length ? `Catat setor ${NAMA[jenisAktif!]} · ${rupiah(total)}` : 'Catat setor pajak'}
            </Tombol>
          )}
        </div>
        {terutang.length === 0 ? <p className="rounded-ctl bg-canvas p-4 text-center text-sm text-muted">Tidak ada pajak terutang.</p> : (
          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="w-10 px-3 py-2"><span className="sr-only">Pilih</span></th>
                  <th className="px-3 py-2 font-semibold">Jenis</th><th className="px-3 py-2 font-semibold">Belanja</th>
                  <th className="px-3 py-2 font-semibold">Tanggal</th><th className="px-3 py-2 text-right font-semibold">DPP</th>
                  <th className="px-3 py-2 text-right font-semibold">Pajak</th><th className="px-3 py-2 font-semibold">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {terutang.map((p) => {
                  const aktif = bisaPilih(p);
                  return (
                    <tr key={p.id} className={cx('border-t border-line', pilih.includes(p.id) && 'bg-primary/5', !aktif && 'text-muted')}>
                      <td className="px-3 py-2">
                        <input type="checkbox" aria-label={`Pilih ${NAMA[p.jenis]} ${p.noBukti ?? ''}`} className="h-4 w-4 accent-[rgb(var(--primary))]"
                          disabled={!aktif} checked={pilih.includes(p.id)}
                          onChange={(e) => setPilih((x) => (e.target.checked ? [...x, p.id] : x.filter((i) => i !== p.id)))} />
                      </td>
                      <td className="px-3 py-2 font-medium">{NAMA[p.jenis]} <span className="angka text-xs text-muted">{(p.tarif * 100).toLocaleString('id-ID')}%</span></td>
                      <td className="px-3 py-2">{p.noBukti} · {p.namaToko}</td>
                      <td className="angka whitespace-nowrap px-3 py-2">{tanggal(p.tanggalBelanja)}</td>
                      <td className="angka whitespace-nowrap px-3 py-2 text-right">{rupiah(p.dpp)}</td>
                      <td className="angka whitespace-nowrap px-3 py-2 text-right font-semibold">{rupiah(p.nilai)}</td>
                      <td className="px-3 py-2 text-xs">{p.statusBelanja !== 'DISETUJUI' ? 'Belanja menunggu persetujuan' : p.bukuPungut === 'TUNAI' ? 'Dipungut di kas tunai' : 'Dipungut di bank'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="px-4 pb-2 pt-4 font-display text-base font-bold">Buku Kas Pembantu Pajak</h3>
        {!bkp.data?.length ? <p className="p-6 text-center text-sm text-muted">Belum ada pungutan pajak.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Tanggal</th><th className="px-4 py-2.5 font-semibold">Bukti / NTPN</th>
                  <th className="px-4 py-2.5 font-semibold">Uraian</th><th className="px-4 py-2.5 text-right font-semibold">Dipungut</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Disetor</th><th className="px-4 py-2.5 text-right font-semibold">Saldo pajak</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {bkp.data.map((r, i) => (
                  <tr key={`${r.transaksiId}-${i}`} className={cx('border-t border-line', r.status === 'DICATAT' && 'bg-warning/5')}>
                    <td className="angka whitespace-nowrap px-4 py-2.5">{tanggal(r.tanggal)}</td>
                    <td className="angka whitespace-nowrap px-4 py-2.5 text-muted">{r.ntpn ?? r.noBukti ?? '—'}</td>
                    <td className="px-4 py-2.5">{r.uraian}</td>
                    <td className="angka whitespace-nowrap px-4 py-2.5 text-right">{r.penerimaan ? rupiah(r.penerimaan) : ''}</td>
                    <td className="angka whitespace-nowrap px-4 py-2.5 text-right">{r.pengeluaran ? rupiah(r.pengeluaran) : ''}</td>
                    <td className="angka whitespace-nowrap px-4 py-2.5 text-right font-medium">{r.saldo === null ? '—' : rupiah(r.saldo)}</td>
                    <td className="px-4 py-2.5"><LencanaStatus status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <LaciSetor buku={buku} terbuka={laci} dipilih={dipilih} total={total} ringkasan={ringkasan}
        onTutup={() => setLaci(false)} onBerhasil={() => { setLaci(false); setPilih([]); }} />
    </div>
  );
}

function LaciSetor({ buku, terbuka, dipilih, total, ringkasan, onTutup, onBerhasil }: {
  buku: Buku; terbuka: boolean; dipilih: PajakDto[]; total: number; ringkasan?: RingkasanBukuDto; onTutup: () => void; onBerhasil: () => void;
}) {
  const setor = useSetorPajak(buku);
  const [kunci, setKunci] = useState('');
  const [ntpn, setNtpn] = useState('');
  const [tgl, setTgl] = useState(hariIni());
  const [cara, setCara] = useState<'TUNAI' | 'NON_TUNAI'>('NON_TUNAI');
  const minTgl = useMemo(() => dipilih.map((p) => p.tanggalBelanja).sort().at(-1), [dipilih]);
  useEffect(() => {
    if (!terbuka) return;
    setKunci(kunciIdempoten()); setNtpn(''); setTgl(hariIni()); setor.reset();
    setCara(dipilih[0]?.bukuPungut === 'TUNAI' ? 'TUNAI' : 'NON_TUNAI');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terbuka]);
  const bersih = ntpn.replace(/[\s-]/g, '').toUpperCase();
  const ntpnSah = /^[0-9A-Z]{16}$/.test(bersih);
  const tersedia = cara === 'TUNAI' ? ringkasan?.saldoTersedia.tunai ?? 0 : ringkasan?.saldoTersedia.bank ?? 0;
  const galat = setor.error instanceof GalatApi ? setor.error.problem : undefined;

  return (
    <Laci terbuka={terbuka} onTutup={onTutup} judul="Catat setor pajak" lebar="max-w-md"
      kaki={<div className="flex justify-end gap-2"><Tombol varian="sekunder" onClick={onTutup}>Batal</Tombol>
        <Tombol memuat={setor.isPending} disabled={!ntpnSah || total > tersedia || !tgl}
          onClick={() => setor.mutate({ kunci, input: { tahun: buku.tahun, sumberDanaKode: buku.sumberDanaKode, pajakIds: dipilih.map((p) => p.id), ntpn: bersih, tanggalSetor: tgl, caraBayar: cara } }, { onSuccess: onBerhasil })}>
          Simpan setoran
        </Tombol></div>}>
      <div className="space-y-4">
        <div className="rounded-card border border-line bg-canvas p-3">
          <p className="text-xs text-muted">{dipilih[0] ? NAMA[dipilih[0].jenis] : ''} · {dipilih.length} bukti pungut</p>
          <p className="angka font-display text-xl font-bold">{rupiah(total)}</p>
        </div>
        <Bidang label="NTPN" galat={ntpn && !ntpnSah ? `NTPN harus 16 karakter huruf/angka (sekarang ${bersih.length})` : undefined} bantuan="Nomor Transaksi Penerimaan Negara pada bukti setor, 16 karakter.">
          <Masukan className="angka uppercase tracking-widest" value={ntpn} maxLength={24} onChange={(e) => setNtpn(e.target.value)} placeholder="mis. 0A1B2C3D4E5F6A7B" />
        </Bidang>
        <Bidang label="Tanggal setor" bantuan={minTgl ? `Tidak boleh sebelum ${tanggal(minTgl)}` : undefined}>
          <Masukan type="date" value={tgl} min={minTgl} max={hariIni()} onChange={(e) => setTgl(e.target.value)} />
        </Bidang>
        <div>
          <span className="mb-1 block text-sm font-medium">Dibayar dari</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(['NON_TUNAI', 'TUNAI'] as const).map((c) => (
              <button key={c} role="radio" aria-checked={cara === c} onClick={() => setCara(c)}
                className={cx('h-10 rounded-ctl border text-sm font-medium transition-colors', cara === c ? 'border-primary bg-primary/10 text-primary' : 'border-line text-muted hover:bg-canvas')}>
                {c === 'TUNAI' ? 'Kas tunai' : 'Rekening bank'}
              </button>
            ))}
          </div>
          <p className="angka mt-1 text-xs text-muted">Tersedia {rupiah(tersedia)}</p>
        </div>
        {total > tersedia && <Spanduk nada="bahaya" judul="Saldo tidak cukup">Kurang {rupiah(total - tersedia)}.</Spanduk>}
        {galat && <Spanduk nada="bahaya" judul={galat.detail ?? galat.title}>{galat.galat?.map((g) => <div key={g.path}>{g.path}: {g.pesan}</div>)}</Spanduk>}
        <p className="text-xs text-muted">Setoran tersimpan berstatus <b>Menunggu persetujuan</b>. Bila Kepala Sekolah menolak, pajak kembali menjadi terutang.</p>
      </div>
    </Laci>
  );
}
