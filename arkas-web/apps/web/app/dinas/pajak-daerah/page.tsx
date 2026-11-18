import { notFound } from 'next/navigation';
import { wajibPeran } from '@/lib/sesi-server';
import { HalamanPajakDaerah } from './halaman-pajak-daerah';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const me = await wajibPeran('/dinas/pajak-daerah');
  if (me.peranAktif.peran !== 'ADMIN_DINAS') notFound();
  return <HalamanPajakDaerah me={me} />;
}
