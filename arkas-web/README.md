# ARKAS Web — monorepo microservices

Implementasi bertahap dari *Dokumen Rancangan Teknis ARKAS Berbasis Web (Edisi Microservices)*.
Isi saat ini: **`svc-penatausahaan` (irisan 1–3) dan `svc-pelaporan`** — RKAS disahkan → catat penerimaan/tarik tunai/belanja → persetujuan Kepala Sekolah → event `TransaksiDisetujui`.
Rincian cakupan, alur, dan keputusan:
- [`docs/irisan-1-penatausahaan.md`](docs/irisan-1-penatausahaan.md) — BKU, belanja, persetujuan
- [`docs/irisan-2-setor-pajak.md`](docs/irisan-2-setor-pajak.md) — setor pajak (NTPN) & BKP Pajak
- [`docs/irisan-3-penutupan-buku-kas.md`](docs/irisan-3-penutupan-buku-kas.md) — penutupan buku kas bulanan, rekonsiliasi, berita acara
- [`docs/svc-pelaporan.md`](docs/svc-pelaporan.md) — laporan BKU bulanan PDF & tanda tangan (simulasi TTE)

```
apps/
  svc-penatausahaan/   NestJS: BKU, BKP, pajak, periode (db_tatausaha) — :3105
  svc-pelaporan/       NestJS: laporan PDF & tanda tangan (db_pelaporan) — :3106
  web/                 Next.js App Router + Tailwind + TanStack Query (halaman BKU & wizard belanja)
packages/
  aturan/              fungsi murni: hitungPajak, transisi status, pemisahan tugas (uji unit >= 90%)
  kontrak/             skema Zod bersama + CloudEvents + topik broker
  common-ms/           DbContextService (RLS), ScopeGuard, ProblemFilter (RFC 9457), Outbox Relay, Inbox Consumer, broker Kafka/memori
db/<layanan>/migrations/           SQL per basis data layanan (Database-per-Service)
scripts/               migrate, dev-keys, dev-token, terbit-kk-disahkan, jalankan-svc
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
pnpm build
```
Tiga terminal:
```bash
./scripts/jalankan-svc.sh svc-penatausahaan
```
```bash
./scripts/jalankan-svc.sh svc-pelaporan
```
```bash
pnpm --filter @arkas/web start
```
Isi data demo lewat API (RKAS disahkan, transaksi, setor pajak, penutupan bulan berjalan; laporan dibuat otomatis):
```bash
node scripts/isi-demo.mjs 20100001
```
Buka http://localhost:3000. Ganti peran Bendahara/Kepala Sekolah di pojok kanan atas.

`terbit-kk-disahkan.mjs` (dipanggil `isi-demo.mjs`) menggantikan svc-perencanaan yang belum dirilis dengan menerbitkan `KertasKerjaDisahkan` contoh. Antarlayanan di dev memakai `BROKER=http`: event outbox dikirim ke `/internal/v1/events` layanan pelanggan.

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
Uji integrasi membuat ulang basis data `db_tatausaha_uji` di PostgreSQL sungguhan pada setiap run.

## Kafka / Redpanda
`BROKER=kafka` dan `BROKER_BROKERS=localhost:19092` setelah `docker compose up -d redpanda`. Adapter Kafka sudah dikompilasi tetapi **belum diuji terhadap broker sungguhan** (lihat dokumen irisan).
