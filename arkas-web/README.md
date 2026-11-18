# ARKAS Web — monorepo microservices

Implementasi bertahap dari *Dokumen Rancangan Teknis ARKAS Berbasis Web (Edisi Microservices)*.
Isi saat ini: **irisan vertikal 1 `svc-penatausahaan`** — RKAS disahkan → catat penerimaan/tarik tunai/belanja → persetujuan Kepala Sekolah → event `TransaksiDisetujui`.
Rincian cakupan, alur, dan keputusan: [`docs/irisan-1-penatausahaan.md`](docs/irisan-1-penatausahaan.md).

```
apps/
  svc-penatausahaan/   NestJS: BKU, BKP, pajak, periode (db_tatausaha)
  web/                 Next.js App Router + Tailwind + TanStack Query (halaman BKU & wizard belanja)
packages/
  aturan/              fungsi murni: hitungPajak, transisi status, pemisahan tugas (uji unit >= 90%)
  kontrak/             skema Zod bersama + CloudEvents + topik broker
  common-ms/           DbContextService (RLS), ScopeGuard, ProblemFilter (RFC 9457), Outbox Relay, Inbox Consumer, broker Kafka/memori
db/svc-penatausahaan/migrations/   00_init, 10_tabel, 20_grants_rls, 30_triggers, 90_seed_dev
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
pnpm build
```
```bash
./scripts/jalankan-svc.sh
```
Di terminal lain:
```bash
node scripts/terbit-kk-disahkan.mjs 20100001
```
```bash
pnpm --filter @arkas/web start
```
Buka http://localhost:3000. Ganti peran Bendahara/Kepala Sekolah di pojok kanan atas.

`terbit-kk-disahkan.mjs` menggantikan svc-perencanaan yang belum dirilis: ia menerbitkan event `KertasKerjaDisahkan` contoh sehingga RKAS dan periode bulan berjalan tersedia.

## Pengujian
```bash
pnpm --filter @arkas/aturan test
```
```bash
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm --filter @arkas/svc-penatausahaan test
```
Uji integrasi membuat ulang basis data `db_tatausaha_uji` di PostgreSQL sungguhan pada setiap run.

## Kafka / Redpanda
`BROKER=kafka` dan `BROKER_BROKERS=localhost:19092` setelah `docker compose up -d redpanda`. Adapter Kafka sudah dikompilasi tetapi **belum diuji terhadap broker sungguhan** (lihat dokumen irisan).
