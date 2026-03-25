# Migración `10foot` (Legacy) → `appVideo` (Vite + React) — Informe + Checklist

Este documento consolida el análisis técnico de ambos proyectos (Legacy: `10foot`, Modern: `appVideo`) y lo convierte en una **checklist accionable** para ejecutar una migración completa, ordenada y sin pérdida de funcionalidades, con foco en **performance y correctitud en Smart TV (LG webOS y Samsung Tizen, modelos ≥ 2019)**.

---

## Resumen ejecutivo

- **Legacy (`10foot`)**: arquitectura **imperativa** basada en **Scenes + Router + Control remoto global + Focus por DOM**. Estado global en singletons (`AppData`, `User`, `CONFIG`). Módulos críticos: **EPG (coordenadas / grid), Player + DRM PlayReady + drivers device**, login/licencias y overlays.
- **Modern (`appVideo`)**: **React + React Router + Contexts**. Foco con `@noriginmedia/norigin-spatial-navigation`. Sin Redux/Zustand; sin TanStack Query/SWR; fetching con **`fetch` + clientes propios (Panaccess/cv)**.
- **Riesgos principales (actuales)**:
  - **Leak/event storms** en `appVideo/src/player/engines/web/WebEngine.js` (listeners del `<video>` sin `removeEventListener` en `destroy()`).
  - **Preload masivo/secuencial** (N+1) en `appVideo/src/contexts/PreloadContext.jsx` (Catchup/EPG/VOD) con impacto grande en TVs 2019.
  - **Foco potencialmente inestable** por `focusKey` no estable + `setFocus` manual distribuido.
  - **Cifrado con secret por defecto** si no se setea `VITE_SECRET_KEY` (riesgo operacional).
  - **Re-renders por “ticks”** (EPG cada 1s / player events) si el estado no está segmentado.

---

## Referencias rápidas (archivos clave)

### Legacy (`10foot`)

- **Carga + dependencias runtime**: `10foot/public/index.html`
- **Boot + escenas**: `10foot/public/js/app.js`
- **Router**: `10foot/public/js/core/module/router.js`
- **Scenes lifecycle**: `10foot/public/js/core/module/scene.js`
- **Control remoto global**: `10foot/public/js/core/module/control.js`
- **Focus (DOM)**: `10foot/public/js/core/module/focus.js`
- **Estado global**: `10foot/public/js/module/app-data.js`, `10foot/public/js/module/user.js`
- **Storage**: `10foot/public/js/core/module/storage.js`
- **Ajax/CV**: `10foot/public/js/core/module/ajax.js`, `10foot/public/js/module/cv.js`
- **EPG**: `10foot/public/js/module/epg.js`, `10foot/public/js/module/EPGCards.js`
- **Player/DRM/Drivers**:
  - Player: `10foot/public/js/core/module/player.js`
  - PlayReady: `10foot/public/js/core/module/playready.js`
  - UI player: `10foot/public/js/module/nbplayer.js`
  - Drivers: `10foot/public/js/core/device/**`

### Modern (`appVideo`)

- **Entrypoint**: `appVideo/src/main.jsx`
- **Routing**: `appVideo/src/App.jsx`
- **Spatial nav provider**: `appVideo/src/components/navigation/SpatialNavigationProvider.jsx`
- **Hook foco**: `appVideo/src/hooks/navigation/useSpatialNavigation.js`
- **Contexts**:
  - Brand: `appVideo/src/contexts/BrandContext.jsx`
  - Device: `appVideo/src/contexts/DeviceContext.jsx`
  - Player: `appVideo/src/contexts/PlayerContext.jsx`
  - Preload: `appVideo/src/contexts/PreloadContext.jsx`
- **Auth/sesión**: `appVideo/src/utils/userSession.js`, `appVideo/src/hooks/useAuthValidator.js`
- **Panaccess/login flow**: `appVideo/src/services/panaccessService.js`, `appVideo/src/services/loginFlow.js`
- **EPG**: `appVideo/src/services/epgService.js`, `appVideo/src/components/epg/EpgCards.jsx`
- **Player engines**: `appVideo/src/player/engines/**` (hotspot: `.../web/WebEngine.js`)

---

