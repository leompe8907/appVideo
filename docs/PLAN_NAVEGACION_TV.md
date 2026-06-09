# Plan de implementación — Navegación TV (10-foot)

**Proyecto:** appVideo  
**Fecha:** 2026-06-09  
**Relacionado:** `AUDITORIA_TECNICA.md` (H-06–H-17, H-45–H-54), `AUDITORIA_CONSOLIDADA_PLAN_ACCION.md` (Etapa 4)

---

## 1. Objetivo

Lograr navegación con D-pad **uniforme y fluida** en todas las áreas de la app en Samsung Tizen 4/5 y LG webOS 4/5 (~2019), con latencia percibida **&lt; 100 ms** entre elementos y sin pérdida de foco al abrir/cerrar modales.

### Criterios de aceptación globales

| # | Criterio |
|---|----------|
| G1 | Una sola pulsación LRUD mueve el foco exactamente un paso lógico (sin “saltos” ni doble consumo). |
| G2 | BACK cierra modal/overlay y restaura foco previo en &lt; 50 ms. |
| G3 | Sidebar ↔ contenido principal funciona en **todas** las rutas `/home/*`. |
| G4 | Ninguna pantalla deja al usuario sin elemento enfocado tras cargar datos. |
| G5 | En TV, scroll al foco es **instantáneo** (sin animación smooth perceptible). |
| G6 | Checklist de 20 pulsaciones rápidas en Inicio sin jank visible (Tizen emulator o hardware). |

---

## 2. Estado actual por área

| Área | Ruta / componente | Hook / mecanismo actual | Estado TV | Hallazgos |
|------|-------------------|-------------------------|-----------|-----------|
| **Login** | `/login` | `useLoginTvNavigation` | Funcional | H-13, timeouts 300 ms iniciales |
| **Smartcard** | `/smartcard` | `useSmartcardTvNavigation` | Funcional | H-13 |
| **Perfiles** | `/profile` | Foco parcial, sin LRUD | **Parcial** | H-49 |
| **Home shell** | `HomeInputDispatcher` | Sidebar ↔ main, BACK | Funcional | H-13, H-16 |
| **Sidebar** | `Sidebar.jsx` | LRUD vertical propio | Lag | H-06, H-54 |
| **Inicio (muro)** | `/home/inicio` | `useBouquetMuroTvNav` | Lag severo | H-07, H-45–H-47 |
| **Servicios TV/Radio** | `/home/servicios-tv-radio` | `useBouquetMuroTvNav` | Lag | Igual que muro |
| **VOD** | `/home/vod` | `useVodPageTvNav` + overlay | Funcional con lag | H-07, H-48 |
| **VOD rail Inicio** | `VodRecommendedHomeRail` | `useVodOverlayTvNav` | Funcional | H-13 |
| **EPG cards** | `/home/epg` | `tabIndex={-1}` + delegate | **Roto** | H-49 |
| **Catchup** | `/home/catchup` | Tab order nativo | **Incompleto** | H-49, sin puente shell |
| **Buscador** | `/home/buscador` | Sin hook TV | **Incompleto** | H-49 |
| **Control parental** | `/home/control-parental` | `ParentalPinGate` parcial | **Incompleto** | H-49 |
| **OSMS** | `/home/osms` | Sin hook TV | **Incompleto** | H-49 |
| **Player HUD** | `PlayerHud` + hook | Duplicado | Conflictos | H-13, H-51 |
| **Modales** | `ConfirmModal`, `EpgEventModal`, `VodDetailModal`, etc. | Cada uno `keydown` | Frágil | H-13, H-14 |
| **Parental gate** | `ParentalPinGate` | Listener propio | OK aislado | Integrar en router |
| **Inactividad** | `InactivityHost` | Listener propio | OK | Prioridad baja en router |
| **Ads zones** | `AdZone` | `tabIndex` + puentes en muro/VOD | Funcional | Mantener en modelos |

**Listeners `keydown` globales hoy (15+):** `HomeInputDispatcher`, `Sidebar`, `useBouquetMuroTvNav`, `useVodPageTvNav`, `useVodOverlayTvNav`, `useLoginTvNavigation`, `useSmartcardTvNavigation`, `usePlayerHudTvNavigation`, `PlayerHud` (×2), `usePlayerChannelZapping`, `ConfirmModal`, `EpgEventModal`, `VodDetailModal`, `ParentalPinGate`, `InactivityHost`.

