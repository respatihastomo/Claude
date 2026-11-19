import { notFound } from 'next/navigation';
import { wajibPeran } from '@/lib/sesi-server';
import { HalamanMitra } from './halaman-mitra';

export const dynamic = 'force-dynamic';

/** 11.2.17 Integrasi Mitra SIPLah & matriks pembukaan (Balai SDSP; Pemantau membaca). */
export default async function Page() {
  const me = await wajibPeran('/admin/mitra');
  if (!['SUPER_ADMIN', 'PEMANTAU'].includes(me.peranAktif.peran)) notFound();
  return <HalamanMitra me={me} />;
}
