# Revisión de estilado para pantallas de PC escaladas por el sistema operativo (2026-07-28)

**Corrección de enfoque:** el problema no es overscan de TV — es específicamente monitores grandes de PC (4K, ultrawide, etc.) donde el usuario sube el escalado de Windows/macOS (125%/150%/200%) para poder leer con comodidad. Este documento está reescrito con ese foco. (La primera versión asumía overscan de TV; esa parte se retiró porque no aplica acá.)

**Alcance:** `src/styles/**`, estilos globales, `index.html`, y cálculos de layout en JS/JSX. Solo diagnóstico — nada de esto se tocó todavía.

## Cómo rompe esto en la práctica

Cuando el usuario sube el escalado del SO en un monitor grande, el navegador ya achica correctamente el viewport CSS por su cuenta (eso es estándar y automático — no es un bug). El problema real aparece por la combinación de dos cosas que si están en el código:

1. **Zonas con píxeles fijos que no participan de ningún escalado**, sin importar qué tan grande o chico sea el viewport CSS resultante.
2. **Breakpoints de `@media` pensados con la lógica "viewport chico = pantalla chica/dispositivo viejo"**, que se disparan igual cuando el viewport se achica por escalado del SO en un monitor grande — mostrando una variante "compacta/mobile" a un usuario que en realidad tiene una pantalla enorme.

Confirmé el segundo punto revisando los breakpoints reales del proyecto:

```
src/styles/pages/_home-shell.scss:932   @media (max-width: 1024px)
src/styles/pages/_parental.scss:168     @media (max-width: 1280px)
src/styles/pages/_parental.scss:173     @media (max-width: 920px)
src/styles/pages/_mi-cuenta.scss:212    @media (max-width: 920px)
src/styles/pages/_osms.scss:544/560     @media (max-width: 900px / 600px)
```

Ejemplo concreto con `_home-shell.scss:932-940`:
```scss
@media (max-width: 1024px) {
  .home-content { margin-left: var(--sidebar-rail-width); }
  .home-sidebar-link { font-size: 1.25rem; }
}
```
Un usuario con un monitor 4K (3840×2160 físico) con Windows al 200% de escala tiene un viewport CSS efectivo de ~1920px — no dispara este breakpoint, está bien. Pero un monitor grande de menor densidad (ej. 27"-32" a 1440p/4K con escalado 150-175%, o alguien usando un TV grande como monitor de PC desde el sillón, con escalado alto para que el texto se lea de lejos) puede terminar con un viewport CSS de 1024px o menos — mucho más chico de lo que su pantalla física sugiere — y el sitio le muestra la variante compacta pensada para pantallas chicas, en una pantalla que es todo lo contrario.

## El hallazgo más importante: ya existe un sistema de escalado, pero está completamente desconectado

- `src/styles/_variables.scss:51-53` declara `$base-width: 1920px` / `$base-height: 1080px` ("Base para escalado Full HD") — no se referencian en ningún mixin ni selector del resto del proyecto.
- `src/utils/responsive.js` define `scaleSize()`, `pxToVw()`, `pxToVh()`, `getScaleFactor()`, `getBreakpoint()` — confirmado por grep en todo el repo: **cero imports, cero usos**, en ningún componente.
- `src/styles/_mixins.scss:74-78` tiene un comentario que dice que el escalado fluido por viewport se "eliminó" a favor de `html { font-size }` en `_responsive.scss` — pero ese archivo fija `font-size: 16px` sin condición ninguna (`_responsive.scss:1-8`), así que el reemplazo tampoco escala nada. Resultado neto: **hoy no hay ningún mecanismo de escalado activo**, ni el viejo ni el que su comentario dice que lo reemplazó.
- Ninguna parte del proyecto lee `window.devicePixelRatio` (grep completo, cero resultados) — no hay ninguna señal de "el usuario está viendo esto escalado" disponible para ajustar nada.

Esto sigue siendo la oportunidad de menor esfuerzo/mayor impacto: conectar lo que ya existe resuelve buena parte del problema.

## Qué falta, por área

### 1. Base global / raíz de la app
- `index.html` solo tiene el viewport meta estándar de web (`width=device-width, initial-scale=1.0`) — correcto para este caso, no hace falta agregar nada ahí.
- `src/hooks/useDeviceDetection.js` captura `window.screen.width/height` (resolución física, no afectada por el escalado del SO de la misma manera que el viewport) e `innerWidth/innerHeight` (viewport CSS real, sí afectado), pero solo los usa para la clasificación TV-vs-PC y después los descarta — nada usa esa info para ajustar una escala.
- `src/config/brands.js` no tiene ningún campo de referencia de resolución/escalado.

