# Auditoría Técnica — appVideo
### OTT App para Samsung Tizen 2019+ / LG webOS 4+ / Web
**Stack:** React 18 + Vite 7 + Zustand 5 + React Router 7 + hls.js + video.js
**Fecha de análisis:** 2026-06-05  
**Última revisión navegación TV:** 2026-06-09

---

## Resumen Ejecutivo

El proyecto está bien estructurado para su propósito y tiene decisiones de diseño correctas (motor de player persistente, preload centralizado, engines separados por plataforma). Sin embargo, acumula **48 hallazgos** agrupados en 9 áreas, varios con impacto directo en la experiencia de usuario en TV (congelamiento de foco, lag perceptible en D-pad ~1 s, memory leaks, cuellos de botella de parseo, riesgo de pantalla negra en zapping).

> **Plan de ejecución navegación TV:** ver `docs/PLAN_NAVEGACION_TV.md` (cobertura por área: login, home, VOD, catchup, buscador, sidebar, parental, popups, OSMS, player).

---

## 🔴 GRUPO 1 — Rendimiento y Cuellos de Botella Críticos

### H-01 · `tvDataService.js` — Mutación directa de objetos del store
**Archivo:** `src/services/tvDataService.js` / `src/store/preloadStore.js`
**Problema:** La función `ensureStreamPlaybackUrl` muta directamente el objeto del stream (`stream.url = ...`, `stream.img = ...`) en lugar de retornar una copia. Estos objetos se almacenan en Zustand. Mutaciones directas rompen la inmutabilidad y pueden causar que React no detecte cambios, generando pantallas obsoletas.
**Impacto:** Alto — re-renders fallidos, datos desincronizados.
**Acción:** Reemplazar `stream.x = y` por `return { ...stream, x: y }` y actualizar todos los `.forEach(ensureStreamPlaybackUrl)` por `.map()`.

---

### H-02 · `preloadStore.js` — Timeout de EPG de 5 minutos
**Archivo:** `src/store/preloadStore.js` (línea 16)
**Problema:** `LOADING_TIMEOUT_MS = 300000` (5 minutos) es extremadamente alto para una TV 2019 con recursos limitados. Si el EPG falla silenciosamente, el usuario espera 5 minutos con la pantalla bloqueada. Además, `maxChannels` en `loadEPGForStreams` usa `total` (todos los streams), ignorando el límite configurado.
**Impacto:** Alto — bloqueo de UI durante minutos en TV.
**Acción:** Reducir timeout a 60-90 segundos. Añadir progreso visible. Respetar `epg.rowsOnInit` de la config de marca.

---

### H-03 · `PlayerHud.jsx` — `setInterval` de 1 segundo en DOM activo
**Archivo:** `src/components/player/PlayerHud.jsx` (línea 442)
**Problema:** Un `setInterval` cada 1 segundo llama a `setLiveNowTickMs(Date.now())`, disparando re-render del `PlayerHud` (~1037 líneas) con múltiples `useMemo` dependientes. En TVs 2019 con CPU limitada, esto genera frame drops durante la reproducción.
**Impacto:** Medio-Alto — degradación de rendimiento en playback.
**Acción:** Mover el tick a `useRef` y actualizar el estado solo cuando el valor relevante cambie más de 30 segundos, o usar `requestAnimationFrame` con throttle.

---

### H-04 · `preloadStore.js` — N+1 queries de API en carga de catchup (batch de 4)
**Archivo:** `src/store/preloadStore.js` (líneas 423-510)
**Problema:** La carga de catchup hace `getCatchupGroups()` y luego `getCatchupEvents()` para cada grupo en batches de 4. Con 20 grupos son 20 requests HTTP. En una TV 2019 con ancho de banda limitado, esto puede tardar 30-60 segundos.
**Impacto:** Alto — tiempo de carga excesivo en catchup.
**Acción:** Reducir batch size a 2 en entornos TV. Implementar `AbortController`. Considerar lazy loading de catchup (cargar por demanda, no en preload).

---

### H-05 · `PlayerContext.jsx` — `JSON.stringify` para comparar tracks en cada evento del engine
**Archivo:** `src/contexts/PlayerContext.jsx` (línea 32)
**Problema:** `tracksSnapshotsEqual` usa `JSON.stringify(a) === JSON.stringify(b)` en cada evento `TRACKS_CHANGE` del engine. `JSON.stringify` de un array de tracks es costoso en CPUs limitadas.
**Impacto:** Medio — overhead de CPU durante reproducción.
**Acción:** Comparación estructural simple por longitud + IDs de tracks (sin serialización completa).

---

### H-06 · `Sidebar.jsx` — `getComputedStyle` y `getBoundingClientRect` en cada keydown de TV
**Archivo:** `src/components/Sidebar.jsx` (líneas 373-383, 488-498)
**Problema:** La función `isRoughlyVisibleEl` llama a `window.getComputedStyle(el)` y `getBoundingClientRect()` por cada ítem del sidebar en **cada evento keydown**. Con 8-10 ítems y pulsaciones rápidas del D-pad, genera layout thrashing constante.
**Impacto:** Alto en TV 2019 — lag de navegación perceptible.
**Acción:** Cachear visibilidad con `data-*` attributes o calcular solo al montar/cambiar el estado. Evitar `getComputedStyle` en handlers de keydown.