## Análisis del Proyecto Base (Legacy) — `10foot`

### 1) Navegación por control remoto y eventos

- **Entrada**: `document.keydown` centralizado (jQuery).
- **Dispatch**: `Control.trigger('beforekey'/'key')` y las Scenes escuchan.
- **Lifecycle**: cada Scene implementa `onKeyDown`, `navigate(direction)`, `onEnter`, `onReturn`.

Archivos:
- `10foot/public/js/core/module/control.js`
- `10foot/public/js/core/module/scene.js`
- `10foot/public/js/core/module/router.js`

### 2) Gestión de foco (10-foot UI)

- **Mecanismo**: foco por **clases CSS y manipulación DOM** (`.focus`, `.focusable`) + filtros `:visible`.
- **EPG clásico**: **hit-testing por coordenadas** (uso de `elementFromPoint`) y celdas con `data-x/data-y`.

Archivos:
- `10foot/public/js/core/module/focus.js`
- `10foot/public/js/module/epg.js`

### 3) Estado / lógica de negocio

- **Single-source-of-truth**: singletons mutables.
  - `AppData`: catálogos/caches y estructuras de EPG.
  - `User`: sesión, preferencias y flags remotos.
- **Persistencia**: `localStorage` con prefijo por brand.

Archivos:
- `10foot/public/js/module/app-data.js`
- `10foot/public/js/module/user.js`
- `10foot/public/js/core/module/storage.js`

### 4) Fetching y flujo de datos

- `Ajax.request` (Promise sobre `$.ajax`).
- Cliente `cv` que orquesta login/config/licencias/streams/EPG/catchup/ads/osms.
- Abort de request EPG y reintentos: riesgo de paralelismo si no se controla bien.

Archivos:
- `10foot/public/js/core/module/ajax.js`
- `10foot/public/js/module/cv.js`

### 5) Integraciones (player/DRM/device)

- **DRM**: PlayReady helper y/o lógica per-device.
- **Player**: abstraído, reemplazado por drivers por plataforma.
- **Drivers**: mapeos de keys y player APIs para Tizen/webOS/Samsung/LG/etc.

Archivos:
- `10foot/public/js/core/module/player.js`
- `10foot/public/js/core/module/playready.js`
- `10foot/public/js/core/device/**`
- `10foot/public/js/module/nbplayer.js`

### 6) Memoria/assets/listeners

Patrones típicos del legacy:
- keydown global permanente (OK si es único).
- intervalos frecuentes (red/EPG/ads/player autohide) con riesgo de quedar activos si overlays/módulos se re-inicializan.
- DOM caches (algunos módulos cachean nodos) y overlays apilados.

---

## Análisis del Proyecto Nuevo (Modern) — `appVideo`

### 1) Arquitectura de componentes y routing

- `react-router-dom` con `Routes/Route`, rutas lazy con `Suspense`.
- Guards: `ProtectedRoute` (validación por `isAuthenticated()` + `useAuthValidator()`).

Archivos:
- `appVideo/src/main.jsx`
- `appVideo/src/App.jsx`
- `appVideo/src/utils/userSession.js`
- `appVideo/src/hooks/useAuthValidator.js`

### 2) Estado global (Contexts)

- Sin Redux/Zustand: Contexts principales:
  - `BrandContext`, `DeviceContext`, `PlayerContext`, `PreloadContext`.
- Riesgo: Contexts “grandes” (muchos campos) → renders amplificados en TV.

Archivos:
- `appVideo/src/contexts/*.jsx`

### 3) Fetching y auth (sin TanStack Query)

- Sin TanStack Query/SWR: fetching con `fetch` + `panaccessService`.
- Retry/control de errores: `src/cv/errorClassifier.js` + `retryOperation`.
- Persistencia sesión/credenciales: `localStorage` + AES (`crypto-js`).

Archivos:
- `appVideo/src/services/panaccessService.js`
- `appVideo/src/services/loginFlow.js`
- `appVideo/src/cv/*`
- `appVideo/src/utils/userSession.js`

### 4) Spatial navigation y foco

