import { z } from 'zod';

/** CloudEvents 1.0 (structured mode, JSON). */
export interface CloudEvent<T = unknown> {
  specversion: '1.0';
  id: string;
  source: string;
  type: string;
  subject?: string;
  time: string;
  datacontenttype: 'application/json';
  correlationid?: string;
  traceparent?: string;
  data: T;
}

export const TOPIK = {
  KERTAS_KERJA_DISAHKAN: 'arkas.perencanaan.kk-disahkan',
  TRANSAKSI_DISETUJUI: 'arkas.tatausaha.transaksi-disetujui',
  PERIODE_DITUTUP: 'arkas.tatausaha.periode-ditutup',
} as const;

export const CloudEventSchema = z.object({
  specversion: z.literal('1.0'),
  id: z.string().uuid(),
  source: z.string().min(1),
  type: z.string().min(1),
  subject: z.string().optional(),
  time: z.string(),
  datacontenttype: z.literal('application/json').optional(),
  correlationid: z.string().optional(),
  traceparent: z.string().optional(),
  data: z.unknown(),
});

/** Diterbitkan svc-perencanaan (Kode 9). Snapshot baris yang disahkan. */
export const KertasKerjaDisahkanData = z.object({
  kertasKerjaId: z.string().uuid(),
  npsn: z.string().regex(/^\d{8}$/),
  tahun: z.number().int(),
  sumberDanaKode: z.string(),
  versi: z.number().int().positive(),
  baris: z
    .array(
      z.object({
        id: z.string().uuid(),
        kodeRekening: z.string(),
        kegiatan: z.string(),
        uraian: z.string(),
        volume: z.number(),
        satuan: z.string().nullable().optional(),
        hargaSatuan: z.number(),
        total: z.number().nonnegative(),
        asalBarisId: z.string().uuid().nullable().optional(),
      }),
    )
    .min(1),
});
export type KertasKerjaDisahkanData = z.infer<typeof KertasKerjaDisahkanData>;

/** Diterbitkan svc-penatausahaan; dikonsumsi svc-perencanaan, svc-pemantauan, svc-integrasi. */
export interface TransaksiDisetujuiData {
  transaksiId: string;
  npsn: string;
  tahun: number;
  sumberDanaKode: string;
  jenis: 'PENERIMAAN' | 'TARIK_TUNAI' | 'SETOR_TUNAI' | 'BELANJA' | 'SETOR_PAJAK';
  tanggal: string;
  /** hanya untuk SETOR_PAJAK */
  ntpn?: string | null;
  nilaiBruto: number;
  totalPajak: number;
  disetujuiOleh: string;
  disetujuiAt: string;
  items: Array<{ barisId: string; kodeRekening: string; jumlah: number }>;
  pajak: Array<{ jenis: string; nilai: number }>;
}
