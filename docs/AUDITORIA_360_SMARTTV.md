# Auditoría 360° — OTT Smart TV (Tizen / webOS) — React + Vite

**Proyecto**: `appVideo`  
**Fecha**: 2026-04-30  
**Rol**: Senior OTT Software Architect (Smart TV)  
**Stack detectado**: React 18 + Vite 7, React Router DOM 7, Zustand, TanStack Query, i18next, Hls.js, engines por plataforma (Web/LG/Samsung).

---

## 1) Resumen Ejecutivo

El proyecto tiene una base sólida para Smart TV: **arranque con “boot shell”**, **render clásico (`ReactDOM.render`)**, **code splitting** por páginas y por módulo de player, y una **abstracción de reproducción por engines** (web/lg/samsung).  

Los principales riesgos para un entorno OTT real (Tizen/webOS 2019+) se concentran en:

- **Seguridad/operación**: uso de una **clave de cifrado por defecto** para credenciales cuando falta `VITE_SECRET_KEY`.
- **Certificación/UX 10-foot**: el sistema de foco y navegación por control remoto luce **incompleto y/o inconsistente** (docs hablan de Norigin pero no existe la dependencia/archivos).
- **Performance TV-first**: EPG con **re-render global cada 1s** y **preload EPG potencialmente masivo** (cargar EPG para todos los canales).
- **Compatibilidad runtime**: `@vitejs/plugin-legacy` está importado pero **no está activo** en `vite.config.js` (si el target incluye webviews más viejos, puede romper).

---

## 2) Alcance de la auditoría

Se revisaron (muestreo representativo) los siguientes ejes:

