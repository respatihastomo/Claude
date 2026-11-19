import type { Problem } from '@arkas/kontrak';
import { GalatApi } from './api';

/** Unggah berkas sebagai body biner (PDF/XLSX), bukan multipart. Jenis isi dicek ulang di server lewat tanda tangan berkas. */
export async function unggahBerkas<T>(path: string, berkas: File, query: Record<string, string | number | undefined> = {}): Promise<T> {
  const q = new URLSearchParams(Object.entries({ nama: berkas.name, ...query }).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
  const jenis = berkas.name.toLowerCase().endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf';
  const res = await fetch(`/api/v1${path}?${q}`, { method: 'POST', headers: { 'content-type': jenis }, body: berkas });
  const isi = await res.json().catch(() => null);
  if (!res.ok) throw new GalatApi(res.status, (isi ?? { type: 'about:blank', title: res.statusText, status: res.status, kode: 'GALAT' }) as Problem);
  return isi as T;
}
