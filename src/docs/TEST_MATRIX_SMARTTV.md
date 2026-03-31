# Matriz de Pruebas Smart TV (Tizen/webOS 2019+) — Guardrails de migración

Este documento define un set mínimo y repetible de pruebas para detectar regresiones en **performance, foco, navegación y playback** durante la migración.

## Plataformas

- **Browser/desktop** (dev rápido): Chrome/Edge
- **Samsung Tizen 2019 (Tizen 5.0)**: `webapis.avplay` (DRM/DASH nativo)
- **LG webOS 2019 (4.5/5.x)**: APIs nativas (DRM/Media)

## Reglas de ejecución

- Ejecutar estas pruebas **después de cada etapa** del plan (al menos en browser + 1 TV).
- En TV, repetir ciclos (entrar/salir/reintentar) para detectar **leaks** y degradación progresiva.
- Registrar: **tiempo de carga**, **latencia de input**, **errores de player**, **consumo de memoria aproximado** (si hay herramientas), y **jank/flicker**.

---

## Suite A — Arranque / Rutas / Sesión (Auth)

- [ ] **A1. Cold start**: abrir app desde cero → Splash visible < 1s.
- [ ] **A2. Login**: credenciales válidas → navegación a Home.
- [ ] **A3. Logout / sesión inválida**: navegar a ruta protegida sin sesión → redirige a `/`.
- [ ] **A4. Revalidación**: dejar app 5–10 min → no se cae la sesión; si se invalida, redirige correctamente.
- [ ] **A5. Offline**: cortar red en Home → app no se congela; UI informa estado; reintento al recuperar red.

Archivos relacionados:
- `src/App.jsx`
- `src/hooks/useAuthValidator.js`
- `src/utils/userSession.js`

---

## Suite B — Foco y navegación (D-Pad / Remote)

- [ ] **B1. Foco visible**: siempre hay un elemento enfocado (sin “foco perdido”).
- [ ] **B2. Grid/List**: UP/DOWN/LEFT/RIGHT navega consistentemente en Bouquets/EPG/VOD.
- [ ] **B3. Back/Return**: vuelve al estado anterior correcto (incluye cerrar modales/overlays).
- [ ] **B4. Modales**: al abrir modal, el foco entra al modal; al cerrar, vuelve al elemento previo.
- [ ] **B5. Re-render**: cambiar filtros/listas no “salta” el foco a un elemento inesperado.

Archivos relacionados:
- `src/components/navigation/SpatialNavigationProvider.jsx`
- `src/hooks/navigation/useSpatialNavigation.js`
- Puntos con `setFocus` manual (Login/Bouquet/Profile/Modales)

---

## Suite C — Preload / Datos (EPG, VOD, Ads, Catchup)

- [ ] **C1. PreloadGate**: módulos que requieren EPG no renderizan estados rotos; muestran loading/skeleton.
- [ ] **C2. Transiciones rápidas**: navegar rápido entre rutas → no deja requests colgados ni UI bloqueada.
- [ ] **C3. Memoria**: repetir 10 veces entrar/salir Bouquets↔EPG↔VOD → no hay degradación notable.
- [ ] **C4. Timeout**: simular backend lento → la UI no queda bloqueada en “loading eterno”.

Archivos relacionados:
- `src/contexts/PreloadContext.jsx` (mientras exista)
- `src/components/preload/PreloadGate.jsx`
- `src/services/*`

---

## Suite D — Playback (Player / DRM / Streams)

- [ ] **D1. Playback básico**: play/pause/stop sin errores.
- [ ] **D2. Seek**: 5 seeks consecutivos → no se desincroniza UI/tiempo.
- [ ] **D3. Ciclos**: 20 ciclos entrar/salir del player (browser) / 10 ciclos (TV) → sin degradación.
- [ ] **D4. DRM (TV)**: DASH+DRM reproduce (PlayReady/Widevine según target).
- [ ] **D5. Error handling**: stream inválido → mensaje claro; la app se recupera (volver atrás funciona).

Archivos relacionados:
- `src/contexts/PlayerContext.jsx`
- `src/player/engines/**`

---

## Suite E — Viewport scaling / Flicker (Tizen 2019 crítico)

- [ ] **E1. Sin flicker**: al entrar a app y al abrir módulos, no se ve parpadeo por cambios de clases/scale.
- [ ] **E2. Resize events** (si el device los dispara): no hay “repintadas masivas” frecuentes.

Archivos relacionados:
- `src/App.jsx`
- `src/hooks/useViewport.js`
- `src/styles/**`

