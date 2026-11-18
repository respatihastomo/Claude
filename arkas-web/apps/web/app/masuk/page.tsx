import { HalamanMasuk } from './halaman-masuk';

export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: { kembali?: string } }) {
  const k = searchParams.kembali ?? '/';
  return <HalamanMasuk kembali={/^\/(?![/\\])/.test(k) ? k : '/'} />;
}
