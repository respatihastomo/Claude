import { redirect } from 'next/navigation';
import { ambilMe } from '@/lib/sesi-server';
import { PilihPeran } from './pilih-peran';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: { kembali?: string } }) {
  const me = await ambilMe();
  if (!me) redirect('/masuk');
  const k = searchParams.kembali ?? '/';
  return <PilihPeran me={me} kembali={/^\/(?![/\\])/.test(k) ? k : '/'} />;
}
