# Handoff — app Fire TV (Vega) de appVideo

Estado al **08-10-2026, ~12:30**, al migrar el proyecto a un disco externo.
Plan general y pendientes numerados: [PLAN_VEGA.md](PLAN_VEGA.md). Cómo compilar
y particularidades de Vega: [apps/vega/README.md](../apps/vega/README.md).

## Dónde está todo

- **Rama:** `vega/core` (subida a `origin`). `main` no tiene nada de esto.
- **App Fire TV:** `apps/vega` (React Native 0.83 para Vega, npm, fuera del
  workspace de pnpm).
- **Código compartido:** `packages/core` (`@appvideo/core`). Lo usan la web y
  el Fire TV, así que todo arreglo ahí cambia también la web.
- **Fire TV Stick 4K Select** de pruebas: `192.168.4.218:5555`, modo
  desarrollador. Tiene instaladas, en **Release**, INTV
  (`com.bromteck.appvideo`, "inTV Play") y MultiplusTV
  (`com.bromteck.appvideo.multiplustv`).

## Al pasar al disco externo

Archivos que **no están en git** y hay que copiar a mano:

| Archivo | Para qué |
|---|---|
| `.env.local` (raíz) | Tokens y URLs de middleware por marca (`VITE_BRAND_TOKEN_*`, `VITE_BRAND_DRM_*`). Sin esto no hay login. |
| `apps/vega/dev-session.local.json` | Sesión de prueba de INTV que se precarga en builds Debug (opcional). |

Se pueden regenerar (no hace falta copiarlos, ocupan ~1,5 GB):
`node_modules` (raíz: `corepack pnpm install`), `apps/vega/node_modules`
(`npm install` en `apps/vega`), `apps/vega/build` (lo arma `scripts/build.sh`),
`dist/` de la web.

Fuera del repo (en la Mac, no en el proyecto):
- SDK de Vega en `~/vega` (`vda` en `~/vega/sdk/vega-sdk/main/0.24.9914/bin/tools/vda`).
- Node 20 en `/usr/local/opt/node@20/bin` (el del sistema es 18: los tests y la
  web necesitan 20). Ej.: `PATH="/usr/local/opt/node@20/bin:$PATH" npx vitest run`.
- `~/Desktop/VegaPruebaRN/node_modules` es un enlace a `apps/vega/node_modules`
  (README de apps/vega): si cambia la ruta, rehacer el enlace o ignorarlo.

## Compilar e instalar (resumen)

```bash
cd apps/vega
VEGA_BRAND=multiplustv ./scripts/build.sh Release
VEGA_BRAND=multiplustv ./scripts/run-on-device.sh 192.168.4.218 Release
```

`VEGA_BRAND` por defecto es `intv`. **Para pruebas largas de reproducción usar
Release:** en Debug la app se cierra a los ~7,5 min de reproducir (runtime de
desarrollo de Vega; ver README, "Particularidades").

Tests y web: `PATH="/usr/local/opt/node@20/bin:$PATH" npx vitest run` (141
pasan) y `corepack pnpm run build:intv`.

## En qué estaba trabajando

**Cortes y saltos del reproductor en vivo** (reporte del usuario con
MultiplusTV: el video se detiene, repite y llega al último `.ts`).

Hecho y probado en el stick (commits `7667fc0` … `28e1981`):

1. **Panel de estadísticas** en el HUD (botón ⚙): perfil de descarga, red
   (estimado de Shaka y velocidad real de los `.ts` de video), último `.ts` de
   video y de audio por separado, manifiesto `.m3u8` tal como lo manda el
   servidor (segmentos y target), distancia al vivo en segmentos, buffer,
   cortes, saltos, % del tiempo cargando, errores, idioma, memoria JS.
   Archivos: `apps/vega/src/player/StatsPanel.jsx`, `VegaHlsPlayer.js`
   (`getDiagnostics`, `recordResponse`, `recordPlaylist`).
