# ARKAS Web — monorepo microservices

Implementasi bertahap dari *Dokumen Rancangan Teknis ARKAS Berbasis Web (Edisi Microservices)*.
Isi saat ini — **`svc-identitas`** (Tahap 0: SSO, sesi, peran, JWT internal), **`svc-referensi`** (Tahap 0: data induk nasional & pajak daerah, disebar lewat event `ReferensiDiubah`) dan alur Tahap 1 "BOSP Inti" lintas layanan: **`svc-perencanaan`** (RKAS disusun → diajukan → disahkan Dinas) → **`svc-penatausahaan`** (BKU, pajak, penutupan buku) → **`svc-pelaporan`** (laporan PDF & tanda tangan), **`svc-bantuan`** (Bantuan Pemerintah: pengajuan → pengesahan → penyaluran, pengajuan sekolah), **`svc-pemantauan`** (HPP & dasbor serapan/kepatuhan), **`svc-integrasi`** (API Mitra SIPLah dua sisi, pembukaan sumber dana di Mitra, transaksi Mitra ke BKU), serta **`svc-audit`** (jejak audit berantai hash SHA-256 dari semua layanan).
Rincian cakupan, alur, dan keputusan:
- [`docs/irisan-1-penatausahaan.md`](docs/irisan-1-penatausahaan.md) — BKU, belanja, persetujuan
- [`docs/irisan-2-setor-pajak.md`](docs/irisan-2-setor-pajak.md) — setor pajak (NTPN) & BKP Pajak
- [`docs/irisan-3-penutupan-buku-kas.md`](docs/irisan-3-penutupan-buku-kas.md) — penutupan buku kas bulanan, rekonsiliasi, berita acara
- [`docs/svc-pelaporan.md`](docs/svc-pelaporan.md) — laporan BKU bulanan PDF & tanda tangan (simulasi TTE)
- [`docs/svc-perencanaan.md`](docs/svc-perencanaan.md) — pagu, kertas kerja RKAS, validasi juknis, penelaahan & pengesahan Dinas
- [`docs/svc-identitas.md`](docs/svc-identitas.md) — SSO OIDC, sesi, peran aktif, JWT internal & JWKS, pengelolaan pengguna berjenjang
- [`docs/svc-referensi.md`](docs/svc-referensi.md) — referensi nasional (Balai SDSP), pajak daerah (Dinas), proyeksi lokal di layanan lain
- [`docs/svc-integrasi.md`](docs/svc-integrasi.md) — Mitra SIPLah: OAuth2 + IP + HMAC, pembukaan sumber dana, transaksi Mitra → BKU (UC-12, UC-34–39)
- [`docs/svc-bantuan.md`](docs/svc-bantuan.md) — Bantuan Pemerintah: juknis/panduan, penerima (impor Excel), pengesahan Balai, PKS & penyaluran, pengajuan sekolah (UC-17–29)
- [`docs/svc-pemantauan.md`](docs/svc-pemantauan.md) — HPP (rencana vs belanja Mitra), dasbor serapan & kepatuhan berjenjang (UC-30, UC-33)
- [`docs/svc-audit.md`](docs/svc-audit.md) — jejak audit append-only berantai hash, verifikasi & deteksi perusakan (UC-31)

