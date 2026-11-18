import { redirect } from 'next/navigation';
import { berandaPeran, wajibPeran } from '@/lib/sesi-server';

export const dynamic = 'force-dynamic';

export default async function Beranda() {
  const me = await wajibPeran('/');
  redirect(berandaPeran(me.peranAktif));
}
