# Menjalankan ARKAS Web di komputer Windows

Versi ringkas dari `Tutorial-Menjalankan-ARKAS-Web-di-Windows.docx` (18 halaman, tersedia juga sebagai PDF).

## Ringkasan

| | |
|---|---|
| Yang berjalan | 9 layanan (:3103–:3111), web (:3000), Mitra SIPLah tiruan (:3190) |
| Basis data | 9 basis data pada satu server PostgreSQL 16 |
| Prasyarat | Node.js 22, pnpm 10, PostgreSQL 16, Git |
| Waktu pemasangan | ± 30 menit sekali jalan |

## 1. Prasyarat

PowerShell **sebagai administrator**:

```powershell
winget install OpenJS.NodeJS.LTS
winget install PostgreSQL.PostgreSQL.16
winget install Git.Git
```

Catat kata sandi pengguna `postgres` yang diminta pemasang PostgreSQL. **Tutup PowerShell lalu buka lagi**, kemudian:

```powershell
corepack enable
node --version   # v22 ke atas
pnpm --version   # 10.x
psql --version   # 16.x
```

`psql` tidak dikenali? Tambahkan ke PATH, lalu buka PowerShell baru:

```powershell
$bin = "C:\Program Files\PostgreSQL\16\bin"
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$bin", "User")
```

## 2. Mengambil kode

```powershell
mkdir C:\kerja -Force
cd C:\kerja
git clone https://github.com/respatihastomo/Claude.git arkas-web
cd arkas-web
```

## 3. Pemasangan sekali jalan

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
.\scripts\windows\pasang-lokal.ps1
# bila sandi postgres bukan "postgres":
.\scripts\windows\pasang-lokal.ps1 -SandiPostgres "sandimu"
```

Skrip memeriksa prasyarat, menjalankan `pnpm install`, membuat kunci pengembangan, menyalin `.env.*.example` → `.env.*`, menjalankan `pnpm build`, lalu menyiapkan sembilan basis data beserta data contoh.

## 4. Menjalankan

```powershell
.\scripts\windows\jalankan-semua.ps1          # semua proses, log ke logs\
.\scripts\windows\jalankan-semua.ps1 -Mode dev  # web dengan muat ulang otomatis
.\scripts\windows\hentikan-semua.ps1
```

Buka **http://localhost:3000**. SSO tidak dikonfigurasi di lokal, jadi halaman masuk menampilkan akun contoh — klik salah satunya.

| Akun | Peran |
|---|---|
| Dewi Lestari | Operator — SMP Swasta Contoh 2 |
| Ahmad Fauzi | Bendahara |
| Hj. Siti Aminah, M.Pd. | Kepala Sekolah |
| Bambang Wijaya | Komite Sekolah |
| Rudi Setiawan | Verifikator Dinas wilayah 3202 |
| Admin Balai SDSP | Balai SDSP — nasional |

## 5. Menelusuri galat

```powershell
Get-Content .\logs\svc-penatausahaan.log -Wait -Tail 40
Get-Content .\logs\svc-penatausahaan.err.log -Tail 40
.\scripts\windows\jalankan-svc.ps1 svc-penatausahaan   # satu layanan, log di layar
```

| Gejala | Solusi |
|---|---|
| `running scripts is disabled` | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` |
| `node`/`pnpm`/`psql` tidak dikenali | Tutup dan buka ulang PowerShell; untuk psql lihat bagian 1 |
| `SASL: client password must be a string` | Jalankan ulang dengan `-SandiPostgres "sandimu"` |
| `EADDRINUSE` | `.\scripts\windows\hentikan-semua.ps1`, lalu `Get-NetTCPConnection -LocalPort 3105` |
| `belum dibangun` | `pnpm build` |
| `pnpm install` lambat | Kecualikan folder repo dari pemindaian Windows Security |
| Ingin data contoh kembali bersih | `node scripts/migrate.mjs <layanan> --fresh --seed` |

## 6. Sehari-hari

```powershell
git pull; pnpm install; pnpm build        # setelah menarik perubahan

$env:DATABASE_ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres"
$env:API_DB_PASSWORD = "api_dev"; $env:WORKER_DB_PASSWORD = "worker_dev"
pnpm test                                  # 214 kasus uji
```

## Berkas pendukung

| Berkas | Isi |
|---|---|
| `scripts/windows/pasang-lokal.ps1` | Pemasangan sekali jalan |
| `scripts/windows/jalankan-semua.ps1` | Menyalakan semuanya dan menunggu port siap |
| `scripts/windows/hentikan-semua.ps1` | Menghentikan proses beserta anak-anaknya |
| `scripts/windows/jalankan-svc.ps1` | Menjalankan satu layanan dengan log di layar |
| `scripts/windows/env-lokal.ps1` | Fungsi bersama: daftar layanan, pembaca `.env`, pemeriksa port |

> Catatan: skrip PowerShell ini belum pernah dijalankan di Windows sungguhan oleh penyusunnya — lingkungan pembuatannya Linux. Langkah-langkah di baliknya sudah terbukti, tetapi bila ada yang tersendat, Lampiran C pada dokumen DOCX memuat seluruh langkah manualnya.
