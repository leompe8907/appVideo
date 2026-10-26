# Optimización Fire TV (Vega) — WindTV

Rama: `vega/optimizacion-wind` (desde `vega/core`, 23-10-2026).
Equipo: Fire TV Stick 4K Select `192.168.4.218:5555`, app
`com.bromteck.appvideo.wind`. Todas las medidas son en ese stick.

## Plan de acción

1. **Línea base (antes de tocar código).** Build Debug de Wind (logs a la Mac
   por `scripts/logserver.py`, ahora con milisegundos) y, para lo largo, Release.
   Medir: arranque, cambio de sección del menú, foco/scroll del muro, tiempo de
   zapping (desglosado), HUD, listado de canales, y errores por canal.
2. **Hallazgos** con evidencia (log, captura, medida).
3. **Priorizar** lo que siente el usuario (cierres, zapping, foco lento), después
   CPU/memoria, después prolijidad.
4. **Cambios chicos y medidos**: volver a medir lo mismo; si no mejora, se revierte.
5. **Cierre**: tests, lint, build Release instalado, revisión.

### Evaluación del plan

- `packages/core` lo usa también la web: no se tocó.
- Debug se cierra a los ~7,5 min de video (ver "Cierres"): pruebas largas en Release.
- Lo descartado en HANDOFF_VEGA.md (arrancar Shaka a 1 `.ts` del borde y mover
  el cabezal) no se repitió.
- Medir latencias con `vda shell` no sirve (cada llamada tarda ~1,5 s): la hora
  de cada tecla se toma en el propio stick (`date` + `inputd-cli` en el mismo
  `shell`) y se compara con los logs de la app.

## Hallazgos y cambios

### 1. Cierres de la app ("se rompe en ciertos canales después de un tiempo")

Evidencia (ACR del equipo con `vega device copy-logs -a SYSTEM_TOMBSTONE/acr` y
log del sistema con `loggingctl log -f`):

- `SIGABRT` en el hilo JS (`libkeplerscript-runtime-loader`), 283 hilos.
- Justo antes: `MESA:drmPrimeHandleToFD() failed (err=24)` y
  `DMA_BUF_IOCTL_EXPORT_SYNC_FILE failed (err=24)`. **errno 24 = EMFILE: el
  proceso se quedó sin descriptores de archivo** (fuga de fds) y el runtime aborta.
- Los dos casos capturados fueron en Debug (~7,5 min de video, lo ya conocido).
  Prueba larga en Release: ver "Prueba larga" más abajo.

Hipótesis principal: algo se pide por cada segmento y retiene un recurso
nativo. En Wind **cada `.ts` trae su propia key AES**, y por cada key la app
importaba de nuevo la key fija de envoltura (`importKey` de WebCrypto nativo)
antes de descifrar. Los canales con `.ts` de 2 s (TELEMICRO, RTVD, Telecentro…)
piden 3× más keys por minuto que los de 6 s: encaja con "ciertos canales".

Cambio: `keyUnwrap.ts` importa la key de envoltura una sola vez por sesión (con
reintento si falla). Test: `apps/vega/src/player/__tests__/keyUnwrap.test.js`
(falla con el código anterior).

### 2. Zapping lento (4–9 s hasta la imagen)

Instrumentación nueva: `VegaHlsPlayer` mide el arranque de cada canal
(`player: arranque N ms (init, lista, key, 1er .ts, metadatos, canplay)` en el
log y fila "Arranque" en el panel ⚙).

Línea base (barrido de 40 canales, Debug): **mediana ~6,1 s, 3,8–8,3 s; ~40 %
de los canales tardaba más de 8 s**. Sin errores de reproducción.

Causa: la ventana de vivo de Shaka (`seekRange`) medía **0 s** (inicio = fin) y
avanzaba con el reloj. En el parser HLS de Shaka 4.8, con
`hls.useSafariBehaviorForLive` (true por defecto) la ventana se iguala al
retraso de vivo. Mientras se bajaba el primer `.ts` (1,7–2,8 s) el borde se
movía, el cabezal quedaba fuera de la ventana, Shaka lo adelantaba y había que
bajar otro `.ts` (a veces el mismo dos veces, a veces tres segmentos).

