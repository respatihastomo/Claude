#!/usr/bin/env bash
# Menjalankan svc-penatausahaan dengan konfigurasi dev (.env di root bila ada, else .env.example).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source "${ENV_FILE:-$( [ -f .env ] && echo .env || echo .env.example )}"; set +a
cd apps/svc-penatausahaan
exec node dist/main.js
