import { redirect } from 'next/navigation';

export default function Beranda() {
  redirect(`/sekolah/${process.env.DEV_NPSN ?? '20100001'}/penatausahaan/bku`);
}
