'use client';
import { useState } from 'react';
import { DialogMutasi, JenisMutasi } from '@/components/dialog-mutasi';
import type { MeDto } from '@arkas/kontrak';
import { Kepala } from '@/components/kepala';
import { Ringkasan } from '@/components/ringkasan';
import { TabelBku } from '@/components/tabel-bku';
import { Kartu, Spanduk, Tombol, cx } from '@/components/ui';
import { WizardBelanja } from '@/components/wizard-belanja';
import { PanelPajak } from '@/components/panel-pajak';
import { PanelPenutupan } from '@/components/panel-penutupan';
import { PanelLaporan } from '@/components/panel-laporan';
import { GalatApi } from '@/lib/api';
import { Buku, useBku, usePutuskan, useRingkasan } from '@/lib/hooks';

const TAB = [{ id: undefined, label: 'Buku Kas Umum' }, { id: 'TUNAI', label: 'BKP Tunai' }, { id: 'BANK', label: 'BKP Bank' }, { id: 'PAJAK', label: 'BKP Pajak' }, { id: 'TUTUP', label: 'Penutupan Buku Kas' }, { id: 'LAPORAN', label: 'Laporan' }] as const;

export function HalamanBku({ npsn, tahun, me }: { npsn: string; tahun: number; me: MeDto }) {
  return <IsiBku npsn={npsn} tahun={tahun} me={me} />;
}

function IsiBku({ npsn, tahun, me }: { npsn: string; tahun: number; me: MeDto }) {
  const peran = me.peranAktif!.peran;
  const buku: Buku = { npsn, tahun, sumberDanaKode: 'BOSP_REG' };
  const [tab, setTab] = useState<'TUNAI' | 'BANK' | 'PAJAK' | 'TUTUP' | 'LAPORAN' | undefined>();
  const [wizard, setWizard] = useState(false);
  const [mutasi, setMutasi] = useState<{ jenis: JenisMutasi; nilai?: number } | null>(null);
  const [sibuk, setSibuk] = useState<string>();
  const ringkasan = useRingkasan(buku);
  const bku = useBku(buku, tab === 'TUNAI' || tab === 'BANK' ? tab : undefined);
  const putuskan = usePutuskan(buku);
  const galat = [ringkasan.error, bku.error, putuskan.error].find((e) => e instanceof GalatApi) as GalatApi | undefined;

  function onPutuskan(id: string, aksi: 'setujui' | 'tolak') {
    const alasan = aksi === 'tolak' ? window.prompt('Alasan penolakan (wajib):')?.trim() : undefined;
    if (aksi === 'tolak' && (!alasan || alasan.length < 3)) return;
    if (aksi === 'setujui' && !window.confirm('Setujui transaksi ini? Transaksi yang disetujui tidak dapat diubah.')) return;
    setSibuk(`${id}:${aksi}`);
    putuskan.mutate({ id, aksi, alasan }, { onSettled: () => setSibuk(undefined) });
  }

  return (
    <div className="min-h-screen">
      <Kepala npsn={npsn} judul={`Buku Kas Umum — BOSP Reguler ${tahun}`} me={me} />

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        {ringkasan.data && !ringkasan.data.periodeBerjalan && (
          <Spanduk nada="info" judul="RKAS belum disahkan">Periode buku kas dibuka otomatis setelah kertas kerja BOSP disahkan oleh Verifikator Dinas.</Spanduk>
        )}
        {galat && <Spanduk nada="bahaya" judul={galat.problem.detail ?? galat.problem.title}>Kode: {galat.problem.kode}</Spanduk>}

        <Ringkasan r={ringkasan.data} />

        <Kartu>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex gap-1" role="tablist">
              {TAB.map((t) => (
                <button key={t.label} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                  className={cx('rounded-ctl px-3 py-1.5 text-sm font-medium transition-colors', tab === t.id ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-canvas hover:text-ink')}>
                  {t.label}
                </button>
              ))}
            </div>
            {peran === 'BENDAHARA' && (
              <div className="flex flex-wrap gap-2">
                <Tombol varian="sekunder" onClick={() => setMutasi({ jenis: 'PENERIMAAN' })}>Catat penerimaan</Tombol>
                <Tombol varian="sekunder" onClick={() => setMutasi({ jenis: 'TARIK_TUNAI' })}>Tarik tunai</Tombol>
                <Tombol onClick={() => setWizard(true)} disabled={ringkasan.data?.periodeBerjalan?.status !== 'BUKA'}>+ Catat belanja</Tombol>
              </div>
            )}
            {peran === 'KEPSEK' && !!ringkasan.data?.menungguPersetujuan && (
              <span className="text-sm font-medium text-warning">{ringkasan.data.menungguPersetujuan} transaksi menunggu persetujuan Anda</span>
            )}
          </div>
          {tab === 'LAPORAN' ? <PanelLaporan buku={buku} peran={peran as 'BENDAHARA' | 'KEPSEK'} />
            : tab === 'TUTUP' ? <PanelPenutupan buku={buku} peran={peran as 'BENDAHARA' | 'KEPSEK'} />
            : tab === 'PAJAK' ? <PanelPajak buku={buku} peran={peran as 'BENDAHARA' | 'KEPSEK'} ringkasan={ringkasan.data} />
            : bku.isLoading ? <p className="p-8 text-center text-sm text-muted">Memuat…</p>
            : <TabelBku baris={bku.data ?? []} bolehPutuskan={peran === 'KEPSEK'} onPutuskan={onPutuskan} sibuk={sibuk} />}
        </Kartu>
      </main>

      <WizardBelanja buku={buku} terbuka={wizard} ringkasan={ringkasan.data} onTutup={() => setWizard(false)}
        onTarikTunai={(nilai) => { setWizard(false); setMutasi({ jenis: 'TARIK_TUNAI', nilai }); }} />
      <DialogMutasi buku={buku} jenis={mutasi?.jenis ?? null} nilaiAwal={mutasi?.nilai} onTutup={() => setMutasi(null)} />
    </div>
  );
}
