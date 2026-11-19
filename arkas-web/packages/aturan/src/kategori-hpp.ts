import { keRupiah, keSen } from './uang';

/**
 * HPP — Halaman Pemetaan Pembelanjaan (fitur 20, SK-11, Kode 15): membandingkan rencana RKAS yang disahkan
 * dengan belanja sekolah di Mitra SIPLah. Fungsi murni; dijalankan svc-pemantauan setiap ada event terkait.
 */
export type KategoriHpp = 'SESUAI' | 'MELEBIHI_RENCANA' | 'DI_LUAR_RENCANA' | 'BELUM_DIBELANJAKAN';
export interface BarisRencana { barisId: string; kodeRekening: string; uraian: string; total: number }
export interface ItemBelanjaMitra { itemId: string; barisId: string | null; kodeRekening: string; uraian: string; jumlah: number }
export interface HasilBarisHpp { barisId: string; kodeRekening: string; uraian: string; rencana: number; belanja: number; selisih: number; kategori: Exclude<KategoriHpp, 'DI_LUAR_RENCANA'> }
export interface CocokHpp { itemId: string; barisId: string | null; cara: 'ID_BARIS' | 'KODE_REKENING' | 'TIDAK_COCOK'; jumlah: number }
export interface HasilHpp {
  baris: HasilBarisHpp[];
  cocok: CocokHpp[];
  diLuarRencana: Array<{ itemId: string; kodeRekening: string; uraian: string; jumlah: number }>;
  ringkasan: Record<KategoriHpp, { jumlah: number; nilai: number }> & { rencana: number; belanja: number };
}

/**
 * 6.3.3 Cocokkan item ke baris:
 * 1) item yang membawa ID baris RKAS yang disahkan -> baris itu;
 * 2) selain itu, item dengan kode rekening yang ada di rencana -> baris berkode sama yang sisanya terbesar
 *    (beban dibagi agar satu baris tidak "melebihi" sementara baris sejenis masih kosong);
 * 3) sisanya DI_LUAR_RENCANA.
 * Kategori baris: belanja 0 -> BELUM_DIBELANJAKAN; belanja <= rencana -> SESUAI; selebihnya MELEBIHI_RENCANA.
 */
export function hitungHpp(rencana: BarisRencana[], belanja: ItemBelanjaMitra[]): HasilHpp {
  const terpakai = new Map(rencana.map((b) => [b.barisId, 0]));
  const perKode = new Map<string, BarisRencana[]>();
  for (const b of rencana) perKode.set(b.kodeRekening, [...(perKode.get(b.kodeRekening) ?? []), b]);
  const cocok: CocokHpp[] = [];
  const diLuar: HasilHpp['diLuarRencana'] = [];

  // urutan deterministik: item ber-ID baris dulu, lalu nilai terbesar
  const urut = [...belanja].sort((a, b) => Number(!a.barisId || !terpakai.has(a.barisId)) - Number(!b.barisId || !terpakai.has(b.barisId)) || b.jumlah - a.jumlah || a.itemId.localeCompare(b.itemId));
  for (const it of urut) {
    const sen = keSen(it.jumlah);
    if (it.barisId && terpakai.has(it.barisId)) {
      terpakai.set(it.barisId, terpakai.get(it.barisId)! + sen);
      cocok.push({ itemId: it.itemId, barisId: it.barisId, cara: 'ID_BARIS', jumlah: it.jumlah });
      continue;
    }
    const calon = perKode.get(it.kodeRekening);
    if (calon?.length) {
      const pilih = calon.reduce((m, b) => (keSen(b.total) - terpakai.get(b.barisId)! > keSen(m.total) - terpakai.get(m.barisId)! ? b : m));
      terpakai.set(pilih.barisId, terpakai.get(pilih.barisId)! + sen);
      cocok.push({ itemId: it.itemId, barisId: pilih.barisId, cara: 'KODE_REKENING', jumlah: it.jumlah });
      continue;
    }
    cocok.push({ itemId: it.itemId, barisId: null, cara: 'TIDAK_COCOK', jumlah: it.jumlah });
    diLuar.push({ itemId: it.itemId, kodeRekening: it.kodeRekening, uraian: it.uraian, jumlah: it.jumlah });
  }

  const baris: HasilBarisHpp[] = rencana.map((b) => {
    const pakai = terpakai.get(b.barisId)!;
    const r = keSen(b.total);
    const kategori = pakai === 0 ? 'BELUM_DIBELANJAKAN' : pakai <= r ? 'SESUAI' : 'MELEBIHI_RENCANA';
    return { barisId: b.barisId, kodeRekening: b.kodeRekening, uraian: b.uraian, rencana: keRupiah(r), belanja: keRupiah(pakai), selisih: keRupiah(r - pakai), kategori };
  });
  const kosong = () => ({ jumlah: 0, nilai: 0 });
  const ringkasan: HasilHpp['ringkasan'] = {
    SESUAI: kosong(), MELEBIHI_RENCANA: kosong(), BELUM_DIBELANJAKAN: kosong(), DI_LUAR_RENCANA: kosong(),
    rencana: keRupiah(rencana.reduce((a, b) => a + keSen(b.total), 0)), belanja: keRupiah(belanja.reduce((a, b) => a + keSen(b.jumlah), 0)),
  };
  for (const b of baris) { ringkasan[b.kategori].jumlah++; ringkasan[b.kategori].nilai = keRupiah(keSen(ringkasan[b.kategori].nilai) + keSen(b.kategori === 'BELUM_DIBELANJAKAN' ? b.rencana : b.belanja)); }
  for (const d of diLuar) { ringkasan.DI_LUAR_RENCANA.jumlah++; ringkasan.DI_LUAR_RENCANA.nilai = keRupiah(keSen(ringkasan.DI_LUAR_RENCANA.nilai) + keSen(d.jumlah)); }
  return { baris, cocok, diLuarRencana: diLuar, ringkasan };
}
