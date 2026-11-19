import { notFound } from 'next/navigation';
import { wajibPeran } from '@/lib/sesi-server';
import { HalamanDetailBantuan } from './halaman-detail';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: { kode: string } }) {
  if (!/^[A-Z0-9_]{3,20}$/.test(params.kode)) notFound();
  const me = await wajibPeran(`/bantuan/${params.kode}`);
  if (!['ADMIN_DIREKTORAT', 'ADMIN_DITJEN', 'TIM_KERJA', 'SUPER_ADMIN', 'PEMANTAU', 'AUDITOR'].includes(me.peranAktif.peran)) notFound();
  return <HalamanDetailBantuan me={me} kode={params.kode} />;
}
