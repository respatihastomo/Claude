# Irisan 2 — Setor pajak (UC-14) & BKP Pajak

Rujukan rencana: SK-03 langkah 6 ("Catat Setor Pajak", NTPN 16 digit, lencana DISETOR), 2.1 butir 9 (Perpajakan), 9.2 (BKP tunai, bank, pajak).

## Alur
1. Belanja yang **disetujui** memungut pajak (`tatausaha.pajak`, status `DIPUNGUT`). Ini masuk BKU sebagai penerimaan pajak (irisan 1).
2. Bendahara membuka tab **BKP Pajak** dan memilih pajak **sejenis**. Satu setoran = satu jenis pajak = satu NTPN.
3. `POST /api/v1/sekolah/{npsn}/pajak/setor` (wajib `Idempotency-Key`) membuat transaksi `SETOR_PAJAK` berstatus `DICATAT`. Pajak terpilih langsung `DISETOR` (NTPN, tanggal, tautan ke setoran), sehingga tidak bisa disetor dua kali.
4. Kepala Sekolah menyetujui setoran seperti transaksi lain (`If-Match`, pemisahan tugas):
   - **Disetujui:** saldo bank/tunai berkurang, dan terbit `TransaksiDisetujui` (`jenis: SETOR_PAJAK`, `ntpn`, rincian pajak).
   - **Ditolak** (mis. NTPN salah): pajak kembali `DIPUNGUT` dan NTPN dilepas, sehingga bisa disetor ulang.

## API baru
| Metode & path | Peran | Catatan |
|---|---|---|
| `GET /api/v1/sekolah/{npsn}/pajak?tahun&sumberDanaKode[&status=DIPUNGUT\|DISETOR]` | semua (RLS) | pajak beserta belanja asal dan status setoran |
| `POST /api/v1/sekolah/{npsn}/pajak/setor` | BENDAHARA | `{ tahun, sumberDanaKode, pajakIds[], ntpn, tanggalSetor, caraBayar }` |
| `GET /api/v1/sekolah/{npsn}/bkp/pajak?tahun&sumberDanaKode[&bulan]` | semua (RLS) | BKP Pajak: dipungut, disetor, saldo pajak berjalan |
| `GET /api/v1/sekolah/{npsn}/bku/ringkasan` | — | tambahan `pajakTerutang` |

Kode galat baru: `JENIS_PAJAK_CAMPUR`, `PAJAK_BELUM_SAH`, `PAJAK_SUDAH_DISETOR`, `PAJAK_TIDAK_DITEMUKAN`, `PAJAK_GANDA`, `PAJAK_KOSONG`, `TANGGAL_SETOR_TIDAK_VALID`, `NTPN_SUDAH_DIPAKAI`, `SETOR_PAJAK_TIDAK_SESUAI`.

## Basis data — `40_setor_pajak.sql` (aditif, aman dijalankan ulang)
- `transaksi.jenis` + `SETOR_PAJAK`; kolom `transaksi.ntpn`. CHECK lama tanpa nama diganti versi bernama (`ck_transaksi_*`).
- Indeks unik `ux_transaksi_ntpn (ntpn, tahun)` khusus setoran yang belum ditolak.
- `pajak.setor_transaksi_id` (FK ke transaksi setor) dengan CHECK `DISETOR ⇔ tertaut`.
- Trigger `cek_setor_pajak`: hanya transisi `DIPUNGUT→DISETOR` (belanja disetujui, setoran DICATAT dengan NTPN/tanggal/buku sama) dan `DISETOR→DIPUNGUT` (setoran DITOLAK). Kolom nilai tidak dapat diubah.
- Trigger `cek_nilai_setor`: saat disetujui, nilai setoran harus sama dengan jumlah pajak tertaut.
- `v_mutasi` + baris setor pajak (pengeluaran di buku yang dipilih).
- RLS `p_setor` pada pajak untuk BENDAHARA/KEPSEK sekolah sendiri; hak UPDATE hanya kolom status/NTPN/tanggal/tautan.

## Pengujian
- `packages/aturan`: +11 uji (`validasiSetorPajak`, `normalisasiNtpn`); total 24, cakupan baris 100%.
- `svc-penatausahaan`: +8 uji integrasi (`test/setor-pajak.e2e.spec.ts`); total 27 lulus. Mencakup:
  - validasi;
  - NTPN dinormalisasi;
  - replay idempoten;
  - setor ganda dan NTPN ganda;
  - tolak lalu setor ulang dengan NTPN yang sama;
  - event dan saldo BKU/BKP Pajak;
  - dua setoran bersamaan;
  - trigger saat aplikasi dilewati.
- UI (Playwright): `docs/tangkapan/08` s.d. `11`.

## Catatan
- Kode billing/MAP dan unggah bukti setor (BPN) belum ada; menyusul bersama unggah bukti S3.
- Satu setoran tidak bisa mencampur buku tunai dan bank. Kas sumber dipilih Bendahara (bawaan: buku tempat pajak dipungut).
- PostgreSQL menyembunyikan `detail` pelanggaran unik dari role tanpa hak SELECT kolom, jadi NTPN ganda dikenali dari nama indeks partisi (`transaksi_<tahun>_ntpn_tahun_idx`).
