# svc-referensi — data induk nasional & pajak daerah

Layanan pemilik **data referensi** (Balai SDSP sebagai pengelola nasional, Dinas untuk pajak daerah). Layanan lain **tidak pernah memanggil svc-referensi secara sinkron** saat transaksi: mereka menyimpan *proyeksi lokal* yang diperbarui lewat event `ReferensiDiubah`.

| Entitas | Tabel `ref.*` | Diproyeksikan ke |
|---|---|---|
| Wilayah | `wilayah` | identitas |
| Jenjang | `jenjang` | — |
| Satuan pendidikan | `satuan_pendidikan` | identitas, perencanaan, penatausahaan |
| Direktorat | `direktorat` | identitas |
| Sumber dana (+ jenjang) | `sumber_dana`, `sumber_dana_jenjang` | — (dibaca via API UC-02) |
| Kode rekening | `kode_rekening` | perencanaan |
| Komponen BOSP | `komponen` | perencanaan |
| Tarif pajak | `tarif_pajak` (PK: rekening, jenis, wilayah) | penatausahaan |

## Alur perubahan

```mermaid
sequenceDiagram
  participant A as Admin Balai / Dinas
  participant R as svc-referensi (db_ref)
  participant O as ref.outbox
  participant C as identitas / perencanaan / penatausahaan
  A->>R: PUT /admin/referensi/{entitas} | PUT /dinas/konfigurasi-pajak
  R->>R: UPSERT (hanya bila isi berubah)
  Note over R: trigger beri_versi: versi = nextval(versi_seq)<br/>trigger terbitkan_referensi: tulis outbox (transaksi sama)
  O-->>C: ReferensiDiubah {entitas, kunci, versi, aktif, data}
  C->>C: consumeIdempotent + UPSERT ... WHERE lokal.versi < EXCLUDED.versi
```

- **Versi global monoton** (`ref.versi_seq`) — konsumen mengabaikan event lama/duplikat, sehingga urutan kirim tidak penting dan terbit ulang aman.
- **Tidak ada DELETE** (trigger `HAPUS_DILARANG`): referensi dinonaktifkan (`aktif=false`) agar transaksi lama tetap bisa dirujuk.
- **Terbit ulang** (`POST /admin/referensi/terbit-ulang`, fungsi `ref.terbit_ulang`) mengirim ulang seluruh baris dalam urutan dependensi tanpa menaikkan versi — untuk mengisi layanan baru atau memulihkan proyeksi.

## Pajak daerah (UC-32)

Tarif pajak berlapis berdasarkan prefiks wilayah: `''` = nasional, `32` = provinsi, `3201` = kabupaten/kota. Untuk sekolah di wilayah `3201xx`, `pilihTarifEfektif` (paket `@arkas/aturan`) memilih baris **paling spesifik** per (rekening, jenis). Baris non-aktif berarti **tidak dipungut** di wilayah itu.

- Hanya jenis **SSPD** yang boleh punya wilayah (CHECK); PPN/PPh tetap nasional.
- Admin Dinas hanya bisa menulis wilayahnya sendiri — ditegakkan dua lapis: pemeriksaan layanan (`DI_LUAR_CAKUPAN`) dan RLS (`p_dinas`: `wilayah_kode LIKE app.wilayah || '%'`).
- `dasarHukum` (Perda/Perkada) wajib, `diubah_oleh` tercatat untuk audit.

Diverifikasi langsung (6 proses, `BROKER=http`): Dinas 3201 menetapkan SSPD 5% → simulasi pajak Bendahara SMPN 1 (wilayah 3201) berubah dari 10% ke 5%; setelah dibebaskan, SSPD hilang dari simulasi. Sekolah di 3202 tetap 10%.

![Pajak daerah](gambar/dinas-pajak-daerah.png)
![Atur pajak daerah](gambar/dinas-pajak-daerah-atur.png)
![Referensi nasional](gambar/admin-referensi.png)
![Tarif pajak](gambar/admin-referensi-tarif.png)

## API

| Metode & jalur | Peran | Keterangan |
|---|---|---|
| `GET /api/v1/referensi/{wilayah,jenjang,sekolah,direktorat,sumber-dana,kode-rekening,komponen,tarif-pajak}` | semua | filter `aktif`, `sumberDanaKode`, `wilayahKode` |
| `PUT /api/v1/admin/referensi/{slug}` | SUPER_ADMIN | upsert; 201 bila berubah, 200 bila sama (idempoten) |
| `POST /api/v1/admin/referensi/terbit-ulang` | SUPER_ADMIN | 202, `{jumlah}` |
| `GET /api/v1/sekolah/{npsn}` | semua (RLS) | profil sekolah |
| `GET /api/v1/sekolah/{npsn}/sumber-dana` | semua | UC-02: sumber dana sesuai jenjang |
| `GET /api/v1/dinas/sekolah` | ADMIN_DINAS, VERIFIKATOR_DINAS | sekolah di wilayahnya |
| `GET/PUT /api/v1/dinas/konfigurasi-pajak` | ADMIN_DINAS | tarif efektif & penetapan/pembebasan SSPD |

Galat integritas Postgres dipetakan ke `problem+json`: FK `23503` → `RUJUKAN_TIDAK_DIKENAL`, CHECK `23514` → `DATA_TIDAK_VALID` (422).

## Menjalankan & menguji

```bash
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres node scripts/migrate.mjs svc-referensi --seed
```
```bash
./scripts/jalankan-svc.sh svc-referensi
```
```bash
pnpm --filter @arkas/svc-referensi test
```
Seed dev menerbitkan 36 event saat layanan pertama kali berjalan, sehingga proyeksi di layanan lain langsung terisi. Uji: 9 e2e svc-referensi, + konsumen (identitas 1, perencanaan 4, penatausahaan 5), + 6 unit `pilihTarifEfektif`.