---

## 3. Arquitectura objetivo

```
┌─────────────────────────────────────────────────────────────┐
│  window keydown (capture) — UN solo listener                │
│  NavigationRouter.dispatch(event)                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
     ┌─────────────────────┼─────────────────────┐
     ▼                     ▼                     ▼
 Priority 100          Priority 80           Priority 50
 ModalStack            PlayerZone            ShellZone
 (FocusManager)        (HUD+zapping)         (sidebar+main)
                           │
                           ▼
                    ZoneHandlers por ruta
                    (login, vod, catchup, …)
                           │
                           ▼
              focusElementSafe + scroll instant
              TvFocusRing.update(activeEl)
```

### Módulos nuevos (propuesta)

| Módulo | Ruta sugerida | Responsabilidad |
|--------|---------------|-----------------|
| `NavigationRouter` | `src/navigation/NavigationRouter.js` | Cola de handlers por prioridad; único `keydown` |
| `FocusManager` | `src/navigation/FocusManager.js` | Stack push/pop; restauración al cerrar modal |
| `NavigationLock` | `src/navigation/NavigationLockContext.jsx` | Reemplazo observable de `shouldDeferHomeShellNavigation` |
| `TvFocusRing` | `src/components/navigation/TvFocusRing.jsx` | Anillo de foco único en TV |
| `registerTvZone` | `src/navigation/registerTvZone.js` | API para montar/desmontar zona con ruta |
| Modelos LRUD | `src/navigation/models/*.js` | Grid lógico bouquet/VOD/catchup/search |
| Adaptadores zona | `src/navigation/zones/*.js` | Lógica por pantalla (migración desde hooks) |

### Prioridades del router (propuesta)

| Prioridad | Zona | Cuándo activa |
|-----------|------|----------------|
| 200 | `modal` | Cualquier modal con `NavigationLock` |
| 150 | `parentalPin` | `ParentalPinGate` visible |
| 100 | `player` | `isPlayerActive` |
| 80 | `epgReminder` | Recordatorio EPG sobre shell |
| 60 | `shell` | Rutas `/home/*` sin player |
| 40 | `auth` | `/login`, `/smartcard`, `/profile` |
| 10 | `global` | Long-press BACK salida app |

---

## 4. Fases de implementación

### Fase 0 — Quick wins CSS/DOM (1 semana)

**Sin reestructurar lógica.** Mejora inmediata del lag percibido.

| Tarea | Archivos | Hallazgo |
|-------|----------|----------|
| `scroll-behavior: auto` en `.device-tv` para contenedores scroll | `_bouquet.scss`, `_vod.scss`, `_catchup.scss`, `_home-shell.scss` | H-45 |
| `--home-sidebar-transition-duration: 0ms` en `.device-tv` | `_home-shell.scss` | H-54 |
| Quitar `transform: scale` de `.focused` en TV; borde 3px | `global.scss` | H-46 |
| Cachear filas muro en `useRef`; invalidar por `epgWallKey` + `ResizeObserver` | `useBouquetMuroTvNav.js`, `inicioBouquetTvGrid.js` | H-07 |
| Cachear lista sidebar; no `getComputedStyle` en keydown | `Sidebar.jsx` | H-06 |
| Quitar `useState(focused)` en `ChannelCard` | `BouquetLayouts.jsx` | H-47 |

**Entregable:** Inicio y sidebar notablemente más rápidos sin cambiar arquitectura.

---

### Fase 1 — Infraestructura central (2 semanas)

| Tarea | Detalle |
|-------|---------|
| 1.1 `NavigationRouter` | Singleton + `register({ id, priority, handleKey, isActive })` |
| 1.2 `FocusManager` | `push(focusId \| element)`, `pop()`, `peek()` |
| 1.3 `NavigationLockContext` | Estado React: `{ locks: Set<string> }`; reemplaza `shouldDeferHomeShellNavigation` gradualmente |
| 1.4 `TvFocusRing` | Montado en `App.jsx`; escucha `focusin` en capture |
| 1.5 `scrollElementIntoVisibleScrollAncestors` | Opción `{ instant: true }` default si `device-tv` |
| 1.6 Migrar **un** consumidor piloto | `ConfirmModal` → registra zona `modal` en router; elimina su `keydown` |

