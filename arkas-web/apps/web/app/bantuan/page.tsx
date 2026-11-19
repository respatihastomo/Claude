import { notFound } from 'next/navigation';
import { wajibPeran } from '@/lib/sesi-server';
import { HalamanDaftarBantuan } from './halaman-daftar';

export const dynamic = 'force-dynamic';
const PERAN_PUSAT_BANTUAN = ['ADMIN_DIREKTORAT', 'ADMIN_DITJEN', 'TIM_KERJA', 'SUPER_ADMIN', 'PEMANTAU', 'AUDITOR'];

/** Fitur 17–19: sumber dana Bantuan Pemerintah (svc-bantuan). */
export default async function Page() {
  const me = await wajibPeran('/bantuan');
  if (!PERAN_PUSAT_BANTUAN.includes(me.peranAktif.peran)) notFound();
  return <HalamanDaftarBantuan me={me} />;
}
