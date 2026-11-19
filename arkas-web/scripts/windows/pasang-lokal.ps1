<#
.SYNOPSIS
  Menyiapkan ARKAS Web di komputer Windows: memeriksa prasyarat, memasang dependensi,
  membuat kunci pengembangan, menyalin berkas konfigurasi, membangun, lalu menyiapkan
  sembilan basis data beserta data contoh.

.EXAMPLE
  .\scripts\windows\pasang-lokal.ps1
  .\scripts\windows\pasang-lokal.ps1 -SandiPostgres 'rahasia' -LewatiMigrasi
#>
[CmdletBinding()]
param(
  [string]$SandiPostgres = 'postgres',
  [string]$HostPostgres = 'localhost',
  [int]$PortPostgres = 5432,
  [switch]$LewatiMigrasi
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\env-lokal.ps1"
$akar = Get-AkarRepo
Set-Location $akar

function Tulis-Judul($teks) { Write-Host "`n=== $teks ===" -ForegroundColor Cyan }
function Tulis-Ok($teks)    { Write-Host "  [ok] $teks" -ForegroundColor Green }
function Tulis-Gagal($teks) { Write-Host "  [!]  $teks" -ForegroundColor Red }

# ---------------------------------------------------------------- prasyarat
Tulis-Judul 'Memeriksa prasyarat'

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Tulis-Gagal 'Node.js tidak ditemukan. Pasang dengan:  winget install OpenJS.NodeJS.LTS'; exit 1 }
$versiNode = (& node --version).TrimStart('v')
if ([int]($versiNode.Split('.')[0]) -lt 22) { Tulis-Gagal "Node 22 ke atas dibutuhkan, yang terpasang $versiNode"; exit 1 }
Tulis-Ok "Node $versiNode"

& corepack enable 2>$null | Out-Null
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) { Tulis-Gagal 'pnpm tidak ditemukan. Jalankan:  corepack enable'; exit 1 }
Tulis-Ok "pnpm $(& pnpm --version)"

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  Tulis-Gagal 'psql tidak ditemukan. Pasang PostgreSQL 16:  winget install PostgreSQL.PostgreSQL.16'
  Write-Host '      Lalu tambahkan C:\Program Files\PostgreSQL\16\bin ke PATH dan buka ulang PowerShell.'
  exit 1
}
$env:PGPASSWORD = $SandiPostgres
$cek = & psql -U postgres -h $HostPostgres -p $PortPostgres -tAc 'select 1' 2>&1
if ($LASTEXITCODE -ne 0) { Tulis-Gagal "Tidak bisa masuk ke PostgreSQL sebagai 'postgres'. Pesan: $cek"; exit 1 }
Tulis-Ok "PostgreSQL di ${HostPostgres}:${PortPostgres} dapat dihubungi"

# ---------------------------------------------------------------- dependensi
Tulis-Judul 'Memasang dependensi (pnpm install)'
& pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { Tulis-Gagal 'pnpm install gagal'; exit 1 }
Tulis-Ok 'Dependensi terpasang'

# ---------------------------------------------------------------- kunci dev
Tulis-Judul 'Membuat kunci pengembangan'
if (Test-Path (Join-Path $akar '.dev-keys\private.pem')) {
  Tulis-Ok 'Kunci sudah ada, dilewati'
} else {
  & node scripts/dev-keys.mjs
  Tulis-Ok 'Kunci EdDSA dibuat di .dev-keys\'
}

# ---------------------------------------------------------------- berkas env
Tulis-Judul 'Menyiapkan berkas konfigurasi'
foreach ($nama in $Global:ArkasLayanan.Keys) {
  $tujuan = Join-Path $akar $Global:ArkasLayanan[$nama].Env
  $contoh = "$tujuan.example"
  if (Test-Path $tujuan) { Write-Host "  (ada)  $(Split-Path $tujuan -Leaf)" }
  elseif (Test-Path $contoh) { Copy-Item $contoh $tujuan; Tulis-Ok "$(Split-Path $tujuan -Leaf) disalin dari contoh" }
  else { Tulis-Gagal "contoh tidak ditemukan: $contoh" }
}

# ---------------------------------------------------------------- build
Tulis-Judul 'Membangun seluruh paket (pnpm build)'
& pnpm build
if ($LASTEXITCODE -ne 0) { Tulis-Gagal 'pnpm build gagal'; exit 1 }
Tulis-Ok 'Build selesai'

# ---------------------------------------------------------------- basis data
if ($LewatiMigrasi) {
  Write-Host "`nMigrasi dilewati atas permintaan (-LewatiMigrasi)." -ForegroundColor Yellow
} else {
  Tulis-Judul 'Menyiapkan sembilan basis data'
  $env:DATABASE_ADMIN_URL = "postgres://postgres:$SandiPostgres@${HostPostgres}:${PortPostgres}/postgres"
  foreach ($nama in $Global:ArkasLayanan.Keys) {
    Write-Host "  - $nama"
    & node scripts/migrate.mjs $nama --seed
    if ($LASTEXITCODE -ne 0) { Tulis-Gagal "migrasi $nama gagal"; exit 1 }
  }
  Tulis-Ok 'Seluruh basis data siap beserta data contoh'
}

Write-Host "`nPemasangan selesai." -ForegroundColor Green
Write-Host "Langkah berikutnya:  .\scripts\windows\jalankan-semua.ps1`n"