Cambio: `useSafariBehaviorForLive: false` en `ShakaPlayer.ts` (la ventana pasa
a ser la duración de la lista, ~12 s con listas de 5 `.ts`).

Resultado (mismos 15 canales, misma prueba): **mediana 6,1 s → 5,0 s, peor caso
9,5 s → 8,5 s, todos arrancan**.

Además: el player esperaba 600 ms (anti-zapping) también al abrir el primer
canal y al reintentar. Ahora sólo espera al zapear: navegar → "cargando" pasó
de ~0,8 s a ~0,45 s.

Probado y descartado (no mejoró o no se pudo aplicar):
- `rebufferingGoal` bajo sólo para arrancar: sin diferencia medible.
- Arrancar alineado al comienzo de un `.ts` (`updateStartTime` en el evento
  `streaming`): en ese momento Shaka todavía no tiene la lista de medios (la
  baja después), así que no se puede calcular. En los 2 canales en que sí se
  aplicó, el arranque bajó a 3,5–3,8 s (un solo `.ts`). **Pendiente** con
  potencial de ~1,3 s: haría falta un gancho dentro de Shaka (parche) o bajar
  `inaccurateManifestTolerance` para Wind (riesgo: el problema de descargas
  dobles que se arregló en `0eada7f`).
- Traducir `liveSyncDurationCount` a `liveSegmentsDelay = N − 1`: no cambia la
  ventana (la causa era otra); revertido.

### 3. Errores de carga mudos

`ShakaPlayer.internalLoad` atrapaba el error de `player.load()` y sólo lo
pasaba a `global.__probeLog`, que no existe: con una lista caída, un 404 o una
key inválida el reproductor quedaba **cargando para siempre**. Ahora `load()`
devuelve la promesa, `VegaHlsPlayer` la escucha y emite `error` (muestra
"Reintentar"); el corte por zapping no se informa.

### 4. Subtítulos encendidos por defecto

`internalLoad` hacía `setTextTrackVisibility(true)` al terminar de cargar y
`autoShowText` era `ALWAYS`: pisaba el "subtítulos apagados hasta que se
elijan" de `VegaHlsPlayer` (en canales/VOD con subtítulos se veían solos).
Ahora `autoShowText: NEVER` y sin el `true` forzado.

### 5. Arranque de la app

Splash fijo de 5 s (`ui.splashDuration` de Wind) y recién después empezaba el
EPG (~5,5 s más en frío). Ahora el EPG se pide en cuanto el splash sabe que el
destino es el home (no con perfiles: ahí la licencia la elige el perfil). En
frío ahorra hasta ~5 s; con caché (< 30 min) no cambia.

### 6. Cambio de sección (menú lateral)

| Sección | Antes (Debug) | Después (Debug) |
|---|---|---|
| Canales | 1,6–1,9 s | 0,7–1,0 s |
| Inicio | 0,6–1,3 s | 0,8 s |
| Buscador | 0,2 s | — |

Canales de Wind es una grilla vertical (`vertical_grid`, 6 columnas) con más de
100 canales: se armaban todas las tarjetas de una. Ahora cada fila de la grilla
es un ítem de la lista virtualizada del muro (`BouquetWall.jsx`, `GridRow`).
Verificado: mismo diseño, ▶ al final de la fila no salta, el scroll acompaña.

Medida nueva en el log: `home: sección X en N ms`.

### 7. Foco al entrar al menú lateral

Desde el contenido, ◀ llevaba el foco al ítem más cercano (a menudo la cuenta,
arriba). Ahora va a la sección activa (`destinations` del `TVFocusGuideView`).

### 8. Renders del HUD

El HUD re-renderizaba toda la pantalla del reproductor cada 1 s para refrescar
"Ahora/Siguiente" (con el listado abierto, también las 145 filas). Ahora el reloj
vive en `BottomBar` / `InfoPanel`, y las filas del listado están memorizadas
(datos y callback estables).

### 9. Log por pedido en Release