---

### H-07 · `useBouquetMuroTvNav.js` — `buildInicioBouquetChannelRows` en cada keydown
**Archivo:** `src/hooks/useBouquetMuroTvNav.js` (líneas 248, 222, 166, 167)
**Problema:** `buildInicioBouquetChannelRows(wall)` recorre el DOM completo de la grilla en **cada evento de flecha**. Con 200 canales, implica 200+ operaciones DOM por cada tecla presionada.
**Impacto:** Crítico en TV 2019 con grillas grandes — lag severo.
**Acción:** Cachear el resultado en `useRef` y recomputar solo cuando el EPG/bouquet cambia (no en cada keydown). Usar `ResizeObserver` o cambio de estado como trigger.

---

## 🔴 GRUPO 2 — Gestión de Estado y Datos

### H-08 · `preloadStore.js` — Variables de control fuera del store Zustand
**Archivo:** `src/store/preloadStore.js` (líneas 57-61)
**Problema:** Las flags `vodLoading`, `adsLoading`, `catchupLoading` son variables de módulo externas al store. Invisibles para el debugger de Zustand, imposibles de testear y pueden causar inconsistencias con HMR/code-splitting. El propio código tiene un comentario "FIX #2" admitiendo el workaround.
**Impacto:** Medio — dificulta debugging; riesgo de doble-carga.
**Acción:** Modelarlas como `status: 'loading'` dentro de cada substate (que ya existe). La bandera redundante puede eliminarse.

---

### H-09 · `preloadStore.js` — Estado raíz reconstruido completamente en cada `set()`
**Archivo:** `src/store/preloadStore.js` (múltiples funciones)
**Problema:** Casi todos los `set()` reconstruyen el objeto completo `{ epg: s.epg, vod: s.vod, ads: s.ads, catchup: s.catchup }`. Cualquier actualización de `epg` invalida los selectores de `vod/ads/catchup`, forzando re-renders innecesarios.
**Impacto:** Medio — re-renders en cascada innecesarios.
**Acción:** Usar `set({ epg: { ...s.epg, status: 'ready' } })` (partial update de Zustand). Separar en slices independientes.

---

### H-10 · `panaccessService.js` — Mutación del parámetro `parameters` y token en body
**Archivo:** `src/services/panaccessService.js` (línea 138)
**Problema:** `parameters = { ...parameters, sessionId, os, ... }` reasigna el parámetro. Además, `apiToken` siempre se inyecta en el body del request, pudiendo exponerlo en logs de red.
**Impacto:** Bajo-Medio — riesgo de seguridad leve, código frágil.
**Acción:** Crear variable local `const payload = { ...parameters, sessionId, ... }`. Evaluar si `apiToken` debe ir en headers HTTP.

---

### H-11 · `BrandContext.jsx` — Sin invalidación del `preloadStore` al cambiar de marca
**Archivo:** `src/contexts/BrandContext.jsx`
**Problema:** `panaccessService.reset()` se llama al cambiar de marca, pero el `preloadStore` no se resetea. Datos EPG/VOD de la marca anterior pueden quedar en memoria y mostrarse brevemente.
**Impacto:** Medio — datos corruptos entre sesiones multi-marca.
**Acción:** Llamar `usePreloadStore.getState().resetPreload()` cuando la marca cambia.

---

### H-12 · `epgWorkerClient.js` — Worker EPG sin cleanup explícito
**Archivo:** `src/workers/epgWorkerClient.js`
**Problema:** El Web Worker para normalizar EPG no tiene mecanismo de terminación visible. Si el servicio falla o la app se desmonta, el worker puede seguir procesando datos de una sesión anterior.
**Impacto:** Medio — leak de memoria y CPU en TVs con poca RAM.
**Acción:** Exponer `terminate()` en `epgWorkerClient` y llamarlo en `resetPreload()`.

---

## 🔴 GRUPO 3 — Arquitectura de Navegación TV

### H-13 · Múltiples listeners `keydown` globales concurrentes
**Archivos:** `useLoginTvNavigation.js`, `usePlayerHudTvNavigation.js`, `useBouquetMuroTvNav.js`, `Sidebar.jsx`, `useVodPageTvNav.js`, `useSmartcardTvNavigation.js`
**Problema:** Hay al menos **6 listeners `keydown` globales** con `capture: true` activos simultáneamente. Todos compiten por el mismo evento. El orden de evaluación depende del orden de montaje (no determinístico). Si dos hooks manejan `TV_ACTION.BACK`, pueden entrar en conflicto.
**Impacto:** Crítico — comportamiento de navegación no determinístico. Difícil de mantener.
**Acción:** Crear un `NavigationRouter` singleton con stack de prioridades. Solo el hook activo de mayor prioridad procesa el evento.

---