- Provider: inicializa Norigin y define keymap en TV.
- Hook wrapper: `useSpatialNavigation` para activar `useFocusable` solo en TV.
- `setFocus` manual en páginas/modales: buen “escape hatch”, pero si se usa mucho tiende a “imperativizar” React.

Archivos:
- `appVideo/src/components/navigation/SpatialNavigationProvider.jsx`
- `appVideo/src/hooks/navigation/useSpatialNavigation.js`
- Puntos con `setFocus` (revisar):
  - `appVideo/src/pages/LoginPage.jsx`
  - `appVideo/src/components/bouquet/Bouquet.jsx`
  - `appVideo/src/pages/ProfilePage.jsx`
  - `appVideo/src/components/MessageModal.jsx`
  - `appVideo/src/components/Profile/*Modal.jsx`

### 5) Unmounting y memory leaks

- Bien: varios hooks limpian `resize/popstate/storage/intervals`.
- Crítico: `WebEngine` agrega listeners al `<video>` y no remueve en `destroy()`.

Archivos:
- `appVideo/src/player/engines/web/WebEngine.js`

### 6) Performance (TV)

Hotspots:
- Preload secuencial/N+1: `appVideo/src/contexts/PreloadContext.jsx`
- Listas grandes sin virtualización: EPG/Bouquets/VOD.
- Ticks que disparan renders: `EpgCards` tick 1s.
- Bundle: `bootstrap` + `crypto-js` + i18n; revisar chunking en `vite.config.js`.

Archivos:
- `appVideo/src/contexts/PreloadContext.jsx`
- `appVideo/src/components/epg/EpgCards.jsx`
- `appVideo/vite.config.js`

---

## Tabla comparativa (equivalencias) — Legacy → Modern

| Área | Legacy (`10foot`) | Modern (`appVideo`) | Estado | Checklist |
|---|---|---|---|---|
| Routing/pantallas | `router.js` + `scene/*.js` | `react-router-dom` (`src/App.jsx`) | Migrado | [ ] Validar equivalencias de overlays/return/back |
| Control remoto | `control.js` keydown global | Norigin keymap (`SpatialNavigationProvider`) | Migrado (parcial) | [ ] Back/Return + media keys + numéricos si aplica |
| Foco | `focus.js` DOM | Norigin (`useSpatialNavigation`, `Focusable*`) | Migrado | [ ] `focusKey` estable + focus trap modales |
| Estado | `AppData/User/CONFIG` | Contexts | Migrado | [ ] Segmentar contexts / evitar renders globales |
| Fetching | `$.ajax` + `cv.js` | `fetch` + `panaccessService`/`loginFlow` | Migrado (parcial) | [ ] Cache/abort/retry consistente |
| EPG | `epg.js` coords + optimizaciones / `EPGCards` | `components/epg/*` + `epgService` | Parcial | [ ] Ventanas/DOM bounds + foco robusto |
| Player/DRM | `player.js` + `playready.js` + drivers | `player/engines/*` + PlayerContext | Parcial | [ ] Fix leaks + validar DRM por device |
| Ads | `Ads.js` | (ver `AdZone`) | Parcial | [ ] Cleanup timeouts + no bloquear foco |
| OSMs | `Osms.js` | (no confirmado) | Brecha probable | [ ] Confirmar migración de mensajería |
| Inactividad/Parental | `InactivityManager`, `ParentalControlDlg` | (no confirmado) | Brecha probable | [ ] Implementar overlays + timers + PIN |

---

## Checklist priorizada (para ejecutar y tildar)

### A. Crítico (estabilidad/perf en TV)

- [ ] **Fix leak del player**: asegurar `removeEventListener` en `appVideo/src/player/engines/web/WebEngine.js` (y equivalente en otros engines si aplica).
- [ ] **Eliminar secret inseguro**: evitar fallback `"default-secret-key-change-me"` en `appVideo/src/utils/userSession.js` (fallar en build/prod si falta).
- [ ] **Re-diseñar Preload TV-first** en `appVideo/src/contexts/PreloadContext.jsx`:
  - [ ] carga mínima para Home/EPG visible
  - [ ] diferir carga secundaria (idle/after paint)
  - [ ] batching y paralelismo controlado (límite de concurrencia)
  - [ ] cancelación/abort si el usuario navega