2. **Flag de marca `player.liveBuffer`** (en todas las marcas,
   `packages/core/src/player/liveBufferConfig.js`, con tests): mismos valores
   que hls.js en la web (3 `.ts` del vivo, máx 6, 30 s adelante, 30 s atrás;
   Wind 20/40). La web lo lee en `src/player/engines/web/hlsPlaybackConfig.js`
   (sin cambio de comportamiento). El Fire TV lo traduce a Shaka
   (`apps/vega/src/w3cmedia/shakaplayer/ShakaPlayer.ts`): antes usaba
   `bufferingGoal 5` / `rebufferingGoal 0.01` del ejemplo de Amazon y se
   quedaba sin buffer. En Warner Hd el tiempo cargando bajó de 22 % a 3–5 %.
3. **Corrección de la distancia al vivo** (`checkLiveLatency` en
   `VegaHlsPlayer.js`): flags `liveMinLatencyDurationCount` (2) y
   `liveSlowPlaybackRate` (0.95). Si queda a menos de 2 `.ts` del borde, frena;
   **el Fire TV Stick no respeta `playbackRate`** (medido: 1,09× al pedir
   0,95×), así que ahí vuelve al punto de arranque (salto atrás). Si queda a más
   de 6, vuelve al vivo. Con manifiestos cortos el mínimo se achica a N − 2.

Lo último medido (Warner Hd, MultiplusTV, Release, commit `28e1981`): manifiesto
de **5 `.ts` de ~11 s**, a 3,0 `.ts` del borde, 17,6 s de buffer, 5 % cargando
(sólo al arrancar), 0 cortes, 3 saltos en 120 s, 0 correcciones.

**Dónde quedó:** iba a instalar el mismo build en INTV (Release) cuando se
cortó por falta de espacio. Falta:

- Instalar el build actual en INTV y dejar que el usuario pruebe ambos con el
  panel abierto un rato largo.
- **Saltos ("saltos" en el panel):** siguen apareciendo (~1 por minuto). Son
  huecos en la línea de tiempo del propio stream (el log del stick muestra
  `TrackBuffer gap(66734) > max frame duration`), Shaka los salta y eso
  adelanta el video hacia el vivo. Propuesta pendiente: comparar el mismo canal
  en la web; si allí también hay saltos, es del origen (avisar a MultiplusTV).
- Descartado (no repetir): arrancar Shaka a 1 `.ts` del borde y mover el
  cabezal atrás → la zona queda sin descargar y el video carga el 47 % del
  tiempo.

## Otros pendientes (ver PLAN_VEGA.md)

- Punto 2: botones de reproducción en vivo (`player.showPlaybackButtonsOnLive`),
  "En vivo" con timeshift, calidad (Wind). HBO Hd de MultiplusTV no reproduce
  (Shaka 3014).
- Punto 4: seguir revisando foco/scroll en el resto de las pantallas.
- Punto 6: tabla de qué flags de marca se aplican en el Fire TV.
- Punto 7: probar catchup y la Guía con MultiplusTV (tiene datos).
- Login: "Iniciar con código" (UDID) y Google/Facebook (en TV, por QR o código).
- Avisar a MultiplusTV de las URLs de imágenes rotas (404, `http://host//`).
- `public/gigmax/background.png` y `splash.png` están modificados en la copia
  de trabajo y **no se subieron** (no los cambió el asistente): decidir si van.
- Perfiles, OSMS, publicidad en video, telemetría, reCAPTCHA en TV, publicación
  en el Appstore (Fase 6).

## Herramientas que se usaron en la Mac (no están en el repo)

Scripts en `/tmp/claude-501/` (se pierden al reiniciar; fáciles de rehacer):
- `shot.sh <nombre>`: captura de pantalla del stick
  (`gwsi-tool-screenshooter` + `vda pull`).
- `key.sh KEY_…`: simula teclas del control (`inputd-cli button_press`).
- Log del stick: `vda -s 192.168.4.218:5555 shell "loggingctl log -f"`.
- Logs de la app en Debug: `python3 apps/vega/scripts/logserver.py <archivo>`
  con `vda reverse tcp:8765 tcp:8765` (lo hace `run-on-device.sh`).