### H-14 · Sin "focus manager" centralizado — el foco se pierde frecuentemente
**Archivos:** Múltiples hooks de TV
**Problema:** No existe estado centralizado del foco. Cada hook usa `setTimeout(() => focusById(...), 0/120/280/300ms)` para esperar que el DOM actualice. Esto causa parpadeo de foco visible en TVs lentas y comportamiento impredecible con timings variables.
**Impacto:** Alto — experiencia de usuario degradada en TV.
**Acción:** Crear un `FocusManager` singleton con stack push/pop al abrir/cerrar modales. Al cerrar un modal, el manager restaura el foco al elemento anterior automáticamente.

---

### H-15 · `useBouquetMuroTvNav.js` — Polling de `requestAnimationFrame` para foco inicial (hasta 20 intentos)
**Archivo:** `src/hooks/useBouquetMuroTvNav.js` (líneas 53-75)
**Problema:** El hook usa polling de `requestAnimationFrame` (hasta 20 intentos ≈ ~330ms) para encontrar la primera tarjeta del muro y hacer foco. Si el EPG no terminó de renderizar, agota los intentos y el usuario queda sin foco en TV.
**Impacto:** Alto — usuario atrapado sin foco en TV al entrar a Inicio.
**Acción:** Reemplazar el polling por reacción al estado del store EPG. Cuando `epg.status === 'ready'`, colocar el foco. Usar `MutationObserver` como alternativa más confiable.

---

### H-16 · `shouldDeferHomeShellNavigation()` — Acoplamiento opaco entre módulos
**Archivo:** `src/utils/homeShellOverlays.js` (usada en Sidebar, BouquetNav)
**Problema:** Función global que bloquea toda la navegación del sidebar cuando hay overlays activos. No es claro desde el código qué condiciones la activan, generando acoplamiento oculto difícil de debuggear.
**Impacto:** Medio — bugs difíciles de reproducir con interacciones modal-sidebar.
**Acción:** Documentar explícitamente los estados que la activan. Migrar a un `NavigationLockContext` React.

---

### H-17 · `usePlayerHudTvNavigation.js` — Zonas de navegación hardcodeadas en strings
**Archivo:** `src/hooks/usePlayerHudTvNavigation.js` (líneas 30-32)
**Problema:** `'player-top-left'`, `'player-top-center'`, `'player-bottom-actions'` son strings hardcodeados. Si el layout del HUD cambia por configuración de marca (`hudLayout`), la navegación se rompe silenciosamente.
**Impacto:** Medio — bugs de foco al cambiar layout del player por marca.
**Acción:** Exportar las constantes de zona desde `PlayerHud.jsx` y consumirlas en el hook.

---

### H-45 · `scroll-behavior: smooth` en contenedores de foco TV
**Archivos:** `src/styles/pages/_bouquet.scss` (`.bouquet-inicio-scroll`, rails horizontales), otros scroll containers del home shell
**Problema:** Al mover foco, `scrollElementIntoVisibleScrollAncestors` desplaza contenedores con `scroll-behavior: smooth`. En TV el scroll animado se percibe como lag adicional (~300–800 ms) encima del tiempo de JS.
**Impacto:** Alto — sensación de navegación “forzada” o lenta entre tarjetas.
**Acción:** En `.device-tv`, forzar `scroll-behavior: auto` en contenedores navegables. Opcional: parámetro `instant` en `scrollElementIntoVisibleScrollAncestors` para TV.

---

### H-46 · Estilo de foco por elemento (scale + sombras) en lugar de anillo único
**Archivos:** `src/styles/global.scss` (`[data-focus="on"].device-tv .focused`), estilos por componente (`_catchup.scss`, `_vod.scss`, etc.)
**Problema:** Cada elemento enfocado aplica `transform: scale(1.05–1.12)` y múltiples `box-shadow`. En GPUs de TV 2019 esto provoca repintados costosos en cada pulsación del D-pad. Las apps OTT maduras suelen usar un **focus ring overlay** (un solo div que se mueve) o un borde ligero sin escalar la tarjeta.
**Impacto:** Alto — contribuye al lag perceptual aunque el JS sea rápido.
**Acción:** Introducir `TvFocusRing` (capa única posicionada con `getBoundingClientRect` solo al cambiar foco, o mejor: refs de layout). En TV, desactivar `scale` en `.focused` y limitar a `outline` / borde de 2–3 px.

---

### H-47 · `ChannelCard` — `setState` en cada cambio de foco
**Archivo:** `src/components/bouquet/BouquetLayouts.jsx` (`ChannelCard`: `focused` local + `setInterval` EPG al enfocar)
**Problema:** Cada movimiento LRUD dispara `setFocused(true/false)` en dos tarjetas (blur + focus), provocando re-renders React de componentes con imágenes, EPG y estilos. Además duplica la clase `.focused` que ya aplica `main.jsx` vía `focusin` global.
**Impacto:** Alto en muro de canales con muchas filas.
**Acción:** Eliminar estado `focused` local; confiar en foco DOM + anillo global. Mover tick de barra EPG a capa no ligada al foco (solo evento en vivo visible) o a un único timer por fila visible.

