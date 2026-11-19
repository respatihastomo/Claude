<#
.SYNOPSIS
  Menghentikan seluruh proses ARKAS Web yang dijalankan jalankan-semua.ps1.
#>
[CmdletBinding()]

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\env-lokal.ps1"
$akar = Get-AkarRepo
$berkasPid = Join-Path $akar '.lokal-pid.json'

if (-not (Test-Path $berkasPid)) {
  Write-Host 'Berkas .lokal-pid.json tidak ada — sepertinya tidak ada yang berjalan.' -ForegroundColor Yellow
  exit 0
}

$daftar = Get-Content -LiteralPath $berkasPid -Raw | ConvertFrom-Json
# Menghentikan satu proses beserta anak-anaknya (cmd.exe -> pnpm -> node).
function Stop-PohonProses {
  param([int]$ProsesId)
  $anak = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProsesId" -ErrorAction SilentlyContinue
  foreach ($a in $anak) { Stop-PohonProses -ProsesId ([int]$a.ProcessId) }
  Stop-Process -Id $ProsesId -Force -ErrorAction SilentlyContinue
}

foreach ($p in $daftar) {
  $proc = Get-Process -Id $p.pid -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-PohonProses -ProsesId ([int]$p.pid)
    Write-Host ("  dihentikan  {0,-20} PID {1}" -f $p.nama, $p.pid) -ForegroundColor Green
  } else {
    Write-Host ("  (sudah mati) {0,-19} PID {1}" -f $p.nama, $p.pid) -ForegroundColor DarkGray
  }
}
Remove-Item -LiteralPath $berkasPid -ErrorAction SilentlyContinue
Write-Host "`nSelesai.`n"
