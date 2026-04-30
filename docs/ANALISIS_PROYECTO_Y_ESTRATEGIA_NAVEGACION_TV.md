# Análisis del Proyecto (`appVideo`) y Estrategia de Navegación Smart TV (LG/Samsung 2019)

**Fecha:** 2026-04-30  
**Target:** **LG webOS 2019 (4.x/5.x)** y **Samsung Tizen 2019 (Tizen 5 / Chromium ~68-69)**  
**Stack:** React 18 + Vite + React Router DOM + Zustand + TanStack Query + i18next + Hls.js + engines por plataforma.

---

## 1) Objetivo del documento

Este documento consolida:

- **Qué encontré** al revisar el proyecto: arquitectura, flujo, performance y riesgos para Smart TV 2019.
- **Cómo funciona la navegación hoy** (mapa real de rutas y gates).
- **Recomendación de navegación 10-foot** (spatial navigation): qué enfoque conviene y por qué.
- **Hoja de ruta** para implementarlo de forma segura (TV-first) sin romper performance, foco ni overlays.

---

## 2) Resumen ejecutivo (hallazgos clave)

### Lo que está bien encaminado (preservar)
- **Arquitectura de player por plataforma**: engines separados (`src/player/engines/{web,lg,samsung}`) + `createEngine`/`resolveEnginePlatform`.
- **Home como Shell + rutas hijas**: `HomePage` actúa como contenedor estable con Sidebar + contenido + overlays.
- **Preload centralizado con “gate”**: `PreloadGate` redirige a `/preload` para asegurar data mínima (EPG) antes de renderizar módulos dependientes.
- **React Query configurado con defaults TV-friendly**: evita refetch agresivo por focus y define `staleTime/gcTime`.

### Lo que hoy limita Smart TV (y afecta navegación)
- **Foco/navegación por control remoto incompleta**:
  - Se usan patrones de foco “manual” (ej. `setTimeout(...focus())`) y `tabIndex`/`onKeyDown`.
  - Esto es frágil en TVs cuando el DOM cambia, aparecen overlays o se actualizan listas.
- **Performance y “ticks” que pueden amplificar re-renders**:
  - EPG (ej. `EpgCards`) usa un tick de 1s (`nowMs`) que puede re-renderizar grillas grandes.
  - En TV, foco + re-render masivo = “saltos de foco” y UI inestable.
- **Docs internas desalineadas** (en algunos puntos): se menciona Norigin/spatial nav que no está presente como dependencia/implementación.

---

## 3) Flujo real de la app (mapa de navegación)

### Rutas y protección (`src/App.jsx`)

- **Públicas**
  - `/` → `SplashPage`
  - `/login` → `LoginPage`

- **Protegidas** (requieren sesión)
  - `/profile` → `ProfilePage`
  - `/smartcard` → `SmartCardPage`
  - `/preload` → `PreloadDataPage`
  - `/home/*` → `HomePage` (shell con rutas hijas)

- **Redirecciones**
  - `/inicio` → `/home/inicio`
  - `/vod` → `/home/vod`
  - `/epg` → `/home/epg`

### Decisión inicial (Splash → destino)
En `SplashPage` se valida sesión, se intenta reactivar licencia y luego navega:
- A `/profile` si `features.profiles`
- A `/home/inicio` si hay licencia activa y no hay profiles
- A `/smartcard` si no se logra licencia
- A `/login` si no hay credenciales o fallan los flujos

### HomeShell (`src/pages/HomePage.jsx`)
`HomePage` monta:
- **Sidebar** (NavLink a rutas hijas `/home/...`)
- **Contenido** (HomeShellContent + Outlet implícito en HomeShellContent)
- **Player global** (montado en `containerRef` estable)
- **Overlays/Hosts**:
  - `ParentalGateHost`
  - `EpgReminderHost`
  - `InactivityHost`
  - `ConfirmModal` (licencia “in use”)