**Entregable:** Router funcionando; un modal usa el nuevo sistema; resto sin regresión.

---

### Fase 2 — Home shell unificado (2 semanas)

| Tarea | Área |
|-------|------|
| 2.1 Migrar `HomeInputDispatcher` + `Sidebar` | Zona `shell` sub-router interno sidebar vs main |
| 2.2 Migrar `useBouquetMuroTvNav` | Zona `shell.inicio` / `shell.serviciosTvRadio` |
| 2.3 Migrar `useVodPageTvNav` + `useVodOverlayTvNav` | Zona `shell.vod` + overlay rail |
| 2.4 Foco inicial Inicio | Reaccionar a `epg.status === 'ready'` (H-15); eliminar rAF polling |
| 2.5 `homeShellLastContentFocus` | Integrar con `FocusManager` |
| 2.6 Ads top/bottom | Mantener puentes; documentar en modelo nav |

**Entregable:** Home completo (inicio, VOD, servicios TV) sin listeners globales propios.

---

### Fase 3 — Pantallas sin cobertura (2 semanas)

Cada pantalla: hook → adaptador de zona + modelo LRUD + foco inicial + puente sidebar.

#### 3.1 Buscador (`SearchPage`)

**Estado:** input + tabs + lista resultados sin LRUD.

**Modelo propuesto:**
```
[ input ]
[ tab_live | tab_vod | tab_catchup | tab_epg ]
[ result_0 … result_N ]
```

**Navegación:**
- UP/DOWN entre filas (tabs → input → resultados).
- LEFT/RIGHT en tabs.
- ENTER en resultado → acción actual (`onSelect`).
- LEFT desde primer resultado → sidebar (vía shell).

**Reestructuración a debatir (ver §6):** ¿`FocusableInput` virtual o input siempre `readOnly` hasta ENTER?

#### 3.2 Catchup (`CatchupPage`)

**Estado:** rails con `EmblaHorizontalRail` / nativo; sin zona shell.

**Modelo:** filas = grupos catchup; columnas = cards + see-more.

**Tareas:**
- `useCatchupTvNav` → `zones/catchupZone.js`
- Puentes UP/DOWN entre rails; LEFT borde → sidebar.
- Modal `CatchupGroupModal` → lock modal en router.

#### 3.3 EPG cards (`EpgCardsPage`)

**Estado crítico:** `tabIndex={-1}` en TV → **no navegable**.

**Opciones:**
- A) Implementar `epgCardsZone` con grid 4 slots por canal (before/now/next/later).
- B) Quitar `tabIndex={-1}` y usar tab order nativo solo en EPG (más simple, menos control).

**Recomendación:** A — consistente con resto de app.

#### 3.4 Control parental (`ParentalSettingsPage`)

**Zonas:** toggle enable → grid canales → flujo PIN (`ParentalPinGate`) → modales confirm.

**Tareas:**
- Grid LCN ordenado: LRUD por filas derivadas de datos (no DOM).
- Integrar PIN gate como prioridad 150 en router.

#### 3.5 OSMS (`OsmsPage`)

**Layout master-detail:** lista mensajes | detalle.

**Navegación:**
- UP/DOWN en lista; ENTER selecciona; RIGHT opcional → panel detalle (o mismo foco en detalle tras ENTER).
- Botones refresh/markSeen en header como fila superior.

#### 3.6 Perfiles (`ProfilePage`)

**Post-login:** perfiles + smartcards.

**Tareas:**
- LRUD entre cards; ENTER selecciona; alinear con flujo existente PC/TV.

**Entregable:** Matriz H-49 cerrada — todas las rutas `/home/*` + auth con LRUD.

---

### Fase 4 — Player y modales (1.5 semanas)

| Tarea | Detalle |
|-------|---------|
| 4.1 Consolidar `PlayerHud.jsx` + `usePlayerHudTvNavigation` + zapping | Un solo `playerZone` prioridad 100 |
| 4.2 Zonas HUD desde `resolvePlayerHudLayout` | H-17 |
| 4.3 Migrar modales | `EpgEventModal`, `VodDetailModal`, `VodCategoryModal`, `CreateProfileModal`, `DeleteProfileModal`, `CatchupGroupModal` |
| 4.4 `EpgReminderHost` | Prioridad 80 |
| 4.5 `InactivityHost` | Solo si overlay visible; no compite con shell |

