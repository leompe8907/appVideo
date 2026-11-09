# QA en el TV (LG webOS) con ares-inspect + CDP

Scripts para medir la app en un LG real sin tocar el código. Requieren Node ≥ 22 (WebSocket global) y `ares-cli` con el TV configurado como dispositivo (`ares-setup-device`).

## Preparación

```bash
ares-launch -d lgtv com.cableatlantico.app          # abrir la app
ares-inspect -d lgtv com.cableatlantico.app          # imprime "Application Debugging - http://localhost:PUERTO"
```

Todos los scripts reciben ese `PUERTO` como primer argumento. Detén el inspector al terminar (`Stop-Process` del proceso node de `ares-inspect`).

## Scripts

| Script | Para qué |
|---|---|
| `cdp.mjs <puerto> <pasos.json>` | Ejecuta pasos: `{"eval":…}`, `{"key":"ArrowDown","code":40,"n":2}`, `{"wait":ms}`, `{"shot":"ruta.png"}`, `{"cmd":"Dominio.metodo"}`, `{"events":true}` |
| `cold.json` | Pasos de arranque en frío: recarga, línea de tiempo de rutas, errores JS, recursos y heap. `node cdp.mjs <puerto> cold.json` |
| `sweep.mjs <puerto> [/ruta]` | Recorre las secciones por D-pad y mide tiempo de carga, bloqueo de la tecla y trabajo del hilo principal (`LIMIT`, `WIN` en ms) |
| `nav.mjs <puerto> <etiqueta> Tecla:codigo:n,…` | Latencia tecla → anillo/pantalla (usar `GAP` para ráfagas) |
| `bench.mjs <puerto> <etiqueta>` | Tiempo hasta la primera imagen: aperturas desde Inicio y cambios de canal (`OPENS`, `ZAPS`) |
| `trace.mjs <puerto> <Tecla> <código> [ms]` | Línea de tiempo de peticiones y eventos de `<video>` tras una tecla |
| `prof.mjs <puerto> <Tecla|NONE> <código> <ms>` | Perfil de CPU (funciones y tiempo propio/inclusivo) |
| `perf.mjs <puerto> <Tecla|NONE> <código> <ms>` | Tiempo de tarea, script, layout y estilo del renderer en una ventana |
| `key-latency.mjs <puerto> <Tecla> <código> [seg] [teclaNav] [códigoNav]` | Sonda ligera (sin Tracing/Profiler, que inflan los tiempos): latencia tecla → pintado y huecos del hilo principal tras una tecla (p. ej. `Escape 27` al cerrar el player) |
| `go.mjs <puerto> <ruta> [ms]` | Navega por D-pad a una sección del sidebar (`NOENTER=1` solo posiciona) |
| `ep.mjs <puerto> <seg>` | Peticiones de EPG, duración y concurrencia durante el preload |

En Git Bash en Windows usa `MSYS_NO_PATHCONV=1` al pasar rutas como `/home/catchup`.

## Cuidado

- Con `disableBackHistoryAPI` el Back sale de la app desde Inicio: `Escape` (= BACK) **sale** de la app si no hay player abierto. `bench.mjs` ya lo comprueba antes de enviarlo.
- Una tecla inyectada con código 461 (Back) la interpreta el sistema como "atrás" del navegador si el `appinfo.json` no tiene `disableBackHistoryAPI`.
- `Page.captureScreenshot` no incluye la capa de video del TV (sale en blanco donde hay video).
- Las sondas que leen `document.body.innerText` fuerzan layout y distorsionan las mediciones: usar `querySelector`.
