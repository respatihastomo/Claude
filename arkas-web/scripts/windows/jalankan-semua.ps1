<#
.SYNOPSIS
  Menjalankan sembilan layanan, Mitra SIPLah tiruan, dan aplikasi web di komputer lokal.
  Keluaran tiap proses ditulis ke folder logs\, dan PID-nya disimpan agar bisa dihentikan.

.EXAMPLE
  .\scripts\windows\jalankan-semua.ps1
  .\scripts\windows\jalankan-semua.ps1 -Mode dev      # web memakai next dev (muat ulang otomatis)
#>
[CmdletBinding()]
param(
  [ValidateSet('start', 'dev')][string]$Mode = 'start',
  [switch]$TanpaWeb,
  [switch]$TanpaMitra
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\env-lokal.ps1"
$akar = Get-AkarRepo
Set-Location $akar

$dirLog = Join-Path $akar 'logs'
New-Item -ItemType Directory -Force -Path $dirLog | Out-Null
$berkasPid = Join-Path $akar '.lokal-pid.json'
$proses = @()

function Jalankan-Proses {
  param([string]$Nama, [string]$Berkas, [string[]]$Argumen, [string]$DirKerja, [hashtable]$Variabel = @{})
  $disetel = @()
  foreach ($k in $Variabel.Keys) { Set-Item -Path "Env:$k" -Value $Variabel[$k]; $disetel += $k }
  try {
    $p = Start-Process -FilePath $Berkas -ArgumentList $Argumen -WorkingDirectory $DirKerja `
      -RedirectStandardOutput (Join-Path $dirLog "$Nama.log") `
      -RedirectStandardError  (Join-Path $dirLog "$Nama.err.log") `
      -WindowStyle Hidden -PassThru
  } finally {
    foreach ($k in $disetel) { Remove-Item -Path "Env:$k" -ErrorAction SilentlyContinue }
  }
  Write-Host ("  dijalankan  {0,-20} PID {1}" -f $Nama, $p.Id)
  return [pscustomobject]@{ nama = $Nama; pid = $p.Id }
}

Write-Host "`n=== Menjalankan layanan ===" -ForegroundColor Cyan
foreach ($nama in $Global:ArkasLayanan.Keys) {
  $dist = Join-Path $akar "apps\$nama\dist\main.js"
  if (-not (Test-Path $dist)) {
    Write-Host "  [!] $nama belum dibangun. Jalankan 'pnpm build' lebih dulu." -ForegroundColor Red
    continue
  }
  $env1 = Read-BerkasEnv (Get-PathEnvLayanan $nama)
  $proses += Jalankan-Proses -Nama $nama -Berkas 'node' -Argumen @('dist\main.js') -DirKerja (Join-Path $akar "apps\$nama") -Variabel $env1
}

if (-not $TanpaMitra) {
  Write-Host "`n=== Mitra SIPLah tiruan ===" -ForegroundColor Cyan
  $proses += Jalankan-Proses -Nama 'mitra-tiruan' -Berkas 'node' -Argumen @('scripts\mitra-tiruan.mjs', 'server') -DirKerja $akar
}

if (-not $TanpaWeb) {
  Write-Host "`n=== Aplikasi web ===" -ForegroundColor Cyan
  # pnpm dipanggil lewat cmd.exe: shim pnpm berupa .cmd/.ps1 yang tidak bisa dieksekusi langsung
  $proses += Jalankan-Proses -Nama 'web' -Berkas 'cmd.exe' -Argumen @('/c', "pnpm --filter @arkas/web $Mode") -DirKerja $akar
}

$proses | ConvertTo-Json | Set-Content -LiteralPath $berkasPid -Encoding UTF8

Write-Host "`n=== Menunggu layanan siap ===" -ForegroundColor Cyan
$batas = (Get-Date).AddSeconds(90)
$belum = @($Global:ArkasLayanan.Keys)
while ($belum.Count -gt 0 -and (Get-Date) -lt $batas) {
  Start-Sleep -Seconds 3
  $belum = @($belum | Where-Object { -not (Test-PortHidup $Global:ArkasLayanan[$_].Port) })
}

Write-Host ''
foreach ($nama in $Global:ArkasLayanan.Keys) {
  $port = $Global:ArkasLayanan[$nama].Port
  $hidup = Test-PortHidup $port
  $tanda = if ($hidup) { '[ok]' } else { '[!] ' }
  $warna = if ($hidup) { 'Green' } else { 'Red' }
  Write-Host ("  {0} {1,-20} :{2}" -f $tanda, $nama, $port) -ForegroundColor $warna
}
if (-not $TanpaMitra) {
  $t = '[!] '; if (Test-PortHidup 3190) { $t = '[ok]' }
  Write-Host ("  {0} {1,-20} :3190" -f $t, 'mitra-tiruan')
}
if (-not $TanpaWeb) {
  # web butuh waktu lebih lama untuk siap; beri kesempatan sampai 60 detik
  $batasWeb = (Get-Date).AddSeconds(60)
  while (-not (Test-PortHidup 3000) -and (Get-Date) -lt $batasWeb) { Start-Sleep -Seconds 3 }
  $t = '[!] '; if (Test-PortHidup 3000) { $t = '[ok]' }
  Write-Host ("  {0} {1,-20} :3000" -f $t, 'web')
}

Write-Host "`nBuka http://localhost:3000 di peramban." -ForegroundColor Green
Write-Host "Log ada di folder logs\.  Menghentikan:  .\scripts\windows\hentikan-semua.ps1`n"
