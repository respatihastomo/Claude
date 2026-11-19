# svc-perencanaan — pagu, kertas kerja (RKAS), penelaahan & pengesahan

Rujukan rencana: 3.4 (svc-perencanaan, db_perencanaan; konsumsi `TransaksiDisetujui`; terbitkan `KertasKerjaDiajukan`, `KertasKerjaDisahkan`), 4.2 (UC-03..UC-09), 5.2.1–5.2.2 (SK-01, SK-02), 5.3.3, 7.3 (6 tabel + proyeksi), 7.6 (`ux_kk_disahkan`, `cek_pagu`), 13.2.3 (Kode 6 `validasiKertasKerja`), 13.2.5–13.2.6 (Kode 8 controller, Kode 9 pengesahan dengan Transactional Outbox).

Layanan ini menggantikan skrip dev `terbit-kk-disahkan.mjs`. RKAS kini disusun, diajukan, ditelaah, dan disahkan sungguhan, lalu dikirim ke svc-penatausahaan lewat event.

## Alur & peran
```
Bendahara/Operator      Kepala Sekolah        Verifikator Dinas (wilayah sekolah)
aktifkan -> DRAF   ──▶  ajukan (wajib valid) ──▶ DIAJUKAN ──▶ sahkan ──▶ DISAHKAN ──(KertasKerjaDisahkan)──▶ svc-penatausahaan
susun baris+jadwal       KertasKerjaDiajukan        │ catatan per baris
                                                    └ kembalikan + alasan ──▶ DRAF
perubahan (dari DISAHKAN) -> versi n+1 DRAF; saat disahkan versi lama -> DIGANTI
```
- **Validasi juknis (Kode 6):**
  - total anggaran harus sama dengan pagu;
  - batas maksimum/minimum per komponen (persen pagu, dari `ref_komponen_lokal`);
  - total = volume × harga;
  - jadwal kas 12 bulan sama dengan total;
  - pada perubahan, tidak boleh di bawah realisasi.
- **Realisasi (SK-02):** `TransaksiDisetujui` dari svc-penatausahaan masuk ke `realisasi_baris_lokal`. Realisasi dijumlahkan per rantai `asal_baris_id`/`akar_baris_id`, sehingga terbawa lintas versi. Baris yang sudah direalisasikan tidak bisa dihapus atau diturunkan di bawah realisasinya.
- **Cakupan Dinas:** RLS `boleh_akses` memetakan NPSN ke wilayah (`ref_sekolah_lokal`) dan mencocokkannya dengan klaim `wilayah` di JWT. Verifikator wilayah lain tidak melihat kertas kerja sekolah tersebut sama sekali.
- **Penelaah per sumber dana (Kode 9):** BOSP oleh `VERIFIKATOR_DINAS`; Bantuan Pemerintah oleh `TIM_KERJA` (belum dirilis).

## API (11.2.8 & 11.2.9)
| Metode & path | Peran | Catatan |
|---|---|---|
| `GET /api/v1/sekolah/{npsn}/pagu?tahun&sumberDanaKode` | semua (RLS) | pagu penetapan |
| `GET /api/v1/sekolah/{npsn}/kertas-kerja?tahun&sumberDanaKode` | semua (RLS) | daftar versi |
| `POST /api/v1/sekolah/{npsn}/kertas-kerja` | OPERATOR, BENDAHARA | aktifkan (201) / kembalikan versi terbuka (200) |
| `POST /api/v1/sekolah/{npsn}/kertas-kerja/perubahan` | OPERATOR, BENDAHARA | versi baru dari yang disahkan |
| `GET /api/v1/kertas-kerja/{id}` | semua (RLS) | detail + baris + validasi + catatan + riwayat; `ETag` |
| `GET /api/v1/kertas-kerja/{id}/komponen` | semua | komponen & batasnya |
| `POST/PUT/DELETE /api/v1/kertas-kerja/{id}/baris[/{barisId}]` | OPERATOR, BENDAHARA | `If-Match` (versi seluruh kertas kerja) |
| `POST /api/v1/kertas-kerja/{id}/ajukan` | KEPSEK | `If-Match` |
| `GET /api/v1/penelaahan` | VERIFIKATOR_DINAS, TIM_KERJA | antrean DIAJUKAN di wilayahnya |
| `POST /api/v1/kertas-kerja/{id}/catatan` | VERIFIKATOR_DINAS, TIM_KERJA | catatan umum/per baris |
| `POST /api/v1/kertas-kerja/{id}/{kembalikan,sahkan}` | VERIFIKATOR_DINAS, TIM_KERJA | `If-Match` |

## Basis data (`db/svc-perencanaan/migrations`)
- Tabel: `pagu`, `kertas_kerja`, `baris_kertas_kerja`, `jadwal_kas`, `verifikasi`, `catatan_baris`; proyeksi `ref_sekolah_lokal`, `ref_komponen_lokal`, `realisasi_baris_lokal`; `outbox`, `inbox_processed`.
- Indeks unik parsial `ux_kk_disahkan` (satu versi disahkan) dan `ux_kk_terbuka` (satu versi DRAF/DIAJUKAN) per buku.
- Trigger:
  - `cek_kk_draf`: baris dan jadwal hanya berubah saat DRAF;
  - `cek_pagu`: total tidak melebihi pagu;
  - `jaga_kertas_kerja`: transisi sah saja, versi disahkan final, larangan hapus.
- CHECK pemisahan tugas: pengesah ≠ pembuat ≠ pengaju.

## Data contoh (`90_seed_dev.sql`)
Dua sekolah (wilayah 3201 dan 3202), komponen BOSP, dan pagu tahun berjalan. **Batas persen komponen di seed (honor maks 20%) adalah contoh.** Nilai resmi mengikuti juknis BOSP yang berlaku dan seharusnya datang dari svc-referensi.

## Pengujian
- `packages/aturan`: +6 uji (`validasiKertasKerja`, `jadwalMerata`).
- `svc-perencanaan`: 12 uji integrasi. Mencakup:
  - aktifkan, If-Match, komponen, jadwal kas;
  - trigger `cek_pagu`;
  - batas honor menolak pengajuan;
  - cakupan wilayah Verifikator;
  - kembalikan lalu ajukan ulang;
  - pengesahan;
  - **uji kontrak** `KertasKerjaDisahkan` dengan skema konsumen svc-penatausahaan;
  - realisasi membatasi pergeseran;
  - versi 2 disahkan dan versi 1 DIGANTI dengan `asalBarisId`;
  - kunci dari superuser.
- Uji menyeluruh empat proses (perencanaan → penatausahaan → pelaporan + web): `scripts/isi-demo.mjs`, tangkapan `docs/tangkapan/17–19`.

## Belum ada
Penetapan pagu dari svc-integrasi/svc-referensi (masih seed), konsumen `ReferensiDiubah`/`SumberDanaDisahkan`, kertas kerja Bantuan Pemerintah (TIM_KERJA), impor Excel kertas kerja, jadwal kas manual di UI (masih rata), dan notifikasi `KertasKerjaDiajukan` (svc-integrasi).
