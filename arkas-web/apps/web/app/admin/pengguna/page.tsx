import { notFound } from 'next/navigation';
import { wajibPeran } from '@/lib/sesi-server';
import { HalamanPengguna } from './halaman-pengguna';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const me = await wajibPeran('/admin/pengguna');
  if (!['SUPER_ADMIN', 'ADMIN_DITJEN', 'ADMIN_DIREKTORAT', 'ADMIN_DINAS', 'OPERATOR'].includes(me.peranAktif.peran)) notFound();
  return <HalamanPengguna me={me} />;
}