Por cada `.ts`, key y lista se escribían 2-3 líneas en el journal del equipo
(`sample:shaka: in the request filter…` de los filtros Uplynk del ejemplo de
Amazon) y `recordPlaylist` creaba un `TextDecoder` nuevo por lista (la librería
loguea cada uno). Ahora sin esos logs y con un único decoder. Queda, fuera de
nuestro código, `[KeplerScript-Native] Application data root path is not set.`
una vez por pedido de red (~120/min en un canal de `.ts` de 2 s).

## Prueba larga (Release)

| Build | Canal | Duración | Resultado |
|---|---|---|---|
| Release con los cambios 2–8 (sin el de keys) | TELEMICRO (`.ts` de 2 s) | 25 min | sin cierre, sin `err=24`, video fluido |
| Release final (todo) | TELEMICRO | 25 min | sin cierre, sin `err=24`, video fluido |

**No se pudo reproducir el cierre en Release en 25 min.** Los dos cierres
registrados en el equipo durante esta sesión fueron en Debug (el ya conocido de
~7,5 min). Para confirmar el arreglo hace falta saber en qué canales y tras
cuánto tiempo se cae en el uso real, y probar ahí el build final.

Cómo leer un cierre en el equipo (sirve para el reporte de un usuario):

```bash
vega device copy-logs -d <ip>:5555 -a SYSTEM_TOMBSTONE/acr --dir /tmp/acr
```

Buscar `CrashReason` y, en el log del sistema de los segundos previos,
`err=24` (sin descriptores).

## Revisión

Revisión independiente del diff (code-reviewer): sin problemas críticos.
Se aplicaron sus dos sugerencias: el título del programa en las filas del
listado se pasa como prop (con el memo quedaba congelado al llegar el EPG o al
cambiar de programa) y, si `decrypt` falla, la key de envoltura se vuelve a
importar en la próxima key.

Tests: 317 de vitest (incluye `keyUnwrap.test.js`, 4 casos), lint sin errores.

## Segunda tanda (26-10-2026)

### Pendientes resueltos

- **Cambio de canal por número.** `num_0`…`num_9` en el player: muestra lo
  tecleado y a los 2 s (o al completar las cifras del LCN más alto) zapea; un
  número inexistente va al más cercano. `channelNumberInput` pasó a
  `packages/core` (web y Vega). Probado: 2-7 → RNN, 3 → MEGAVISION.
- **CH±.** El SDK declara `channel_up` / `channel_down`; el player sólo
  aceptaba `channelUp` / `channelDown`. Ahora acepta ambos (probado con
  `KEY_CHANNELUP/DOWN`). No se registró qué nombre manda el equipo, así que no
  está confirmado que antes fallara.
- **Arranque con un solo `.ts`** (sólo marcas con `ignorePlaylistDateTime`,
  hoy Wind): `startAtSegmentBoundary` + `inaccurateManifestTolerance` 0.
  Mismos 15 canales: **mediana 5,0 s → 4,0 s** (6 canales por debajo de
  3,6 s). Release, TELEMICRO, 201 s: 100 `.ts`, 100 keys, 105 listas (sin
  descargas dobles), 0 cortes. Costo: el vivo queda ~1 segmento más atrás
  (4,7 en vez de ~3; máximo de la marca 6).

### Arranque en frío medido

Caché vencida: el EPG quedó listo 0,7 s después de llegar al home (antes
~5,5 s): la precarga durante el splash funciona.

### Cierres en Debug

Los cuatro cierres de Debug registrados fueron **~8 min después de abrir la
app**, aunque en uno casi no se reprodujo video (10:28 → 10:36). La
explicación del README ("7,5 min de reproducir") no encaja. Hipótesis no
verificada: el runtime de desarrollo retiene cada pedido de red y se agotan
los descriptores. En Release, el build del 23-10 reprodujo TELEMICRO ~7,5 h
seguidas; lo terminó el sistema al activarse el protector de pantalla
(`ReclaimMediaResource`, normal en Fire TV), sin `err=24`.

### Test de navegación del home (Debug)

