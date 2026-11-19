import { notFound } from 'next/navigation';
import { wajibPeran } from '@/lib/sesi-server';
import { HalamanPenelaahan } from './halaman-penelaahan';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const me = await wajibPeran('/penelaahan');
  if (!['VERIFIKATOR_DINAS', 'TIM_KERJA'].includes(me.peranAktif.peran)) notFound();
  return <HalamanPenelaahan me={me} />;
}
