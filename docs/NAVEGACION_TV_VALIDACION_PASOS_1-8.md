# Validación navegación TV — Pasos 1 a 8

**Proyecto:** appVideo  
**Fecha:** 2026-06-09  
**Relacionado:** `PLAN_NAVEGACION_TV.md` §11 (orden de implementación)  
**Commits de referencia:**
- `2550a76` — pasos 1–7 (CSS, cache, buscador, anillo, layout home)
- `3629007` — refinamiento foco login + `TvFocusRing` (extiende paso 6)

**Uso de este documento:** revisar cada paso en TV/emulador y anotar errores en la tabla **«Errores encontrados»** de cada sección. Luego pasar ese listado al agente para corregir **un error a la vez**.

---

## Resumen rápido

| Paso | Tema | Estado implementación | Áreas afectadas |
|------|------|----------------------|-----------------|
| **1** | CSS rendimiento TV (scroll, sidebar, sin `scale`) | ✅ Hecho | Global TV |
| **2** | Sin `setState` de foco en `ChannelCard` | ✅ Hecho | Muro / bouquet |
| **3** | Buscador — Opción B (LRUD + IME en ENTER) | ✅ Hecho | `/home/buscador` |
| **4** | Color anillo desde `secondaryColor` | ✅ Hecho | Todas (tema marca) |
| **5** | Cache sidebar + filas muro | ✅ Hecho | Sidebar, `/home/inicio` |
| **6** | `TvFocusRing` (anillo único) | ✅ Hecho (+ login refinado) | Global TV |
| **7** | `PreloadGate` + layout `/home/*` | ✅ Hecho | Rutas home con EPG |
| **8** | `FocusManager` + `NavigationLockContext` | ❌ **No implementado** | — |

**Fuera de alcance de estos 8 pasos (para más adelante):**
- Teclado virtual / IME en login — intentos revertidos; IME nativo sigue activo.
- `NavigationRouter` central (paso 9 del plan).
- EPG, Catchup, OSMS, Parental, Player HUD unificado (pasos 10+).

---

## Paso 1 — CSS rendimiento TV

### Qué se hizo
En `.device-tv`:
- `scroll-behavior: auto` en contenedores con scroll (muro, VOD, catchup, buscador, EPG, etc.).
- `--home-sidebar-transition-duration: 0ms` en `.home-shell-ui`.
- Sin `transform: scale` en `.focused` (el anillo marca el foco).

### Archivos
| Archivo | Cambio |
|---------|--------|
| `src/styles/_tv-nav-performance.scss` | Reglas anteriores |
| `src/styles/main.scss` | Import del partial |

### Cómo probar
1. En TV, navegar con ↑↓←→ en **Inicio (muro)**, **VOD**, **sidebar**.
2. Comprobar que el scroll al mover foco es **instantáneo** (sin deslizamiento suave).
3. Comprobar que el sidebar abre/cierra **sin animación lenta**.
4. Comprobar que las cards **no se agrandan** (`scale`) al recibir foco.

### Errores encontrados (completar)

| # | Pantalla / ruta | Qué falla | Severidad (baja/media/alta) | Notas |
|---|-----------------|-----------|----------------------------|-------|
| 1.1 | Sidebar expand | Foco/anillo quedaba en posición del rail compacto | Alta | Fix: sync anillo tras expand (`Sidebar` + `requestTvFocusRingSync`) |
| 1.2 | | | | |

---

## Paso 2 — ChannelCard sin re-render por foco

### Qué se hizo
Se eliminó `useState` para estado `focused` en tarjetas del bouquet. El foco visual lo maneja el sistema global (`TvFocusRing` + `focusin`), no estado React local.

### Archivos
| Archivo | Cambio |
|---------|--------|
| `src/components/bouquet/BouquetLayouts.jsx` | `focusedRef` en lugar de `useState`; handlers `focusin`/`focusout` |

### Cómo probar
1. `/home/inicio` — muro de canales.
2. Pulsar ↑↓←→ rápido (20 pulsaciones).
3. Verificar fluidez y que el anillo sigue al elemento activo sin parpadeos raros en la card.

### Errores encontrados (completar)

| # | Pantalla / ruta | Qué falla | Severidad | Notas |
|---|-----------------|-----------|-----------|-------|
| 2.1 | | | | |

---

## Paso 3 — Buscador TV (Opción B)

### Qué se hizo
LRUD entre **input → tabs → resultados**. El input usa `FocusableInput`: navegable con flechas; el teclado (IME nativo) solo al pulsar **ENTER** en el input.