- [ ] **Estandarizar foco**:
  - [ ] `focusKey` estable por entidad (id real, no índice)
  - [ ] focus trap en modales
  - [ ] contrato claro de “initial focus” por pantalla
- [ ] **Reducir re-renders por ticks**:
  - [ ] aislar el estado que cambia cada 1s (EPG “now”) del resto del árbol
  - [ ] evitar que `PlayerContext` propague updates de alta frecuencia a toda la app

### B. Importante (equivalencia funcional)

- [ ] **OSMs**: confirmar si existe equivalente en `appVideo`; si no:
  - [ ] migrar overlay/lista/detalle + persistencia de “leídos” (paridad con `10foot/public/js/module/Osms.js`)
- [ ] **Inactividad**: migrar lógica de timeout + modal countdown + impacto en player (paridad con `10foot/public/js/module/InactivityManager.js`)
- [ ] **Parental/PIN**: migrar flujo de PIN + bloqueo por canal/contenido (paridad con `ParentalControlDlg`)
- [ ] **EPG performance**:
  - [ ] limitar DOM (ventanas/segmentos)
  - [ ] focus navigation en grids/listas consistente
  - [ ] abort/cancel de fetch EPG al navegar
- [ ] **Compatibilidad keys**:
  - [ ] Back/Return (Tizen/webOS)
  - [ ] media keys (Play/Pause/FF/RW) si el legacy las usa
  - [ ] numéricos/guide/color keys si son features legacy

### C. Mejora (optimización/UX/infra)

- [ ] **Chunking y tamaño de bundle**: ajustar `appVideo/vite.config.js` para separar deps pesadas (bootstrap/crypto-js/i18n) y mejorar cache.
- [ ] **Suspense UX**:
  - [ ] evitar pantallas en blanco (fallbacks TV-friendly)
  - [ ] prefetch de rutas críticas (Home/Player/EPG)
- [ ] **Telemetría mínima** (si aplica): tiempos de preload, errores de playback, memoria aproximada, FPS/long tasks.
- [ ] **Accesibilidad 10-foot**:
  - [ ] foco visible (outline/scale/shadow consistente)
  - [ ] feedback de “cargando” con timeouts controlados
  - [ ] latencias visibles en acciones del control remoto

---

## “Definition of Done” por feature (para cerrar migración)

### Login / Licencias / Sesión
- [ ] login exitoso + persistencia sesión
- [ ] renovación/validación periódica (`useAuthValidator`)
- [ ] activación/estado de licencias (paridad con legacy)
- [ ] manejo offline (si aplica en legacy)

Archivos guía:
- Legacy: `10foot/public/js/module/LoginHelper.js`, `10foot/public/js/module/cv.js`
- Modern: `appVideo/src/services/loginFlow.js`, `appVideo/src/services/panaccessService.js`, `appVideo/src/utils/userSession.js`

### Player / DRM
- [ ] play/pause/seek robusto
- [ ] cambio de audio/subtitles si existe en legacy
- [ ] cleanup correcto al salir del player (sin listeners duplicados)
- [ ] DRM OK por device (webOS/Tizen)

Archivos guía:
- Legacy: `10foot/public/js/module/nbplayer.js`, `10foot/public/js/core/module/playready.js`, `10foot/public/js/core/device/**`
- Modern: `appVideo/src/contexts/PlayerContext.jsx`, `appVideo/src/player/engines/**`

### EPG
- [ ] carga rápida (primera vista)
- [ ] navegación fluida (sin jank) con listas grandes
- [ ] actualización “now” sin re-render masivo
- [ ] modal/detalle de evento (si aplica)

Archivos guía:
- Legacy: `10foot/public/js/module/epg.js`, `10foot/public/js/module/EPGCards.js`
- Modern: `appVideo/src/components/epg/EpgCards.jsx`, `appVideo/src/services/epgService.js`

---

## Notas de riesgo específico (Smart TV 2019+)

- **DOM grande** y **reflows** penalizan fuerte; preferir ventanas/segmentos.
- **Timers** (1s) deben afectar el mínimo subárbol posible.
- **Listeners** de video y globales deben tener teardown determinista.
- **Focus** debe ser estable ante re-render (keys estables + traps de modales).

