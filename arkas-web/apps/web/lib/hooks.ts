'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BarisBkuDto, BarisRkasDto, BuatTransaksiInput, RingkasanBukuDto, TransaksiDto } from '@arkas/kontrak';
import type { AjukanTutupInput, BarisBkpPajakDto, DetailPeriodeDto, PajakDto, PeriodeDto, SetorPajakInput } from '@arkas/kontrak';
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

// ---------- Irisan 3: penutupan buku kas ----------
export function usePeriode(b: Buku) {
  return useQuery({ queryKey: [...kunciBuku(b), 'periode'], queryFn: async () => (await api<{ data: PeriodeDto[] }>(`/sekolah/${b.npsn}/periode?${qs(b)}`)).data.data });
}
export function useDetailPeriode(b: Buku, id?: string) {
  return useQuery({ queryKey: [...kunciBuku(b), 'periode', id], enabled: !!id, queryFn: async () => api<DetailPeriodeDto>(`/periode/${id}`) });
}
/** Aksi periode memakai ETag terkini sebagai If-Match. */
export function useAksiPeriode(b: Buku) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, aksi, etag, body }: { id: string; aksi: 'ajukan-tutup' | 'setujui' | 'kembalikan'; etag: string; body?: AjukanTutupInput | { alasan: string } }) =>
      (await api<DetailPeriodeDto>(`/periode/${id}/${aksi}`, { method: 'POST', json: body ?? {}, headers: { 'If-Match': etag } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: kunciBuku(b) }),
  });
}

// ---------- svc-pelaporan ----------
export interface LaporanDto {
  id: string; jenis: 'BKU_BULANAN'; periodeId: string; bulan: number; status: 'MENUNGGU' | 'SIAP' | 'GAGAL' | 'DITANDATANGANI';
  percobaan: number; galatTerakhir: string | null; sha256: string | null; ukuran: number | null; siapAt: string | null;
  ditandatanganiOleh: string | null; ditandatanganiAt: string | null; penyediaTte: 'SIMULASI_DEV' | 'BSRE' | null; sha256Tertanda: string | null; versi: number;
}
export function useLaporan(b: Buku) {
  return useQuery({
    queryKey: [...kunciBuku(b), 'laporan'],
    queryFn: async () => (await api<{ data: LaporanDto[] }>(`/laporan?npsn=${b.npsn}&${qs(b)}`)).data.data,
    // laporan dibuat asinkron oleh pekerja svc-pelaporan: muat ulang selagi ada yang menunggu
    refetchInterval: (q) => (q.state.data?.some((l) => l.status === 'MENUNGGU') ? 2000 : false),
  });
}
export function useTandatangani(b: Buku) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (l: LaporanDto) => (await api<LaporanDto>(`/laporan/${l.id}/tandatangani`, { method: 'POST', headers: { 'If-Match': `W/"${l.versi}"` } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: kunciBuku(b) }),
  });
}
