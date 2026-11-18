import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AturanError } from '@arkas/aturan';
import { GalatHttp } from '../http/problem.filter';
import type { Broker } from './broker';
import type { CloudEvent } from './cloud-event';

export const MasukanEventInternal = z.object({
  topik: z.string().min(3).max(80),
  event: z.object({
    specversion: z.literal('1.0'), id: z.string().uuid(), source: z.string().min(1), type: z.string().min(1),
    subject: z.string().optional(), time: z.string(), datacontenttype: z.literal('application/json').optional(),
    correlationid: z.string().optional(), traceparent: z.string().optional(), data: z.unknown(),
  }),
});
export type MasukanEventInternal = z.infer<typeof MasukanEventInternal>;

/**
 * Logika endpoint internal `/internal/v1/events` (dipakai controller tiap layanan, HANYA dev):
 * verifikasi token (waktu konstan), lalu serahkan ke pelanggan lokal. Galat penangan -> 422 agar pengirim mencoba ulang.
 */
export async function terimaEventInternal(broker: Broker, tokenHarap: string | undefined, tokenDapat: string | undefined, m: MasukanEventInternal) {
  const a = Buffer.from(tokenHarap ?? '');
  const b = Buffer.from(tokenDapat ?? '');
  if (a.length === 0 || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new GalatHttp(401, 'TOKEN_INTERNAL_TIDAK_VALID', 'X-Internal-Token tidak valid');
  }
  const event = { datacontenttype: 'application/json', ...m.event } as CloudEvent;
  try {
    if (broker.serahkanLokal) await broker.serahkanLokal(m.topik, event);
    else await broker.publish(m.topik, event);
  } catch (e) {
    if (e instanceof GalatHttp) throw e;
    throw new GalatHttp(422, e instanceof AturanError ? e.kode : 'EVENT_GAGAL_DIPROSES', e instanceof Error ? e.message : String(e));
  }
  return { diterima: true, id: m.event.id };
}
