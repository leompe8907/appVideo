# Auditoría Técnica — Reporte Complementario (Parte 3)

**Fecha de análisis:** 6 de junio de 2026 (Actualización complementaria)
**Propósito:** Este reporte complementa a `AUDITORIA_TECNICA.md` y `AUDITORIA_TECNICA_OTT.md`, añadiendo hallazgos adicionales descubiertos tras un análisis estricto de linting, ciclo de vida en React y arquitectura de enrutamiento que no fueron cubiertos en los informes anteriores.

---

## 🔴 GRUPO 1 — Errores Críticos de React y Ciclo de Vida

### H-39 · `usePlayerHudTvNavigation.js` — Mutación de `refs` durante la fase de Render
**Archivo:** `src/hooks/usePlayerHudTvNavigation.js` (Línea 95)
**Problema:** El hook realiza una mutación directa de un ref: `overlayRef.current = overlay;` dentro del cuerpo de la función (fase de renderizado). En React (especialmente React 18+), el renderizado debe ser puro, ya que los componentes pueden ser renderizados múltiples veces antes de un commit.
**Impacto:** Medio-Alto — Viola las reglas de React y puede provocar comportamientos de foco no determinísticos o warnings severos en Strict Mode.
**Acción:** Mover la actualización de la ref a un hook `useLayoutEffect` o `useEffect`:
```javascript
useEffect(() => {
  overlayRef.current = overlay;
}, [overlay]);
```

### H-40 · `ErrorBoundary.jsx` — Trampa (Deadlock) de auto-recarga por Chunk Error
**Archivo:** `src/components/ErrorBoundary.jsx`
**Problema:** Existe una lógica muy útil para recargar la página (auto-reload) cuando hay un error de chunk (ej. nueva versión desplegada y el caché falla). Usa `sessionStorage.setItem('app_reloaded_from_error', '1')` para evitar recargas infinitas. Sin embargo, **la bandera nunca se limpia** (no hay un `sessionStorage.removeItem`). Si el usuario sufre un error, recarga y usa la app normalmente, y horas después sufre *otro* chunk error válido, la app no se recargará porque la bandera del primer error sigue existiendo en el Session Storage.
**Impacto:** Medio — Las recargas post-despliegue en caliente fallarán irremediablemente para usuarios con sesiones largas activas.
**Acción:** Añadir un `useEffect` en `App.jsx` o en el propio `ErrorBoundary` (si carga correctamente sus `children`) que remueva la llave del `sessionStorage`.

---

## 🟡 GRUPO 2 — Rendimiento, Linting y Arquitectura

### H-41 · `PlayerHud.jsx` — Stale Closures potenciales en `useMemo`
**Archivo:** `src/components/player/PlayerHud.jsx`
**Problema:** ESLint ha detectado que el componente tiene dependencias omitidas en un array de `useMemo` ('backward', 'forward', 'goLive', 'handlePlayPause', 'skipLiveBy', etc.). Esto es un antipatrón en React que puede generar "Stale Closures", donde las acciones del reproductor utilicen versiones anticuadas del estado (ej. al pausar/reproducir).
**Impacto:** Medio — Bugs transitorios difíciles de reproducir durante la interacción con el reproductor de video.
**Acción:** Declarar explícitamente todas las dependencias en el arreglo de `useMemo`, o estabilizar la referencia de las funciones inyectadas usando `useCallback` / `useRef`.

### H-42 · Vendor Plugins minificados bloqueando / ensuciando el linter
**Archivo:** `src/player/vendor/videojs-hlsjs-plugin.js`
**Problema:** El linter está escaneando dependencias de terceros minificadas dentro de la carpeta `src`. Esto inunda la salida del CI/CD con cientos de errores (184 detectados) de estilo como `no-redeclare`, `no-cond-assign`, lo que invisibiliza los errores reales del código fuente de la app.
**Impacto:** Bajo — Degrada la DX (Developer Experience) y hace que el equipo ignore el linter.
**Acción:** Excluir explícitamente el directorio `src/player/vendor` o los archivos `*.min.js` en el archivo `eslint.config.js` o `.eslintignore`.

### H-43 · React Router v7 — Anidación excesiva de `<PreloadGate>` en rutas hermanas
**Archivo:** `src/App.jsx`
**Problema:** Múltiples rutas como `/home/inicio`, `/home/buscador`, `/home/servicios-tv-radio` repiten exactamente el mismo envolvedor: `element={<PreloadGate required="epg"> ... </PreloadGate>}`. Al cambiar entre estas páginas, el componente padre se desmonta y remonta, pudiendo forzar una re-evaluación del EPG.
**Impacto:** Bajo-Medio — Redundancia estructural y posibles parpadeos o validaciones dobles.
**Acción:** Agrupar todas las rutas que requieran EPG bajo una ruta padre unificada (Layout) que incluya el `<PreloadGate required="epg">` y use un `<Outlet />` de React Router para despachar a los componentes hijos. Idealmente, para v7 de React Router, se recomienda migrar a la API `createBrowserRouter` para usar de forma nativa los pre-fetchers de los `loaders`.

### H-44 · Uso inconsistente de `i18n.t` fuera de contextos reactivos
**Archivo:** Varios archivos no-JSX y ErrorBoundary.
**Problema:** En el `ErrorBoundary.jsx` se hace uso de `i18n.t('errors.loadAppTitle')` de forma directa importando la instancia, en lugar de recibirlo mediante el hook `useTranslation()`. Si el lenguaje cambia dinámicamente en tiempo de ejecución, estos textos no se van a volver a renderizar.
**Impacto:** Bajo — La pantalla de error podría aparecer en el idioma incorrecto si hubo un fallo después de cambiar el idioma del perfil.
**Acción:** Para componentes de clase, utilizar el HOC `withTranslation()` o renderizar el texto en un subcomponente funcional para engancharse correctamente al contexto.
