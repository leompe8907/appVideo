# Errores de ESLint pendientes en `vega/core` (2026-10-14)

Encontrados al preparar la publicación de `vega/core` en `main`. `pnpm test`
pasa (160 tests) y `pnpm run build:wind` compila y pasa sus chequeos, pero
`pnpm lint` (`eslint .`) da **11 errores** y 13 avisos. Ninguno se corrigió:
quedan para el equipo web.

Reproducir: `npx eslint . ` (Node 20).

## 1. Prioridad alta: puede romper el reproductor en ejecución

| Archivo | Línea | Regla |
|---|---|---|
| `src/components/player/PlayerHud.jsx` | 924 | `react-hooks/rules-of-hooks` |

`const toggleFullscreen = useCallback(...)` está **después** de
`if (!hasContent) return null;` (línea 856). Un hook después de un `return`
condicional: si el HUD pasa de no tener contenido (`state.url` vacío) a tenerlo
sin desmontarse, React lanza *"Rendered more hooks than during the previous
render"* y la pantalla del reproductor se rompe.

En `main` no pasa: ahí no hay hooks después de ese `return`. Lo introdujo
`vega/core` (fullscreen, commit `09871e5`).

Arreglo sugerido: mover el bloque `toggleFullscreen` (líneas 924-945) a
justo antes de `if (!hasContent) return null;`. Todo lo que usa (`log`,
`syncPlayerFullscreenLayout`, `setIsFullscreen`) ya está definido antes.

## 2. `react-hooks/refs`: leer `ref.current` durante el render

Regla nueva de `eslint-plugin-react-hooks` (React Compiler). No rompe hoy,
pero el valor leído puede quedar desactualizado y el componente no es
compatible con el compilador. Patrón típico: `if (!zoneIdRef.current)
zoneIdRef.current = createZoneId(...)` en el cuerpo del componente; usar
`useState(() => createZoneId(...))` o `useRef` + `useEffect`.

| Archivo | Línea |
|---|---|
| `src/components/ConfirmModal.jsx` | 37 |
| `src/components/epg/EpgEventModal.jsx` | 47 |
| `src/components/osms/OsmsMessageModal.jsx` | 14 |
| `src/components/osms/OsmsNotificationHost.jsx` | 23 |
| `src/components/parental/ParentalPinGate.jsx` | 23 |
| `src/components/vod/VodDetailModal.jsx` | 31 |
| `src/components/vod/VodDetailModalClassic.jsx` | 30 |

## 3. `react-refresh/only-export-components`

Archivos que exportan componentes y también constantes/funciones: el hot
reload de Vite no funciona bien en ellos. Sólo afecta al desarrollo. Mover las
constantes a un archivo aparte.

| Archivo | Línea |
|---|---|
| `src/components/navigation/TvFocusRing.jsx` | 72 |
| `src/contexts/OsdKeyboardContext.jsx` | 6 |

## 4. `no-redeclare`

| Archivo | Línea | Detalle |
|---|---|---|
| `packages/core/src/config/resolveBrandToken.js` | 144 | `'process' is already defined` |

Probablemente un `/* global process */` o una declaración local de `process`
que choca con el global del entorno de ESLint. Inofensivo en ejecución.

## Avisos (13)

Variables sin usar y similares (`no-unused-vars`, p. ej. `catIndex` sin
usar). Ver la salida completa de `npx eslint .`.
