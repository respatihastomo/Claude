'use client';
import { useEffect, useState } from 'react';
import type { BarisKertasKerjaDto, KomponenDto } from '@arkas/kontrak';
import { rupiah } from '@/lib/format';
import { Laci } from './laci';
import { Bidang, Masukan, Pilihan, Spanduk, Tombol } from './ui';

export interface NilaiBaris { komponenKode: string; kodeRekening: string; uraian: string; volume: number; satuan: string; hargaSatuan: number }

/** UC-04 — laci tambah/ubah baris RKAS. Jadwal kas dibagi rata 12 bulan oleh layanan bila tidak diisi. */
export function LaciBaris({ terbuka, komponen, awal, memuat, galat, onTutup, onSimpan }: {
  terbuka: boolean; komponen: KomponenDto[]; awal?: BarisKertasKerjaDto; memuat: boolean; galat?: string;
  onTutup: () => void; onSimpan: (v: NilaiBaris) => void;
}) {
  const kosong = { komponenKode: komponen[0]?.kode ?? '', kodeRekening: '', uraian: '', volume: '1', satuan: '', hargaSatuan: '' };
  const [f, setF] = useState(kosong);
  useEffect(() => {
    if (terbuka) setF(awal ? { komponenKode: awal.komponenKode, kodeRekening: awal.kodeRekening, uraian: awal.uraian, volume: String(awal.volume), satuan: awal.satuan, hargaSatuan: String(awal.hargaSatuan) } : kosong);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terbuka, awal?.id]);
  const total = Math.round(Number(f.volume || 0) * Number(f.hargaSatuan || 0) * 100) / 100;
  const sah = f.komponenKode && /^\d(\.\d{1,4}){3,6}$/.test(f.kodeRekening) && f.uraian.trim().length >= 3 && Number(f.volume) > 0 && f.satuan.trim() && Number(f.hargaSatuan) > 0;
  const ubah = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Laci terbuka={terbuka} onTutup={onTutup} judul={awal ? 'Ubah baris RKAS' : 'Tambah baris RKAS'} lebar="max-w-lg"
      kaki={<div className="flex justify-end gap-2"><Tombol varian="sekunder" onClick={onTutup}>Batal</Tombol>
        <Tombol disabled={!sah} memuat={memuat} onClick={() => onSimpan({ ...f, volume: Number(f.volume), hargaSatuan: Number(f.hargaSatuan) })}>Simpan baris</Tombol></div>}>
      <div className="space-y-4">
        <Bidang label="Komponen BOSP">
          <Pilihan value={f.komponenKode} onChange={ubah('komponenKode')}>
            {komponen.map((k) => <option key={k.kode} value={k.kode}>{k.kode}. {k.nama}{k.maksPersen != null ? ` (maks ${k.maksPersen}%)` : ''}</option>)}
          </Pilihan>
        </Bidang>
        <Bidang label="Kode rekening" bantuan="mis. 5.1.02.01.01.0024">
          <Masukan className="angka" value={f.kodeRekening} onChange={ubah('kodeRekening')} placeholder="5.1.02.01.01.0024" />
        </Bidang>
        <Bidang label="Uraian"><Masukan value={f.uraian} onChange={ubah('uraian')} /></Bidang>
        <div className="grid grid-cols-3 gap-3">
          <Bidang label="Volume"><Masukan inputMode="decimal" className="angka" value={f.volume} onChange={ubah('volume')} /></Bidang>
          <Bidang label="Satuan"><Masukan value={f.satuan} onChange={ubah('satuan')} placeholder="rim" /></Bidang>
          <Bidang label="Harga satuan"><Masukan inputMode="decimal" className="angka" value={f.hargaSatuan} onChange={ubah('hargaSatuan')} /></Bidang>
        </div>
        <div className="flex justify-between rounded-ctl bg-canvas px-3 py-2 text-sm"><span>Total</span><span className="angka font-semibold">{rupiah(total)}</span></div>
        {awal && awal.realisasi > 0 && <Spanduk nada="info" judul={`Sudah terealisasi ${rupiah(awal.realisasi)}`}>Total baris tidak boleh di bawah realisasinya.</Spanduk>}
        <p className="text-xs text-muted">Jadwal kas dibagi rata ke 12 bulan.</p>
        {galat && <Spanduk nada="bahaya" judul={galat} />}
      </div>
    </Laci>
  );
}