### Gates de datos (EPG/VOD)
`PreloadGate` hace:
- Si un módulo requiere EPG y `epg.status` aún no es `ready|error` → redirige a:
  - `/preload?redirect=/home/<modulo>`
Luego `PreloadDataPage` dispara `loadEPG/loadVOD/...` y vuelve a `redirect`.

**Conclusión de arquitectura:** la navegación TV debe integrarse sobre:
- **Shell** (Sidebar ↔ contenido) y
- **Overlays** (modales, parental gate, player HUD),
sin depender del focus nativo del navegador.

---

## 4) Restricciones y realidades de LG/Samsung 2019 (por qué importan)

### 4.1 Runtime y performance
- CPU/RAM limitadas: penaliza DOM grande, timers frecuentes y re-renders amplificados.
- Chromium viejo (Tizen 2019): ciertos patrones modernos requieren build “downlevel” (tema separado del foco, pero afecta estabilidad general).

### 4.2 Certificación y UX 10-foot (reglas no negociables)
- Siempre debe existir **un elemento enfocado** (o un recovery inmediato).
- **Back/Return** debe cerrar overlays primero, luego navegar.
- Modales requieren **focus trap** y **restore** del foco previo.
- D-pad (LRUD) debe ser determinístico (sin “foco perdido” al mutar listas).

---

## 5) Estado actual del foco (qué hay hoy)

Patrones detectados en pantallas:
- `tabIndex={0}` + `onKeyDown` (Enter/Space) en cards/botones.
- `setTimeout(() => el.focus(), N)` como “focus inicial”.
- Algunos listeners globales en overlays para Back/Return (por keyCode 10009/461).

**Problema:** esto funciona en PC, pero en TV se vuelve frágil cuando:
- se re-renderiza una grilla (EPG tick, cambio de filtros),
- se abre un modal/overlay,
- el player se activa y mueve el foco,
- hay navegación rápida (zapping).

---

## 6) Estrategia recomendada para navegación 10-foot (Smart TV)

### 6.1 Objetivo de la estrategia
Lograr una navegación:
- **Determinística** (LRUD siempre predecible),
- **Resistente a re-renders** (no pierde foco),
- **Compatible con overlays** (trap + restore),
- **Barata en CPU** (sin cálculos geométricos pesados por frame).

### 6.2 Alternativas (y decisión recomendada)

#### Opción A — Librería “spatial navigation” por árbol de foco (ej. Norigin)
**Pros**
- Modelo mental fuerte (focusKey, boundaries).
- Comunidad/adopción en OTT.

**Contras (en TV 2019, y con este repo)**
- Si no se controlan estrictamente `focusKey` estables + boundaries + overlays, aparece foco inestable.
- Las pantallas de grilla grandes y dinámicas (EPG/VOD) requieren mucha disciplina.

#### Opción B — Motor LRUD lógico (Grid/vecinos explícitos) **(recomendado)**
**Idea:** la navegación no “adivina” con geometría; cada pantalla define:
- IDs únicos por elemento
- vecinos `left/right/up/down` (o por algoritmo de grilla)
- boundaries por “zonas” (Sidebar, contenido, modal, player HUD)

**Pros**
- Máxima previsibilidad y robustez ante DOM dinámico.
- Más fácil de certificar: si un elemento desaparece, se define fallback.
- Menor costo computacional (sin raycasting ni medición constante de DOM).

**Contras**
- Requiere wiring explícito (IDs, layout metadata).
- Hay que diseñar un contrato consistente para todas las pantallas.

**Decisión recomendada para `appVideo` (LG/Samsung 2019):**
Implementar **LRUD lógico con boundaries** como capa propia, y mantener una interfaz simple:

- `FocusProvider` (estado global de foco por “scope”)
- `useFocusable({ id, scope, row, col, disabled })`
- `FocusBoundary scope="sidebar|content|modal|player"`
- `focusRestore` por ruta (último id enfocado por screen)

