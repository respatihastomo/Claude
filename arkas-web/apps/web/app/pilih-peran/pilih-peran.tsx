'use client';
import { useState } from 'react';
import type { MeDto } from '@arkas/kontrak';
import { Kartu, Spanduk } from '@/components/ui';
import { cakupanTeks, LABEL_PERAN } from '@/lib/peran';

/** UC-01 — memilih peran aktif (cakupan data token mengikuti peran ini). */
export function PilihPeran({ me, kembali }: { me: MeDto; kembali: string }) {
  const [galat, setGalat] = useState<string>();
  async function pilih(id: string) {
    const r = await fetch('/api/v1/me/peran-aktif', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ peranPenggunaId: id }) });
    if (r.ok) window.location.assign(kembali); else setGalat((await r.json()).detail);
  }
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Kartu className="w-full max-w-md p-6">
        <h1 className="font-display text-xl font-bold">Halo, {me.nama}</h1>
        <p className="mt-1 text-sm text-muted">Pilih peran yang akan Anda gunakan.</p>
        {!me.peran.length && <div className="mt-4"><Spanduk nada="peringatan" judul="Akun Anda belum memiliki peran aktif">Hubungi admin sekolah atau Dinas.</Spanduk></div>}
        <ul className="mt-4 space-y-2">
          {me.peran.map((p) => (
            <li key={p.id}>
              <button onClick={() => pilih(p.id)} className="w-full rounded-ctl border border-line p-3 text-left hover:border-primary hover:bg-primary/5">
                <span className="block font-semibold">{LABEL_PERAN[p.peran] ?? p.peran}</span>
                <span className="block text-sm text-muted">{cakupanTeks(p)}{p.berlakuSampai && ` · berlaku s.d. ${new Date(p.berlakuSampai).toLocaleDateString('id-ID')}`}</span>
              </button>
            </li>
          ))}
        </ul>
        {galat && <div className="mt-4"><Spanduk nada="bahaya" judul={galat} /></div>}
      </Kartu>
    </main>
  );
}
