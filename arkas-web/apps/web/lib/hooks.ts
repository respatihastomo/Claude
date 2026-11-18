'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BarisBkuDto, BarisRkasDto, BuatTransaksiInput, RingkasanBukuDto, TransaksiDitolakDto, TransaksiDto } from '@arkas/kontrak';
import type { AjukanTutupInput, BarisBkpPajakDto, DetailPeriodeDto, PajakDto, PeriodeDto, SetorPajakInput } from '@arkas/kontrak';
import type { BarisKertasKerjaInput, DetailKertasKerjaDto, KertasKerjaDto, KomponenDto } from '@arkas/kontrak';
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
export function useDitolak(b: Buku, aktif = true) {
  return useQuery({ queryKey: [...kunciBuku(b), 'ditolak'], enabled: aktif, queryFn: async () => (await api<{ data: TransaksiDitolakDto[] }>(`/sekolah/${b.npsn}/bku/ditolak?${qs(b)}`)).data.data });
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

// ---------- svc-perencanaan ----------

export function useDaftarKk(b: Buku) {
  return useQuery({ queryKey: ['kk', b.npsn, b.tahun, b.sumberDanaKode], queryFn: async () => (await api<{ data: KertasKerjaDto[] }>(`/sekolah/${b.npsn}/kertas-kerja?${qs(b)}`)).data.data });
}
export function useKk(id?: string) {
  return useQuery({ queryKey: ['kk', id], enabled: !!id, queryFn: async () => (await api<DetailKertasKerjaDto>(`/kertas-kerja/${id}`)).data });
}
export function useKomponen(id?: string) {
  return useQuery({ queryKey: ['kk', id, 'komponen'], enabled: !!id, staleTime: 60_000, queryFn: async () => (await api<{ data: KomponenDto[] }>(`/kertas-kerja/${id}/komponen`)).data.data });
}
export function usePenelaahan(aktif: boolean) {
  return useQuery({ queryKey: ['penelaahan'], enabled: aktif, queryFn: async () => (await api<{ data: KertasKerjaDto[] }>('/penelaahan')).data.data });
}
type AksiKk =
  | { jenis: 'aktifkan' | 'perubahan'; b: Buku }
  | { jenis: 'baris'; kk: DetailKertasKerjaDto; input: BarisKertasKerjaInput; barisId?: string }
  | { jenis: 'hapus'; kk: DetailKertasKerjaDto; barisId: string }
  | { jenis: 'ajukan' | 'sahkan'; kk: DetailKertasKerjaDto }
  | { jenis: 'kembalikan'; kk: DetailKertasKerjaDto; alasan: string }
  | { jenis: 'catatan'; kk: DetailKertasKerjaDto; catatan: string; barisId?: string };
/** Semua aksi kertas kerja; If-Match memakai rowVersion detail yang sedang ditampilkan. */
export function useAksiKk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: AksiKk) => {
      const im = (kk: DetailKertasKerjaDto) => ({ 'If-Match': `W/"${kk.rowVersion}"` });
      switch (a.jenis) {
        case 'aktifkan': return (await api<DetailKertasKerjaDto>(`/sekolah/${a.b.npsn}/kertas-kerja`, { method: 'POST', json: { tahun: a.b.tahun, sumberDanaKode: a.b.sumberDanaKode } })).data;
        case 'perubahan': return (await api<DetailKertasKerjaDto>(`/sekolah/${a.b.npsn}/kertas-kerja/perubahan`, { method: 'POST', json: { tahun: a.b.tahun, sumberDanaKode: a.b.sumberDanaKode } })).data;
        case 'baris': return (await api<DetailKertasKerjaDto>(`/kertas-kerja/${a.kk.id}/baris${a.barisId ? `/${a.barisId}` : ''}`, { method: a.barisId ? 'PUT' : 'POST', json: a.input, headers: im(a.kk) })).data;
        case 'hapus': return (await api<DetailKertasKerjaDto>(`/kertas-kerja/${a.kk.id}/baris/${a.barisId}`, { method: 'DELETE', headers: im(a.kk) })).data;
        case 'kembalikan': return (await api<DetailKertasKerjaDto>(`/kertas-kerja/${a.kk.id}/kembalikan`, { method: 'POST', json: { alasan: a.alasan }, headers: im(a.kk) })).data;
        case 'catatan': return (await api<DetailKertasKerjaDto>(`/kertas-kerja/${a.kk.id}/catatan`, { method: 'POST', json: { catatan: a.catatan, ...(a.barisId ? { barisId: a.barisId } : {}) } })).data;
        default: return (await api<DetailKertasKerjaDto>(`/kertas-kerja/${a.kk.id}/${a.jenis}`, { method: 'POST', json: {}, headers: im(a.kk) })).data;
      }
    },
    onSuccess: (kk) => { qc.setQueryData(['kk', kk.id], kk); void qc.invalidateQueries({ queryKey: ['kk'] }); void qc.invalidateQueries({ queryKey: ['penelaahan'] }); },
  });
}
