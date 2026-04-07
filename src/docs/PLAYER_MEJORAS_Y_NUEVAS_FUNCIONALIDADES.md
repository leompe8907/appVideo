## Objetivo

Implementar mejoras y nuevas funcionalidades del **player** con foco en **estabilidad** y compatibilidad para **Web + LG webOS 2019 + Samsung Tizen 2019**, manteniendo el contrato UI ↔ Engine y el fallback seguro.

Este documento sirve como **checklist** y **plan de ejecución** para no saltarnos ningún punto.

## Estado actual (resumen técnico)

- **Montaje del player (dónde vive el `<video>`/engine)**
  - El contenedor físico del player se monta en `src/pages/HomePage.jsx` usando `containerRef` del `PlayerContext`.
  - Cuando `PlayerContext.state.url` existe, `HomePage` muestra el overlay del player + spinner/HUD.
  - Nota importante ya contemplada en el código: el engine debe montar el `<video>` dentro de un nodo que React no reordene para evitar pantalla negra con HUD visible.

- **Orquestación**
  - `src/contexts/PlayerContext.jsx` expone `play/pause/stop/close/seek/forward/backward/...` y mantiene estado global: `isLoading`, `isSeeking`, `currentTime`, `duration`, `error`, `liveSecondsLate`, etc.

- **HUD**
  - `src/components/player/PlayerHud.jsx` ya implementa:
    - Auto-hide
    - Controles básicos (±10s, play/pause, stop, exit)
    - Modelo live basado en ventana de evento (`resolveLiveWindow` + `liveSecondsLate`)

- **Engines**
  - Selección: `src/player/engines/createEngine.js` + `src/player/engines/resolveEnginePlatform.js`
    - Overrides QA: `?engine=web|lg|samsung` y `localStorage['player.engine']`
    - Gate por marca: `brandConfig.player.nativeAdaptersEnabled` y `brandConfig.player.enginePolicy`
  - Web: `src/player/engines/web/WebEngine.js` (HTML5 video + hls.js)
  - TV base: `src/player/engines/tv/BaseTvEngine.js` (fallback WebEngine + lifecycle hooks)
  - Samsung: `src/player/engines/samsung/SamsungEngine.js` (AVPlay + DRM + display rect; parcial, con fallback)
  - LG: `src/player/engines/lg/LgEngine.js` (adapter inyectado o Luna DRM; parcial, con fallback)

- **Dónde se dispara playback hoy**
  - Servicios/canales:
    - `src/pages/TvRadioServicesPage.jsx` (selección de canal)
    - `src/components/epg/EpgCards.jsx` (play live desde EPG)
    - `src/pages/SearchPage.jsx` (resultados tipo `service` y `epg`)
  - Catchup:
    - `src/pages/CatchupPage.jsx`
    - `src/pages/SearchPage.jsx`
    - `src/components/ads/HomeShellContent.jsx` (si aplica)
  - VOD:
    - `src/pages/VodPage.jsx` llama `play(params)` desde modales (`VodDetailModal*`), no desde la página directamente

## Alcance solicitado (esta iniciativa)

- **Teclas del control remoto** (play/pause/ff/rw/back/return/exit) con prioridad correcta y sin romper foco.
- **Seekbar / HUD mejorado** (TV-safe, press&hold, aceleración, steps configurables, go-live, feedback robusto).
- **Tracks** (audio/subtítulos) con selector UI focusable y fallback por plataforma.
- **Lista de canales** como overlay dentro del player (zapping).
- **Información del evento/canal** (título, horario, live, rating, etc.) en el HUD/overlay.
- **Control parental** desde cero:
  - Existe un campo `parentalControl` en servicios (se integrará en una fase posterior/iterativa).
  - Se requiere PIN + bloqueo de canales/eventos.
- **Engines nativos**: completar wiring en LG/Samsung manteniendo fallback seguro.

## Principios (estabilidad-first)

- **Un solo punto de verdad**: toda reproducción pasa por `PlayerContext.play(...)`.
- **UI no conoce APIs nativas**: las diferencias de plataforma quedan dentro del engine (`WebEngine`, `SamsungEngine`, `LgEngine`).
- **Fallback seguro**: si una capacidad nativa no está disponible o falla, caer a WebEngine sin romper UX.
- **Evitar storms de eventos**: throttling de `timeupdate` ya existe en WebEngine; mantener o reforzar en engines TV.
- **Foco siempre visible en TV**: overlays focusables, focus trap en modales/overlays, retorno de foco al cerrar.

