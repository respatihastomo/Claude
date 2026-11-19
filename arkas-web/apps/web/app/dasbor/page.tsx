import { notFound } from 'next/navigation';
import { wajibPeran } from '@/lib/sesi-server';
import { HalamanDasbor } from './halaman-dasbor';

export const dynamic = 'force-dynamic';

/** UC-30 Dasbor pemantauan (svc-pemantauan): pusat nasional, Dinas sebatas wilayahnya. */
export default async function Page() {
  const me = await wajibPeran('/dasbor');
  if (!['PEMANTAU', 'SUPER_ADMIN', 'AUDITOR', 'ADMIN_DINAS', 'VERIFIKATOR_DINAS'].includes(me.peranAktif.peran)) notFound();
  return <HalamanDasbor me={me} />;
}
