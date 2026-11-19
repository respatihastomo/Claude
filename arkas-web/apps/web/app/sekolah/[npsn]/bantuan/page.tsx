import { notFound } from 'next/navigation';
import { wajibPeran } from '@/lib/sesi-server';
import { HalamanBantuanSekolah } from './halaman-bantuan-sekolah';

export const dynamic = 'force-dynamic';

/** Fitur 14 & 15: bantuan pemerintah yang diterima sekolah & pengajuan PKS/RAB/SPTJM (svc-bantuan). */
export default async function Page({ params }: { params: { npsn: string } }) {
  const me = await wajibPeran(`/sekolah/${params.npsn}/bantuan`);
  if (me.peranAktif.npsn !== params.npsn) notFound();
  return <HalamanBantuanSekolah me={me} npsn={params.npsn} />;
}
