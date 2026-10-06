#!/usr/bin/env bash
# Compila la app Vega.
#   scripts/build.sh            → Debug
#   scripts/build.sh Release    → Release
# Marca: VEGA_BRAND=intv (por defecto).
set -euo pipefail
cd "$(dirname "$0")/.."

BUILD_TYPE="${1:-Debug}"
export PATH="/usr/local/opt/node@20/bin:$PATH"
# shellcheck disable=SC1090
source ~/vega/env >/dev/null

node scripts/gen-env.js
node scripts/gen-brand-assets.js
# id y título del paquete según la marca; se vuelve a intv al terminar.
node scripts/brand-package.js apply
trap 'node scripts/brand-package.js restore >/dev/null' EXIT
# El plugin de Babel incrusta valores del .env.local: sin esto Metro
# reutilizaría transformaciones viejas.
rm -rf "${TMPDIR:-/tmp}"/metro-* "${TMPDIR:-/tmp}"/haste-map-* 2>/dev/null || true

npx react-native build-vega --build-type "$BUILD_TYPE"
