import { notFound } from 'next/navigation';
import { wajibPeran } from '@/lib/sesi-server';
import { HalamanPerencanaan } from './halaman-perencanaan';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: { npsn: string } }) {
  const me = await wajibPeran(`/sekolah/${params.npsn}/perencanaan`);
  // peran sekolah hanya sekolahnya; peran Dinas/pusat dibatasi RLS svc-perencanaan per wilayah/cakupan
  if (!/^\d{8}$/.test(params.npsn) || (me.peranAktif.npsn && me.peranAktif.npsn !== params.npsn)) notFound();
  const tahun = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric' }).format(new Date()));
  return <HalamanPerencanaan npsn={params.npsn} tahun={tahun} me={me} />;
}
