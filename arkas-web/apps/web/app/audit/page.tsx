import { notFound } from 'next/navigation';
import { wajibPeran } from '@/lib/sesi-server';
import { HalamanAudit } from './halaman-audit';

export const dynamic = 'force-dynamic';

/** UC-31 Memeriksa jejak audit (svc-audit): Auditor & Balai SDSP (nasional), Kepala Sekolah (sekolahnya). */
export default async function Page() {
  const me = await wajibPeran('/audit');
  if (!['AUDITOR', 'SUPER_ADMIN', 'KEPSEK'].includes(me.peranAktif.peran)) notFound();
  return <HalamanAudit me={me} />;
}