### Archivos
| Archivo | Cambio |
|---------|--------|
| `src/hooks/useSearchPageTvNav.js` | Hook LRUD buscador |
| `src/pages/SearchPage.jsx` | Integración hook + `FocusableInput` |
| `src/components/navigation/FocusableInput.jsx` | `readOnly` hasta ENTER (compartido con login) |

### Cómo probar
1. `/home/buscador`
2. Flechas: input ↔ tabs ↔ lista resultados.
3. ENTER en input → abre teclado; escribir; volver a navegar con flechas.
4. ← desde primer resultado → sidebar (si aplica según shell).

### Errores encontrados (completar)

| # | Pantalla / ruta | Qué falla | Severidad | Notas |
|---|-----------------|-----------|-----------|-------|
| 3.1 | | | | |

---

## Paso 4 — Color del anillo desde marca

### Qué se hizo
Cadena de color de foco en `applyTheme`:
1. `ui.focus.color` (override explícito)
2. `ui.secondaryColor` (default)
3. `ui.primaryColor` (fallback)

Variables CSS: `--focus-color`, `--focus-color-rgb`.

### Archivos
| Archivo | Cambio |
|---------|--------|
| `src/utils/config.js` | Lógica `focusColor` |

### Cómo probar
1. Cargar app con marca configurada.
2. Verificar que el anillo de foco usa el color secundario de la marca (o el override si existe en `brands.js`).

### Errores encontrados (completar)

| # | Pantalla / ruta | Qué falla | Severidad | Notas |
|---|-----------------|-----------|-----------|-------|
| 4.1 | | | | |

---

## Paso 5 — Cache DOM (sidebar + muro)

### Qué se hizo
- **Sidebar:** cache de destinos de foco; evita recalcular en cada `keydown`.
- **Muro inicio:** cache de filas en `useRef`; invalidación por `epgWallKey` + `ResizeObserver`.

### Archivos
| Archivo | Cambio |
|---------|--------|
| `src/components/Sidebar.jsx` | Cache navegación |
| `src/utils/inicioBouquetTvGrid.js` | Helpers grid / filas |
| `src/hooks/useBouquetMuroTvNav.js` | Cache filas + uso grid |

### Cómo probar
1. Sidebar: ↑↓ entre ítems — debe sentirse más rápido que antes.
2. `/home/inicio`: ↑↓←→ en muro con muchos canales — sin lag de ~1 s entre pulsaciones.
3. Cambiar tamaño ventana / rotación (si aplica) — el muro sigue navegable.

### Errores encontrados (completar)

| # | Pantalla / ruta | Qué falla | Severidad | Notas |
|---|-----------------|-----------|-----------|-------|
| 5.1 | | | | |

---

## Paso 6 — TvFocusRing (anillo único)

### Qué se hizo
- Componente `TvFocusRing` montado en `App.jsx`.
- Un solo anillo sigue `document.activeElement`.
- En TV, `main.jsx` **no** añade clase `.focused` (solo el anillo).
- `_tv-focus-ring.scss` suprime bordes/sombras/scale duplicados en login, bouquet, sidebar, player HUD, etc.
- Posicionamiento **síncrono** en `focusin`/`focusout` (sin `rAF` en cada tecla).
- **Login (refinamiento `3629007`):** caché de foco en `useLoginTvNavigation`, `preventScroll` en `focus.js`, sin transiciones en controles login.

### Archivos
| Archivo | Rol |
|---------|-----|
| `src/components/navigation/TvFocusRing.jsx` | Anillo único |
| `src/styles/_tv-focus-ring.scss` | Estilos anillo + supresión doble foco |
| `src/App.jsx` | Monta `<TvFocusRing />` |
| `src/main.jsx` | No aplica `.focused` en `device-tv` |
| `src/hooks/useLoginTvNavigation.js` | Caché foco login, delay inicial 0 ms |
| `src/utils/tvNavigation/focus.js` | `preventScroll`, caché `focusById` |

### Cómo probar

**Global**
1. En cualquier pantalla TV: un **solo** indicador de foco (anillo), sin doble borde.

**Login** (`/login`) — área más pulida
1. Al cargar: foco en usuario sin delay perceptible.
2. ↓ usuario → contraseña → toggle → botones.
3. Un solo anillo; inputs/botones **no** cambian de tamaño ni borde grueso extra.
4. Modales QR/UDID: foco coherente.

