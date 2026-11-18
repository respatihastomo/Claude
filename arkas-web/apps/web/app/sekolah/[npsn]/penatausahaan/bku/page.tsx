import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { NPSN_DEV, PERAN_DEV, peranDari } from '@/lib/dev-sesi';
import { HalamanBku } from './halaman-bku';

export const dynamic = 'force-dynamic';

export default function Page({ params }: { params: { npsn: string } }) {
  if (params.npsn !== NPSN_DEV) notFound();
  const peran = peranDari(cookies().get('peran')?.value);
  const tahun = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric' }).format(new Date()));
  return <HalamanBku npsn={params.npsn} tahun={tahun} peran={peran} namaPengguna={PERAN_DEV[peran].nama} />;
}
