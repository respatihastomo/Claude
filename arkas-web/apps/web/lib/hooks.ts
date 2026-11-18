'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BarisBkuDto, BarisRkasDto, BuatTransaksiInput, RingkasanBukuDto, TransaksiDto } from '@arkas/kontrak';
import type { BarisBkpPajakDto, PajakDto, SetorPajakInput } from '@arkas/kontrak';
import { api, kunciIdempoten } from './api';

export interface Buku { npsn: string; tahun: number; sumberDanaKode: string }
const qs = (b: Buku, extra: Record<string, string | undefined> = {}) =>
  new URLSearchParams(Object.entries({ tahun: String(b.tahun), sumberDanaKode: b.sumberDanaKode, ...extra }).filter(([, v]) => v) as [string, string][]).toString();

export const kunciBuku = (b: Buku) => ['buku', b.npsn, b.tahun, b.sumberDanaKode] as const;

export function useRingkasan(b: Buku) {
  return useQuery({ queryKey: [...kunciBuku(b), 'ringkasan'], queryFn: async () => (await api<RingkasanBukuDto>(`/sekolah/${b.npsn}/bku/ringkasan?${qs(b)}`)).data });
}
export function useBku(b: Buku, buku?: 'TUNAI' | 'BANK') {
  return useQuery({ queryKey: [...kunciBuku(b), 'bku', buku ?? 'SEMUA'], queryFn: async () => (await api<{ data: BarisBkuDto[] }>(`/sekolah/${b.npsn}/bku?${qs(b, { buku })}`)).data.data });
}
export function useRkas(b: Buku, aktif = true) {
  return useQuery({ queryKey: [...kunciBuku(b), 'rkas'], enabled: aktif, queryFn: async () => (await api<{ data: BarisRkasDto[] }>(`/sekolah/${b.npsn}/bku/rkas?${qs(b)}`)).data.data });
}

/** Satu Idempotency-Key per niat simpan: dibuat saat formulir dibuka, dipakai ulang bila jaringan putus lalu dikirim lagi. */
export function useCatat(b: Buku) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, kunci }: { input: BuatTransaksiInput; kunci: string }) =>
      (await api<TransaksiDto>(`/sekolah/${b.npsn}/bku`, { method: 'POST', json: input, headers: { 'Idempotency-Key': kunci } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: kunciBuku(b) }),
  });
}

export function usePutuskan(b: Buku) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, aksi, alasan }: { id: string; aksi: 'setujui' | 'tolak'; alasan?: string }) => {
      const { etag } = await api<TransaksiDto>(`/transaksi/${id}`);
      return (await api<TransaksiDto>(`/transaksi/${id}/${aksi}`, { method: 'POST', json: alasan ? { alasan } : {}, headers: { 'If-Match': etag ?? '' } })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: kunciBuku(b) }),
  });
}

export { kunciIdempoten };

// ---------- Irisan 2: setor pajak ----------

export function usePajak(b: Buku) {
  return useQuery({ queryKey: [...kunciBuku(b), 'pajak'], queryFn: async () => (await api<{ data: PajakDto[] }>(`/sekolah/${b.npsn}/pajak?${qs(b)}`)).data.data });
}
export function useBkpPajak(b: Buku) {
  return useQuery({ queryKey: [...kunciBuku(b), 'bkp-pajak'], queryFn: async () => (await api<{ data: BarisBkpPajakDto[] }>(`/sekolah/${b.npsn}/bkp/pajak?${qs(b)}`)).data.data });
}
export function useSetorPajak(b: Buku) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, kunci }: { input: SetorPajakInput; kunci: string }) =>
      (await api<TransaksiDto>(`/sekolah/${b.npsn}/pajak/setor`, { method: 'POST', json: input, headers: { 'Idempotency-Key': kunci } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: kunciBuku(b) }),
  });
}