**Otras áreas** — pueden tener restos de doble foco (no re-auditadas tras paso 6)
- Home / bouquet / sidebar / player — anotar si ves doble borde o anillo desfasado.

### Errores encontrados (completar)

| # | Pantalla / ruta | Qué falla | Severidad | Notas |
|---|-----------------|-----------|-----------|-------|
| 6.1 | | | | |
| 6.2 | | | | |

### Sub-tema diferido: teclado en login
| Tema | Estado |
|------|--------|
| IME nativo al ENTER en input | Activo (comportamiento original) |
| Compactación formulario al abrir teclado | **Sin fix** — revertido a propósito |
| Teclado virtual propio / librería | **Pendiente** — decisión futura |

---

## Paso 7 — PreloadGate + layout `/home/*`

### Qué se hizo
Rutas que comparten EPG precargado agrupadas bajo `HomeEpgRoutesLayout` con un solo `<PreloadGate required="epg">`. Al cambiar entre inicio, buscador, EPG, etc., **no se desmonta** el gate.

### Archivos
| Archivo | Cambio |
|---------|--------|
| `src/components/preload/HomeEpgRoutesLayout.jsx` | Layout + `PreloadGate` |
| `src/App.jsx` | Rutas hijas bajo `<Route element={<HomeEpgRoutesLayout />}>` |

### Rutas bajo el layout
- `/home/inicio`
- `/home/buscador`
- `/home/servicios-tv-radio`
- `/home/epg`
- `/home/control-parental`

### Rutas fuera (gate propio o sin EPG)
- `/home/vod`, `/home/catchup`, `/home/osms`

### Cómo probar
1. Entrar a `/home/inicio`, esperar preload.
2. Ir a buscador → EPG → control parental → volver a inicio.
3. No debe repetirse pantalla de carga EPG completa en cada salto.
4. Foco y navegación siguen funcionando tras cada cambio de ruta.

### Errores encontrados (completar)

| # | Pantalla / ruta | Qué falla | Severidad | Notas |
|---|-----------------|-----------|-----------|-------|
| 7.1 | | | | |

---

## Paso 8 — FocusManager + NavigationLockContext

### Estado: ❌ NO IMPLEMENTADO

Este paso está **planificado** en `PLAN_NAVEGACION_TV.md` §11 pero **aún no hay código** en el repo:
- No existe `src/navigation/FocusManager.js`
- No existe `NavigationLockContext`
- Los modales siguen con listeners `keydown` propios

### Qué debería hacer (cuando se implemente)
- Pila de foco al abrir/cerrar modales.
- Restaurar foco previo en &lt; 50 ms (criterio G2).
- Reemplazo gradual de `shouldDeferHomeShellNavigation`.

### Errores encontrados (completar)

| # | Pantalla / ruta | Qué falla | Severidad | Notas |
|---|-----------------|-----------|-----------|-------|
| 8.x | N/A — no implementado | Registrar aquí problemas de **foco en modales** que este paso debería resolver | | Ej.: al cerrar modal VOD no vuelve foco al rail |

---

## Plantilla para pasar errores al agente

Copiar y rellenar:

```
VALIDACIÓN NAVEGACIÓN TV — ERRORES

Dispositivo: [ej. Samsung Tizen 5 / modelo 2019]
Build: [commit o fecha deploy]

--- Paso 1 ---
1.1 [pantalla] — [descripción]

--- Paso 2 ---
2.1 ...

--- Paso 3 ---
...

--- Paso 6 (login) ---
6.1 ...

--- Paso 7 ---
...

--- Paso 8 (foco modales, aunque no esté implementado) ---
8.1 ...
```

**Regla de trabajo acordada:** corregir **un error a la vez**, sin romper lo que ya funciona (especialmente login navegación fluida).

---

## Checklist rápido por área (§7 del plan)

Marcar ✅ / ❌ / ⚠️ al validar:

| Área | Paso(s) relacionados | OK | Notas |
|------|---------------------|-----|-------|
| Login | 6 | | |
| Smartcard | — (sin cambios en 1–8) | | |
| Sidebar | 1, 5, 6 | | |
| Inicio (muro) | 1, 2, 5, 6 | | |
| VOD | 1, 6 | | |
| Buscador | 3, 7 | | |
| EPG | 7 (layout); navegación rota — paso 10+ | | |
| Catchup | 1 | | |
| Player HUD | 6 (estilos anillo) | | |
| Modales | 8 pendiente | | |

---

*Actualizar este documento cuando se cierren errores o se implemente el paso 8.*