| Área | Resultado |
|---|---|
| Inicio, ▼▲ rápido (150 ms) | El foco sigue fila por fila sin perder teclas, de arriba a abajo y vuelta. |
| Fila larga, 60 ▶ a 120 ms | Llega al último canal (200) sin perder teclas. |
| Canales | 0,7–1,0 s para dibujarse (ver 6). |
| Buscador | Abre en 209 ms con el teclado del sistema; resultados en vivo. |
| Mi cuenta | Abre en 287 ms, pero **abría el teclado sola** (arreglado). |
| Volver del player | **Foco perdido o en otra fila** en dos casos (arreglado). |

Arreglado en esta tanda:
- Volver de un canal lejano en una fila horizontal (columna > 6): el foco
  caía en la primera tarjeta. Ahora la fila arma columnas hasta ese canal.
- Volver del player: el primer render enfocaba la primera tarjeta y después
  saltaba al canal (a veces quedaba en otra fila, fuera de pantalla). Ahora el
  destino se calcula en el mismo render: un solo evento de foco, directo.
- Mi cuenta: los campos del primer paso de "Cambiar contraseña" ganaban el
  foco al menú y abrían el teclado del sistema.

### Lista de cosas optimizables (no hechas)

1. **◀ sobre el banner cambia de slide** y no lleva al menú lateral: desde el
   banner no hay forma de ir al menú sin bajar primero.
2. **Buscador:** tras "Listo", el primer ▼ cae en el chip "Canales" con un
   foco poco visible; los resultados usan fondo resaltado y no el anillo de
   foco del resto de la app.
3. **Arranque de canal:** sigue siendo 3–6 s; el primer `.ts` tarda ~2,5 s
   (1–4 MB a 1080p). Arrancar en el perfil más bajo y que el ABR suba
   bajaría ~1 s en canales con varios perfiles.
4. **Debug inestable (~8 min):** confirmar la hipótesis (p. ej. Debug sin
   `devLog` a la Mac) para poder probar más tiempo con logs.
5. **Log nativo por pedido** (`Application data root path is not set`, ~120/min):
   no es nuestro; reportar a Amazon o averiguar qué API lo dispara.
6. **Splash fijo de 5 s** (`ui.splashDuration` de Wind): con la sesión
   resuelta en <1 s, bajarlo a 2–3 s ahorra tiempo en cada arranque
   (decisión de producto).
7. **Zapping a un canal fuera de los bouquets de Inicio:** al volver el foco
   va a la primera tarjeta (no hay tarjeta de ese canal).
8. **Test intermitente:** 1 de 321 falló una vez y pasó en las dos corridas
   siguientes; no quedó registrado cuál.

### Qué conviene migrar a web / Samsung / LG

Las tres usan video.js + hls.js (`HlsPlaybackController`); los adaptadores
nativos de Samsung/LG están apagados por defecto (`nativeAdaptersEnabled`).

| Cambio de Vega | Web/TV | Evidencia |
|---|---|---|
| Key de envoltura importada una vez | **Aplica**: se importa por cada key | `src/player/engines/web/HlsPlaybackController.js:50` |
| HUD sin re-render global cada 1 s | **Aplica**: tick arriba del HUD y el listado recibe una función nueva por render (su memo nunca corta) | `PlayerHud.jsx:283`, `:584`, `:1519` |
| EPG durante el splash | **Aplica**: sólo se pide en `/preload` | `src/pages/PreloadDataPage.jsx:33` |
| Foco del menú en la sección activa | **Aplica**: ◀ se resuelve por geometría | `src/components/Sidebar.jsx:191-213` |
| Foco al volver sin saltos / filas largas | Revisar en TV | — |
| Tiempo de arranque desglosado | **En parte**: sólo uptime | `hlsDiagnostics.js` |
| Log en producción | Menor: `console.info` por motor | `resolveEnginePlatform.js:81`, `BaseTvEngine.js` |
| Ventana de vivo de 0 s / un solo `.ts` | No aplica (hls.js) | — |
| Errores de carga, subtítulos, espera al zapear, grilla | Ya está bien | — |

## Pendientes

- Zapeando a un canal que no está en ningún bouquet de Inicio, al volver el foco
  va a la primera tarjeta (no hay tarjeta de ese canal).
- `console.error: forwardRef render functions accept exactly two parameters`
  al abrir el player (Debug; viene de un componente de librería, sin impacto).