> Si más adelante se desea, se puede migrar a una librería (Norigin) usando los mismos conceptos (id estable + scopes). Pero para TV 2019, empezar con LRUD lógico suele ser más seguro.

---

## 7) Diseño propuesto (cómo encaja con tu app)

### 7.1 Scopes/boundaries mínimos
Definir scopes (zonas) en el HomeShell:
- `sidebar`
- `content`
- `modal` (ConfirmModal / Parental / OSMs)
- `player` (cuando el player está activo y captura input)

**Regla de prioridad de input**
1) `modal` (si existe abierto)
2) `player` (si está activo y visible)
3) `sidebar` / `content` (según dónde esté el foco)

### 7.2 Contrato de Back/Return
Implementar un único dispatcher (central):
- Si hay modal → cerrar modal (y restore focus al último del scope anterior)
- Else si player activo → cerrar HUD/volver atrás según UX definida
- Else → `navigate(-1)` o volver a `/home/inicio` (según política)

### 7.3 Inicialización y restore de foco
Para cada screen (Login/Profile/SmartCard/Home modules):
- `initialFocusId` (primario)
- `fallbackFocusId` (si el primario desaparece)
- persistir “último foco” por ruta (ej. `/home/epg` → último card enfocado)

### 7.4 Grillas grandes (EPG/VOD)
Aplicar reglas que eviten foco inestable:
- IDs estables por entidad (ej. `epg:<channelId>:slot:<now|next>`).
- Cuando cambian datos (re-render), si el id desaparece → fallback en la misma fila/col o al encabezado.
- Evitar que el tick de 1s dispare re-render del contenedor de navegación (aislar el estado volátil).

---

## 8) Plan de implementación (pasos incrementales)

### Etapa 1 — Infra mínima (1–2 días)
- Implementar capa de input remoto (normalización de teclas).
- Definir `FocusProvider` + scopes + API `useFocusable`.
- Implementar `Back/Return` centralizado.

**Done cuando:**
- Login + SmartCard + Profile navegables con D-pad sin mouse.
- Sin “focus lost” al abrir/cerrar un modal simple.

### Etapa 2 — HomeShell (2–5 días)
- Sidebar navegable (arriba/abajo) y salto a content con derecha.
- Content por módulo: Inicio/Bouquets primero (foco estable).
- Restore focus al volver desde otro módulo.

**Done cuando:**
- Sidebar ↔ content sin saltos.
- Back cierra settings/about/logout modal siempre en orden.

### Etapa 3 — Módulos pesados (EPG/VOD) (5–10 días)
- IDs estables en grillas.
- En EPG: aislar tick o reducirlo para no re-render masivo.
- Virtualización si hace falta (EPG/VOD) para no exceder DOM.

**Done cuando:**
- 20 ciclos EPG↔Inicio↔VOD en TV sin degradación, sin foco perdido.

---

## 9) Métricas recomendadas (para validar en TV real)

- **Focus reliability**: 0 pérdidas en 200 acciones LRUD (test manual automatizable).
- **Input latency percibida**: respuesta visual < 120ms en navegación.
- **Soak test**: 20 ciclos navegación + abrir/cerrar overlays + iniciar/detener player sin degradación.
- **EPG**: sin jank notable y sin “saltos de foco” al actualizar “now”.

---

## 10) Archivos relevantes (referencias del repo)

- Routing y guards: `src/App.jsx`, `src/hooks/useAuthValidator.js`
- Flujo inicial: `src/pages/SplashPage.jsx`, `src/pages/LoginPage.jsx`
- Home shell: `src/pages/HomePage.jsx`, `src/components/Sidebar.jsx`
- Preload: `src/components/preload/PreloadGate.jsx`, `src/pages/PreloadDataPage.jsx`, `src/store/preloadStore.js`
- Player: `src/contexts/PlayerContext.jsx`, `src/player/engines/**`
- Pantallas de entrada: `src/pages/ProfilePage.jsx`, `src/pages/SmartCardPage.jsx`