```
apps/
  svc-referensi/       NestJS: wilayah, sekolah, sumber dana, komponen, kode rekening, tarif pajak (db_ref) — :3103
  svc-identitas/       NestJS: SSO OIDC, sesi, peran aktif, JWT internal & JWKS, pengguna (db_auth) — :3104
  svc-penatausahaan/   NestJS: BKU, BKP, pajak, periode (db_tatausaha) — :3105
  svc-pelaporan/       NestJS: laporan PDF & tanda tangan (db_pelaporan) — :3106
  svc-perencanaan/     NestJS: pagu, kertas kerja RKAS, penelaahan (db_perencanaan) — :3107
  svc-integrasi/       NestJS: API Mitra SIPLah /mitra/v1, pembukaan sumber dana, transaksi Mitra (db_integrasi) — :3109
  svc-bantuan/         NestJS: Bantuan Pemerintah, dokumen, penerima, penyaluran, pengajuan sekolah (db_banper) — :3111
  svc-pemantauan/      NestJS: HPP, serapan & kepatuhan, dasbor berjenjang (db_pemantauan) — :3110
  svc-audit/           NestJS: jejak audit berantai hash SHA-256, verifikasi rantai (db_audit) — :3108
  web/                 Next.js App Router + Tailwind + TanStack Query (halaman BKU & wizard belanja)
packages/
  aturan/              fungsi murni: hitungPajak, pilihTarifEfektif, transisi status, pemisahan tugas (uji unit >= 90%)
  kontrak/             skema Zod bersama + CloudEvents + topik broker
  common-ms/           DbContextService (RLS), ScopeGuard, ProblemFilter (RFC 9457), Outbox Relay, Inbox Consumer, broker Kafka/memori
db/<layanan>/migrations/           SQL per basis data layanan (Database-per-Service)
db/_bersama/                       templat SQL lintas layanan (trigger audit catat_audit)
scripts/               migrate, dev-keys, dev-token, terbit-kk-disahkan, jalankan-svc, mitra-tiruan (Mitra SIPLah dev)
```

## Prasyarat
Node 22, pnpm 10, PostgreSQL 16 (lokal atau `docker compose up -d postgres`).

## Menjalankan
```bash
pnpm install
```
```bash
cp .env.example .env
```
```bash
node scripts/dev-keys.mjs
```
```bash
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres node scripts/migrate.mjs svc-penatausahaan --seed
```
```bash
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres node scripts/migrate.mjs svc-pelaporan
```
```bash
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres node scripts/migrate.mjs svc-perencanaan --seed
```
```bash
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres node scripts/migrate.mjs svc-identitas --seed
```
```bash
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres node scripts/migrate.mjs svc-referensi --seed
```
```bash
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres node scripts/migrate.mjs svc-audit
```
```bash
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres node scripts/migrate.mjs svc-integrasi --seed
```
```bash
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres node scripts/migrate.mjs svc-pemantauan
```
```bash
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres node scripts/migrate.mjs svc-bantuan
```
```bash
pnpm build
```
Sepuluh terminal (sembilan layanan + Mitra tiruan), ditambah web:
```bash
./scripts/jalankan-svc.sh svc-identitas
```
```bash
./scripts/jalankan-svc.sh svc-referensi
```
```bash
./scripts/jalankan-svc.sh svc-perencanaan
```
```bash
./scripts/jalankan-svc.sh svc-penatausahaan
```
```bash
./scripts/jalankan-svc.sh svc-pelaporan
```
```bash
./scripts/jalankan-svc.sh svc-audit
```
```bash
./scripts/jalankan-svc.sh svc-integrasi
```
```bash
./scripts/jalankan-svc.sh svc-pemantauan
```
```bash
./scripts/jalankan-svc.sh svc-bantuan
```
```bash
node scripts/mitra-tiruan.mjs server
```
```bash
pnpm --filter @arkas/web start
```
Isi data demo lewat API (RKAS disusun & disahkan Dinas, transaksi, setor pajak, penutupan bulan berjalan; laporan dibuat otomatis):
```bash
node scripts/isi-demo.mjs 20100001
```
Buka http://localhost:3000. Masuk dengan salah satu pengguna contoh (mode dev) atau SSO bila `OIDC_*` diisi; ganti peran aktif di pojok kanan atas.

`terbit-kk-disahkan.mjs` masih tersedia untuk menjalankan svc-penatausahaan sendirian (tanpa svc-perencanaan). Antarlayanan di dev memakai `BROKER=http`: event outbox dikirim ke `/internal/v1/events` layanan pelanggan.

## Pengujian
```bash
pnpm --filter @arkas/aturan test
```
```bash
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm --filter @arkas/svc-penatausahaan test
```
```bash
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm --filter @arkas/svc-pelaporan test
```
Atau semuanya sekaligus (berurutan):
```bash
pnpm test
```
Uji integrasi membuat ulang basis data `db_tatausaha_uji` di PostgreSQL sungguhan pada setiap run.

### Uji UI menyeluruh (web)