---

### H-48 · `useChunkedList` no es virtualización de navegación
**Archivo:** `src/hooks/useChunkedList.js`, usado en `BouquetLayouts.jsx`, rails catchup/VOD
**Problema:** El chunking pinta progresivamente más ítems hasta montar cientos de nodos DOM. Reduce tiempo de primer paint pero **no limita** nodos activos durante navegación. Apps tipo Netflix virtualizan: solo ~15–25 ítems montados en el viewport + buffer.
**Impacto:** Alto en grillas EPG/VOD/catchup grandes — más DOM = más costo en spatial nav y scroll.
**Acción:** Evaluar virtualización por ventana (`@tanstack/react-virtual` o rail propio) en rails horizontales y grid vertical. Mantener chunking solo como fallback de carga de datos, no de DOM.

---

### H-49 · Cobertura incompleta de navegación TV por pantalla
**Archivos / áreas sin hook LRUD dedicado ni integración con shell:
| Área | Estado actual | Riesgo |
|------|---------------|--------|
| `SearchPage.jsx` | Sin hook TV; input + tabs + resultados sin grid espacial | Foco impredecible, sin puente sidebar |
| `CatchupPage.jsx` | `tabIndex={0}` nativo; rails sin hook | Lag + sin puente con ads/sidebar |
| `OsmsPage.jsx` | Lista/detalle sin `tabIndex` ni LRUD | Usuario atrapado o foco perdido |
| `ParentalSettingsPage.jsx` | Grid de canales sin hook; solo `ParentalPinGate` parcial | Navegación rota en TV |
| `EpgCardsPage.jsx` | `tabIndex={-1}` en TV + `data-home-spatial-delegate` | **Sin movimiento** con flechas en TV |
| `ProfilePage.jsx` | Foco inicial parcial; sin LRUD entre perfiles/smartcards | Inconsistente post-login |
| Modales sueltos | Cada uno con su `keydown` (`ConfirmModal`, `VodDetailModal`, etc.) | Conflictos con H-13 |

**Impacto:** Crítico — experiencia desigual; áreas “rotas” en TV aunque Inicio/VOD funcionen.
**Acción:** Matriz de cobertura en `PLAN_NAVEGACION_TV.md`. Registrar cada pantalla en `NavigationRouter` con handler de zona o migrar a adaptadores comunes.

---

### H-50 · Navegación basada en geometría DOM vs grid lógico en datos
**Archivos:** `src/utils/inicioBouquetTvGrid.js`, `src/utils/vodTvGrid.js`, hooks `use*Bouquet*TvNav`, `useVodPageTvNav`
**Problema:** H-07 propone cachear mediciones DOM, pero el estándar OTT usa **índices fila/columna en el modelo de datos** (`bouquet.items`, categorías VOD). Medir `getBoundingClientRect` en cada invalidación de scroll sigue siendo frágil y costoso frente a un grid derivado de datos.
**Impacto:** Alto — techo de rendimiento por debajo de apps de streaming comparables.
**Acción:** Fase 2 del plan: `buildBouquetNavModel(bouquets)` y `buildVodNavModel(categories)` que expongan `{ row, col, id }` sin leer layout. DOM solo para scroll-into-view del destino.

---

### H-51 · `PlayerHud.jsx` — listeners `keydown` duplicados respecto al hook
**Archivo:** `src/components/player/PlayerHud.jsx` (líneas ~384–433) + `usePlayerHudTvNavigation.js`
**Problema:** El HUD registra handlers propios de BACK/key además del hook de navegación TV. Duplica trabajo por pulsación y aumenta riesgo de doble `preventDefault` o handlers que no se alinean.
**Impacto:** Medio-Alto — conflictos en player activo.
**Acción:** Consolidar toda la lógica de teclas del HUD en un solo módulo registrado en `NavigationRouter` con prioridad máxima cuando `isPlayerActive`.

---

### H-52 · Sin presupuesto de rendimiento para `keydown` en dispositivo TV
**Archivos:** Transversal (navegación TV)
**Problema:** No hay métrica ni test que exija p. ej. `< 16 ms` de procesamiento por pulsación en Tizen/webOS de referencia. Las regresiones de lag no se detectan en CI ni en code review.
**Impacto:** Medio — el problema de ~1 s de lag puede reintroducirse.
**Acción:** Añadir script/manual de benchmark D-pad + umbral en checklist de Etapa 4. Opcional: `performance.mark` en `NavigationRouter` en builds `DEV` / `?tvNavPerf=1`.

---

### H-53 · `main.jsx` — doble sistema de clases `.focused`
**Archivo:** `src/main.jsx` (listeners `focusin`/`focusout` globales) + componentes con clase `.focused` manual (`ChannelCard`, catchup, etc.)
**Problema:** Coexisten el sistema global (`data-focusable`, `.focused` en `focusin`) y estados React locales que también añaden `.focused`. Estilos compiten y se duplica trabajo en cada foco.
**Impacto:** Medio — CSS inconsistente y renders extra.
**Acción:** Una sola fuente de verdad: global `focusin` + `TvFocusRing` en TV; eliminar `focused` local en componentes.

