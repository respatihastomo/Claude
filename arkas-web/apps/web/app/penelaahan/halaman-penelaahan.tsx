'use client';
import Link from 'next/link';
import type { MeDto } from '@arkas/kontrak';
import { Kepala } from '@/components/kepala';
import { Kartu } from '@/components/ui';
import { usePenelaahan } from '@/lib/hooks';

/** UC-07 — antrean kertas kerja DIAJUKAN di cakupan penelaah. */
export function HalamanPenelaahan({ me }: { me: MeDto }) {
  const antrean = usePenelaahan(true);
  return (
    <div className="min-h-screen">
      <Kepala judul="Penelaahan Kertas Kerja" me={me} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Kartu>
          {antrean.isLoading ? <p className="p-6 text-sm text-muted">Memuat…</p> : !antrean.data?.length ? (
            <p className="p-6 text-center text-sm text-muted">Tidak ada kertas kerja yang menunggu penelaahan di wilayah Anda.</p>
          ) : (
            <ul className="divide-y divide-line">
              {antrean.data.map((k) => (
                <li key={k.id}>
                  <Link href={`/sekolah/${k.npsn}/perencanaan`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-canvas">
                    <span><span className="font-semibold">{k.namaSekolah}</span> <span className="angka text-sm text-muted">· {k.npsn} · {k.sumberDanaKode} {k.tahun} · versi {k.versi}</span></span>
                    <span className="text-sm text-muted">diajukan {k.diajukanAt && new Date(k.diajukanAt).toLocaleString('id-ID')} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Kartu>
      </main>
    </div>
  );
}
