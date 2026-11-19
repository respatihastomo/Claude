/**
 * Fungsi murni: menyusun baris BKU bulanan dari proyeksi TransaksiDisetujui dan memeriksa
 * konsistensinya terhadap ringkasan yang dibekukan di PeriodeDitutup (svc-penatausahaan).
 * Aturan baris sama dengan tatausaha.v_mutasi.
 */
export interface TransaksiLokal {
  transaksiId: string; jenis: 'PENERIMAAN' | 'TARIK_TUNAI' | 'SETOR_TUNAI' | 'BELANJA' | 'SETOR_PAJAK';
  tanggal: string; noBukti: string | null; uraian: string; caraBayar: 'TUNAI' | 'NON_TUNAI' | null; ntpn: string | null;
  nilaiBruto: number; disetujuiAt: string;
  items: Array<{ kodeRekening: string; jumlah: number; uraian?: string }>;
  pajak: Array<{ jenis: string; nilai: number }>;
}
export interface MutasiBuku { saldoAwal: number; penerimaan: number; pengeluaran: number; saldoAkhir: number }
export interface Ringkasan { tunai: MutasiBuku; bank: MutasiBuku; pajak: { saldoAwal: number; dipungut: number; disetor: number; saldoAkhir: number }; jumlahTransaksi: number }
export interface BarisLaporan {
  tanggal: string; noBukti: string | null; uraian: string; kodeRekening: string | null; buku: 'TUNAI' | 'BANK';
  penerimaan: number; pengeluaran: number; saldo: number;
}

const sen = (x: number) => Math.round(x * 100);
const rp = (s: number) => s / 100;
const NAMA_PAJAK: Record<string, string> = { PPN: 'PPN', PPH21: 'PPh 21', PPH23: 'PPh 23', SSPD: 'pajak daerah' };

export function susunBaris(transaksi: TransaksiLokal[], saldoAwal: number): BarisLaporan[] {
  const urut = [...transaksi].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.disetujuiAt.localeCompare(b.disetujuiAt) || a.transaksiId.localeCompare(b.transaksiId));
  const mentah: Array<Omit<BarisLaporan, 'saldo'>> = [];
  for (const t of urut) {
    const dasar = { tanggal: t.tanggal, noBukti: t.noBukti, kodeRekening: null as string | null };
    const bukuBayar = t.caraBayar === 'TUNAI' ? 'TUNAI' : 'BANK';
    switch (t.jenis) {
      case 'PENERIMAAN':
        mentah.push({ ...dasar, uraian: t.uraian, buku: 'BANK', penerimaan: t.nilaiBruto, pengeluaran: 0 });
        break;
      case 'TARIK_TUNAI':
        mentah.push({ ...dasar, uraian: t.uraian, buku: 'BANK', penerimaan: 0, pengeluaran: t.nilaiBruto });
        mentah.push({ ...dasar, uraian: t.uraian, buku: 'TUNAI', penerimaan: t.nilaiBruto, pengeluaran: 0 });
        break;
      case 'SETOR_TUNAI':
        mentah.push({ ...dasar, uraian: t.uraian, buku: 'TUNAI', penerimaan: 0, pengeluaran: t.nilaiBruto });
        mentah.push({ ...dasar, uraian: t.uraian, buku: 'BANK', penerimaan: t.nilaiBruto, pengeluaran: 0 });
        break;
      case 'BELANJA':
        for (const i of t.items) mentah.push({ ...dasar, uraian: i.uraian ?? t.uraian, kodeRekening: i.kodeRekening, buku: bukuBayar, penerimaan: 0, pengeluaran: i.jumlah });
        for (const p of t.pajak.filter((x) => x.nilai > 0)) {
          mentah.push({ ...dasar, uraian: `Pungut ${NAMA_PAJAK[p.jenis] ?? p.jenis} ${t.noBukti ?? ''}`.trim(), buku: bukuBayar, penerimaan: p.nilai, pengeluaran: 0 });
        }
        break;
      case 'SETOR_PAJAK':
        mentah.push({ ...dasar, noBukti: t.ntpn ?? t.noBukti, uraian: t.uraian, buku: bukuBayar, penerimaan: 0, pengeluaran: t.nilaiBruto });
        break;
    }
  }
  let saldo = sen(saldoAwal);
  return mentah.map((b) => {
    saldo += sen(b.penerimaan) - sen(b.pengeluaran);
    return { ...b, saldo: rp(saldo) };
  });
}

/** Mengembalikan daftar ketidakcocokan (kosong = konsisten). Dipakai sebelum PDF dibuat: event bisa tiba tidak berurutan. */
export function periksaKonsistensi(transaksi: TransaksiLokal[], baris: BarisLaporan[], r: Ringkasan): string[] {
  const salah: string[] = [];
  if (transaksi.length !== r.jumlahTransaksi) salah.push(`jumlah transaksi ${transaksi.length} dari ${r.jumlahTransaksi}`);
  for (const buku of ['TUNAI', 'BANK'] as const) {
    const m = buku === 'TUNAI' ? r.tunai : r.bank;
    const masuk = baris.filter((b) => b.buku === buku).reduce((s, b) => s + sen(b.penerimaan), 0);
    const keluar = baris.filter((b) => b.buku === buku).reduce((s, b) => s + sen(b.pengeluaran), 0);
    if (masuk !== sen(m.penerimaan)) salah.push(`penerimaan ${buku.toLowerCase()} ${rp(masuk)} ≠ ${m.penerimaan}`);
    if (keluar !== sen(m.pengeluaran)) salah.push(`pengeluaran ${buku.toLowerCase()} ${rp(keluar)} ≠ ${m.pengeluaran}`);
  }
  return salah;
}