---

### H-54 · Sidebar — transición de 380 ms acoplada al foco
**Archivo:** `src/styles/pages/_home-shell.scss` (`$home-sidebar-duration: 380ms`), `Sidebar.jsx` (`onFocusCapture` expande rail)
**Problema:** Al volver al sidebar desde contenido, expandir el rail anima ancho/opacidad 380 ms mientras el usuario ya movió el foco. Se percibe como retraso de la UI respecto al input.
**Impacto:** Medio — especialmente en transiciones sidebar ↔ main.
**Acción:** En TV: expandir sidebar **sin animación de grid** (`--home-sidebar-transition-duration: 0ms` ya existe parcialmente en `prefers-reduced-motion`; aplicar siempre en `.device-tv`) o pre-expandir antes de `focus()`.

---

## 🟠 GRUPO 4 — Player y Engines

### H-18 · `PlayerContext.jsx` — Errores de `engine.init()` silenciados
**Archivo:** `src/contexts/PlayerContext.jsx` (líneas 481-533)
**Problema:** La función `play()` dispara una `async IIFE` interna. Los errores de `engine.init()` solo se loggean en `console.error` sin actualizar el estado de error del player. El usuario no ve ninguna indicación de fallo.
**Impacto:** Medio — errores silenciosos en inicio de reproducción.
**Acción:** Capturar errores de la IIFE y actualizarlos en `setState({ error: err })`.

---

### H-19 · `PlayerContext.jsx` — Stale closures en handlers del engine
**Archivo:** `src/contexts/PlayerContext.jsx` (línea 437, `eslint-disable`)
**Problema:** El `useEffect` con `[]` tiene handlers (`handleTime`, `handleError`, etc.) que acceden a `state` y callbacks a través de closures del momento de montaje. Si esos valores cambian, los handlers tienen valores obsoletos. El `eslint-disable` confirma que las dependencias se ignoran deliberadamente.
**Impacto:** Alto — handlers de player con estado obsoleto en ciertos escenarios.
**Acción:** Usar `useRef` para todos los callbacks del engine (`handleTimeRef`, etc.) que actualicen su `.current` en cada render.

---

### H-20 · `SamsungEngine.js` / `LgEngine.js` — Sin timeout en inicialización del SDK nativo
**Archivos:** `src/player/engines/samsung/SamsungEngine.js`, `src/player/engines/lg/LgEngine.js`
**Problema:** La inicialización del SDK nativo (AVPlay / webOSTV.js) no tiene timeout. Si el SDK no responde (TV en estado incorrecto), la app se queda en carga indefinidamente.
**Impacto:** Alto en producción — app bloqueada en ciertas condiciones de TV.
**Acción:** `Promise.race` con timeout de 10 segundos. Fallback a `WebEngine` si el nativo falla.

---

### H-21 · `WebEngine.js` — `video.js 6.6.3` (2018, EOL)
**Archivo:** `package.json` (línea 54)
**Problema:** `video.js` pinneado en `6.6.3` (2018). Esta versión no recibe actualizaciones de seguridad ni compatibilidad con streams HLS modernos. Representa ~180KB gzipped en el bundle.
**Impacto:** Medio-Alto — seguridad, compatibilidad, peso del bundle.
**Acción:** Verificar si se usa activamente. Si solo se usa `hls.js` directamente, remover `video.js` del bundle completamente.

---

### H-22 · `resolveEnginePlatform.js` — Detección de plataforma solo por UserAgent (frágil)
**Archivo:** `src/player/engines/resolveEnginePlatform.js`
**Problema:** Los UserAgents de TVs son inconsistentes entre versiones de firmware. Una TV puede identificarse como Chrome genérico y recibir el WebEngine en lugar del nativo, perdiendo capacidades de DRM y decodificación hardware.
**Impacto:** Alto — engine incorrecto → reproducción degradada o sin DRM.
**Acción:** Detección secundaria por APIs del SDK (`window.tizen`, `window.webOS`). Loggear qué engine se seleccionó y por qué.

---

## 🟠 GRUPO 5 — Seguridad y Gestión de Sesión

### H-23 · `userSession.js` — SessionId en `localStorage` sin cifrado
**Archivo:** `src/utils/userSession.js`
**Problema:** El `sessionId` (token de autenticación de alto valor), `udid` y credenciales se almacenan en `localStorage` en texto plano. En un WebView de TV, cualquier script del mismo origen puede accederlos.
**Impacto:** Alto — riesgo de secuestro de sesión.
**Acción:** Cifrar con `crypto-js` o `node-forge` (ambos ya están en el proyecto). Para el `sessionId`, evaluar `sessionStorage` si no debe persistir entre cierres de la app.

---

