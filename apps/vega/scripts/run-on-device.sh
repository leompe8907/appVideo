#!/usr/bin/env bash
# Instala y abre la app en el Fire TV.
#   scripts/run-on-device.sh [ip]   (por defecto 192.168.4.218)
# Los logs de desarrollo llegan a scripts/logserver.py por el túnel 8765.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1090
source ~/vega/env >/dev/null

DEVICE="${1:-192.168.4.218}:5555"
VDA="$(ls -d ~/vega/sdk/vega-sdk/main/*/bin/tools/vda | tail -1)"
APP_ID="com.bromteck.appvideo.main"

"$VDA" connect "$DEVICE" >/dev/null
"$VDA" -s "$DEVICE" reverse tcp:8765 tcp:8765 >/dev/null
vega device terminate-app -d "$DEVICE" -a "$APP_ID" >/dev/null 2>&1 || true
vega device install-app -d "$DEVICE" -p build/armv7-debug/vega_armv7.vpkg
vega device launch-app -d "$DEVICE" -a "$APP_ID"