Menguji halaman sungguhan lewat peramban (Playwright) terhadap tumpukan yang sedang berjalan: sepuluh proses + Mitra tiruan dari bagian *Menjalankan*, ditambah data demo yang bulan berjalannya masih terbuka.
```bash
DEMO_TANPA_TUTUP=1 node scripts/isi-demo.mjs 20100001
```
```bash
pnpm --filter @arkas/web e2e
```
Cakupan (`apps/web/e2e/`):
- Admin Dinas menetapkan, membebaskan, lalu memulihkan pajak daerah lewat UI, dan tarif baru terbukti berlaku di simulasi pajak Bendahara (lintas layanan lewat event).
- Admin Dinas ditolak membuka referensi nasional dan mengatur wilayah lain.
- Balai mengubah batas komponen dan menerbitkan ulang referensi.
- Kepala Sekolah menolak transaksi; Bendahara melihat alasannya, dan **Catat ulang** membuka formulir terisi.
- Mitra tiruan mengirim belanja SIPLah; Bendahara memetakan barang ke baris RKAS dan mencatatnya ke BKU; Balai melihat matriks pembukaan.
- Bantuan Pemerintah lintas 6 peran: Direktorat menyusun, Ditjen menyetujui juknis, Balai mengesahkan → referensi, pagu & pembukaan Mitra mengikuti → penyaluran → sekolah mengajukan PKS/RAB/SPTJM → Tim Kerja menyetujui.
- Pemantau menelusuri dasbor Nasional → provinsi → kabupaten → HPP sekolah; Verifikator Dinas terkunci ke wilayahnya.
- Perubahan Balai tercatat di **Jejak audit** Auditor dengan nilai sebelum/sesudah, dan rantai hash terverifikasi utuh; Kepala Sekolah hanya melihat rantai sekolahnya.

Uji memulihkan data yang diubahnya (di blok `finally`), jadi aman dijalankan berulang. Alamat web dapat diganti dengan `WEB_URL`.

## Kafka / Redpanda
`BROKER=kafka` dan `BROKER_BROKERS=localhost:19092` setelah `docker compose up -d redpanda`.

Adapter diperiksa terhadap broker sungguhan oleh `scripts/uji-kafka.mjs`: ia menerbitkan tiga CloudEvent lewat `KafkaBroker` yang sama dengan yang dipakai layanan, lalu memeriksa kelengkapan isi, fan-out ke dua grup konsumen, dan urutan per `subject`.

```bash
docker compose up -d redpanda
pnpm --filter @arkas/common-ms build
node scripts/uji-kafka.mjs            # BROKER_BROKERS untuk alamat lain
```

Pemeriksaan ini juga berjalan otomatis pada setiap push lewat job **kafka** di `.github/workflows/ci.yml` (Redpanda sebagai service container).

## Integrasi berkelanjutan & kontainer

`.github/workflows/ci.yml` menjalankan empat jenis pekerjaan pada setiap push dan pull request:

| Job | Isi |
|---|---|
| `uji` | `pnpm build`, `pnpm typecheck`, migrasi sembilan basis data pada PostgreSQL 16, lalu `pnpm test` (214 kasus uji) |
| `kafka` | `scripts/uji-kafka.mjs` terhadap Redpanda sungguhan |
| `kontainer` | Membangun citra sembilan layanan dari `Dockerfile` (matriks, cache GHA) |
| `kontainer-web` | Membangun citra Next.js dari `Dockerfile.web` |

Membangun citra secara manual:

```bash
docker build --build-arg LAYANAN=svc-penatausahaan -t arkas/svc-penatausahaan .
docker build -f Dockerfile.web -t arkas/web .
```

Keduanya multi-stage, berjalan sebagai pengguna tak-root, dan hanya memasang dependensi produksi pada tahap akhir.

## Dokumentasi pengembangan

Dokumen teknis lengkap (arsitektur, model data, kontrak antarlayanan, keamanan, pengujian, operasional) dalam DOCX & PDF: [docs/buku-pengembangan](docs/buku-pengembangan/README.md).

## Kode sumber sebagai dokumen

Seluruh kode sumber dicetak per unit (DOCX & PDF, 486 halaman): [docs/kode-sumber](docs/kode-sumber/README.md).

## Buku untuk sekolah

Buku Panduan dan Buku Tutorial ARKAS Web untuk Sekolah (DOCX & PDF): [docs/buku-sekolah](docs/buku-sekolah/README.md).
