import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { MeDto } from '@arkas/kontrak';

export const SVC_IDENTITAS = process.env.SVC_IDENTITAS_URL ?? 'http://localhost:3104';

/** Profil & peran aktif dari svc-identitas memakai cookie sesi pengguna (server component). */
export async function ambilMe(): Promise<MeDto | null> {
  const sesi = cookies().get('arkas_sesi')?.value;
  if (!sesi) return null;
  const r = await fetch(`${SVC_IDENTITAS}/api/v1/me`, { headers: { cookie: `arkas_sesi=${encodeURIComponent(sesi)}` }, cache: 'no-store' });
  return r.ok ? ((await r.json()) as MeDto) : null;
}

/** Wajib masuk & sudah memilih peran aktif; selain itu dialihkan. */
export async function wajibPeran(kembali: string): Promise<MeDto & { peranAktif: NonNullable<MeDto['peranAktif']> }> {
  const me = await ambilMe();
  if (!me) redirect(`/masuk?kembali=${encodeURIComponent(kembali)}`);
  if (!me.peranAktif) redirect(`/pilih-peran?kembali=${encodeURIComponent(kembali)}`);
  return me as MeDto & { peranAktif: NonNullable<MeDto['peranAktif']> };
}

/** Halaman awal sesuai peran aktif. */
export function berandaPeran(p: NonNullable<MeDto['peranAktif']>): string {
  if (p.npsn) return ['BENDAHARA', 'KEPSEK', 'KOMITE'].includes(p.peran) ? `/sekolah/${p.npsn}/penatausahaan/bku` : `/sekolah/${p.npsn}/perencanaan`;
  if (p.peran === 'VERIFIKATOR_DINAS' || p.peran === 'TIM_KERJA') return '/penelaahan';
  if (p.peran === 'AUDITOR') return '/audit';
  if (p.peran === 'PEMANTAU') return '/dasbor';
  if (['ADMIN_DIREKTORAT', 'ADMIN_DITJEN', 'TIM_KERJA'].includes(p.peran)) return '/bantuan';
  return '/admin/pengguna';
}
