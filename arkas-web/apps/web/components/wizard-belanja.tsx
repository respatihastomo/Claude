'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BarisRkasDto, RingkasanBukuDto } from '@arkas/kontrak';
import { api, GalatApi } from '@/lib/api';
import { hariIni, rupiah } from '@/lib/format';
import { Buku, kunciIdempoten, useCatat, useRkas } from '@/lib/hooks';
import { Laci } from './laci';
import { BilahSisa, Bidang, Masukan, Spanduk, Tombol, cx } from './ui';

interface Item { barisId: string; uraian: string; volume: string; satuan: string; hargaSatuan: string }
interface HasilPajak { nilaiBruto: number; totalPajak: number; nilaiNetto: number; pajak: Array<{ jenis: string; tarif: number; dpp: number; nilai: number }> }
const LANGKAH = ['Detail & saldo', 'Pilih dari RKAS', 'Pajak & simpan'];
const NAMA_PAJAK: Record<string, string> = { PPN: 'PPN', PPH21: 'PPh 21', PPH23: 'PPh 23', SSPD: 'Pajak daerah (SSPD)' };
const jumlahItem = (i: Item) => Math.round(Number(i.volume || 0) * Number(i.hargaSatuan || 0) * 100) / 100;

/** UC-11 — Laci Wizard 3 Langkah (5.2.3). */
export function WizardBelanja({ buku, terbuka, ringkasan, onTutup, onTarikTunai }: {
  buku: Buku; terbuka: boolean; ringkasan?: RingkasanBukuDto; onTutup: () => void; onTarikTunai: (nilai: number) => void;
}) {
  const [langkah, setLangkah] = useState(0);
  const [kunci, setKunci] = useState('');
  const [d, setD] = useState({ tanggal: hariIni(), caraBayar: 'NON_TUNAI' as 'TUNAI' | 'NON_TUNAI', noBukti: '', namaToko: '', penjualPunyaNpwp: true, uraian: '' });
  const [items, setItems] = useState<Item[]>([]);
  const [cari, setCari] = useState('');
  const rkas = useRkas(buku, terbuka);
  const catat = useCatat(buku);

  useEffect(() => {
    if (terbuka) {
      setLangkah(0); setKunci(kunciIdempoten()); setItems([]); setCari(''); catat.reset();
      setD({ tanggal: hariIni(), caraBayar: 'NON_TUNAI', noBukti: '', namaToko: '', penjualPunyaNpwp: true, uraian: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terbuka]);

  const petaRkas = useMemo(() => new Map((rkas.data ?? []).map((b) => [b.barisId, b])), [rkas.data]);
  const itemSah = items.filter((i) => jumlahItem(i) > 0);
  const bruto = itemSah.reduce((s, i) => s + jumlahItem(i), 0);

  const sim = useQuery({
    queryKey: ['simulasi-pajak', buku, d.penjualPunyaNpwp, itemSah.map((i) => [i.barisId, i.volume, i.hargaSatuan])],
    enabled: terbuka && itemSah.length > 0,
    queryFn: async () => (await api<HasilPajak>(`/sekolah/${buku.npsn}/bku/simulasi-pajak`, { method: 'POST', json: {
      tahun: buku.tahun, sumberDanaKode: buku.sumberDanaKode, penjualPunyaNpwp: d.penjualPunyaNpwp,
      items: itemSah.map((i) => ({ barisId: i.barisId, volume: Number(i.volume), hargaSatuan: Number(i.hargaSatuan) })),
    } })).data,
  });

  const netto = sim.data?.nilaiNetto ?? bruto;
  const tersedia = d.caraBayar === 'TUNAI' ? ringkasan?.saldoTersedia.tunai ?? 0 : ringkasan?.saldoTersedia.bank ?? 0;
  const kurang = netto > tersedia ? netto - tersedia : 0;

  const lebihAnggaran = itemSah.filter((i) => {
    const b = petaRkas.get(i.barisId);
    const total = itemSah.filter((x) => x.barisId === i.barisId).reduce((s, x) => s + jumlahItem(x), 0);
    return b ? total > b.sisa : false;
  });
  const bolehLanjut = [
    !!d.tanggal && d.noBukti.trim().length > 0 && d.namaToko.trim().length > 0 && d.uraian.trim().length >= 3,
    itemSah.length > 0 && itemSah.length === items.length && lebihAnggaran.length === 0,
    !kurang && !sim.isFetching && !sim.error,
  ];

  const tambah = (b: BarisRkasDto) => setItems((x) => [...x, { barisId: b.barisId, uraian: b.uraian, volume: '1', satuan: b.satuan ?? '', hargaSatuan: String(b.hargaSatuan) }]);
  const ubah = (idx: number, p: Partial<Item>) => setItems((x) => x.map((it, i) => (i === idx ? { ...it, ...p } : it)));
  const simpan = () => catat.mutate({ kunci, input: {
    jenis: 'BELANJA', tahun: buku.tahun, sumberDanaKode: buku.sumberDanaKode, tanggal: d.tanggal, caraBayar: d.caraBayar,
    noBukti: d.noBukti.trim(), namaToko: d.namaToko.trim(), penjualPunyaNpwp: d.penjualPunyaNpwp, uraian: d.uraian.trim(),
    items: itemSah.map((i) => ({ barisId: i.barisId, uraian: i.uraian, volume: Number(i.volume), hargaSatuan: Number(i.hargaSatuan), ...(i.satuan ? { satuan: i.satuan } : {}) })),
  } }, { onSuccess: onTutup });
  const galat = catat.error instanceof GalatApi ? catat.error.problem : sim.error instanceof GalatApi ? sim.error.problem : undefined;
  const daftarRkas = (rkas.data ?? []).filter((b) => !cari || `${b.kegiatan} ${b.kodeRekening} ${b.uraian}`.toLowerCase().includes(cari.toLowerCase()));

  return (
    <Laci terbuka={terbuka} onTutup={onTutup} judul="Catat belanja"
      kaki={
        <div className="flex items-center justify-between gap-3">
          <Tombol varian="hantu" onClick={() => (langkah ? setLangkah(langkah - 1) : onTutup())}>{langkah ? '← Kembali' : 'Batal'}</Tombol>
          {langkah < 2
            ? <Tombol disabled={!bolehLanjut[langkah]} onClick={() => setLangkah(langkah + 1)}>Lanjut →</Tombol>
            : <Tombol disabled={!bolehLanjut[2]} memuat={catat.isPending} onClick={simpan}>Simpan belanja</Tombol>}
        </div>
      }>
      <ol className="mb-5 grid grid-cols-3 gap-2" aria-label="Langkah">
        {LANGKAH.map((l, i) => (
          <li key={l} className="flex items-center gap-2">
            <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors duration-200',
              i < langkah ? 'bg-success text-white' : i === langkah ? 'bg-primary text-primary-ink' : 'bg-canvas text-muted')} aria-current={i === langkah ? 'step' : undefined}>
              {i < langkah ? '✓' : i + 1}
            </span>
            <span className={cx('text-xs sm:text-sm', i === langkah ? 'font-semibold text-ink' : 'text-muted')}>{l}</span>
          </li>
        ))}
      </ol>

      <div className="mb-5 grid grid-cols-2 gap-3 rounded-card border border-line bg-canvas p-3">
        <div>
          <p className="text-xs text-muted">Saldo {d.caraBayar === 'TUNAI' ? 'tunai' : 'bank'} tersedia</p>
          <p className="angka font-display text-lg font-bold">{rupiah(tersedia)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Setelah belanja ini</p>
          <p className={cx('angka font-display text-lg font-bold', kurang ? 'text-danger' : 'text-ink')}>{rupiah(tersedia - netto)}</p>
        </div>
      </div>
      {kurang > 0 && d.caraBayar === 'TUNAI' && (
        <div className="mb-5">
          <Spanduk nada="peringatan" judul="Saldo tunai belum cukup" aksi={<Tombol varian="sekunder" className="h-9" onClick={() => onTarikTunai(kurang)}>Catat tarik tunai lebih dulu</Tombol>}>
            Kurang {rupiah(kurang)}. Catat tarik tunai, minta persetujuan Kepala Sekolah, lalu lanjutkan belanja ini.
          </Spanduk>
        </div>
      )}
      {kurang > 0 && d.caraBayar === 'NON_TUNAI' && <div className="mb-5"><Spanduk nada="bahaya" judul="Saldo bank tidak cukup">Kurang {rupiah(kurang)}.</Spanduk></div>}

      {langkah === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Bidang label="Tanggal transaksi"><Masukan type="date" value={d.tanggal} max={hariIni()} onChange={(e) => setD({ ...d, tanggal: e.target.value })} /></Bidang>
          <div>
            <span className="mb-1 block text-sm font-medium">Cara bayar</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {(['NON_TUNAI', 'TUNAI'] as const).map((c) => (
                <button key={c} role="radio" aria-checked={d.caraBayar === c} onClick={() => setD({ ...d, caraBayar: c })}
                  className={cx('h-10 rounded-ctl border text-sm font-medium transition-colors', d.caraBayar === c ? 'border-primary bg-primary/10 text-primary' : 'border-line text-muted hover:bg-canvas')}>
                  {c === 'TUNAI' ? 'Tunai' : 'Non-tunai (bank)'}
                </button>
              ))}
            </div>
          </div>
          <Bidang label="No. bukti / nota"><Masukan value={d.noBukti} onChange={(e) => setD({ ...d, noBukti: e.target.value })} placeholder="mis. NOTA-0012" /></Bidang>
          <Bidang label="Nama toko / penyedia"><Masukan value={d.namaToko} onChange={(e) => setD({ ...d, namaToko: e.target.value })} /></Bidang>
          <div className="sm:col-span-2"><Bidang label="Uraian belanja"><Masukan value={d.uraian} onChange={(e) => setD({ ...d, uraian: e.target.value })} placeholder="mis. Belanja ATK untuk ujian semester" /></Bidang></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--primary))]" checked={d.penjualPunyaNpwp} onChange={(e) => setD({ ...d, penjualPunyaNpwp: e.target.checked })} />
            Penyedia memiliki NPWP <span className="text-muted">(tanpa NPWP tarif PPh lebih tinggi)</span>
          </label>
        </div>
      )}

      {langkah === 1 && (
        <div className="space-y-4">
          {items.length > 0 && (
            <div className="space-y-3">
              {items.map((it, idx) => {
                const b = petaRkas.get(it.barisId);
                const lebih = lebihAnggaran.some((x) => x.barisId === it.barisId);
                return (
                  <div key={idx} className={cx('rounded-card border p-3', lebih ? 'border-danger/50 bg-danger/5' : 'border-line')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{b?.uraian}</p>
                        <p className="angka text-xs text-muted">{b?.kodeRekening} · sisa {b ? rupiah(b.sisa) : '—'}</p>
                      </div>
                      <button className="text-xs text-muted hover:text-danger" onClick={() => setItems((x) => x.filter((_, i) => i !== idx))}>Hapus</button>
                    </div>
                    <div className="mt-2 grid grid-cols-6 gap-2">
                      <div className="col-span-6 sm:col-span-3"><Masukan aria-label="Uraian item" value={it.uraian} onChange={(e) => ubah(idx, { uraian: e.target.value })} /></div>
                      <div className="col-span-2 sm:col-span-1"><Masukan aria-label="Volume" inputMode="decimal" className="angka" value={it.volume} onChange={(e) => ubah(idx, { volume: e.target.value.replace(/[^\d.]/g, '') })} /></div>
                      <div className="col-span-4 sm:col-span-2"><Masukan aria-label="Harga satuan" inputMode="decimal" className="angka" value={it.hargaSatuan} onChange={(e) => ubah(idx, { hargaSatuan: e.target.value.replace(/[^\d.]/g, '') })} /></div>
                    </div>
                    <p className={cx('angka mt-2 text-right text-sm font-semibold', lebih && 'text-danger')}>{rupiah(jumlahItem(it))}{lebih && ' — melebihi sisa anggaran'}</p>
                  </div>
                );
              })}
              <p className="angka text-right text-sm">Total bruto <b>{rupiah(bruto)}</b></p>
            </div>
          )}
          <div>
            <Masukan placeholder="Cari kegiatan, kode rekening, atau uraian RKAS…" value={cari} onChange={(e) => setCari(e.target.value)} />
            <ul className="mt-2 divide-y divide-line rounded-card border border-line">
              {rkas.isLoading && <li className="p-3 text-sm text-muted">Memuat RKAS…</li>}
              {daftarRkas.map((b) => (
                <li key={b.barisId}>
                  <button onClick={() => tambah(b)} disabled={b.sisa <= 0} className="w-full p-3 text-left transition-colors hover:bg-canvas disabled:opacity-50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{b.uraian}</p>
                        <p className="truncate text-xs text-muted">{b.kegiatan} · <span className="angka">{b.kodeRekening}</span>{b.pajak.length > 0 && ` · ${b.pajak.map((p) => NAMA_PAJAK[p]).join(', ')}`}</p>
                      </div>
                      <span className="angka shrink-0 rounded-full bg-canvas px-2 py-0.5 text-xs font-medium">sisa {rupiah(b.sisa)}</span>
                    </div>
                    <div className="mt-2"><BilahSisa terpakai={b.realisasi} anggaran={b.anggaran} /></div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {langkah === 2 && (
        <div className="space-y-4">
          <div className="rounded-card border border-line">
            <div className="flex justify-between border-b border-line px-4 py-3 text-sm"><span>Nilai bruto</span><span className="angka font-semibold">{rupiah(sim.data?.nilaiBruto ?? bruto)}</span></div>
            {sim.isFetching && <p className="px-4 py-3 text-sm text-muted">Menghitung pajak…</p>}
            {sim.data?.pajak.length === 0 && <p className="px-4 py-3 text-sm text-muted">Rekening ini tidak dikenai pajak.</p>}
            {sim.data?.pajak.map((p) => (
              <div key={`${p.jenis}-${p.tarif}`} className="flex justify-between px-4 py-2 text-sm">
                <span>{NAMA_PAJAK[p.jenis]} <span className="angka text-muted">{(p.tarif * 100).toLocaleString('id-ID')}% × DPP {rupiah(p.dpp)}</span></span>
                <span className="angka text-danger">− {rupiah(p.nilai)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-line bg-canvas px-4 py-3 text-sm font-semibold"><span>Dibayar ke penyedia</span><span className="angka">{rupiah(netto)}</span></div>
          </div>
          <p className="text-xs text-muted">Pajak yang dipungut dicatat di BKU sebagai penerimaan pajak dan wajib disetor (BKP Pajak, irisan berikutnya). Unggah foto nota menyusul pada irisan berikutnya.</p>
        </div>
      )}

      {galat && <div className="mt-5"><Spanduk nada="bahaya" judul={galat.detail ?? galat.title}>{galat.galat?.map((g) => <div key={g.path}>{g.path}: {g.pesan}</div>)}</Spanduk></div>}
    </Laci>
  );
}