### H-24 · `udidCrypto.js` — Generación del UDID potencialmente insegura
**Archivo:** `src/utils/udidCrypto.js`
**Problema:** Si el UDID se genera con `Math.random()`, cambia al limpiar `localStorage` y puede ser predecible por actores maliciosos que quieran impersonar dispositivos.
**Impacto:** Medio — autenticación por UDID comprometida.
**Acción:** Usar `crypto.getRandomValues()` (disponible en Chrome 61+). Almacenar con hash SHA-256 + salt fijo de la marca.

---

### H-25 · `sessionValidator.js` — Múltiples intervalos de validación pueden acumularse
**Archivo:** `src/utils/sessionValidator.js`
**Problema:** Si el componente que inicia el validador se desmonta y re-monta, pueden quedar múltiples `setInterval` corriendo simultáneamente, generando requests duplicados de validación de sesión.
**Impacto:** Medio — requests duplicados, carga innecesaria al servidor.
**Acción:** Usar un singleton con flag `isRunning` y cleanup explícito.

---

### H-26 · `LoginPage.jsx` — `password.trim()` antes de enviar al backend
**Archivo:** `src/pages/LoginPage.jsx` (línea 263)
**Problema:** `password: password.trim()` trunca contraseñas válidas que empiezan/terminan con espacios. Un usuario que creó su cuenta con espacios en la contraseña no podrá loguearse desde la app.
**Impacto:** Medio — bug de autenticación silencioso.
**Acción:** Remover `.trim()` del password. Solo hacer trim en `username`.

---

## 🟡 GRUPO 6 — Dependencias y Build

### H-27 · `package.json` — Bootstrap 5.3.8 en dependencias de producción
**Archivo:** `package.json` (línea 42)
**Problema:** Bootstrap CSS/JS (~30KB JS + ~22KB CSS gzipped) está en `dependencies`. Si solo se usan algunos estilos, es peso innecesario en el bundle. Crítico para TVs que descargan el asset al primer inicio.
**Impacto:** Medio — bundle size innecesario (~50KB gzipped).
**Acción:** Auditar qué clases de Bootstrap se usan realmente. Si son pocas, migrar a CSS custom y remover Bootstrap.

---

### H-28 · `vite.config.js` — Doble target de transpilación: riesgo de ES2016+ sin transpilar en Tizen
**Archivo:** `vite.config.js` (líneas 54-59, 78)
**Problema:** El plugin `@vitejs/plugin-legacy` con `targets: ['chrome 61']` y el `target: 'es2015'` del build pueden dejar features de ES2016+ (async/await, etc.) sin transpilar en el chunk "moderno" que le puede tocar a Tizen 2019 (Chrome 69).
**Impacto:** Alto — app puede romper en Samsung Tizen 4.
**Acción:** Agregar `es-check` al pipeline de CI para verificar que ningún chunk contiene sintaxis no soportada en Chrome 61/69.

---

### H-29 · `azcopy.exe` (60MB) commiteado en la raíz del repositorio
**Archivo:** `azcopy.exe` (raíz)
**Problema:** Un ejecutable de 60MB en el repositorio es mala práctica de seguridad, infla el tamaño del clone y puede disparar alertas en pipelines CI/CD.
**Impacto:** Medio — seguridad y performance del repo.
**Acción:** Añadir `azcopy.exe` al `.gitignore`. Usar scripts que descarguen azcopy en tiempo de CI.

---

### H-30 · `scripts/buildAll.js` — Sin error handling en el script de multi-brand build
**Archivo:** `scripts/buildAll.js`
**Problema:** Si falla el build de una marca, el script puede continuar silenciosamente, generando artifacts incompletos que llegan a producción.
**Impacto:** Medio — deploys corruptos sin notificación.
**Acción:** Asegurar `process.exit(1)` si cualquier brand-build falla. Añadir logging de qué brand falló.

---

## 🟡 GRUPO 7 — Diseño y UX

### H-31 · `LoginPage.jsx` — Emojis como iconos en botones (`🙈` / `👁️`)
**Archivo:** `src/pages/LoginPage.jsx` (línea 488)
**Problema:** Los emojis se renderizan diferente entre Tizen y webOS. En Samsung 2019 con fuentes limitadas, pueden mostrarse como cuadrados vacíos o caracteres extraños.
**Impacto:** Medio — UX degradada en TV.
**Acción:** Reemplazar emojis por SVG icons o caracteres Unicode simples con CSS styling.

---

### H-32 · `Sidebar.jsx` — 722 líneas con SVG paths hardcodeados inline
**Archivo:** `src/components/Sidebar.jsx` (líneas 40-133)
**Problema:** Todos los iconos están como SVG inline con paths extensos en el JSX. Aumenta el bundle JS, dificulta el mantenimiento y no permite caché del browser.
**Impacto:** Bajo-Medio — mantenimiento y bundle size.
**Acción:** Extraer iconos a componentes separados o usar SVG sprites con `<use href>`.

---

