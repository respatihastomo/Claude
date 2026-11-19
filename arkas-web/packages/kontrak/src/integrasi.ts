import { z } from 'zod';
import { Npsn, Rupiah, SumberDanaKode, Tahun, Tanggal } from './umum';

// ---------- API Mitra SIPLah di ARKAS Web (/mitra/v1, 11.2.18) ----------
export const TokenMitraInput = z.object({ grant_type: z.literal('client_credentials'), client_id: z.string().min(3).max(60), client_secret: z.string().min(8).max(200) });

const ItemMitra = z.object({
  itemId: z.string().trim().min(1).max(60),
  /** ID baris RKAS dari /anggaran bila Mitra menyimpannya di keranjang; null = dipetakan kemudian oleh Bendahara */
  barisId: z.string().uuid().nullable().default(null),
  kodeRekening: z.string().regex(/^\d(\.\d{1,4}){3,6}$/),
  uraian: z.string().trim().min(1).max(300),
  volume: z.number().positive().max(1_000_000),
  satuan: z.string().trim().max(30).nullable().default(null),
  hargaSatuan: Rupiah,
});
export const TransaksiMitraInput = z.object({
  transactionId: z.string().trim().min(3).max(60),
  npsn: Npsn, tahun: Tahun, sumberDanaKode: SumberDanaKode, tanggal: Tanggal,
  namaToko: z.string().trim().min(1).max(150),
  penjualPunyaNpwp: z.boolean(),
  items: z.array(ItemMitra).min(1).max(100),
}).refine((t) => new Set(t.items.map((i) => i.itemId)).size === t.items.length, { message: 'itemId harus unik', path: ['items'] });
export type TransaksiMitraInput = z.infer<typeof TransaksiMitraInput>;

export const StatusTransaksiMitraInput = z.object({ status: z.enum(['DIBATALKAN', 'RETUR']), alasan: z.string().trim().min(3).max(500) });
export const ValidasiKeranjangInput = z.object({
  npsn: Npsn, tahun: Tahun, sumberDanaKode: SumberDanaKode,
  items: z.array(z.object({ itemId: z.string().min(1).max(60), barisId: z.string().uuid().nullable().default(null), kodeRekening: z.string(), jumlah: Rupiah })).min(1).max(100),
});
export type ValidasiKeranjangInput = z.infer<typeof ValidasiKeranjangInput>;
export const KonfirmasiPembukaanInput = z.object({ status: z.enum(['DIBUKA', 'GAGAL']), versi: z.number().int().positive(), catatan: z.string().max(500).optional() });

// ---------- API pengelolaan (Balai SDSP, 11.2.17) ----------
export const DaftarMitraInput = z.object({
  kode: z.string().regex(/^[A-Z0-9_]{3,20}$/, 'Kode Mitra: 3–20 huruf kapital/angka/garis bawah'),
  nama: z.string().trim().min(3).max(150),
  baseUrl: z.string().url().regex(/^https?:\/\//),
  ipDiizinkan: z.array(z.string().ip()).min(1).max(20),
});
export type DaftarMitraInput = z.infer<typeof DaftarMitraInput>;
export const UbahMitraInput = z.object({ nama: z.string().trim().min(3).max(150).optional(), baseUrl: z.string().url().optional(), ipDiizinkan: z.array(z.string().ip()).min(1).max(20).optional(), status: z.enum(['AKTIF', 'NONAKTIF']).optional() });

// ---------- Event (Tabel 8.3) ----------
export interface ItemTransaksiMitra { itemId: string; barisId: string | null; kodeRekening: string; uraian: string; volume: number; satuan: string | null; hargaSatuan: number; jumlah: number }
/** svc-integrasi -> svc-penatausahaan (antrean pemetaan BKU), svc-pemantauan (HPP). */
export interface TransaksiMitraDiterimaData {
  transaksiMitraId: string; mitraKode: string; transactionId: string; npsn: string; tahun: number; sumberDanaKode: string;
  tanggal: string; namaToko: string; penjualPunyaNpwp: boolean; total: number; items: ItemTransaksiMitra[]; diterimaAt: string;
}
/** Kompensasi: pesanan dibatalkan/diretur di Mitra -> penatausahaan menandai koreksi, pemantauan mengurangi belanja. */
export interface TransaksiMitraDibatalkanData {
  transaksiMitraId: string; mitraKode: string; transactionId: string; npsn: string; tahun: number; sumberDanaKode: string;
  status: 'DIBATALKAN' | 'RETUR'; alasan: string; at: string;
}
/** svc-integrasi -> svc-pemantauan: matriks pembukaan; alarm bila GAGAL. */
export interface PembukaanDikonfirmasiData { sumberDanaKode: string; mitraKode: string; versi: number; status: 'DIBUKA' | 'GAGAL'; at: string }

// ---------- Penatausahaan: antrean transaksi Mitra (UC-12) ----------
export interface TransaksiMitraMasukDto {
  id: string; mitraKode: string; transactionId: string; tahun: number; sumberDanaKode: string; tanggal: string; namaToko: string;
  penjualPunyaNpwp: boolean; total: number; items: ItemTransaksiMitra[];
  status: 'MENUNGGU' | 'DICATAT' | 'DIBATALKAN'; statusMitra: 'DITERIMA' | 'DIBATALKAN' | 'RETUR'; alasanBatal: string | null;
  transaksiId: string | null; statusTransaksi: 'DICATAT' | 'DISETUJUI' | 'DITOLAK' | null; diterimaAt: string;
}
/** POST /api/v1/transaksi-mitra/{id}/catat — pemetaan item tanpa barisId (dan boleh mengganti yang ada). */
export const CatatTransaksiMitraInput = z.object({
  pemetaan: z.array(z.object({ itemId: z.string().min(1).max(60), barisId: z.string().uuid() })).max(100).default([]),
  /** tanggal pembukuan bila tanggal pesanan jatuh di periode yang sudah ditutup */
  tanggal: Tanggal.optional(),
});
export type CatatTransaksiMitraInput = z.infer<typeof CatatTransaksiMitraInput>;
