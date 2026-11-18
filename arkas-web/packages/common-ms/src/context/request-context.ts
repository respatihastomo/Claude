import type { Peran } from './peran';

/** Konteks permintaan yang diturunkan dari JWT internal + header gateway. Disuntikkan ke sesi PostgreSQL untuk RLS. */
export interface RequestContext {
  penggunaId: string;
  peran: Peran;
  npsn?: string;
  wilayahKode?: string;
  direktoratIds: string[];
  ip: string;
  requestId: string;
  traceparent?: string;
  alasan?: string;
}

/** Konteks pekerja latar (consumer/relay). Pekerja memakai login BYPASSRLS, jadi peran ini hanya untuk jejak. */
export function konteksSistem(requestId: string): RequestContext {
  return { penggunaId: '00000000-0000-0000-0000-000000000000', peran: 'SISTEM', direktoratIds: [], ip: '127.0.0.1', requestId };
}
