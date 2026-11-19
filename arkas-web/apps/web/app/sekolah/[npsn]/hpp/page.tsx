import { notFound } from 'next/navigation';
import { wajibPeran } from '@/lib/sesi-server';
import { HalamanHpp } from './halaman-hpp';

export const dynamic = 'force-dynamic';

/** Fitur 20 HPP satu sekolah (svc-pemantauan). Cakupan ditegakkan RLS; pengguna sekolah lain mendapat 403. */
export default async function Page({ params, searchParams }: { params: { npsn: string }; searchParams: { tahun?: string } }) {
  if (!/^\d{8}$/.test(params.npsn)) notFound();
  const me = await wajibPeran(`/sekolah/${params.npsn}/hpp`);
  const tahun = Number(searchParams.tahun) || new Date().getFullYear();
  return <HalamanHpp me={me} npsn={params.npsn} tahun={tahun} />;
}
