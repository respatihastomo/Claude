import { notFound } from 'next/navigation';
import { wajibPeran } from '@/lib/sesi-server';
import { HalamanReferensi } from './halaman-referensi';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const me = await wajibPeran('/admin/referensi');
  if (me.peranAktif.peran !== 'SUPER_ADMIN') notFound();
  return <HalamanReferensi me={me} />;
}