**Entregable:** 0 `addEventListener('keydown')` fuera de `NavigationRouter`.

---

### Fase 5 — Rendimiento avanzado (2 semanas, opcional paralelo)

| Tarea | Hallazgo |
|-------|----------|
| 5.1 `bouquetNavModel` / `vodNavModel` desde datos preload | H-50 |
| 5.2 Virtualización rail VOD Inicio + catchup | H-48 |
| 5.3 Virtualización grid vertical bouquet (si > 48 canales visibles) | H-48 |
| 5.4 Benchmark `?tvNavPerf=1` + checklist CI manual | H-52 |
| 5.5 Eliminar hooks legacy (`useLoginTvNavigation` → `loginZone`) | Limpieza |

---

## 5. Cronograma sugerido

```
Semana 1      │ Fase 0 — Quick wins CSS + cache DOM
Semana 2–3    │ Fase 1 — NavigationRouter + FocusManager + TvFocusRing
Semana 4–5    │ Fase 2 — Home shell (inicio, VOD, sidebar)
Semana 6–7    │ Fase 3 — Search, Catchup, EPG, Parental, OSMS, Profile
Semana 8      │ Fase 4 — Player + modales
Semana 9–10   │ Fase 5 — Grid datos + virtualización + benchmarks
```

Depende de Etapas 1–3 del plan consolidado (app debe arrancar y no congelar UI durante preload).

---

## 6. Decisiones acordadas (2026-06-09)

### 6.1 Router propio vs librería — **Router propio**

**Decisión:** Implementar `NavigationRouter` + zonas propias. Norigin u otra librería solo como **plan B** si tras Fase 2–3 no se cumple latencia &lt; 100 ms en hardware 2019.

**Criterio de escape a librería:** benchmark D-pad en muro Inicio + VOD con 20 pulsaciones; si p95 &gt; 100 ms tras Fase 3, evaluar `@noriginmedia/react-spatial-navigation` en piloto acotado.

**Por qué el propio alcanza estándar de mercado** (si se implementa bien):
- Un listener vs 15+ elimina la mayor parte del overhead actual.
- Grid lógico en datos (Fase 5) evita el cuello de `getBoundingClientRect`.
- Anillo único + scroll instantáneo cubren la capa visual que hoy suma ~500 ms percibidos.

---

### 6.2 Anillo de foco — **Sí, color desde marca**

**Decisión:** `TvFocusRing` único en TV; **sin `scale` en cards**.

**Color (cadena de prioridad en `applyTheme`):**
1. `ui.focus.color` — override explícito por marca (ya existe en `config.js`).
2. `ui.secondaryColor` — **default del anillo** si no hay `focus.color`.
3. `ui.primaryColor` — fallback final.

Implementación: en `src/utils/config.js`, cambiar el default de `--focus-color` de `primaryColor` a `focusCfg.color || ui.secondaryColor || ui.primaryColor`, y derivar `--focus-color-rgb` del color elegido. El anillo CSS usa `var(--focus-color)` (sin cambios en cada marca de `brands.js` salvo casos especiales).

**Nota:** `secondaryColor` ya se expone como `--secondary-color` para hovers/fondos; reutilizarlo para foco mantiene coherencia visual de marca sin duplicar config.

---

### 6.3 EPG en TV — **Se mantiene; arreglar (ver §6.3.1)**

**Decisión:** `/home/epg` sigue en producto TV.

#### 6.3.1 Problemas detectados a corregir

| # | Problema | Impacto | Acción en plan |
|---|----------|---------|----------------|
| E1 | `tabIndex={isTV ? -1 : 0}` en slots (`EpgCards.jsx`) | **Foco muerto** en TV | `tabIndex={0}` o foco vía zona sin -1 |
| E2 | Sin `epgCardsZone` en router | Flechas no mueven foco | Fase 3: `zones/epgCardsZone.js` |
| E3 | `data-home-spatial-delegate="true"` en página | Bloquea ← al sidebar sin lógica propia | Zona EPG define borde izquierdo → sidebar |
| E4 | Una fila DOM por canal × 3–4 cards | Lag con muchos canales | `VirtualVerticalList` mínimo (Fase 5) |
| E5 | `setInterval` 1 s × página entera para `nowMs` | Re-render de todas las filas | Timer único + actualizar solo filas visibles |
| E6 | Modal detalle (`EpgEventModal`) con `keydown` propio | Conflicto H-13 | Registrar en `modal` zone |

