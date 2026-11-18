'use client';
import { useEffect, useState } from 'react';
import { GalatApi } from '@/lib/api';
import { hariIni, rupiah } from '@/lib/format';
import { Buku, kunciIdempoten, useCatat } from '@/lib/hooks';
import { Laci } from './laci';
import { Bidang, Masukan, Spanduk, Tombol } from './ui';

export type JenisMutasi = 'PENERIMAAN' | 'TARIK_TUNAI' | 'SETOR_TUNAI';
const JUDUL: Record<JenisMutasi, string> = { PENERIMAAN: 'Catat penerimaan dana', TARIK_TUNAI: 'Catat tarik tunai', SETOR_TUNAI: 'Catat setor tunai ke bank' };
const URAIAN: Record<JenisMutasi, string> = { PENERIMAAN: 'Penerimaan dana BOSP Reguler', TARIK_TUNAI: 'Tarik tunai dari rekening sekolah', SETOR_TUNAI: 'Setor sisa kas tunai ke rekening' };

export function DialogMutasi({ buku, jenis, nilaiAwal, onTutup }: { buku: Buku; jenis: JenisMutasi | null; nilaiAwal?: number; onTutup: () => void }) {
  const catat = useCatat(buku);
  const [kunci, setKunci] = useState('');
  const [f, setF] = useState({ tanggal: hariIni(), nilai: '', uraian: '', noBukti: '' });
  useEffect(() => {
    if (jenis) {
      setKunci(kunciIdempoten());
      setF({ tanggal: hariIni(), nilai: nilaiAwal ? String(Math.ceil(nilaiAwal)) : '', uraian: URAIAN[jenis], noBukti: '' });
      catat.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jenis, nilaiAwal]);
  const galat = catat.error instanceof GalatApi ? catat.error.problem : undefined;

  return (
    <Laci terbuka={!!jenis} onTutup={onTutup} judul={jenis ? JUDUL[jenis] : ''} lebar="max-w-md"
      kaki={<div className="flex justify-end gap-2"><Tombol varian="sekunder" onClick={onTutup}>Batal</Tombol>
        <Tombol memuat={catat.isPending} disabled={!Number(f.nilai)} onClick={() => jenis && catat.mutate(
          { kunci, input: { jenis, tahun: buku.tahun, sumberDanaKode: buku.sumberDanaKode, tanggal: f.tanggal, nilai: Number(f.nilai), uraian: f.uraian, ...(f.noBukti ? { noBukti: f.noBukti } : {}) } },
          { onSuccess: onTutup },
        )}>Simpan</Tombol></div>}>
      <div className="space-y-4">
        <Bidang label="Tanggal"><Masukan type="date" value={f.tanggal} max={hariIni()} onChange={(e) => setF({ ...f, tanggal: e.target.value })} /></Bidang>
        <Bidang label="Nilai (Rp)" bantuan={Number(f.nilai) ? rupiah(Number(f.nilai)) : undefined}>
          <Masukan inputMode="decimal" className="angka" value={f.nilai} onChange={(e) => setF({ ...f, nilai: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" />
        </Bidang>
        <Bidang label="Uraian"><Masukan value={f.uraian} onChange={(e) => setF({ ...f, uraian: e.target.value })} /></Bidang>
        <Bidang label="No. bukti (opsional)"><Masukan value={f.noBukti} onChange={(e) => setF({ ...f, noBukti: e.target.value })} /></Bidang>
        {galat && <Spanduk nada="bahaya" judul={galat.detail ?? galat.title}>{galat.galat?.map((g) => <div key={g.path}>{g.path}: {g.pesan}</div>)}</Spanduk>}
        <p className="text-xs text-muted">Transaksi tersimpan berstatus <b>Menunggu persetujuan</b> dan baru menggerakkan saldo setelah disetujui Kepala Sekolah.</p>
      </div>
    </Laci>
  );
}
