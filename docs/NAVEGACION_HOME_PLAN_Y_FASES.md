# Plan de navegación en Home (Smart TV / PC) — Fases y estado

**Última actualización:** 2026-05-13  
**Relación con otros documentos:** complementa y concreta `docs/ANALISIS_PROYECTO_Y_ESTRATEGIA_NAVEGACION_TV.md` (estrategia global) con un **desglose operativo por superficies del módulo `/home`**.

---

## Resumen ejecutivo

| Fase | Nombre | Estado |
|------|--------|--------|
| 0 | Inventario y criterios (zonas, prioridad de input, BACK/LRUD, checklist) | **Hecha** (este documento, sección [Fase 0](#fase-0--inventario-y-criterios-completada)) |
| 1 | Capa de entrada unificada en Home (dispatcher de teclas + scopes) | **En progreso** — [entrega 1](#fase-1--primera-entrega-mayo-2026) + [entrega 2](#fase-1--segunda-entrega-mayo-2026) |
| 2 | Sidebar TV-first (LRUD, submenú, salto a contenido) | **Parcial** — cruce RIGHT/LEFT global; falta UP/DOWN interno y submenú |
| 3 | Chrome común (`HomeShellContent`: header + ads + outlet) | Pendiente |
| 4 | Inicio (`BouquetPage` / `BouquetWall` / carriles) | Pendiente |
| 5 | Resto de rutas `/home/*` (por módulo) | Pendiente |
| 6 | Player global + transición shell ↔ player | Pendiente |
| 7 | Hardening transversal (recovery, soak, regresiones) | Pendiente |

---

## Fase 0 — Inventario y criterios (completada)

### Objetivo de la fase

Fijar **lenguaje común** y **reglas de prioridad** antes de tocar código de navegación en Home: qué zonas existen, quién consume las teclas primero, y cómo se espera que se comporte BACK y el pad LRUD en TV. Sin nueva UI.

### 0.1 Zonas (scopes) dentro y alrededor de `/home`

Definición práctica para el dispatcher futuro (Fase 1). Orden conceptual de “capas” de arriba a abajo:

| Zona | Descripción | Ubicación en código / DOM |
|------|-------------|---------------------------|
| **A — Modales globales** | Diálogos bloqueantes (portal en `document.body`) | `ConfirmModal` usado en `HomePage` (licencia en uso), `Sidebar` (acerca de, logout, salir). `ConfirmModal.jsx`: `createPortal(..., document.body)`. |
| **B — Hosts / overlays no modales** | Gates y recordatorios que pueden competir con foco | `ParentalGateHost`, `EpgReminderHost`, `InactivityHost` en `HomePage.jsx`. Requieren inventario por archivo al implementar Fase 1. |
| **C — Player** | Reproducción a pantalla completa / HUD | `home-global-player` + `containerRef` + `PlayerHud` en `HomePage.jsx`. Con player activo, `home-shell-ui` pasa a `--hidden` (opacity/visibility/pointer-events). |
| **D — Shell UI** | Barra lateral + contenido principal cuando no hay player | `home-shell-ui`: `Sidebar` + `main.home-content` con `HomeShellContent` (`Outlet`). |
| **D1 — Sidebar** | Navegación lateral, settings, submenú | `Sidebar.jsx`: `aside.home-sidebar`, `nav.home-sidebar-nav`, submenú settings. |
| **D2 — Chrome del contenido** | Cabecera y publicidad opcional | `HomeShellContent.jsx`: `InicioHeader`, `AdZone` (top/bottom), wrapper `home-content-outlet`. |
| **D3 — Outlet (página activa)** | Cada ruta hija: Inicio, Buscador, VOD, EPG, etc. | Rutas en `App.jsx` bajo `/home/...`; páginas como `BouquetPage.jsx`, `VodPage.jsx`, etc. |

**Nota:** Los modales del sidebar están **fuera** del `aside` en el DOM (portal), pero `Sidebar` usa `blockCollapseForOverlayRef` para no colapsar el rail cuando hay modal abierto — conviene que el dispatcher de Fase 1 respete la misma idea (overlay = no “perder” estado del sidebar por blur).

### 0.2 Rutas hijas de `/home` (inventario)

Definidas en `src/App.jsx` (orden lógico de menú puede variar en `Sidebar.jsx`):

| Ruta | Página | PreloadGate |
|------|--------|-------------|
| `/home` | Redirige a `/home/inicio` | `HomePage.jsx` (`Navigate`) |
| `/home/inicio` | `BouquetPage` | `epg` |
| `/home/buscador` | `SearchPage` | `epg` |
| `/home/servicios-tv-radio` | `TvRadioServicesPage` | `epg` |
| `/home/vod` | `VodPage` | — |
| `/home/epg` | `EpgCardsPage` | `epg` |
| `/home/catchup` | `CatchupPage` | — |
| `/home/control-parental` | `ParentalSettingsPage` | `epg` |
| `/home/osms` | `OsmsPage` | — |
| `/home/*` (otro) | Redirige a `/home/inicio` | — |

**Implicación para foco:** al pasar por `PreloadGate`, la vista puede cambiar a `/preload` temporalmente; al volver, el **restore de foco** debe considerar `redirect` (Fase 7 / criterios de regresión).

### 0.3 Prioridad de input (regla única propuesta)

Cuando coincidan varias zonas “activas”, el orden de consumo recomendado para **keydown** (TV y teclado tipo mando) es:

1. **Modales globales** (A): si un `ConfirmModal` u otro diálogo `aria-modal` está abierto, consume BACK/Escape y, en implementación futura, **no** deja que LRUD navegue por el contenido de fondo.
2. **Hosts que definan trap explícito** (B): si un host implementa captura de foco/teclas (ej. gate parental), por encima del shell salvo que el producto diga lo contrario.
3. **Player activo** (C): si hay URL de reproducción y el shell está oculto, LRUD/BACK orientados al HUD / política de cierre (coordinar con `PlayerHud.jsx`, que ya registra listeners con `capture: true` para BACK en TV).
4. **Shell UI** (D): sidebar + chrome + outlet; dentro de D, la **política horizontal** típica en TV es: **Sidebar ↔ Contenido** con LEFT/RIGHT en los bordes (a definir en Fase 2–3).

**Estado hoy:** no existe un único dispatcher en Home; coexisten listeners por componente (`ConfirmModal` solo `Escape` → `onCancel`, `PlayerHud` con códigos TV, etc.). La Fase 1 debe **documentar y luego centralizar** para evitar orden no determinístico.

### 0.4 Matriz corta BACK / Return / Escape

| Contexto | Comportamiento esperado (criterio de producto para implementación) | Observación código actual |
|----------|-------------------------------------------------------------------|----------------------------|
| Modal `ConfirmModal` abierto | BACK o Escape cierra / cancela según `onCancel` | `Escape` llama `onCancel`; BACK de TV **no está explícito** en `ConfirmModal` — alinear con `getTvActionFromKeyEvent` / mismos keyCodes que `PlayerHud` en Fase 1. |
| Player + HUD visible | BACK: cerrar HUD o salir de reproducción (según UX ya definida en player) | `PlayerHud.jsx` maneja varios códigos de BACK con `capture: true`. |
| Shell: submenú settings abierto | BACK: cerrar submenú primero | Hoy es estado local `settingsOpen`; no hay listener global documentado. |
| Shell: foco en contenido | BACK: según política (¿`navigate(-1)` vs inicio?) | Pendiente decisión explícita en Fase 1–2. |
| Sin overlays | BACK largo / salida app | Ya contemplado en otros flujos (ej. Login TV); Home puede reutilizar política o delegar al SO. |

### 0.5 LRUD (criterios iniciales, sin implementación)

| Movimiento | Criterio propuesto |
|------------|-------------------|
| **UP/DOWN** | Orden **determinístico** dentro de cada zona (lista de enlaces del sidebar; grilla en outlet). Evitar depender solo del orden DOM si el CSS cambia. |
| **LEFT** | Desde la primera columna del **contenido**, opcionalmente saltar al **sidebar** (TV). |
| **RIGHT** | Desde el **sidebar** (ítem activo), saltar al primer foco del **chrome o outlet** según exista header/ads. |
| **ENTER** | Activar control enfocado; coherente con `FocusableButton` / convenciones existentes. |

**Estado hoy:** el sidebar usa foco nativo + `NavLink`; no hay mapa LRUD explícito entre sidebar y `main`.

### 0.6 Foco visible (PC + TV)

- `src/main.jsx`: en `focusin`/`focusout` aplica clase `.focused` y `data-focusable="true"` si `html[data-focus] !== 'off'`.
- `src/utils/config.js` (tema por marca): `data-focus` on/off y variables `--focus-color`, etc.

**Criterio Fase 0:** cualquier implementación nueva de foco en Home debe **reutilizar** `.focused` / `data-focus` para no duplicar estilos.

### 0.7 Archivos de referencia (inventario rápido)

| Archivo | Rol |
|---------|-----|
| `src/App.jsx` | Rutas `/home/*` y `PreloadGate` |
| `src/pages/HomePage.jsx` | Shell, player, modales globales, hosts |
| `src/components/Sidebar.jsx` | Navegación lateral, settings, modales |
| `src/components/ads/HomeShellContent.jsx` | Header, ads, `Outlet` |
| `src/components/ConfirmModal.jsx` | Portal modal; tecla Escape |
| `src/components/player/PlayerHud.jsx` | BACK capture, foco HUD |
| `src/styles/pages/_home-shell.scss` | Layout grid, sidebar colapsado, ocultación shell con player |
| `docs/ANALISIS_PROYECTO_Y_ESTRATEGIA_NAVEGACION_TV.md` | Estrategia LRUD lógica, etapas 1–3 |

### 0.8 Checklist de prueba manual (para repetir al cerrar cada fase)

**Fase 0 (baseline / registro de bugs actuales):**

- [ ] Entrar a `/home/inicio` en **TV**: recorrer sidebar con direccionales; abrir **Configuración**; ejecutar **Acerca de** y cerrar con Escape y con botón.
- [ ] Con modal abierto, verificar que **no** se navegue accidentalmente por cards del Inicio detrás.
- [ ] Iniciar reproducción desde Inicio: verificar que el foco **no quede** en elemento oculto con `aria-hidden` (ya hay mitigación parcial en `HomePage` hacia el player).
- [ ] Cerrar player y comprobar dónde queda el foco (registrar comportamiento actual como “antes/después”).
- [ ] Cambiar de ruta `/home/inicio` → `/home/epg` → volver: anotar si el foco vuelve a un sitio usable sin clic.

**Meta numérica sugerida (a partir de Fase 1):** ≥ 20 acciones LRUD sin `document.activeElement === document.body` salvo recovery explícito.

### 0.9 Riesgos detectados en inventario (para abordar en fases siguientes)

1. **Varios `window.addEventListener('keydown', …, { capture: true })`** en distintos componentes → orden de registro puede hacer el comportamiento **no obvio**; Fase 1 debe unificar o documentar orden.
2. **`ConfirmModal`:** ~~solo `Escape` hacia `onCancel`~~ **Actualizado (Fase 1):** BACK TV + Escape; modal de un solo botón cierra con ambos.
3. **Sidebar + portal:** foco sale del `aside`; el código ya mitiga colapso con `blockCollapseForOverlayRef` — el dispatcher debe tratar modales del sidebar como zona **A** aunque el “dueño” sea Sidebar.
4. **Rutas condicionales** (VOD/Catchup/OSMS visibles según datos): el orden de ítems enfocables **cambia** → necesidad de **fallback** de foco al mutar lista (Fases 2 y 4).

---

## Fase 1 — Capa de entrada unificada en Home

### Primera entrega (mayo 2026) — hecha

Objetivo: cerrar huecos **BACK en TV** y un **dispatcher mínimo** con registro temprano.

**Implementado:** `HomeInputDispatcher` (cierre recordatorio EPG con player), `homeShellOverlays.js`, `ConfirmModal` (BACK + Escape unificado), `ParentalPinGate` (códigos BACK TV). Detalle en revisiones anteriores del repo.

### Segunda entrega (mayo 2026) — hecha

**Política BACK (shell, sin player, sin overlays bloqueantes):**

- Rutas bajo `/home/*` **distintas de** `/home/inicio`: **BACK** → `navigate(-1)` (historial SPA), con `preventDefault` / `stopPropagation`, sin repetición de tecla (`e.repeat`).
- En **`/home/inicio`**: **no** se consume BACK (el WebView / SO puede manejar salida o historial real).

**Orden BACK vs recordatorio EPG + player:** el cierre asistido del modal EPG (recordatorio) se evalúa **antes** de cortar por `isPlayerActive`, para que BACK cierre el recordatorio también con reproducción activa.

**Cruce TV sidebar ↔ contenido:**

- Atributos de scope: `aside.home-sidebar[data-home-scope="sidebar"]`, `main.home-content[data-home-scope="content"]` (`Sidebar.jsx`, `HomePage.jsx`).
- **RIGHT** con foco dentro del sidebar → primer elemento enfocable visible dentro de `main` (orden DOM: header/ads/outlet según ruta).
- **LEFT** con foco en el **primer** elemento enfocable visible del `main` → vuelve al `NavLink` activo del menú o, si no hay match, al botón de Configuración.
- Solo **`isTV`**; no aplica con player activo ni cuando `shouldDeferHomeShellNavigation()` detecta portales (VOD, perfiles, EPG modal, inactividad, etc.).
- **`data-home-spatial-delegate="true"`** (solo afecta **LEFT** hacia el sidebar): grillas o paneles con navegación horizontal propia; en **LEFT**, si el foco está dentro de ese contenedor, no se fuerza el salto al menú. Ej.: `EpgCardsPage` (`epg-page-content`). **RIGHT** desde el sidebar sigue entrando al contenido.

**Archivos nuevos / tocados:** `src/utils/homeShellNavigation.js` (`getVisibleFocusablesInContainer`, `focusElementSafe`); ampliación de `homeShellOverlays.js` (`shouldDeferHomeShellNavigation`, selectores VOD/perfil/mensajes); `HomeInputDispatcher.jsx`; `EpgCardsPage.jsx`.

**Pendiente (Fase 1.x / 2):** refinamiento del “primer foco” del main (p. ej. saltar anuncios); restore de foco al cambiar de ruta; carril VOD en Inicio con LRUD propio.

---

### Entrega Fase 2 + Inicio (mayo 2026) — hecha (navegación TV básica)

- **Sidebar (`Sidebar.jsx`):** en TV, **UP/DOWN** entre `NavLink`, botón de Configuración y subenlaces si el submenú está abierto (`window` `capture`, tras `HomeInputDispatcher`). **No** se colapsa el rail al cambiar de ruta ni al elegir enlace en TV (`collapseAfterNav`).
- **Inicio (`BouquetPage` + hook):** `useInicioBouquetTvNav.js` — LRUD entre filas de `.channel-card` del `.bouquet-wall`; **foco inicial TV** en la **primera** tarjeta del muro (no en el sidebar); **scroll automático** al foco vía `scrollElementIntoVisibleScrollAncestors` (`homeShellNavigation.js`) + `focusin` en `.bouquet-inicio-scroll`; en TV **`scroll-behavior: auto`** en contenedores de scroll del módulo bouquet (`_bouquet.scss`). `ChannelCard` con **`tabIndex={0}`**.
- **Archivos:** `src/hooks/useInicioBouquetTvNav.js`; `Sidebar.jsx`; `BouquetPage.jsx`; `BouquetLayouts.jsx` (`ChannelCard`); `homeShellNavigation.js`; `_bouquet.scss`.

**Pendiente:** LRUD en `VodRecommendedHomeRail`; “primer foco” del main ignorando ads si aplica; refinamiento grid vertical multi-columna.

---

### Texto original de alcance (Fase 1 completa visionada)

**Qué se hará (visión completa):** controlador de teclado bajo el árbol de `HomePage`, con matriz de prioridad de la sección 0.3; normalizar teclas con `src/utils/tvRemote.js` donde aplique; traps y restore de foco por scope.

**Pruebas (visión completa):** modales y hosts; sidebar ↔ contenido (parcialmente cubierto en entrega 2).

---

## Fase 2 — Sidebar TV-first

**Qué se hará (restante):** IDs estables en todos los ítems condicionales; traps de foco más estrictos si hace falta.

**Hecho:** cruce **RIGHT** sidebar → main y **LEFT** desde el primer foco visible del `main` hacia el `NavLink` activo (`HomeInputDispatcher`). **UP/DOWN** en sidebar + submenú Configuración; en TV **no** se fuerza colapso del rail al cambiar ruta ni al pulsar enlaces del menú. **Foco inicial en Inicio (TV):** primera tarjeta de canal del muro; scroll al foco en carruseles y scroll vertical.

**Pruebas:** 30 ciclos sidebar + submenú + modales; en TV verificar RIGHT/LEFT entre rail y contenido en Inicio y EPG.

---

## Fase 3 — Chrome común (`HomeShellContent`)

**Qué se hará:** orden explícito Header → Ads (si hay) → Outlet para UP/DOWN; alinear `AdZone` con el mismo contrato de foco que el resto.

**Pruebas:** rutas con `sectionKey` (inicio, serviciosTvRadio, vod, catchup) con ads/header ON/OFF según marca de prueba.

---

## Fase 4 — Inicio (`BouquetPage` / `BouquetWall` / carriles)

**Qué se hará (restante):** LRUD en carril VOD recomendado; IDs estables por canal/bouquet; refinamiento de columnas en grid vertical; integración con `InicioHeader` / `setFocusedChannel`; revisar re-renders que invaliden foco.

**Hecho (parcial):** hook `useInicioBouquetTvNav` para LRUD en el muro de bouquets (`.bouquet-wall`); tarjetas de canal enfocables (`tabIndex` 0); ajuste de scroll a ancestros con overflow; `scroll-behavior: auto` en TV para esos contenedores.

**Pruebas:** cambiar bouquet y navegar 50 movimientos sin perder foco; abrir player y volver.

---

## Fase 5 — Resto de `/home/*` (por módulo)

**Qué se hará:** aplicar el mismo contrato por página: `SearchPage`, `VodPage`, `EpgCardsPage`, `CatchupPage`, `TvRadioServicesPage`, `OsmsPage`, `ParentalSettingsPage`.

**Pruebas:** por cada módulo: entrar/salir 10 veces, overlay típico, BACK.

---

## Fase 6 — Player global + transición shell ↔ player

**Qué se hará:** política única de foco al activar/desactivar player; alinear `useLayoutEffect` de `HomePage` con el dispatcher; coordinar con `PlayerHud` para no duplicar BACK.

**Pruebas:** play desde Inicio → BACK/HUD → foco restaurado según regla acordada.

---

## Fase 7 — Hardening transversal

**Qué se hará:** recovery si foco cae en `body`; soak 20 ciclos Inicio ↔ EPG ↔ VOD; regresión tras `PreloadGate` y redirects.

**Pruebas:** checklist extendido + prueba en hardware Tizen/webOS objetivo.

---

## Changelog del documento

| Fecha | Cambio |
|-------|--------|
| 2026-05-13 | Creación del documento. **Fase 0** completada: zonas, rutas, prioridad de input, matriz BACK, criterios LRUD, archivos de referencia, checklist y riesgos. |
| 2026-05-13 | **Fase 1 — primera entrega:** `HomeInputDispatcher` + `homeShellOverlays.js`; `ConfirmModal` (BACK TV + Escape en modales de un botón); `ParentalPinGate` (códigos BACK TV). |
| 2026-05-13 | **Inicio TV:** foco inicial en primera `.channel-card`; scroll al foco (`scrollElementIntoVisibleScrollAncestors`, `focusin`); TV `scroll-behavior: auto` en `_bouquet.scss`. Eliminado foco inicial sidebar en `/home/inicio`. |
| 2026-05-13 | **Fase 2 + Inicio (parcial):** sidebar TV UP/DOWN + sin colapso forzado en TV; `useInicioBouquetTvNav` + `ChannelCard` `tabIndex` 0. |
