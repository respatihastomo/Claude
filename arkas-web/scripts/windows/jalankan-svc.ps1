<#
.SYNOPSIS
  Menjalankan SATU layanan di jendela ini (log tampil langsung). Berguna saat menelusuri galat.

.EXAMPLE
  .\scripts\windows\jalankan-svc.ps1 svc-penatausahaan
#>
[CmdletBinding()]
param([Parameter(Mandatory, Position = 0)][string]$Layanan)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\env-lokal.ps1"
if (-not $Global:ArkasLayanan.Contains($Layanan)) {
  Write-Host "Layanan tidak dikenal: $Layanan" -ForegroundColor Red
  Write-Host ("Pilihan: " + ($Global:ArkasLayanan.Keys -join ', '))
  exit 2
}
$akar = Get-AkarRepo
$berkasEnv = Get-PathEnvLayanan $Layanan
Write-Host "Konfigurasi: $berkasEnv" -ForegroundColor DarkGray
foreach ($kv in (Read-BerkasEnv $berkasEnv).GetEnumerator()) { Set-Item -Path "Env:$($kv.Key)" -Value $kv.Value }
Set-Location (Join-Path $akar "apps\$Layanan")
Write-Host "Menjalankan $Layanan di port $($Global:ArkasLayanan[$Layanan].Port) — Ctrl+C untuk berhenti.`n" -ForegroundColor Cyan
& node dist\main.js
