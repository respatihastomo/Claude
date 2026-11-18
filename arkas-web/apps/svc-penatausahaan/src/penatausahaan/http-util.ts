import { GalatHttp } from '@arkas/common-ms';

export function wajibIdempotencyKey(v: string | undefined): string {
  if (!v) throw new GalatHttp(428, 'IDEMPOTENCY_KEY_WAJIB', 'Header Idempotency-Key wajib untuk pencatatan transaksi');
  if (!/^[A-Za-z0-9_.:-]{8,80}$/.test(v)) throw new GalatHttp(400, 'IDEMPOTENCY_KEY_TIDAK_VALID', 'Idempotency-Key 8–80 karakter [A-Za-z0-9_.:-]');
  return v;
}

/** If-Match: W/"3" atau "3" -> 3 */
export function wajibIfMatch(v: string | undefined): number {
  if (!v) throw new GalatHttp(428, 'IF_MATCH_WAJIB', 'Header If-Match (ETag transaksi) wajib untuk keputusan');
  const m = /^(?:W\/)?"(\d+)"$/.exec(v.trim());
  if (!m) throw new GalatHttp(400, 'IF_MATCH_TIDAK_VALID', 'Format If-Match tidak dikenali');
  return Number(m[1]);
}

export const etag = (versi: number) => `W/"${versi}"`;