## Plan por fases (orden recomendado)

### Fase 0 — Baseline y guardrails

- [ ] Alinear “punto único” de overlay del player (confirmado: `HomePage`).
- [ ] Asegurar cleanup determinista (listeners/intervals) en HUD/overlays y engines.
- [ ] Añadir utilidades comunes:
  - normalización de teclas remotas (key/keyCode/platform)
  - steps de seek configurables por marca y por tipo de contenido

**Archivos**:
- `src/pages/HomePage.jsx`
- `src/contexts/PlayerContext.jsx`
- `src/components/player/PlayerHud.jsx`
- `src/player/engines/*`

### Fase 1 — Router de teclas remotas (Player-first)

Objetivo: controles del remoto funcionen en el player, con prioridad por overlay (PIN, lista de canales, selector tracks, etc.).

- [ ] Definir un “RemoteKeyRouter” para el player:
  - Back/Return/Exit: cerrar overlay → cerrar player → volver a UI.
  - Media keys:
    - Play/Pause: toggle
    - FF/RW: seek step o press&hold
    - OK/Enter: mostrar HUD / activar acción primaria según overlay
- [ ] Registrar keys en Tizen si se requieren keys adicionales (más allá de Back/Exit/Return/Enter).
- [ ] Evitar conflicto con Norigin:
  - En overlays/inputs, consumir eventos en capture cuando corresponde.

**Archivos candidatos**:
- `src/components/player/PlayerHud.jsx` (listeners y wake HUD)
- `src/components/navigation/SpatialNavigationProvider.jsx` (registro keys + bridges)
- (nuevo) `src/player/remote/*` o `src/utils/remoteKeys/*`

### Fase 2 — HUD/Seekbar TV-safe (press&hold + aceleración)

- [ ] Añadir soporte “press&hold” para FF/RW:
  - incremento progresivo (p. ej. 10s → 30s → 60s) sin spamear `seek()`
  - feedback visual: estado “seeking” + preview del tiempo objetivo
- [ ] Steps configurables por:
  - `type`: `service` vs `vod` vs `catchup`
  - marca: config en `brands.js` (o config equivalente)
- [ ] Live UX:
  - `goLive`
  - “atrasado -mm:ss” consistente (ya existe `liveSecondsLate`)

**Archivos**:
- `src/components/player/PlayerHud.jsx`
- `src/contexts/PlayerContext.jsx`
- `src/styles/pages/_player-hud.scss`

### Fase 3 — Tracks (audio/subtítulos) + UI selector focusable

Objetivo: exponer tracks desde engine con API consistente.

- [ ] Extender contrato del engine para tracks:
  - `getTracks(): { audio: Track[], text: Track[], selectedAudioId, selectedTextId, textEnabled }`
  - `selectAudioTrack(id)`
  - `selectTextTrack(id)` + `setTextTrackEnabled(bool)`
  - eventos: `trackschange`, `trackselected`
- [ ] Implementación por plataforma:
  - Web:
    - HLS/hls.js: `hls.audioTracks`, `hls.subtitleTracks`
    - HTML5: `video.textTracks`
  - Samsung AVPlay:
    - mapear a APIs disponibles por firmware (capabilities runtime)
  - LG:
    - preferir adapter nativo/injected si existe; fallback web si no hay soporte
- [ ] UI:
  - overlay selector con Norigin (lista focusable, cerrar con Back)
  - fallback UX: ocultar si no hay tracks o no está soportado

**Archivos**:
- `src/player/engines/web/WebEngine.js`
- `src/player/engines/samsung/SamsungEngine.js`
- `src/player/engines/lg/LgEngine.js`
- `src/player/engines/contracts.js` (o `.../contracts` existente)
- `src/components/player/*` (nuevo overlay)

### Fase 4 — Lista de canales (overlay) + zapping

- [ ] Definir “fuente de canales” para el overlay:
  - `usePreload().epg.streams` (orden por LCN como en `EpgCards`)
  - incluir info mínima: `id`, `lcn`, `name`, `logo`, `parentalControl`, `epgItems` (si existe)
- [ ] Overlay UI:
  - lista/columna con foco y scroll
  - canal actual destacado
  - Enter/OK: zappear (`play({ type:'service', ... })`)
  - Back: cerrar overlay sin detener reproducción
- [ ] Performance TV:
  - ventana de render (limit DOM si lista es grande)
  - no recalcular toda la lista en ticks

