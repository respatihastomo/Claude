# Fungsi bersama skrip Windows: membaca berkas .env dan memetakan layanan.
# Di-dot-source oleh skrip lain:  . "$PSScriptRoot\env-lokal.ps1"

$Global:ArkasLayanan = [ordered]@{
  'svc-referensi'     = @{ Port = 3103; Env = '.env.referensi' }
  'svc-identitas'     = @{ Port = 3104; Env = '.env.identitas' }
  'svc-penatausahaan' = @{ Port = 3105; Env = '.env' }
  'svc-pelaporan'     = @{ Port = 3106; Env = '.env.pelaporan' }
  'svc-perencanaan'   = @{ Port = 3107; Env = '.env.perencanaan' }
  'svc-audit'         = @{ Port = 3108; Env = '.env.audit' }
  'svc-integrasi'     = @{ Port = 3109; Env = '.env.integrasi' }
  'svc-pemantauan'    = @{ Port = 3110; Env = '.env.pemantauan' }
  'svc-bantuan'       = @{ Port = 3111; Env = '.env.bantuan' }
}

function Get-AkarRepo {
  return (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

# Membaca berkas .env menjadi hashtable. Tanda kutip di sekeliling nilai dibuang,
# baris kosong dan komentar diabaikan.
function Read-BerkasEnv {
  param([Parameter(Mandatory)][string]$Path)
  $hasil = @{}
  if (-not (Test-Path $Path)) { return $hasil }
  foreach ($baris in Get-Content -LiteralPath $Path -Encoding UTF8) {
    $t = $baris.Trim()
    if ($t -eq '' -or $t.StartsWith('#')) { continue }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { continue }
    $nama = $t.Substring(0, $i).Trim()
    $nilai = $t.Substring($i + 1).Trim()
    if ($nilai.Length -ge 2 -and (($nilai.StartsWith("'") -and $nilai.EndsWith("'")) -or ($nilai.StartsWith('"') -and $nilai.EndsWith('"')))) {
      $nilai = $nilai.Substring(1, $nilai.Length - 2)
    }
    $hasil[$nama] = $nilai
  }
  return $hasil
}

# Berkas env yang dipakai sebuah layanan: .env.<x> bila ada, selain itu contohnya.
function Get-PathEnvLayanan {
  param([Parameter(Mandatory)][string]$Layanan)
  $akar = Get-AkarRepo
  $dasar = Join-Path $akar $Global:ArkasLayanan[$Layanan].Env
  if (Test-Path $dasar) { return $dasar }
  return "$dasar.example"
}

function Test-PortHidup {
  param([int]$Port)
  try { return (Test-NetConnection -ComputerName 'localhost' -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue) }
  catch { return $false }
}
