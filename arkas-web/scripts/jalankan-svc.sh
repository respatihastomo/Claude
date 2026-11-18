#!/usr/bin/env bash
# Menjalankan satu layanan dengan konfigurasi dev: scripts/jalankan-svc.sh [svc-identitas|svc-perencanaan|svc-penatausahaan|svc-pelaporan]
# Berkas env: .env / .env.example (penatausahaan) atau .env.pelaporan / .env.pelaporan.example (pelaporan); ENV_FILE untuk menimpa.
set -euo pipefail
cd "$(dirname "$0")/.."
SVC="${1:-svc-penatausahaan}"
case "$SVC" in
  svc-penatausahaan) dasar=".env" ;;
  svc-pelaporan) dasar=".env.pelaporan" ;;
  svc-perencanaan) dasar=".env.perencanaan" ;;
  svc-identitas) dasar=".env.identitas" ;;
  *) echo "layanan tidak dikenal: $SVC" >&2; exit 2 ;;
esac
set -a; source "${ENV_FILE:-$( [ -f "$dasar" ] && echo "$dasar" || echo "$dasar.example" )}"; set +a
cd "apps/$SVC"
exec node dist/main.js
