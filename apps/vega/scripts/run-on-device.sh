#!/usr/bin/env bash
# Instala y abre la app en el Fire TV.
#   scripts/run-on-device.sh [ip] [Debug|Release]   (por defecto 192.168.4.218, Debug)
# Los logs de desarrollo llegan a scripts/logserver.py por el túnel 8765.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1090
source ~/vega/env >/dev/null

DEVICE="${1:-192.168.4.218}:5555"
BUILD_DIR="build/armv7-$(echo "${2:-Debug}" | tr "[:upper:]" "[:lower:]")"
VDA="$(ls -d ~/vega/sdk/vega-sdk/main/*/bin/tools/vda | tail -1)"
# Mismo id que scripts/brand-package.js (intv conserva el id base).
BRAND="${VEGA_BRAND:-intv}"
if [ "$BRAND" = "intv" ]; then APP_ID="com.bromteck.appvideo.main"; else APP_ID="com.bromteck.appvideo.${BRAND}.main"; fi

"$VDA" connect "$DEVICE" >/dev/null
"$VDA" -s "$DEVICE" reverse tcp:8765 tcp:8765 >/dev/null
vega device terminate-app -d "$DEVICE" -a "$APP_ID" >/dev/null 2>&1 || true
vega device install-app -d "$DEVICE" -p "$BUILD_DIR/vega_armv7.vpkg"
vega device launch-app -d "$DEVICE" -a "$APP_ID"