**Modelo LRUD EPG:** filas = canales (LCN); columnas = before / now / next / later (según `epgPast`). UP/DOWN cambia canal; LEFT/RIGHT cambia slot; ENTER abre detalle o reproduce si live.

---

### 6.4 Buscador en TV — **Aclaración de la pregunta original**

La pregunta no era “¿eliminar el buscador?”, sino **cómo debe comportarse el campo de texto con el control remoto**:

| Enfoque | Comportamiento | Cuándo tiene sentido |
|---------|----------------|----------------------|
| **A — Tipeo con IME** (actual `FocusableInput`) | Foco en input → ENTER abre teclado pantalla del TV → usuario escribe → resultados se actualizan | Usuarios que buscan por nombre libre |
| **B — Input navegable sin editar hasta ENTER** | Flechas mueven foco entre input / tabs / resultados; solo al pulsar ENTER en el input se abre el teclado | Menos interrupciones al navegar |
| **C — Sin tipeo en primera línea** | Buscador arranca en tabs o categorías; el tipeo es pantalla secundaria | Apps muy simples (no es el caso de appVideo) |

**Decisión confirmada:** **Opción B** — LRUD `input → tabs → resultados`; IME al pulsar ENTER en el input (`FocusableInput`). Implementado en `useSearchPageTvNav.js` + `SearchPage.jsx` (previo al `NavigationRouter`).

---

### 6.5 Virtualización — **Rail propio mínimo**

**Decisión:** `VirtualHorizontalRail` / `VirtualVerticalList` propios (~80–120 líneas c/u), sin `@tanstack/react-virtual`.

**Alcance inicial:** rails catchup, VOD recomendado Inicio, lista EPG vertical.

---

### 6.6 PreloadGate + layout `/home/*` — **Aprobado**

Refactor `App.jsx`: layout padre con `<PreloadGate><Outlet /></PreloadGate>` para rutas hermanas. Ejecutar en **Fase 2** junto con shell.

---

### 6.7 Login / Smartcard → `authZone` — **Aprobado**

Migrar `useLoginTvNavigation` y `useSmartcardTvNavigation` a zonas registradas solo en rutas `/login`, `/smartcard`, `/profile`. Ejecutar en **Fase 1–2**.

---

## 7. Checklist de prueba por área

Usar en Tizen 5 emulator + 1 TV física antes de cerrar cada fase.

| Área | Pruebas |
|------|---------|
| Login | USER → PASS → toggle → botones; BACK cierra modales QR/UDID; long-press BACK sale |
| Smartcard | Lista ↕; modales confirm; BACK logout |
| Profile | Perfiles ↕; ENTER selecciona |
| Sidebar | ↕ ítems; settings → submenú; → main; ← vuelve |
| Inicio | Muro ↕↔; puente ads; rail VOD; ← sidebar |
| VOD | Categorías ↕↔; modal detalle; BACK restaura foco |
| EPG | Slots por canal ↕↔; ENTER abre modal |
| Catchup | Rails ↕↔; see-more modal |
| Buscador | Input/tabs/resultados; ← sidebar |
| Parental | Toggle; grid; cambio PIN |
| OSMS | Lista; detalle; acciones header |
| Player | HUD zonas; overlays canales/tracks; zapping; BACK |
| Modales | Foco atrapado; BACK cierra; foco restaurado |

---

## 8. Métricas y seguimiento

| Métrica | Objetivo | Cómo medir |
|---------|----------|------------|
| Listeners `keydown` globales | 1 | `rg "addEventListener\('keydown'" src` |
| Tiempo handler router | &lt; 8 ms p95 | `performance.now()` con `?tvNavPerf=1` |
| Tiempo scroll+foco | &lt; 16 ms p95 | Misma herramienta |
| Pantallas sin zona TV | 0 | Matriz §2 actualizada |
| Regresiones foco modal | 0 | Test manual checklist §7 |

