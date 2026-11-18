# Irisan 3 — Penutupan buku kas bulanan (UC-15)

Rujukan rencana: SK-05 (penutupan buku kas & pelaporan bulanan), 2.1 butir 10 (penutupan bulanan, rekonsiliasi rekening koran, berita acara pemeriksaan kas, periode tertutup terkunci, selisih bank wajib dijelaskan), 8.3 event `PeriodeDitutup` → svc-pelaporan.

## Alur
```
BUKA ──(Bendahara: rekonsiliasi + hitung kas, ajukan)──▶ DIAJUKAN ──(Kepala Sekolah: setujui berita acara)──▶ DITUTUP
  ▲                                                         │
  └──────────────(Kepala Sekolah: kembalikan + alasan)──────┘
```
1. **Daftar periksa:** bulan sudah berakhir, tidak ada transaksi menunggu, dan periode sebelumnya sudah ditutup. Pajak dipungut bulan itu yang belum disetor hanya menjadi peringatan, karena tenggat setornya bulan berikutnya.
2. **Bendahara** mengisi saldo rekening koran dan hasil hitung kas fisik. Selisih bank atau kas wajib dijelaskan (minimal 10 karakter). Ringkasan BKU bulan itu dibekukan bersama rekonsiliasi. Selama **DIAJUKAN**, transaksi baru maupun persetujuan di bulan itu ditolak.
3. **Kepala Sekolah** memeriksa berita acara:
   - **Setujui:** periode `DITUTUP` (permanen), bulan berikutnya dibuka, dan `PeriodeDitutup` terbit lewat outbox.
   - **Kembalikan:** periode kembali `BUKA` dengan alasan.

   Pengaju tidak boleh menutup sendiri (pemisahan tugas).

## API (11.2.11)
| Metode & path | Peran | Catatan |
|---|---|---|
| `GET /api/v1/sekolah/{npsn}/periode?tahun&sumberDanaKode` | semua (RLS) | daftar periode & status |
| `GET /api/v1/periode/{id}` | semua (RLS) | ringkasan BKU bulan itu, daftar periksa, rekonsiliasi; `ETag` |
| `POST /api/v1/periode/{id}/ajukan-tutup` | BENDAHARA | `If-Match`; `{ saldoRekeningKoran, kasFisik, penjelasanBank?, penjelasanKas? }` |
| `POST /api/v1/periode/{id}/setujui` | KEPSEK | `If-Match` |
| `POST /api/v1/periode/{id}/kembalikan` | KEPSEK | `If-Match`; `{ alasan }` |

Event `PeriodeDitutup` (`arkas.tatausaha.periode-ditutup`) berisi:
- saldo awal, penerimaan, pengeluaran, dan saldo akhir untuk buku tunai dan bank;
- buku pajak (dipungut, disetor, saldo);
- jumlah transaksi dan hasil rekonsiliasi;
- `periodeBerikutBulan`.

## Basis data — `50_penutupan.sql` (aditif, aman dijalankan ulang)
- `periode`:
  - status ditambah `DIAJUKAN`;
  - kolom baru `row_version`, `diajukan_oleh/at`, `alasan_kembali`;
  - CHECK pemisahan tugas.
- Tabel `rekonsiliasi`:
  - kolom `selisih_bank` dan `selisih_kas` dihitung oleh basis data (`GENERATED`);
  - CHECK: selisih wajib dijelaskan;
  - snapshot `ringkasan` (jsonb).
- Trigger:
  - `jaga_periode`: transisi sah saja, dan syarat pengajuan diperiksa ulang di basis data (tidak ada transaksi `DICATAT`, periode sebelumnya ditutup, rekonsiliasi ada);
  - `jaga_rekonsiliasi`: hanya dapat diubah selagi `BUKA`;
  - larangan hapus;
  - pesan `tolak_periode_tertutup` dibedakan untuk `DIAJUKAN` dan `DITUTUP`.
- RLS:
  - Bendahara hanya dapat mengubah periode `BUKA` menjadi `DIAJUKAN`;
  - Kepala Sekolah hanya dapat mengubah `DIAJUKAN` menjadi `DITUTUP` atau `BUKA`, dan membuka periode berikutnya.
- Pengajuan memakai kunci buku yang sama dengan pencatatan transaksi, sehingga tidak ada transaksi yang lolos di tengah penutupan.

## Konfigurasi
`TUTUP_SEBELUM_AKHIR_BULAN=true` **hanya untuk dev/demo**. Bawaannya `false`, sehingga buku baru dapat ditutup mulai tanggal terakhir bulan.

Efek samping di demo: setelah November ditutup lebih awal, transaksi bertanggal hari ini (masih November) akan ditolak `PERIODE_TERTUTUP`, sedangkan periode Desember baru bisa dipakai mulai 1 Desember.

## Pengujian
- `packages/aturan`: +8 uji (`cekKesiapanTutup`, `validasiRekonsiliasi`, `akhirBulan`, `bulanBerikut`); total 32, cakupan baris 100%.
- `svc-penatausahaan`: +8 uji integrasi (`test/penutupan.e2e.spec.ts`); total 35 lulus. Mencakup:
  - transaksi menunggu menghalangi pengajuan;
  - selisih wajib dijelaskan;
  - If-Match dan peran;
  - periode DIAJUKAN mengunci transaksi;
  - kembalikan lalu catat susulan;
  - pemisahan tugas;
  - ditutup: bulan berikut dibuka dan event terbit;
  - periode terkunci, termasuk dari superuser;
  - trigger saat aplikasi dilewati.
- UI (Playwright): `docs/tangkapan/12` s.d. `14`.

## Catatan & lanjutan
- Ditemukan dan diperbaiki: `SELECT … FOR UPDATE` tunduk pada kebijakan RLS UPDATE. Akibatnya periode yang sudah ditutup tampak "tidak ditemukan" saat Kepala Sekolah bertindak. Kini status diperiksa dulu tanpa kunci, baru dikunci.
- Belum ada: PDF berita acara dan laporan bulanan (svc-pelaporan, Tahap 1), rincian pecahan uang kas, unggah scan rekening koran, dan penutupan akhir tahun (SiLPA ke tahun berikutnya).
