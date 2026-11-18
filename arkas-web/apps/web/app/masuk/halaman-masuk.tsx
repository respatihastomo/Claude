'use client';
import { useEffect, useState } from 'react';
import { Kartu, Spanduk, Tombol } from '@/components/ui';

/** Pengguna contoh di basis data dev (db_auth 90_seed_dev.sql). Hanya tampil bila svc-identitas mengizinkan masuk dev. */
const CONTOH = [
  ['bendahara@smpn1.example', 'Sri Wahyuni', 'Bendahara & Operator — SMP Negeri Contoh 1'],
  ['kepsek@smpn1.example', 'Drs. Bambang S.', 'Kepala Sekolah — SMP Negeri Contoh 1'],
  ['verifikator@dinas3201.example', 'Rina A.', 'Verifikator Dinas — wilayah 3201'],
  ['admin@dinas3201.example', 'Hendra P.', 'Admin Dinas — wilayah 3201'],
  ['admin@balai.example', 'Admin Balai SDSP', 'Balai SDSP — nasional'],
] as const;

export function HalamanMasuk({ kembali }: { kembali: string }) {
  const [metode, setMetode] = useState<{ sso: boolean; dev: boolean }>();
  const [galat, setGalat] = useState<string>();
  const [sibuk, setSibuk] = useState<string>();
  useEffect(() => { fetch('/api/v1/auth/metode').then((r) => r.json()).then(setMetode).catch(() => setGalat('Layanan identitas tidak dapat dihubungi')); }, []);

  async function masukDev(email: string) {
    setSibuk(email); setGalat(undefined);
    const r = await fetch('/api/v1/auth/dev-masuk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
    if (r.ok) window.location.assign(kembali);
    else { setGalat((await r.json().catch(() => ({}))).detail ?? 'Gagal masuk'); setSibuk(undefined); }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Kartu className="w-full max-w-md p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">ARKAS Web</p>
        <h1 className="mt-1 font-display text-xl font-bold">Masuk</h1>
        <p className="mt-1 text-sm text-muted">Gunakan akun SSO Anda. Peran dan cakupan data ditentukan oleh pengelola akun.</p>
        {metode?.sso && <a href={`/api/v1/auth/masuk?kembali=${encodeURIComponent(kembali)}`} className="mt-5 flex h-11 w-full items-center justify-center rounded-ctl bg-primary text-sm font-semibold text-primary-ink hover:bg-primary/90">Masuk dengan SSO</a>}
        {metode && !metode.sso && <div className="mt-5"><Spanduk nada="info" judul="SSO belum dikonfigurasi di lingkungan ini">Isi OIDC_ISSUER, OIDC_CLIENT_ID, dan OIDC_REDIRECT_URI pada svc-identitas.</Spanduk></div>}
        {metode?.dev && (
          <div className="mt-6">
            <Spanduk nada="peringatan" judul="Masuk pengembangan (tanpa SSO)">Hanya untuk lingkungan dev. Pilih pengguna contoh:</Spanduk>
            <ul className="mt-3 space-y-2">
              {CONTOH.map(([email, nama, ket]) => (
                <li key={email}>
                  <Tombol varian="sekunder" className="h-auto w-full justify-start py-2 text-left" memuat={sibuk === email} onClick={() => masukDev(email)}>
                    <span><span className="block font-semibold">{nama}</span><span className="block text-xs font-normal text-muted">{ket}</span></span>
                  </Tombol>
                </li>
              ))}
            </ul>
          </div>
        )}
        {galat && <div className="mt-4"><Spanduk nada="bahaya" judul={galat} /></div>}
      </Kartu>
    </main>
  );
}