---

## 9. Riesgos y mitigación

| Riesgo | Mitigación |
|--------|------------|
| Regresión masiva al migrar hooks | Fase 1 piloto con `ConfirmModal`; feature flag `VITE_TV_NAV_ROUTER=1` |
| Grid lógico desincronizado con layout marca | Tests snapshot por `hudLayout` / `bouquetLayout` |
| Virtualización rompe foco | Buffer de 2 ítems; foco por `data-nav-id` estable |
| Equipo sin hardware TV | Emuladores + dispositivo mínimo en CI manual semanal |

---

## 10. Resumen ejecutivo para stakeholders

1. **El lag de ~1 s no se debe a librerías pesadas** sino a arquitectura fragmentada + CSS + DOM en cada tecla.
2. **Las auditorías H-13–H-17 ya apuntaban bien**; se amplían con H-45–H-54 (visual, render, pantallas faltantes).
3. **Fase 0** puede ejecutarse ya y dar mejoras visibles en 1 semana.
4. **Fases 1–4** unifican input y cubren todas las áreas listadas.
5. **Fase 5** acerca el rendimiento al estándar OTT (grid en datos + virtualización).
6. **Sección §6** lista decisiones de producto/diseño que requieren acuerdo antes de implementar.

---

## 11. Orden de implementación (menos crítico → más crítico)

Ejecutar en este orden para minimizar riesgo y obtener mejoras tempranas:

| Orden | Ítem | Riesgo | Impacto | Estado |
|-------|------|--------|---------|--------|
| **1** | CSS TV: `scroll-behavior: auto`, sidebar 0 ms, sin `scale` en foco | Muy bajo | Medio | ✅ `_tv-nav-performance.scss` |
| **2** | Quitar `setState` foco en `ChannelCard` | Bajo | Medio | ✅ |
| **3** | **Buscador Opción B** (`useSearchPageTvNav`) | Bajo | Medio (área aislada) | ✅ |
| **4** | `secondaryColor` → `--focus-color` default en `applyTheme` | Bajo | Bajo (visual) | ✅ `config.js` |
| **5** | Cache sidebar (`H-06`) y filas muro (`H-07`) | Bajo | Alto | ✅ `Sidebar.jsx`, `inicioBouquetTvGrid.js`, `useBouquetMuroTvNav.js` |
| **6** | `TvFocusRing` (anillo único) | Medio | Alto visual | ✅ `TvFocusRing.jsx`, `_tv-focus-ring.scss` |
| **7** | Refactor `PreloadGate` + layout `/home/*` (`H-43`) | Medio | Medio | ✅ `HomeEpgRoutesLayout.jsx`, `App.jsx` |
| **8** | `FocusManager` + `NavigationLockContext` | Medio | Alto | Pendiente |
| **9** | `NavigationRouter` (piloto `ConfirmModal`) | Medio | Crítico (base) | Pendiente |
| **10** | EPG TV: `tabIndex`, `epgCardsZone` (página rota) | Medio | Alto | Pendiente |
| **11** | Catchup, OSMS, Parental, Profile zones | Medio | Alto | Pendiente |
| **12** | `authZone` (login / smartcard) | Medio-Alto | Alto | Pendiente |
| **13** | Migrar shell: `HomeInputDispatcher`, Sidebar, muro, VOD | Alto | Crítico | Pendiente |
| **14** | Player HUD + modales al router | Alto | Crítico | Pendiente |
| **15** | Grid lógico en datos (`H-50`) | Alto | Crítico perf | Pendiente |
| **16** | `VirtualHorizontalRail` / lista EPG | Alto | Crítico perf | Pendiente |

**Criterio de “más crítico”:** impacto en todas las pantallas + riesgo de regresión + dependencia del resto (el router central es el último paso arquitectónico grande, no el primero).

---

## 12. Próximos pasos recomendados

1. Validar en TV/emulador: pasos **1–7**.
2. Siguiente: **8** (`FocusManager` + `NavigationLockContext`).
3. Antes del paso **9**, cerrar decisiones pendientes de §6.1–6.3, 6.5–6.7 si se retoman.
4. No saltar al paso **13** sin **8–9** (infraestructura).

---

*Documento vivo — actualizar matriz §2 al cerrar cada fase.*
