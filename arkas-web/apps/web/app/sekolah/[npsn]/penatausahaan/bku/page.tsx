import { notFound } from 'next/navigation';
import { wajibPeran } from '@/lib/sesi-server';
import { HalamanBku } from './halaman-bku';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: { npsn: string } }) {
  const me = await wajibPeran(`/sekolah/${params.npsn}/penatausahaan/bku`);
  if (me.peranAktif.npsn !== params.npsn) notFound(); // penatausahaan hanya untuk peran sekolah itu sendiri
  const tahun = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric' }).format(new Date()));
  return <HalamanBku npsn={params.npsn} tahun={tahun} me={me} />;
}