### 2. SCSS de componentes y páginas (28 archivos revisados)
Mezcla muy inconsistente: algunos archivos ya están bien resueltos con unidades fluidas, otros son 100% píxeles fijos. Esto es exactamente lo que se nota cuando el usuario escala el SO: las partes fluidas se ven proporcionadas, las partes en píxeles fijos quedan chicas/desalineadas en comparación.

**Buenos ejemplos para usar como plantilla:** `_virtual-keyboard.scss` (`clamp()`), `_vod.scss` (`clamp(9rem, 10.5vw, 12.5em)` para el ancho de tarjeta), `_bouquet.scss` (variables `--bouquet-cell-width` en `em`/`rem`).

**Los peores, en orden de impacto:**
- `_catchup.scss`: la grilla de contenido menos fluida de toda la app — columnas (`minmax(190px, 1fr)`, `72px 1fr`), miniaturas (`72px`/`54px`) y tipografías (`22px`, `18px`, `14px`, `12px`) todas fijas.
- `_parental.scss`: pantalla completa de configuración sin una sola unidad fluida, y además tiene los dos breakpoints (`1280px`, `920px`) que se disparan solos con el viewport achicado por escalado.
- `_mi-cuenta.scss`: reloj y padding acoplados con números fijos frágiles (línea 101-115), más el breakpoint de `920px`.
- `_search.scss`: panel con un margen fijo de `10px` en los 4 bordes — no crece ni se achica con el resto del layout.
- `_home-shell.scss`: las insignias de notificación del sidebar (`.home-sidebar-badge`, líneas 619-637 y 825-834) no se escalan igual que el resto de los ítems de navegación.
- `_inactivity.scss` (pantalla de inactividad): elementos anclados a los bordes en píxeles fijos (`left:24px; bottom:24px; right:24px`).
- Riesgo menor: `_player-hud.scss` (mayormente bien resuelto en rem, salvo columnas de grid fijas como `160px 1fr`), `_profile.scss` (grilla de avatares con mínimos fijos).

### 3. Cálculos de layout en JS / estilos inline
- Ningún lugar del código lee `window.devicePixelRatio` — es la señal estándar del navegador para "el usuario está viendo esto con zoom/escalado del SO", y hoy no se usa en absoluto.
- `src/utils/responsive.js` (dead code, ver arriba) sería el lugar natural para calcular un factor de escala real usando `window.innerWidth` (viewport ya afectado por el escalado del SO) en vez de una referencia fija 1920×1080 — pero primero habría que decidir contra qué referencia comparar, dado que ahora sabemos que el caso de uso real es "monitor grande escalado", no TV.
- Varios lugares mezclan medición en vivo (`getBoundingClientRect`, correcto) con constantes en píxeles fijos que no escalan proporcionalmente: el margen de 20px en `Sidebar.jsx` (auto-shrink de etiquetas), el margen de 20px en `homeShellNavigation.js` (scroll-into-view), el epsilon de 50px en `spatialNavigation.js` (tolerancia de visibilidad de foco). Conceptualmente están bien, pero al ser un número fijo representan una fracción distinta de la pantalla según cuánto la haya escalado el usuario.
- `PlayerHud.jsx` (`syncPlayerFullscreenLayout`) calcula el tamaño del video a partir de `window.innerWidth/innerHeight` o del contenedor medido — esto es correcto y ya se adapta bien al viewport escalado, no hace falta tocarlo.

## Recomendación de por dónde empezar

1. **Revisar los breakpoints de `max-width` en `_home-shell.scss`, `_parental.scss`, `_mi-cuenta.scss` y `_osms.scss`** — decidir si esos umbrales deberían subirse, o si esas pantallas deberían simplemente no tener una variante "compacta" distinta y resolverse con `clamp()`/`vw` en su lugar (evita el problema de raíz en vez de mover el número del breakpoint).
2. **Migrar `_catchup.scss` y `_parental.scss`** a `clamp()`/`vw`/`rem` siguiendo el patrón de `_vod.scss`/`_bouquet.scss` — son las pantallas completas con más superficie en píxeles fijos.
3. Recién después, si hace falta más precisión, conectar `responsive.js`/`$base-width` con una referencia pensada para este caso de uso (monitor de escritorio grande, no TV).

¿Querés que arranque por los breakpoints (punto 1) o directamente por migrar `_catchup.scss`/`_parental.scss` a unidades fluidas?