**Archivos**:
- `src/components/player/PlayerHud.jsx` (botón/acción para abrir overlay)
- `src/store/usePreload` (fuente EPG)
- (nuevo) `src/components/player/ChannelListOverlay.jsx` (sugerido)

### Fase 5 — Información de evento/canal en HUD

- [ ] Mostrar metadata estable:
  - Canal: LCN + nombre + logo
  - Evento live: título, horario, progreso, rating
  - Catchup: título/fecha/hora (desde `item`)
  - VOD: título/año/duración (depende de `VodDetailModal`/params)
- [ ] Alinear el modelo `item` que se pasa en `play()`:
  - service: `channel` completo
  - catchup: `event` o `{ catchupId }`
  - vod: params desde modal (definir shape consistente)

**Archivos**:
- `src/components/player/PlayerHud.jsx`
- `src/contexts/PlayerContext.jsx`
- `src/components/epg/EpgCards.jsx` (shape del `item` en service)
- `src/pages/CatchupPage.jsx`

### Fase 6 — Control parental (desde cero, iterativo)

Objetivo: bloquear reproducción/acciones según `parentalControl` (en servicios) con PIN.

- [ ] Definir modelo de datos:
  - PIN (hash/no plaintext si se puede)
  - lista de canales bloqueados (por `id`/`lcn`)
  - política por rating/evento (si aplica)
- [ ] Definir UX:
  - Si canal/evento está bloqueado y el usuario intenta reproducir:
    - abrir modal PIN (focus trap, teclado TV)
    - si PIN OK → permitir reproducción (y opcionalmente recordar por sesión)
    - si PIN falla/cancel → no reproducir y mantener foco
- [ ] Integración:
  - el gating debe ocurrir antes de `play()` (o envolver `play()` con un “guard”)
  - overlay de canal list debe respetar bloqueo (badge + gating)

**Archivos**:
- (nuevo) `src/parental/*` o `src/utils/parental/*`
- (nuevo) `src/components/parental/ParentalPinModal.jsx`
- puntos de entrada: `TvRadioServicesPage`, `EpgCards`, `SearchPage`, overlay de canales, `VodDetailModal` (si aplica)

### Fase 7 — Engines TV (completar wiring nativo sin romper fallback)

- [ ] Samsung AVPlay:
  - robustecer mapeo de estados (buffering/loaded/playing/paused/ended/error)
  - validar `seekTo`, `setDisplayRect`, `prepareAsync`, `setDrm*` por firmware
  - tracks: mapear si hay APIs disponibles
  - hide/resume: decidir política (pause/stop/keep) según estabilidad DRM
- [ ] LG webOS:
  - definir si el camino es adapter inyectado (recomendado) o `<video>` + Luna DRM
  - tracks si aplica
  - hide/resume: política equivalente

**Archivos**:
- `src/player/engines/samsung/SamsungEngine.js`
- `src/player/engines/lg/LgEngine.js`
- `src/player/engines/tv/BaseTvEngine.js`
- `src/player/engines/resolveEnginePlatform.js`

## Criterios de aceptación (DoD)

### Estabilidad (obligatorio)

- [ ] 20 ciclos entrar/salir del player en Web sin degradación visible.
- [ ] 10 ciclos en TV (Samsung 2019, LG 2019) sin:
  - pantalla negra persistente
  - audio fantasma tras cerrar
  - bloqueo de foco (siempre hay foco)
  - memory leak evidente (rendimiento cae progresivamente)
- [ ] Errores de reproducción no dejan la UI bloqueada (Back/Exit siempre responde).

### Funcionalidad (según feature)

- [ ] Teclas remotas funcionan en el player (Play/Pause/FF/RW/Back/Return/Exit).
- [ ] Seekbar responde de forma consistente y no “se queda buscando”.
- [ ] Tracks (si el stream los ofrece) se pueden cambiar; si no, la UI lo oculta/explica.
- [ ] Lista de canales permite zapping fluido y respeta bloqueo parental.
- [ ] Panel de info muestra datos correctos del evento/canal.
- [ ] Control parental: PIN bloquea reproducción cuando corresponde.

## Pruebas recomendadas (TV 2019)

Usar como base `src/docs/TEST_MATRIX_SMARTTV.md` y expandir con:

- Stress de seek (10-20 seeks seguidos; press&hold)
- Cambios de track durante reproducción
- Abrir/cerrar overlays (lista canales, tracks, PIN) repetidamente
- Background/resume (home button / app switch) en Tizen/webOS si está disponible

