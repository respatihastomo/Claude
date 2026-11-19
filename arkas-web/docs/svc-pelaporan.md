# svc-pelaporan — laporan BKU bulanan & tanda tangan

Rujukan rencana: 3.4 (svc-pelaporan: laporan PDF/XLSX, TTE BSrE; konsumsi `PeriodeDitutup`, `TransaksiDisetujui`; terbitkan `LaporanDitandatangani`), 7.3 (db_pelaporan: `laporan` + proyeksi `bku_periode_ringkas`), 18 Tahap 1 (kriteria keluar: `KertasKerjaDisahkan → PeriodeDitutup → LaporanDitandatangani` tanpa selisih).

## Alur
```mermaid
sequenceDiagram
  participant T as svc-penatausahaan
  participant P as svc-pelaporan
  participant DB as db_pelaporan
  participant K as Kepala Sekolah
  T-->>P: TransaksiDisetujui (tiap transaksi) — proyeksi bku_transaksi_lokal
  T-->>P: PeriodeDitutup — proyeksi bku_periode_ringkas + laporan MENUNGGU
  loop pekerja pembuat (FOR UPDATE SKIP LOCKED)
    P->>DB: klaim laporan, susun baris BKU, periksa konsistensi vs ringkasan
    alt data belum lengkap (event belum tiba)
      P->>DB: MENUNGGU + backoff; setelah 8 percobaan -> GAGAL
    else konsisten
      P->>P: HTML -> PDF (Chromium dev / Gotenberg), simpan, SHA-256 -> SIAP
    end
  end
  K->>P: POST /laporan/{id}/tandatangani (If-Match)
  P->>DB: PDF bertanda (berkas baru), DITANDATANGANI + outbox
  P-->>T: LaporanDitandatangani (pelanggan: svc-integrasi, svc-pemantauan — belum dirilis)
```

**Konsistensi antarlayanan.** Event dari topik berbeda bisa tiba tidak berurutan. Sebelum PDF dibuat, baris BKU yang disusun dari proyeksi `TransaksiDisetujui` dicocokkan dengan ringkasan yang dibekukan di `PeriodeDitutup`, yaitu jumlah transaksi serta penerimaan dan pengeluaran tiap buku. Laporan baru dibuat bila semuanya cocok. Ini menjawab kriteria keluar Tahap 1, "tanpa selisih".

## API (11.2.12 — gateway `/api/v1/laporan*`)
| Metode & path | Peran | Catatan |
|---|---|---|
| `GET /api/v1/laporan?npsn&tahun&sumberDanaKode` | semua (cakupan + RLS) | daftar laporan & status |
| `GET /api/v1/laporan/{id}` | semua (RLS) | `ETag` |
| `GET /api/v1/laporan/{id}/berkas[?versi=asli]` | semua (RLS) | PDF; SHA-256 diperiksa ulang tiap unduhan, `ETag` = SHA-256 |
| `POST /api/v1/laporan/{id}/tandatangani` | KEPSEK | `If-Match`; hanya status `SIAP` |

## Adapter (port & adapter)
| Port | Dev (dipakai di sini) | Produksi | Status |
|---|---|---|---|
| Broker | `memory` (uji), `http` (lintas proses: POST CloudEvent ke `/internal/v1/events`, ulang via outbox) | `kafka` | Kafka belum diuji pada broker sungguhan |
| PDF | `chromium` (Playwright lokal) | `gotenberg` (`GOTENBERG_URL`) | Gotenberg belum diuji |
| Penyimpanan | folder lokal `PENYIMPANAN_DIR` | object storage S3 | adapter S3 belum dibuat |
| TTE | `simulasi` — **bukan TTE yang sah**, label jelas di PDF dan UI | BSrE (PAdES) | belum tersedia; butuh kontrak & sertifikat |

## Basis data (`db/svc-pelaporan/migrations`)
- `laporan` (MENUNGGU → SIAP → DITANDATANGANI, atau GAGAL) dengan antrean, SHA-256 berkas asli & bertanda, `row_version`.
- Trigger `jaga_laporan`: laporan bertanda final; tanda tangan hanya dari SIAP; identitas tidak dapat diubah; larangan hapus.
- RLS: baca per NPSN; UPDATE tanda tangan hanya oleh KEPSEK sekolah itu, dari status SIAP, oleh pengguna sendiri.
- Role terpisah `api_pelaporan_login` / `worker_pelaporan_login` (BYPASSRLS untuk konsumen & pekerja).

## Menjalankan (dev)
```bash
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres node scripts/migrate.mjs svc-pelaporan
```
```bash
./scripts/jalankan-svc.sh svc-pelaporan
```
`node scripts/isi-demo.mjs` mengisi alur lengkap lewat API, yang berakhir dengan laporan bulan berjalan dibuat otomatis.

## Pengujian
- 6 uji unit (`test/bku.spec.ts`):
  - aturan baris BKU sama dengan `tatausaha.v_mutasi`;
  - pemeriksaan konsistensi;
  - escape HTML;
  - label DRAF dan simulasi TTE.
- 7 uji integrasi (`test/pelaporan.e2e.spec.ts`, PostgreSQL & Chromium sungguhan):
  - event tiba tidak berurutan, laporan menunggu lalu SIAP;
  - event ganda diproses sekali;
  - unduh PDF dengan integritas SHA-256;
  - cakupan sekolah & RLS;
  - tanda tangan: peran, If-Match, dan event terbit;
  - laporan bertanda final, juga terhadap superuser;
  - berkas yang dirusak terdeteksi;
  - data yang tak pernah konsisten berakhir GAGAL;
  - event cacat ditolak 422.
- Uji menyeluruh tiga proses (svc-penatausahaan + svc-pelaporan + web) lewat `BROKER=http`: tangkapan `docs/tangkapan/15–16`.

## Catatan operasional
- `PDF=chromium` memuat Playwright yang terpasang di mesin (bukan dependensi paket). Turborepo meneruskan `NODE_PATH` dan `PLAYWRIGHT_BROWSERS_PATH` ke tugas uji (`turbo.json` `passThroughEnv`).
- Role login PostgreSQL berlaku untuk seluruh klaster. Uji memakai kata sandi yang sama dengan dev (`API_DB_PASSWORD`/`WORKER_DB_PASSWORD`), sehingga menjalankan uji tidak memutus layanan dev yang sedang berjalan. Bug ini ditemukan dan diperbaiki di irisan ini.

## Belum ada
Laporan XLSX dan laporan tahunan/realisasi, adapter S3, TTE BSrE, tanda tangan Bendahara, nama pengguna dari svc-identitas (PDF masih menampilkan ID), serta pelanggan `LaporanDitandatangani`.