### H-33 · `styles/` — Sass con `@import` deprecado (silenciado con `silenceDeprecations`)
**Archivo:** `vite.config.js` (línea 67)
**Problema:** El config silencia deprecaciones de Sass: `['import', 'global-builtin', 'if-function', 'color-functions']`. El proyecto acumula deuda de CSS que eventualmente romperá al actualizar Sass.
**Impacto:** Bajo-Medio — mantenimiento a largo plazo.
**Acción:** Migrar gradualmente de `@import` a `@use`/`@forward` en Sass.

---

## 🟡 GRUPO 8 — Estructura y Organización

### H-34 · `src/cv/` — Directorio con nombre no intuitivo y sin documentación
**Archivo:** `src/cv/`
**Problema:** El directorio contiene el cliente Panaccess (`createCVClient`, `errorClassifier`) pero el nombre `cv/` no es intuitivo para desarrolladores nuevos. No hay README explicativo.
**Impacto:** Bajo — onboarding de nuevos desarrolladores.
**Acción:** Renombrar a `src/panaccess/` o añadir `src/cv/README.md`.

---

### H-35 · `src/config/brands.js` — Configuración con posibles secrets commiteados
**Archivo:** `src/config/brands.js`
**Problema:** Si `brands.js` contiene URLs de API, tokens y configuraciones de producción directamente en código fuente commiteado, es un riesgo crítico de seguridad.
**Impacto:** ⚠️ POTENCIALMENTE CRÍTICO — exposición de credenciales.
**Acción:** Verificar si contiene secrets. Si es así, migrar a variables de entorno (`.env.local`) y no commitear valores de producción.

---

### H-36 · `src/docs/` — Documentación interna dentro de `src/`
**Archivo:** `src/docs/`
**Problema:** Documentación técnica embebida dentro del directorio de código fuente puede incluirse inadvertidamente en el bundle si se importa.
**Impacto:** Bajo — limpieza.
**Acción:** Mover a la raíz del proyecto (`/docs/` o wiki del repositorio).

---

## 🟡 GRUPO 9 — Logging, Testing y Observabilidad

### H-37 · `logger.js` — Sin error reporting remoto en producción
**Archivo:** `src/utils/logger.js`
**Problema:** El logger no envía errores a ningún servicio de observabilidad. En una TV donde el usuario no tiene acceso a DevTools, los errores en producción son invisibles para el equipo.
**Impacto:** Alto — imposibilidad de detectar bugs en producción en TV.
**Acción:** Integrar Sentry (tiene SDK para browsers) o un endpoint de telemetría propio.

---

### H-38 · Sin tests unitarios ni de integración
**Problema:** No hay `__tests__/`, `*.test.js`, ni configuración de Jest/Vitest. Para una app con lógica compleja de parseo (catchup, EPG, bouquets), la ausencia de tests es un riesgo alto de regresión silenciosa.
**Impacto:** Alto — cada cambio puede romper funcionalidad sin detección automática.
**Acción:** Comenzar con Vitest (compatible con el stack Vite). Cubrir primero: `normalizeBouquetsResponse`, `normalizeStreamsResponse`, `prepareRecorded`, `tracksSnapshotsEqual`.

---

---

## 🎯 Navegación TV — ¿Mantener o Migrar a Librería?

### Sistema actual (imperativo manual)
**Descripción:** Múltiples hooks registran listeners `keydown` globales. Cada uno es responsable de un subconjunto de UI. La coordinación se hace mediante chequeos de estado y `shouldDeferHomeShellNavigation()`.

#### ✅ Fortalezas
- Control total y granular sobre cada pantalla
- Sin dependencias externas
- El equipo conoce el código

#### ❌ Debilidades
- 6+ listeners globales concurrentes (H-13) — riesgo de conflictos
- Sin estado centralizado de foco (H-14) — parpadeos y pérdidas de foco
- DOM queries en cada keydown (H-06, H-07) — performance degradada en TV 2019
- `setTimeout` con magic numbers (280ms, 300ms, 120ms) — frágil ante cambios de render
- No escala: cada nueva pantalla requiere razonar sobre todos los listeners existentes
- Imposible de testear: los hooks dependen del DOM real

---

### Opción A — Mejorar el sistema actual
**Esfuerzo:** 3-4 semanas

**Mejoras clave:**
1. Crear un `NavigationRouter` singleton con stack de prioridades (solo el hook activo de mayor prioridad procesa el evento)
2. Cachear resultados de DOM queries en `useRef`
3. Reemplazar `setTimeout` mágicos por callbacks de estado React
4. Crear un `FocusManager` con historial de foco (push/pop con apertura/cierre de modales)

---

### Opción B — Migrar a `@norigin-media/spatial-navigation`
**Esfuerzo:** 6-10 semanas (migración gradual por pantalla)

**Características:**
- Sistema declarativo de zonas de foco (`FocusContext`)
- Navegación espacial basada en posición DOM (no listas hardcodeadas)
- Soporte nativo para modales y overlays (lock de foco automático)
- Estándar de facto en la industria OTT (adoptado por plataformas enterprise)
- Compatible con React 18

**Riesgo:** La migración es disruptiva y requiere refactorizar todos los hooks de TV actuales.

---

### ✅ Recomendación

