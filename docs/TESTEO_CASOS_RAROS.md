# Testeo de casos raros (TV LG webOS 5, cableatlantico) — 2-nov-2026

Se ejecutó `scripts/tv-qa/chaos.mjs` (y `key-latency.mjs`) contra el LG 49UN7310PSC por CDP. Cada escenario informa ruta, foco, errores JS nuevos, nodos/heap, huecos del hilo principal y si la app sigue respondiendo.

## Resultado por escenario

| Escenario | Qué se hizo | Resultado | Acción |
|---|---|---|---|
| Ráfaga de flechas | 80 flechas aleatorias a 30 ms; teclas mantenidas (autoRepeat) en las 4 direcciones | Sin errores, foco válido, respuesta 4–9 ms | Ninguna |
| **Atrás repetido** | 3 Atrás seguidos desde Catchup (contenido → menú → Inicio → salir) | **La app se cerraba** (pasó 2 veces en las pruebas) | **Corregido**: salir exige doble Atrás (aviso "Presiona Atrás de nuevo para salir", 2.5 s) |
| Saltar entre secciones | 24 movimientos + Enter en el menú sin esperar la carga | Sin errores; termina en una sección válida | Ninguna |
| Abrir/cerrar player ×6 | Enter, esperar 1.5–6 s, Atrás | 6/6 sin HUD pegado; heap 17 MB y nodos estables (sin fugas) | Ninguna |
| Enter ×3 y Atrás inmediato | Mientras carga | Estado sano | Ninguna |
| Enter mantenido | 30 repeticiones sobre un canal | Un solo player y un solo `<video>` | Ninguna |
| Zapping en ráfaga | 16 PageUp/PageDown a 120–400 ms | Reproduce al final (canal coherente) | Ninguna |
| Teclas aleatorias con el HUD abierto | 40 teclas | Dos Atrás lo cierran; sin errores | Ninguna |
| Guía (EPG) mantenida | 260 Abajo y 260 Arriba | 11 filas montadas de 204, sin errores. Observación: Arriba en la primera fila lleva el foco al menú lateral (inofensivo) | Documentado |
| Catchup completo | Fin de riel, "Ver más", Atrás del modal, abrir evento | Correcto (el evento abre su ficha, no el player directo) | Ninguna |
| Pestaña oculta/visible | `visibilitychange` con reproducción | Sigue reproduciendo | Ninguna |
| **Corte de red en reproducción** | Fallos de XHR al servidor de streaming (el emulador de red de CDP no funciona en este TV) | Con el buffer agotado (~30 s) la imagen quedaba **congelada sin spinner ni mensaje, indefinidamente**; el `waiting` del `<video>` no llega en esta TV | **Corregido** (ver abajo) |
| **Buscador con una letra** | `a` → 2 047 resultados montados | **Hilo bloqueado 10.7 s** | **Corregido**: máximo 60 por lista + aviso "afina la búsqueda" (bloqueo 2.0 s) |
| Buscador con entradas raras | vacío, espacio, `%%%`, HTML, unicode/emoji, 3 000 caracteres, sin coincidencias | Sin errores ni inyección (React escapa) | Ninguna |
| **Fallo de render en una pantalla** | Revisión de código | `ErrorBoundary` raíz sin ningún botón: en una TV la pantalla quedaba muerta | **Corregido**: botón "Reintentar" enfocado, límite por ruta (`resetKey`) alrededor de `<Routes>` |
| **Chunk viejo tras un deploy** | Se vio al reconstruir con la app abierta: `Unexpected token <` y pantalla en blanco (20 nodos) | Error global de script que el boundary no veía | **Corregido**: el boundary escucha `window.error` de `/assets/` y recarga una vez (con espera a `online`) |

## Corte de red: comportamiento actual
1. ~4 s sin avanzar `currentTime` → spinner.
2. A los ~30 s más se recarga el stream; se repite hasta 3 veces (si la red vuelve, reanuda sola).
3. Agotados los intentos → overlay "Error en reproducción" con Reintentar enfocado. Comprobado: con la red de vuelta, OK recupera la imagen.

Implementación: `utils/progressTracker.js` (detecta `currentTime` quieto), `player/engines/web/stallWatchdog.js` (reintentos), `WebEngine.js` (vigilancia cada 2 s) y `hooks/usePlayerLoadingVisible.js` (spinner). Tests: `progressTracker.test.js`, `stallWatchdog.test.js`.

## No probado / límites
- El emulador de red de CDP (`Network.emulateNetworkConditions`, `Fetch`) no funciona en este Chromium: los cortes se simularon fallando XHR en la página.
- No se probaron: cierre de sesión, cambio de licencia en caliente, PIN parental con ráfaga de dígitos (cubierto por tests unitarios), teclado en pantalla real, Samsung/otras marcas.
- Falla de carga de chunk por red (no por deploy): no se pudo simular en el TV (la interceptación tampoco funciona); cubierto por tests del `ErrorBoundary` (reintento y `resetKey`).
- Pendiente de decidir: Arriba en la primera fila de la Guía lleva al menú lateral.

## Menú de canales del player: navegación lenta (3-nov-2026)

Síntoma: con el menú de ~200 canales abierto, una pulsación suelta se sentía lenta y con saltos; manteniendo la tecla se veía fluido.

Medido en el TV (sonda en página + perfil de CPU):
- Costo del manejador de una tecla: ~35 ms. Casi todo era el anillo de foco (`TvFocusRing`), que en cada foco hacía 3 `querySelectorAll` sobre todo el documento para observar anclajes del layout del Home (no aplican en el menú ni en el HUD), más el motor geométrico, que recorría las ~200 filas con `getComputedStyle`/`getBoundingClientRect` por tecla.
- Con el menú abierto el video sigue decodificándose en el hilo principal (descifrado AES por software + demux, ~40 % del hilo en HTTP). Cuando una de esas tareas cae entre pulsaciones, el cuadro tarda 2–3 frames (60–90 ms) y varias teclas llegan juntas: eso es el "salto". Al mantener la tecla los eventos son continuos y la latencia se disimula.

Cambios: UP/DOWN del menú por hermanos del DOM (`channelSidebarNav.js`, con tests), scroll calculado con `offsetTop` y el anillo no busca anclajes del Home cuando el foco está en el menú o el HUD. Resultado: manejador ~35 ms → ~15 ms; latencia pulsación→cuadro de 9–148 ms (mediana ~60) a 12–26 ms sin tarea pesada y 57–94 ms cuando coincide con el descifrado.

Lo que queda es la carga del video en el hilo principal: la solución es servir la app por HTTPS (WebCrypto nativo), ya documentada en el plan de rendimiento.