- **Build + runtime targets**: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`
- **Routing + session gating**: `src/App.jsx`, `src/hooks/useAuthValidator.js`, `src/utils/userSession.js`
- **Estados globales / fetching**: `src/query/QueryProvider.jsx`, `src/store/preloadStore.js` + `src/store/usePreload.js`
- **Player lifecycle**: `src/contexts/PlayerContext.jsx`, `src/player/engines/**`
- **UX 10-foot (focus/keys/modals)**: `src/components/navigation/*`, `src/components/epg/EpgEventModal.jsx`, `src/components/inactivity/InactivityHost.jsx`, `src/components/bouquet/Bouquet.jsx`
- **Documentación interna**: `src/docs/*` y `docs/*`

---

## 3) Puntos fuertes (preservar)

### 3.1 Arranque y primer paint
- **Boot shell antes del bundle**: `index.html` renderiza `#app-boot-shell` y setea splash de marca. Esto reduce “pantalla negra” y mejora percepción de performance.

### 3.2 Compatibilidad WebView de TVs
- **`ReactDOM.render`**: `src/main.jsx` justifica que ciertos WebViews de TV se comportan mejor que `createRoot`.

### 3.3 Arquitectura del player por plataforma
- **Engines separados**: `src/player/engines/{web,lg,samsung}` + `createEngine.js` + `resolveEnginePlatform.js` es el approach correcto para Tizen/webOS.
- **Engine longevo**: `src/contexts/PlayerContext.jsx` crea el engine una sola vez para evitar pantalla negra y overhead por reinit.

### 3.4 Estrategia de bundle / chunking
- **Code splitting por páginas**: lazy routes en `src/App.jsx`.
- **Chunk dedicado a player**: `vite.config.js` genera chunk `player-engine`.

### 3.5 Defaults “TV-friendly” en TanStack Query
- `src/query/QueryProvider.jsx`: reduce refetch agresivo y define `staleTime/gcTime`, adecuado para CPU/red limitadas.

---

## 4) Hallazgos (con severidad)

> Convención: **Crítico** = riesgo de certificación/seguridad/estabilidad.  
> **Importante** = degradación fuerte de performance o mantenibilidad.  
> **Mejora** = optimizaciones recomendadas, no bloqueantes.

---

### 4.1 Crítico — Seguridad / Operación

#### H4.1.1 Clave de cifrado insegura por defecto
- **Evidencia**: `src/utils/userSession.js`:
  - `getSecretKey()` retorna `import.meta.env.VITE_SECRET_KEY || 'default-secret-key-change-me'`.
  - `setLoggedIn()` cifra username/password con AES usando esa key.
- **Impacto**:
  - Si prod sale sin `VITE_SECRET_KEY`, las credenciales quedan cifradas con una clave conocida → exposición real.
  - Riesgo de auditorías/pentest y riesgo operacional (compromiso de cuentas).
- **Recomendación**:
  - En **producción**, no permitir fallback: fallar en build o al iniciar si falta `VITE_SECRET_KEY`.
  - Definir estrategia de migración de credenciales ya persistidas (re-login o migración por “fallbackKey” controlado).

---

### 4.2 Crítico — UX 10-foot / Certificación (foco y control remoto)

#### H4.2.1 Spatial navigation inconsistente / migración incompleta
- **Evidencia**:
  - Documentos internos mencionan Norigin: `src/docs/TEST_MATRIX_SMARTTV.md` y `src/docs/MIGRACION_10FOOT_A_APPVIDEO_CHECKLIST.md`.
  - Sin embargo, no existe `src/components/navigation/SpatialNavigationProvider.jsx` ni `src/hooks/navigation/useSpatialNavigation.js`.
  - `package.json` no contiene `@noriginmedia/norigin-spatial-navigation`.
  - Componentes `FocusableButton`/`FocusableInput` declaran “Se eliminó completamente la lógica de navegación por foco/control remoto”.
- **Impacto**:
  - Alta probabilidad de “focus lost”, navegación no determinística y fallos de certificación (“no se puede usar solo con remoto”, “foco no visible”).
- **Recomendación**:
  - Decidir un enfoque único:
    - Adoptar una librería madura de spatial navigation (p.ej. Norigin) y estandarizar `focusKey`, boundaries, traps.
    - O implementar un motor propio (más riesgoso) con contrato de foco por pantalla + overlays + retorno.
  - Centralizar “Back/Return/Exit” y normalización de teclas en un único módulo.

---

### 4.3 Crítico — Compatibilidad build/runtime

#### H4.3.1 `@vitejs/plugin-legacy` importado pero no aplicado
- **Evidencia**: `vite.config.js` importa `legacy` pero `plugins` solo incluye `react()`.
- **Impacto**:
  - Si el target real incluye WebViews con gaps (según modelo/año), pueden aparecer errores de sintaxis/polyfills.
- **Recomendación**:
  - Confirmar matriz mínima (webOS 4/5 y Tizen 4/5/6).
  - Activar `legacy()` con targets explícitos solo si aplica; si no, eliminar dependencia para reducir complejidad.

---

### 4.4 Importante — Performance (CPU/RAM en TV)

#### H4.4.1 EPG re-render masivo por tick de 1s
- **Evidencia**: `src/components/epg/EpgCards.jsx`:
  - `setInterval(() => setNowMs(Date.now()), 1000)`
  - El `nowMs` participa en el render y recalcula slots y progreso para cada canal.
- **Impacto**:
  - Input lag / jank / caídas progresivas en TVs 2019, especialmente con muchos canales.
- **Recomendación**:
  - Aislar el tick: que solo actualice el mínimo subárbol (p.ej. solo la fila enfocada o un “now ticker” compartido con memo).
  - Reducir frecuencia (5–15s) y/o actualizar solo progresos visibles.

#### H4.4.2 Preload EPG potencialmente masivo
- **Evidencia**: `src/store/preloadStore.js`:
  - En `loadEPG`, luego de `getBouquetsWithChannels`, calcula `total = allStreams.length` y llama `loadEPGForStreams(..., { maxChannels: total })`.
- **Impacto**:
  - Cargar EPG para “todos los canales” puede exceder presupuesto de red/CPU/memoria.
- **Recomendación**:
  - “TV-first preload”: cargar solo `rowsOnInit` o un subconjunto (bouquet visible), y lazy-load a demanda.
  - Concurrencia limitada + abort/cancel al navegar.

---

### 4.5 Importante — Mantenibilidad / deuda documental

#### H4.5.1 Documentación de routing desalineada
- **Evidencia**: `src/docs/ROUTING.md` describe `src/routes/AppRouter.jsx`, `layouts/`, etc. pero el routing real vive en `src/App.jsx` y rutas actuales difieren.
- **Impacto**:
  - Onboarding lento; decisiones técnicas basadas en docs incorrectas.
- **Recomendación**:
  - Actualizar doc para reflejar el árbol real o mover el router a la estructura documentada.

---

### 4.6 Mejora — UX/Accesibilidad 10-foot

#### H4.6.1 Foco visible y contrato de foco por pantalla
- **Evidencia**:
  - Varias pantallas/modales hacen focus con `setTimeout + element.focus()` (ej. `Bouquet`, `EpgEventModal`).
- **Impacto**:
  - En TV, “timers de foco” suelen ser frágiles ante re-render/layout shifts.
- **Recomendación**:
  - Definir contrato por pantalla: “initial focus”, “restore focus”, “modal trap”, “escape/back behavior”.
  - Garantizar estilos de foco visibles y consistentes.

---

## 5) Evaluación de Arquitectura (estructura y flujo)

### 5.1 Jerarquía y providers
- `src/main.jsx` envuelve `App` con:
  - `ErrorBoundary`
  - `BrowserRouter`
  - `DeviceProvider`
  - `BrandProvider`
  - `AppQueryProvider`

**Observación**: correcto, pero hay que vigilar providers “grandes” que generen renders amplificados.

### 5.2 Routing y guards
- `src/App.jsx` implementa:
  - páginas lazy con `Suspense`
  - `ProtectedRoute` (check `isAuthenticated()` + `useAuthValidator()`).

**Riesgo**: en TV, las redirecciones + “validación periódica” (cada 5 min en `useAuthValidator`) pueden disparar cambios inesperados de estado; debe estar muy bien testeado con network flakiness.

### 5.3 Estado global: Zustand + React Query
- Hay coexistencia (Zustand para preload/parental/inactividad/reminders, React Query para fetching general).

**Recomendación**: definir responsabilidad clara:
- React Query para datos “server state” cacheables.
- Zustand para “UI/app state” y orquestación.

---

## 6) Recomendaciones TV-first (patrones)

### 6.1 Foco y navegación
- Unificar input remoto:
  - Normalización: `key`, `code`, `keyCode` (Tizen 10009, LG 461, etc).
  - Router de acciones por capa: screen < overlay < player HUD (stack).
- Spatial navigation consistente:
  - `focusKey` estable por entidad (ID real, no índice).
  - boundaries por secciones (sidebar/grid/modals).
  - trap en modales + restore focus.

### 6.2 Performance
- Evitar “ticks globales” que re-renderizan grillas completas.
- EPG con ventanas (viewport/windowing) y/o rendering incremental.
- Preload por etapas: mínimo para home visible, luego diferido (idle) con límites de concurrencia.

### 6.3 Player lifecycle
- Asegurar teardown determinista:
  - listeners de `<video>`, intervalos, observers.
  - ciclos de entrada/salida repetidos sin degradación.

---

## 7) Plan de Acción (Roadmap)

### Fase 0 — Guardrails (1–2 días)
- [ ] Eliminar fallback inseguro de `VITE_SECRET_KEY` en producción.
- [ ] Definir matriz mínima de TVs y decisión formal sobre `plugin-legacy`.
- [ ] Alinear documentación (`ROUTING.md`, spatial nav) con el código real.

### Fase 1 — Certificable 10-foot (3–7 días)
- [ ] Implementar spatial navigation real (o motor propio) con contrato de foco.
- [ ] Centralizar manejo de teclas Back/Return/Exit + prioridades por overlays.
- [ ] Checklist de pruebas de foco/remote (basado en `src/docs/TEST_MATRIX_SMARTTV.md`, actualizado).

### Fase 2 — Performance TV-first (5–10 días)
- [ ] Reducir re-render masivo en EPG (tick localizado).
- [ ] Rediseñar preload EPG/VOD: ventanas + lazy + cancelación + límite de concurrencia.
- [ ] Revisión de bundle/chunks y tamaños por marca.

### Fase 3 — Estabilidad y soak tests (continuo)
- [ ] Soak test en TV real: 10–20 ciclos navegación+player+modales.
- [ ] Telemetría mínima (debug): tiempos de arranque, preload, errores de engine, latencia de input.

---

## 8) Consultas (preguntas para cerrar ambigüedades)

1) **Targets exactos de certificación**: ¿webOS 4.0/4.5/5.x y Tizen 4/5/6?  
2) **Estrategia de navegación**: ¿todo debe ser navegable por D-Pad (sin mouse) en todas las pantallas?  
3) **Spatial navigation**: ¿hubo decisión de no usar Norigin? Si no, ¿dónde quedó la implementación?  
4) **Tamaño real de EPG**: cantidad típica de canales y eventos por canal (picos).  
5) **Modo de deployment**: ¿servido por HTTP/CDN o empaquetado con rutas especiales? (impacta `BrowserRouter` vs `HashRouter`).  
6) **Política de seguridad**: ¿está permitido persistir password en storage (aunque cifrado) o se requiere refresh token/rotación?

---

## 9) Apéndice — Archivos clave revisados

- Build/boot: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`
- Routing/auth: `src/App.jsx`, `src/hooks/useAuthValidator.js`, `src/utils/userSession.js`
- Estado/datos: `src/query/QueryProvider.jsx`, `src/store/preloadStore.js`, `src/store/usePreload.js`
- Player: `src/contexts/PlayerContext.jsx`, `src/player/engines/web/WebEngine.js`, `src/player/engines/resolveEnginePlatform.js`
- UX: `src/components/navigation/*`, `src/components/epg/EpgEventModal.jsx`, `src/components/inactivity/InactivityHost.jsx`, `src/components/bouquet/Bouquet.jsx`