> **Corto plazo (1-3 meses): Mejorar el sistema actual (Opción A)**
> Resolver H-06, H-07, H-13, H-14, H-15. Impacto máximo para el usuario de TV 2019 con el menor riesgo de regresión.

> **Mediano plazo (3-6 meses): Migrar gradualmente a `@norigin-media/spatial-navigation`**
> Comenzar por las pantallas más problemáticas (BouquetWall, Player HUD) y mantener el sistema legacy para pantallas estables (Login, SmartCard) hasta completar la migración.

**Razón principal para migrar:** Escalabilidad. Cada nueva feature de TV en el sistema actual requiere razonar sobre todos los listeners existentes. Con navegación espacial declarativa, el desarrollador define zonas de foco y el sistema resuelve el resto automáticamente.

---

## Plan de Acción por Fases

### 🔴 Fase 1 — Crítico (semanas 1-2)
| # | Hallazgo | Archivo | Resultado esperado |
|---|----------|---------|-------------------|
| 1 | H-01: Mutación de streams | `tvDataService.js` | Datos inmutables en el store |
| 2 | H-07: DOM queries en keydown | `useBouquetMuroTvNav.js` | Sin lag en grilla TV |
| 3 | H-06: `getComputedStyle` en keydown | `Sidebar.jsx` | Sin lag en sidebar TV |
| 4 | H-26: `password.trim()` | `LoginPage.jsx` | Fix bug de autenticación |
| 5 | H-20: Sin timeout en engine nativo | `SamsungEngine.js` / `LgEngine.js` | App no se congela |
| 6 | H-29: `azcopy.exe` en repo | `.gitignore` | Repo limpio |

### 🔴 Fase 2 — Crítico (semanas 2-4)
| # | Hallazgo | Archivo | Resultado esperado |
|---|----------|---------|-------------------|
| 7 | H-02: Timeout EPG de 5 min | `preloadStore.js` | UX fluida en TV |
| 8 | H-04: N+1 queries catchup | `preloadStore.js` | Carga más rápida |
| 9 | H-13 + H-14: Listeners concurrentes / sin focus manager | Hooks TV | Navegación estable |
| 10 | H-15: Polling rAF para foco | `useBouquetMuroTvNav.js` | Foco siempre colocado |
| 11 | H-22: Detección de plataforma por UA | `resolveEnginePlatform.js` | Engine correcto |
| 12 | H-23: SessionId en plano | `userSession.js` | Mayor seguridad |

### 🟠 Fase 3 — Importante (semanas 4-7)
| # | Hallazgo | Acción |
|---|----------|--------|
| 13 | H-03: Interval de reloj live | Throttle + `requestAnimationFrame` |
| 14 | H-05: `JSON.stringify` para tracks | Comparación estructural manual |
| 15 | H-08 + H-09: Flags fuera del store / `set()` total | Refactor slices de Zustand |
| 16 | H-19: Stale closures en engine | Refs para handlers del engine |
| 17 | H-21: `video.js` 6.6.3 EOL | Evaluar remoción (-180KB) |
| 18 | H-27: Bootstrap en bundle | Auditar y remover si no se usa |
| 19 | H-28: Doble target de transpilación | Agregar `es-check` al CI |
| 20 | H-31: Emojis en botones TV | SVG icons |
| 21 | H-35: Secrets en `brands.js` | Migrar a `.env` |

### 🟡 Fase 4 — Mejoras continuas
| # | Hallazgo | Acción |
|---|----------|--------|
| 22 | H-11: Caché al cambiar marca | `BrandContext.jsx` + `resetPreload()` |
| 23 | H-12: Worker EPG sin cleanup | `terminate()` en `epgWorkerClient` |
| 24 | H-17: Zonas hardcodeadas en HUD | Exportar constantes desde `PlayerHud` |
| 25 | H-24: UDID inseguro | `crypto.getRandomValues()` |
| 26 | H-25: Múltiples validation intervals | Singleton con flag `isRunning` |
| 27 | H-37: Sin error reporting | Integrar Sentry o telemetría propia |
| 28 | H-38: Sin tests | Vitest para funciones de parseo |
| 29 | H-32 + H-33: SVG inline / Sass deprecado | Refactor gradual |

---

## Preguntas Abiertas

> **⚠️ ¿`src/config/brands.js` contiene URLs/tokens de producción commiteados?**
> Si es así, H-35 es CRÍTICA y debe resolverse antes de cualquier push a repositorios remotos.

> **⚠️ ¿Hay acceso a hardware real de Samsung Tizen 4 y LG webOS 4 para validar los fixes de performance?**
> Los hallazgos H-06, H-07 y H-22 son difíciles de validar en browser. Se necesita hardware real o emuladores oficiales.

> **¿El proyecto usa `video.js` activamente?**
> Si `WebEngine.js` usa solo `hls.js` directamente, `video.js` puede eliminarse ahorrando ~180KB del bundle.

> **¿Hay planes de agregar nuevas pantallas de TV a corto plazo?**
> Esto define si conviene priorizar la migración de navegación (Opción B) antes o después de las correcciones de performance.
