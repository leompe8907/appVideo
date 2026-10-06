# VEGA — Especificación de diseño TV (referencia web → React Native Fire TV)

> Fuente: app web en `src/` + config compartida en `packages/core/src/config/brands/*.js`.
> Marca de referencia: **intv** (`packages/core/src/config/brands/intv.js`). Viewport objetivo: **1920×1080**.
> Todas las medidas en px están calculadas con `html { font-size: 16px }` fijo (`src/styles/_responsive.scss:6-8`), o sea **1rem = 16px**, **1vw = 19.2px**, y `em` = 16px salvo que se indique otro font-size heredado.
> Notación: `archivo:línea`. "BRAND:" = valor leído de la config de marca en runtime (no hardcodear).

---

## 0. Reglas transversales que condicionan TODO el diseño TV

| Regla | Detalle | Ref |
|---|---|---|
| Detección TV | `html.device-tv` + `html[data-device]` los pone `DeviceProvider` | `src/contexts/DeviceContext.jsx:27-42` |
| Foco habilitado | `html[data-focus="on"]` si BRAND `ui.focus.enabled !== false` | `src/utils/config.js:316-320` |
| **En TV NO se aplica la clase `.focused`** | El listener global de `focusin/focusout` sale temprano si `device-tv` → todas las reglas `.focused` (scale, sombras) de `global.scss` y de las páginas **no se usan en TV**. El foco visible en TV es **un único anillo flotante** (`TvFocusRing`) + estilos `:focus` puntuales (sidebar). | `src/main.jsx:64,80`; `src/styles/global.scss:135-158` (inactivo en TV) |
| Anillo de foco | Ver §6.3. Montado una sola vez en `App` | `src/App.jsx:161` |
| Navegación | Espacial por geometría (D-pad): el candidato con menor `primary + perp*2.2 − overlap*0.6` en la dirección pedida. Handlers registrados (`navigationRouter.register`) corren antes, del más reciente al más viejo; si devuelven `true` consumen la tecla | `src/navigation/spatialNavigation.js:80-110,155-190`; `src/navigation/NavigationRouter.js` |
| Auto-scroll | Al mover foco: se enfoca con `preventScroll`, y luego `scrollIntoViewWithinAncestors` ajusta **cada** ancestro scrolleable (X e Y) con margen 20px, sin animación | `src/navigation/spatialNavigation.js:261-308,310-352` |
| Teclas | UP/DOWN/LEFT/RIGHT (37-40), ENTER (13, Space), BACK (Escape/27, Backspace/8, 10009, 461, GoBack), CH+/CH− (427/428, ChannelUp/Down) | `src/utils/tvRemote.js:5-55` |
| Sin `gap` en flex | En TV se usan márgenes en vez de `gap` (WebKit viejos). En RN se puede usar `gap` directamente con los mismos valores | `src/styles/pages/_bouquet.scss:13-52` |

---

## 1. App shell de Home (Sidebar)

Archivos: `src/pages/HomePage.jsx`, `src/components/Sidebar.jsx`, `src/hooks/useHomeNavItems.js`, `src/components/HomeNavIcon.jsx`, estilos `src/styles/pages/_home-shell.scss` (base) + `src/styles/pages/_home-shell-tv.scss` (overrides TV).

### 1.1 Modo de shell
- BRAND `layout.shell.tv` → intv `"sidebar"` (`intv.js` `layout.shell`). `resolveShellMode()` devuelve `'topbar'` solo si el valor es exactamente `"topbar"`; si no, sidebar (`packages/core/src/config/brandConfig.js:114-117`). **En TV intv no hay Topbar** (el Topbar sólo es `layout.shell.pc`).
- Estructura (`src/pages/HomePage.jsx:152-222`):
  ```
  .home-shell
   ├─ .home-global-player (fixed, z 1000, oculto si no hay player)  → §4
   └─ .home-shell-ui (oculto con opacity 0 + scale(1.01) cuando hay player, :65-70)
       ├─ .home-shell-dim  (solo si sidebar expandido)
       ├─ <Sidebar/>  (aside fixed izquierda)
       └─ main.home-content[data-home-scope="content"] → HomeShellContent → <Outlet/>
  ```
- `/home` redirige a `/home/inicio` (`HomePage.jsx:148-150`).

### 1.2 Medidas a 1920×1080 (TV)
| Elemento | Valor CSS | px @1080p | Ref |
|---|---|---|---|
| Rail colapsado `--sidebar-rail-width` | `6vw` | **115.2** | `_home-shell-tv.scss:11-14` |
| Panel expandido `--sidebar-overlay-width` | `25vw` (tope `min(25vw,46vw)`) | **480** | `_home-shell-tv.scss:13`; `_home-shell.scss:736-739` |
| Transición de ancho | `width 380ms cubic-bezier(0.4,0,0.2,1)` | — | `_home-shell.scss:22-23,468` |
| Sidebar | `position:fixed; left:0; top:0; height:100vh; z-index:30; padding: 0.65rem 0 1rem` | top 10.4 / bottom 16 | `_home-shell.scss:450-469` |
| Contenido `main.home-content` | `margin-left: var(--sidebar-rail-width)` (no se corre al expandir: el panel es overlay); `height:100vh; overflow:hidden; display:flex column; z-index:1` | x=115.2, ancho **1804.8** | `_home-shell.scss:931-946` |
| Ítem (link) alto mínimo | `--home-sidebar-tv-item-min-height: 5vw` | **96** | `_home-shell-tv.scss:22-35,154-156` |
| Ítem padding vertical | `padding-block: 0.78rem` (≥1080 de alto) | 12.48 | `_home-shell-tv.scss:167-171` |
| Ítem font-size | `2vw` (≥1080 de alto; `3vw` en <1080) | **38.4** | `_home-shell-tv.scss:32,169` |
| Ícono | `2vw × 2vw` (≥1080; `3vw` en <1080) | **38.4** | `_home-shell-tv.scss:37-40,173-176` |
| Separación entre ítems nav | `margin-bottom: 0.65rem` | 10.4 | `_home-shell-tv.scss:160-165` |
| Grupo cuenta → nav | `margin-bottom: 0.35rem` | 5.6 | `_home-shell.scss:535-538` |
| Ítem layout | grid `var(--sidebar-rail-width) minmax(0,1fr)`: col 1 = ícono centrado en el rail, col 2 = label | — | `_home-shell.scss:585-612` |
| Grupo nav | `flex:1; justify-content:center` (columna **centrada verticalmente**), overflow-y auto sin scrollbar | — | `_home-shell.scss:540-550,567-579` |
| Avatar de perfil (si `features.profiles`) | círculo `2vw` (38.4) con margen `(rail−2vw)/2` a cada lado, borde `2px rgba(255,255,255,.25)`, `object-fit:cover` | 38.4 | `_home-shell.scss:639-643`; `_home-shell-tv.scss:182-186` |
| Badge OSMS | pill `min-width clamp(18px,2vmin,26px)` (21.6), alto `clamp(16px,1.8vmin,24px)` (19.4), font `clamp(10px,1.1vmin,14px)` (11.9) 700, bg `rgba(255,68,68,.9)`, borde `1px rgba(255,255,255,.18)`. Colapsado: absoluto top ~6.5 / right ~8.6 | — | `_home-shell.scss:656-691,881-892` |

### 1.3 Colores y tipografía
| Token | Origen | intv |
|---|---|---|
| Fondo del rail y del panel | `--sidebar-panel-bg` = `--sidebar-panel-bg-theme` ← BRAND `ui.sidebar.panelBackgroundColor ?? ui.sidebar.backgroundColor` (si contiene `rgba` cae a `#0a0a0a`) | **`rgb(0, 4, 253)`** | `config.js:351-355`; `_home-shell.scss:453,460` |
| Texto ítem en reposo | `rgba(255,255,255,0.42)`, weight 400 | — | `_home-shell.scss:593-595` |
| Texto hover / focus-visible | `rgba(255,255,255,0.78)` | — | `_home-shell.scss:614-623` |
| Texto activo (ruta actual) o con `:focus` | `#fff`, ícono opacidad 1 | — | `_home-shell.scss:701-710` |
| Label en panel expandido | siempre `#fff` | — | `_home-shell.scss:760-769` |
| Acento (subrayado) `--sidebar-accent` | `--focus-color` ← BRAND `ui.focus.color` (fallback `ui.secondaryColor`) | **`#3355FF`** | `_home-shell.scss:451`; `config.js:323-336` |
| Fuente | `--font-family` ← BRAND `ui.fontFamily` | `Roboto, sans-serif` | `config.js:310` |
| `--sidebar-text`, `--sidebar-submenu-*` | BRAND `ui.sidebar.textColor/submenuBackgroundColor/submenuTextColor` (declarados, el sidebar actual no los usa para los links) | `rgba(255,255,255,.82)` / `rgb(0,0,0)` / `rgba(255,255,255,.85)` | `config.js:356-358` |

### 1.4 Estados colapsado / expandido
- **Colapsado** (`.home-sidebar--collapsed`): solo íconos; label `opacity:0; max-width:0` (`_home-shell.scss:693-698`). Indicador de ítem activo **o enfocado**: barra `1.6rem × 2px` (25.6×2), `border-radius:1px`, color acento, centrada en el rail, `bottom: 0.35rem` (`_home-shell.scss:712-727`). El botón de cuenta oculta el label y centra el ícono (`_home-shell-tv.scss:91-104`).
- **Expandido** (`.home-sidebar--overlay`): ancho 480px, `::before` pinta el panel desde `left: rail` hasta el borde con el mismo bg (`_home-shell.scss:736-753`); labels visibles, `padding-right: 1rem`. Indicador: subrayado **bajo el texto** `100% × 2px`, `margin-top: 0.35rem`, color acento (`_home-shell.scss:771-784`).
- **Dim sobre el contenido** al expandir: `position:fixed; left: 480px; inset resto; background: rgba(12,14,20,0.18); backdrop-filter: blur(3px); z-index:20` (`_home-shell.scss:48-59`; montado en `HomePage.jsx:212`).
- El label se auto-encoge si no entra: reduce `font-size` proporcionalmente hasta **mín. 11px**, margen de seguridad 20px (`Sidebar.jsx:13-63`).
- En TV el foco del sidebar **no usa el anillo** (excluido en `TvFocusRing.jsx:14-15`) y se anulan bordes/sombras/scale (`_home-shell-tv.scss:68-77`; `_tv-focus-ring.scss:126-136`). El feedback de foco = texto blanco + barra/subrayado acento.

### 1.5 Ítems del menú (orden, labels, íconos, flags)
Orden = BRAND `layout.navOrder` (default `['search','inicio','channels','vod','epg','catchup']`) (`useHomeNavItems.js:116-121`). Siempre primero, fuera de `navOrder`, el ítem **Cuenta** (`Sidebar.jsx:238-276`).

| key | Ruta | Label (es) | Ícono (`HomeNavIcon name`) / SVG fuente | Visible si | Ref |
|---|---|---|---|---|---|
| (cuenta) | `/home/mi-cuenta` | nombre del perfil activo (si `features.profiles`) → nombre del suscriptor → "Cuenta" | `account` (`src/constants/sidebar/Cuenta - Blanco.svg`) o avatar `public/<brand>/avatars/N.png` | siempre; badge si `features.osms && unread>0` | `useHomeNavItems.js:56-62,81-82` |
| `search` | `/home/buscador` | "Buscador" | `search` (`Buscar - Blanco.svg`) | siempre | `:85` |
| `inicio` | `/home/inicio` | "Inicio" | `home` (`Home - Blanco.svg`) | siempre | `:86` |
| `channels` | `/home/servicios-tv-radio` | "Canales" | `channels` (`Canales - Blanco.svg`) | `epg.status==='ready'` y existe algún bouquet con `isMain=false` explícito | `:78-79,87-94`; `tvDataService.js:222-241` |
| `vod` | `/home/vod` | "Películas" | `movies` (`Películas - Blanco.svg`) | salvo VOD cargado y vacío (optimista mientras carga) | `:64-75,95-102` |
| `epg` | `/home/epg` | "Guía de canales" | `guide` (Material "menu", 3 líneas) | BRAND `EPG.enabled !== false` | `:33,103-105` |
| `catchup` | `/home/catchup` | "Catchup" | `catchup` (replay) | BRAND `catchup.enabled !== false` y no vacío tras cargar | `:32,70-76,106-113` |

**intv resultante:** Cuenta · Inicio · Canales (si hay bouquets no-main) · Buscador · Películas · Catchup (EPG oculto: `EPG.enabled:false`).
Íconos: SVGs monocromos `fill="currentColor"` (heredan el color del texto), viewBox 314×314 salvo Material (960) y catchup (20) (`HomeNavIcon.jsx:5-82`). Los `.svg` originales están en `src/constants/sidebar/`.

### 1.6 Comportamiento TV del sidebar
- **Expansión = foco**: cualquier foco dentro del aside lo expande (`onFocusCapture`), y al salir el foco se colapsa tras **80ms** si el nuevo foco quedó fuera (`Sidebar.jsx:131-144,232-233`).
- **UP/DOWN** quedan confinados al sidebar (nunca escapan al contenido) (`Sidebar.jsx:196-219`). **RIGHT** sale al contenido por geometría; **LEFT** desde la primera columna del contenido entra al sidebar (geometría).
- **OK** sobre un ítem: navega, colapsa y enfoca el **primer enfocable** del `<main>` de la ruta nueva (hasta 48 frames de reintento) (`Sidebar.jsx:112-129,166-178`). Re-seleccionar la ruta actual fuerza `replace` con nonce (cierra overlays) (`Sidebar.jsx:70-77`).
- Cambio de ruta por cualquier vía → colapsa (`Sidebar.jsx:160-163`).
- **BACK** en `/home/*` distinto de `/home/inicio` → `navigate(-1)`; en Inicio no hace nada (no hay salida de app en Home) (`src/components/home/HomeInputDispatcher.jsx:33-59`).

### 1.7 Fondo del contenido
- `main.home-content`: `background-color:#0f1117` (fallback) + `background-image: var(--home-background-image)`, `cover`, `center`, `no-repeat` (`_home-shell.scss:940-944`).
- `--home-background-image` se resuelve probando en orden `background.png|webp|jpg|jpeg|svg` de `public/<brand>/` y usando el primero que carga (cacheado por marca) (`src/utils/config.js:56-137`). intv → `public/intv/background.png` (3840×2160).

---

## 2. Home "Inicio" (`/home/inicio` → `BouquetPage`)

Archivos: `src/components/ads/HomeShellContent.jsx`, `src/components/home/InicioHeader.jsx`, `src/pages/BouquetPage.jsx`, `src/components/bouquet/BouquetWall.jsx`, `src/components/bouquet/BouquetLayouts.jsx`, `src/components/vod/VodRecommendedHomeRail.jsx`, `src/components/ads/AdZone.jsx`; estilos `src/styles/pages/_bouquet.scss`, `_home-shell.scss`, `_home-ads.scss`, `_vod.scss`.

### 2.1 Estructura vertical del contenido (dentro de `main`, 1804.8 × 1080)
```
.home-content-stack (flex column)                         HomeShellContent.jsx:76-101
 ├─ InicioHeader            (si header habilitado)        :79
 ├─ AdZone "top"            (solo si topInBouquets=true)  :80-87
 ├─ .home-content-outlet  (flex:1, overflow:auto)         _home-shell.scss:956-962
 │   └─ .bouquet-page > .bouquet-container > .bouquet-content
 │       └─ .bouquet-inicio-scroll  (ÚNICO scroll vertical)   BouquetPage.jsx:104-127
 │           ├─ AdZone "top"  (si topInBouquets=false → scrollea con el contenido)
 │           ├─ BouquetWall   (rails de bouquets)
 │           └─ VodRecommendedHomeRail ("Recomendado")
 └─ AdZone "bottom"  (fijo bajo el outlet)                :91-98
```
- Flags BRAND `homeShell.ads.{inicio,serviciosTvRadio,vod,catchup,topInBouquets}` (intv: inicio `true`, resto `false`, topInBouquets `false`) (`HomeShellContent.jsx:45-49`). intv: banner top **dentro** del scroll y banner bottom fijo.
- Scroll vertical: `.bouquet-inicio-scroll` `overflow-y:auto`, sin scrollbar; TV: `padding-bottom: 3.25rem` (52) y `scroll-padding-block-end: 3.5rem` (56); `scroll-behavior:auto` (sin smooth en TV) (`_bouquet.scss:175-199,1148-1160`).
- Foco inicial: primer enfocable dentro de `.bouquet-inicio-scroll` cuando `epg` está listo (normalmente el banner top si existe, si no la 1ª tarjeta del 1er bouquet) (`BouquetPage.jsx:39`; `src/hooks/useTvInitialFocus.js:19-28`).
- Al cerrar el player se restaura el foco a la tarjeta del **último canal en vivo reproducido**, o al último foco recordado del main (`HomePage.jsx:53-65,123-132`; `src/utils/homeShellLastContentFocus.js:106-145`).

### 2.2 InicioHeader (cabecera + "Ahora/Siguiente" del canal enfocado)
- Se monta si `homeShell.header[sección]` (intv `true`) **y** `header.activado.tv` (intv `true`) (`HomeShellContent.jsx:42-43`; `brandConfig.js:151-182`). Renderiza `null` si ninguna área tiene contenido (`InicioHeader.jsx:196-227`). **intv: todas las áreas `enabled:false` y `subheader.enabled:false` → no se ve nada en TV.** Especificar igualmente para otras marcas:
- Fila header `.inicio-header`: flex row, 3 columnas `flex:1` (left/center/right, alineación por `areas.X.contentAlign`), `min-height 7.25rem` (116), padding `0.5rem 0.75rem`, separación 0.5rem; logo `height 4rem` (64) contain, margen der 0.75rem (oculto si shell topbar); hora `HH:mm` `2.05rem` (32.8) 600, `letter-spacing .02em`, opacidad .92 (`_home-shell.scss:77-128,244-257`; `InicioHeader.jsx:103-125`).
- Subheader `.inicio-subheader` (solo en Inicio, si `subheader.enabled` y `subheader.activado.tv` y algún área con `showServiceInfo`): alto `10.25rem` (164; min 8.25rem), padding `0.4rem 0.75rem 0.5rem`, `border-bottom 1px rgba(255,255,255,.08)` (`_home-shell.scss:91-108`). Contenido (canal **enfocado** en el muro, vía `HomeHeaderProvider`/`setFocusedChannel` en `BouquetPage.jsx:26-30`):
  - Canal: `LCN Nombre` `1.5rem` (24) 700, ellipsis (`_home-shell.scss:170-194`).
  - Bloque "Ahora HH:mm – HH:mm" (label `1.2rem` opac .9, hora 600) + título `1.2rem` 700 ellipsis + descripción `0.9rem` opac .86 ellipsis; ídem "Siguiente" (`_home-shell.scss:201-242`; `InicioHeader.jsx:127-188`).
  - Vacío: "Selecciona un canal para ver información." `0.95rem` opac .85.
  - Color texto `#fff` (`_home-shell.scss:72-75`).

### 2.3 BouquetWall (muro de rails)
- Fuente: `epg.bouquetsWithChannels` (preloadStore). Inicio = bouquets **sin** `isMain=false` explícito, ordenados por `priority` asc (desempate id/nombre) + rail sintético "Más vistos" insertado por prioridad (`BouquetWall.jsx:32-47`; `tvDataService.js:177-197,243-249`).
- Por bouquet se resuelve el layout de dispositivo `tv` (`resolveBouquetLayoutForDevice`, ver 2.4) → `vertical_grid` usa `BouquetGridVertical`, todo lo demás `BouquetHorizontalGrid` (`BouquetWall.jsx:65-89`).
- Contenedor `.bouquet-wall`: `margin: 0 2rem` (32 a cada lado), TV `padding: 1rem 0`; **separación entre bouquets 2rem (32)** (`_bouquet.scss:292-302,1162-1165`; `$bouquet-items-gap: 2rem` en `:11`).
- Título de cada bouquet `.bouquet-heading`: `1.6rem` (25.6) **600**, `#fff`, `margin-bottom .35rem` (5.6), `padding 0 .25rem` (`_bouquet.scss:338-345,539-546`).
- Estados: error → texto `#f8d7da` 1rem centrado; vacío → "No hay bouquets" `rgba(255,255,255,.85)`, padding 3rem (`_bouquet.scss:1094-1114`).

**Rails en TV = scroll nativo, NO Embla.** `useEmbla = isPC && scrollX` (`BouquetLayouts.jsx:106`); en TV el track lleva `data-native-horizontal-rail` y es un CSS grid con scroll-x (`BouquetLayouts.jsx:135-140`; `EmblaHorizontalRail.jsx:226-247`). En RN: `FlatList horizontal` por bouquet dentro de un scroll vertical.

Track horizontal `.bouquet-horizontal-grid-track` (`_bouquet.scss:347-398,1180-1204`):
| Propiedad | Valor | px |
|---|---|---|
| padding-inline | `1.25rem 1.75rem` | 20 izq / 28 der |
| gap entre tarjetas | `2rem` | **32** |
| flujo `column` (carrusel / multi-fila) | `grid-auto-flow: column; grid-template-rows: repeat(rows, auto); grid-auto-columns: var(--bouquet-cell-width)`; overflow-x auto | — |
| alto mínimo fila única | `min-height: 18rem`, contenido centrado vertical (TV: `align-content:flex-start`) | 288 |
| flujo `row` (logo_with_number sin tipo de plataforma) | grilla que **envuelve** (`repeat(auto-fill, cell)`), sin scroll horizontal, `padding-top .35rem` | — |
| margen inferior por tarjeta (TV) | `margin-block-end: 2rem !important` → suma 32 bajo cada fila | 32 |

Primera tarjeta en x = 115.2 (rail) + 32 (wall) + 20 (track) = **167.2px**. Caben ≈6,7 tarjetas de 224 en el ancho visible.

Virtualización TV de cada rail/grilla (`src/hooks/useChunkedList.js:63-147`): si >24 ítems → monta 28, revela de a 20 por frame mientras no hay foco; con foco mantiene ventana ±20 alrededor del índice enfocado. En RN equivale a `FlatList` con `initialNumToRender≈28`, `windowSize` acotado.

### 2.4 Layouts por bouquet (bouquetLayouts / layoutType)
Resolución (`packages/core/src/utils/bouquetLayoutConfig.js`):
1. `bouquet.bouquetLayouts.tv` (o `customData` JSON con `{layouts:{tv:{...}}}`): campos `type` (`horizontal_grid|horizontal_carousel|vertical_grid`), `card_design`, `rows` (máx 6), `columns`, `logo_index`, `background_color` (`:213-267,433-479`).
   - `vertical_grid` → grilla vertical de `columns` columnas; `horizontal_grid` con `rows>1` → `horizontal_multi_row` (scroll-x, `rows` filas, flujo por columnas); resto → carrusel 1 fila (`:330-382,572-610`).
2. Legacy `bouquet.layoutType` (string) → carrusel 1 fila; `grid_horizontal` → 3 filas; `grid_vertical` → 1 columna (`:388-427`).
3. Default `service_layout_logo_normal`.

`card_design` → **variante visual** (`getChannelLayoutVariant`, `:486-561`) y **slug** de ancho de celda (`src/utils/bouquetLayoutClasses.js:4-86`):

| card_design (alias) | Variante | Ancho celda `--bouquet-cell-width` | Tarjeta (ancho×alto) | Muestra |
|---|---|---|---|---|
| `service_layout_logo_normal` (`logo`, `logo_normal`) — **default** | `logo` | 14em = **224** | 224×**208** (13em) | Solo logo del canal |
| `service_layout_logo_large` (`logo_large`, `logo_grande`) | `logo` | 16em = **256** | 256×208 | Solo logo |
| `service_layout_event_normal` (`event`) | `event` | 224 | 224×208 | Imagen del evento actual (fallback logo) |
| `service_layout_event_line` (`event_line`) | `event_line` | 224 | 224×208, fila min-h 20rem (320) | Imagen del evento |
| `service_layout_event_large`, `service_layout_full_width_line` | `event_line` | 18em = **288** | 288×208, fila min-h 320 | Imagen del evento |
| `service_layout_event_and_logo` (`event+logo`) y `service_layout_detailed` | `event_and_logo` | 224 | 224×**288** (18rem) | Logo arriba + imagen evento + barra de progreso + hora/título debajo |
| `service_layout_event_and_logo_overlay` y `event_with_logo_{top,bottom}_{left,right}` | `event_and_logo_overlay` | 224 | 224×208 | Logo arriba + imagen + hora/título + progreso **superpuestos** |
| `service_layout_logo_with_number` (`logo+lcn`) | `logo_with_number` | 12.5rem = **200** | 200 × (160 marco + nombre) | Marco con logo + LCN abajo-derecha, nombre debajo |
| `service_layout_channel_full_info` | `logo_with_number` | 224 (slug propio, sin override) | 224 × (179 marco + nombre) | Igual que logo_with_number |

Detalle por variante (`src/components/bouquet/BouquetLayouts.jsx:196-481`, estilos `_bouquet.scss:558-1001`):
- **Base `.channel-card`** (`:558-578`): `border-radius: 3rem` (**48px**, `$border-radius-sm`), `background: rgba(255,255,255,.04)`, `border: 2px solid transparent`, `overflow:hidden`; logo `object-fit: contain` 100%×100%. Si el canal trae `backgroundColor/bgColor` se usa de fondo (variantes logo/event) (`BouquetLayouts.jsx:201-209`).
- **event_and_logo** (`_bouquet.scss:585-733`):
  - `.channel-card-frame`: `border: 2px solid #fff`, `border-radius: 1.25em` (20), overflow hidden.
  - `.channel-card-logo-top`: alto `3em` (48), padding `.25em .5em`, bg `#0a0a0a` o BRAND-de-bouquet `layouts.tv.background_color` (`BouquetLayouts.jsx:214-215`); logo contain.
  - `.channel-card-event-block`: alto fijo `8rem` (128), imagen `object-fit: fill`; al pie una franja `background:black`, padding `.35em .5em .4em` con la barra de progreso.
  - Barra `.channel-timeship`: alto `.25em` (4), radio pill, track `rgba(255,255,255,.25)`, relleno `var(--bouquet-timeship-color)` ← BRAND `bouquets.timeshipColor ?? ui.epgLineColorTime` (intv **`#3333FF`**) (`config.js:235-238`). En TV sin transición; el % se recalcula cada 1s **solo mientras la tarjeta tiene foco** (`BouquetLayouts.jsx:235-252`).
  - Debajo del marco `.channel-card-event-time-below`: hora `HH:mm – HH:mm` `1.2rem` (19.2) opac .9 tabular; título `1.2rem` **600**, 2 líneas máx, color `#fcfafa`, padding `0 .5em`.
  - Fila del track: `min-height: calc(18rem + .85rem)` (301.6), `padding-block .4rem` (`_bouquet.scss:394-398,1190-1193`).
- **event_and_logo_overlay** (`_bouquet.scss:851-978`): marco `border 2px transparent`, radio 20; logo-top 48 `#0a0a0a`; imagen `flex:1` fill; info inferior con `linear-gradient(to top, rgba(0,0,0,.85), rgba(0,0,0,.6))`, hora `1.2rem` opac .9 + título `1.2rem` 500 (2 líneas), luego barra de progreso.
- **logo_with_number** (`_bouquet.scss:764-848`): tarjeta transparente sin borde; `.channel-card-lwn-frame` `aspect-ratio 5/4`, `border-radius 1rem` (16), bg **`#152a52`** (o `bgColor` del canal), padding `.75em .7em 1.15em`; logo `max 82% × 78%` contain; LCN absoluto `right .55em; bottom .35em`, `1.45rem` (23.2) 600 `#fff` tabular; nombre `margin-top .4em`, `0.88rem` (14.1) 500 `#fff` ellipsis.
- **Bloqueado por control parental**: candado 32×32 círculo `rgba(0,0,0,.55)` arriba-derecha (8,8), y en TV `opacity .52` (enfocado `.88`) (`_bouquet.scss:1008-1023,1286-1294`; `BouquetLayouts.jsx:220-221,345`).
- **Imágenes** (`BouquetLayouts.jsx:255-301`):
  - Logo: `${brand.drm}/cdn/public/images/${channel.logo2id}/{v|v<logo_index>}/thumb.png` (`bouquetLayoutConfig.js:618-630`) → fallback `channel.img` → `public/<brand>/placeholder_220x160.png`.
  - Evento: `epgNow.imageUrl || imageUrl2 || catchupImageUrl || channel.eventImage || channel.currentEvent.image` → fallback logo. Pasa por `proxyImageUrl` (`src/utils/imageProxy.js`).
- **Grilla vertical** (`BouquetGridVertical`, `BouquetLayouts.jsx:486-548`; `_bouquet.scss:533-556,1167-1178`): `grid-template-columns: repeat(columns, minmax(0,1fr))`, `grid-auto-rows: minmax(10em,auto)`, centrado; TV: `gap:0` + `margin-right/bottom 2rem` por tarjeta, padding lateral `.45rem`, inferior `.65rem`.

### 2.5 Foco y teclas en tarjetas
- La tarjeta es `div[tabIndex=0][role=button]` (`BouquetLayouts.jsx:322-344`). En TV el estilo `.focused` de las tarjetas **no aplica** (§0); el anillo `TvFocusRing` rodea el **marco interno** (`.channel-card-frame` / `.channel-card-lwn-frame`) si existe, o la tarjeta entera (`TvFocusRing.jsx:28-39`), copiando su `border-radius` (48 en logo, 20 en event_and_logo, 16 en logo_with_number). Sin scale.
- `scroll-margin-block: .5rem 2.75rem; scroll-margin-inline: .75rem` (`_bouquet.scss:1218-1221`).
- Foco → actualiza el canal del subheader (`onChannelFocus`). **OK** → `requestPlayChannel` (gate parental) → `play({type:'service', id, url, item})`; URL = `channel.url|streamUrl|hlsUrl|hls` o `panaccessService.getStreamM3u8Url({streamId})`, normalizada (`BouquetPage.jsx:52-102`).
- LEFT/RIGHT: siguiente tarjeta del rail (geometría) con auto-scroll horizontal del track; UP/DOWN: rail anterior/siguiente (tarjeta más alineada en X), auto-scroll vertical del `.bouquet-inicio-scroll`. LEFT en la 1ª tarjeta → sidebar.

### 2.6 "Más vistos" (MostWatched)
- No es un componente propio: `useMostWatchedBouquet` arma un bouquet sintético `{bouquetId:'most-watched', name: 'Más vistos', priority, isMain, customData, items}` y se ordena junto con los demás por `priority` (`src/hooks/useMostWatchedBouquet.js:34-79`). Usa el mismo render/layout que cualquier bouquet (layout desde `customData` de la respuesta).
- Datos: `GET {login.telemetry.baseUrl}/api/v1/telemetry/top-channels/` con JWT de device-session; se cruzan los ids con `epg.streams` (`packages/core/src/services/mostWatchedChannelsService.js:56-58,81-140`). Requiere BRAND `login.telemetry.enabled` + baseUrl → **intv: deshabilitado (no aparece)**.

### 2.7 Riel VOD "Recomendado" (al final de Inicio)
- Se muestra si `vod.status==='ready'` y `vod.vodRecommended.length>0` (`VodRecommendedHomeRail.jsx:75-103`). Título "Recomendado".
- Sección `.bouquet-vod-recommended`: `margin: 0 2rem`, `padding: 0 .5rem 1rem`; título `1.25rem` (20) 600 `#fff`, `margin-bottom .35rem` (`_bouquet.scss:204-220`).
- Rail nativo en TV (`data-native-horizontal-rail`): alto `21em` (336), `padding-inline .5rem 1.75rem`, separación 2rem por tarjeta (`_bouquet.scss:222-286`).
- `VodCard`: ancho `clamp(9rem,10.5vw,12.5em)` = **200**, póster `2/3` → **300** alto, `border-radius 8px`, `border 2px rgba(255,255,255,.2)`, bg `rgba(40,40,40,.8)`, `object-fit:cover`; título `.85rem` (13.6) `#fff` 1 línea, `margin-top .35rem` (`_vod.scss:261-321`).
- Si hay >9 ítems, primera tarjeta "Ver todas las películas" (`VodSeeMoreCard`) → `/home/vod` (`VodRecommendedHomeRail.jsx:19,86-92`). OK en una tarjeta abre `VodDetailModal` (BRAND `vod.layout` intv `"hero"`).

### 2.8 Banners (AdZone) en TV
- Se cargan con `loadAds()` si la sección los tiene habilitados (`HomeShellContent.jsx:51-56`); `ads.top` / `ads.bottom` del preloadStore (`packages/core/src/store/preloadStore.js:479+`, fuente `panaccessService.getAds`).
- `.home-ad-zone`: 100% ancho del contenedor, `background rgba(0,0,0,.35)`, top: `border-bottom 1px rgba(255,255,255,.08)`; bottom: `border-top` igual y `margin-top .4rem` en TV (`_home-ads.scss:1-18`).
- Media: imagen 100% ancho, alto auto, `contain`; video (mp4/webm/ogg, autoplay muted loop) `max-height 8em` (128) top / `6.5em` (104) bottom, bg `#000` (`_home-ads.scss:41-56`; `AdZone.jsx:13-42`).
- Rotación si hay >1: cada `displayTime` s (default 5s imagen / 10s video, clamp 2–30s), **pausada mientras la zona tiene foco**; `dismissTime` oculta la zona (`AdZone.jsx:62-83`; `packages/core/src/utils/adsData.js:42-59`).
- Puntos: 8×8 círculo, inactivo `rgba(255,255,255,.35)`, activo `.95`, separación 6, padding `6px 8px 4px` (`_home-ads.scss:100-122`). En TV **sin flechas ni contador** (`:96-98,145-147`).
- TV: la zona es un único enfocable (`tabIndex 0`); el anillo rodea `.home-ad-media` (`TvFocusRing.jsx:30-35`); con foco además `box-shadow: inset 0 0 0 2px rgba(255,255,255,.35)`. **LEFT/RIGHT** cambian de slide (si hay >1) y consumen la tecla; **OK** activa: abre URL, reproduce canal, reproduce catchup o abre VOD (`AdZone.jsx:126-149`; `src/utils/adActivate.js`).

---

## 3. Página Canales (`/home/servicios-tv-radio` → `TvRadioServicesPage`)
- **Mismo diseño que Inicio** (mismo `.bouquet-page` / `.bouquet-inicio-scroll` / `BouquetWall`), con `variant="servicios"`: solo bouquets con `isMain=false` explícito, por prioridad; sin banners top internos, sin "Más vistos", sin riel VOD (`src/pages/TvRadioServicesPage.jsx:88-103`; `BouquetWall.jsx:36-40`).
- Cada bouquet usa su propio layout TV (§2.4): rails horizontales o grilla vertical según `bouquetLayouts.tv`.
- Header: BRAND `homeShell.header.serviciosTvRadio` (intv true, pero vacío); ads: `homeShell.ads.serviciosTvRadio` (intv false).
- Si no hay bouquets no-main → redirige a Inicio (`:81-86`). Foco inicial: primer enfocable (`:27`). OK = mismo flujo de reproducción (`:29-79`).
- `Bouquet.jsx` (lista simple de bouquets `.bouquet-row`, máx 900px) es legacy y **no está ruteado**.

---

## 4. Player en vivo + HUD (`PlayerHud`)

Archivos: `src/components/player/PlayerHud.jsx`, `src/hooks/usePlayerHudTvNavigation.js`, `src/hooks/usePlayerChannelZapping.js`, `src/utils/channelZappingList.js`, estilos `src/styles/pages/_player-hud.scss`, `_home-shell.scss:259-448`. (`PlayerHudToolbar.jsx`/`renderPlayerHudButton.jsx`/`resolvePlayerHudLayout.js` existen pero **PlayerHud no los usa**.)

### 4.1 Capas
- `.home-global-player`: `fixed inset 0`, `z-index 1000`, bg `#000`, fade `opacity 220ms` (`_home-shell.scss:259-278`). Video 100%×100% `object-fit: var(--player-video-object-fit, contain)` (`:290-300`).
- Loading: overlay `--player-loading-background` (BRAND `ui.playerLoading.premium` intv `true` → `radial-gradient(circle at center, rgba(9,14,22,.18) 0%, rgba(9,14,22,.62) 78%), linear-gradient(180deg, rgba(4,8,14,.22), rgba(4,8,14,.48))` + `blur(5px) saturate(1.05)`), spinner **54×54**, borde `3px rgba(255,255,255,.25)`, top `#fff`, halo `0 0 0 7px rgba(255,255,255,.05)` + glow `0 0 36px rgba(120,170,255,.32)`, giro 0.85s + pulso 1.25s (`_home-shell.scss:414-448`; `config.js:296-309`).
- Al abrir el player el shell se oculta (`.home-shell-ui--hidden`) y el foco pasa al contenedor de video (`HomePage.jsx:107-121`).

### 4.2 Layout HUD @1080p
| Región | Estilo | px | Ref |
|---|---|---|---|
| Raíz `.player-hud` | `absolute; left/right/bottom 0; padding .75rem 1.1rem 1rem; z 14`; fade `opacity 180ms` | 12 / 17.6 / 16 | `_player-hud.scss:1-21` |
| Topbar | `fixed; top .75rem; left/right 1.1rem`; `justify-content: space-between`; 3 grupos (left/center/right), separación interna `1.45rem` | top 12, lados 17.6, gap 23.2 | `:100-127` |
| Botón ícono `.player-hud__iconbtn` | círculo `font-size 1.95rem`, `2em × 2em`; ícono `1em`; `border 1px rgba(255,255,255,.26)`; bg `linear-gradient(180deg, rgba(10,10,12,.445) 0%, rgba(10,10,12,.9) 100%)`; color `#fff`. Primario (play) bg `rgba(255,255,255,.18)` | **62.4** Ø, ícono 31.2 | `:139-165` |
| Reloj (derecha) | `HH:mm` `1.95rem` tabular, pill, mismo gradiente, `border 1px rgba(255,255,255,.18)`, padding `.2rem .45rem` | 31.2 | `:129-137` |
| Seekbar (solo VOD/catchup o `player.showSeekbarOnLive`) | caja radio 12, `border 1px rgba(255,255,255,.18)`, bg `linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.55))`; tiempos `1.3rem`; barra **6px** track `rgba(255,255,255,.28)`, relleno `linear-gradient(90deg,#4ed3ff,#8efeb3)`; chip "−mm:ss" `#9fe8ff` | — | `:279-317,402-414`; `PlayerHud.jsx:920-923,1196-1211` |
| Bottombar | `margin-top .55rem`; radio 12; `border 1px rgba(255,255,255,.18)`; bg `linear-gradient(180deg, rgba(10,10,12,.72) 0%, rgba(10,10,12,.9) 100%)`; `box-shadow 0 10px 28px rgba(0,0,0,.45)`; `backdrop-filter blur(5px)`; padding `.65rem .75rem`; flex space-between | ancho 1884.8 | `:416-434` |
| Logo canal | `12em × 9em`, radio 10, contain, bg `rgba(255,255,255,.06)` | **192×144** | `:446-456` |
| Nombre canal | `LCN` (opac .9, margen der 1rem) + nombre; `2.25rem` **700** `#fff` | 36 | `:462-479` |
| Programa | `1.92rem` `rgba(255,255,255,.92)`; filas "En este momento: {título}" y "Siguiente: {título}"; label opac .78; título ellipsis | 30.7 | `:481-507`; `PlayerHud.jsx:1225-1238` |
| Derecha | rango `HH:mm - HH:mm` `1.5rem` (24) tabular `rgba(255,255,255,.88)`; debajo pill "En vivo" si hay ventana timeshift (`.9rem`, `border 1px rgba(255,255,255,.26)`, bg `rgba(255,255,255,.1)`) | — | `:509-545`; `PlayerHud.jsx:1242-1258` |

Botones del topbar (orden izquierda, `PlayerHud.jsx:1003-1092`): **Volver** (siempre) · **EPG** (si `EPG.enabled`; intv no) · **Candado** bloquear/desbloquear canal (si en vivo y `account.sections.parentalControl` ≠ false; intv sí) · **Canales** (abre listado) · **Info** · **Audio/Subtítulos** (si hay pistas). Centro: Rew 10s / Play-Pausa / Fwd 10s solo VOD/catchup o `player.showPlaybackButtonsOnLive` (intv false → en vivo el centro va vacío) (`:690-694,1094-1131`). Derecha en TV: solo reloj (volumen y fullscreen son solo PC) (`:1133-1193`).
Datos del canal: logo `item.img|imageUrl|logoUrl|logo|icon`, `lcn`, `name`; now/next desde `item.epgItems` re-evaluado cada 1s (`PlayerHud.jsx:360-379`).

### 4.3 Listado de canales (zapping lateral)
- Portal a `body`: overlay `fixed inset 0; z 2000; bg rgba(0,0,0,.35)` (`_player-hud.scss:769-775`).
- Panel `.player-channel-sidebar`: izquierda, alto completo, ancho `min(32em, 44vw)` = **512**; bg `linear-gradient(180deg, rgba(10,10,12,.72), rgba(10,10,12,.9))`; `box-shadow 12px 0 40px rgba(0,0,0,.35)`; texto `#fff` (`:777-791`).
- Header padding `14px 14px 10px`; título "Listado de canales" `2.35rem` (37.6) **800** (`:793-809`).
- Lista: padding 10, filas separadas 8px, scroll vertical sin scrollbar, máx 400 filas (`:811-831`; `PlayerHud.jsx:189-190`).
- Fila (botón): grid `11rem auto 1fr` (176 | LCN | meta), gap 10, padding `10px 12px`, radio 12, `border 1px rgba(0,0,0,.08)`, bg `rgba(0,0,0,.06)`; activa (canal reproduciéndose) bg `rgba(255,255,255,.12)`. Logo ancho `10em` (160) contain radio 10; LCN `1.5rem` **900** centrado; nombre `1.5rem` 600 ellipsis; programa actual `1.2rem` 600 opac .78 ellipsis (`_player-hud.scss:833-899`; `PlayerHud.jsx:192-219`).
- Orden de canales: todos los `epg.streams` deduplicados, por LCN ascendente, LCN 0 al final (`src/utils/channelZappingList.js:8-35`; `PlayerHud.jsx:381-383`).
- Foco inicial (100ms): la fila del **canal activo** (o la primera) (`PlayerHud.jsx:150-165`). UP/DOWN dentro del panel; **OK** zapea; el panel queda abierto salvo BRAND `player.closeChannelSidebarOnSelect` (intv `false`) (`:1466-1474`); **BACK** cierra el panel (`:135-148`).

### 4.4 Overlays Info / Pistas
- Info en vivo con evento actual → `EpgEventModal` (sin acciones) (`PlayerHud.jsx:1476-1494`); si no, caja `.player-hud__overlay` (radio 14, bg `rgba(0,0,0,.6)`, blur 6) con botón cerrar enfocado a 120ms (`_player-hud.scss:559-591`; `PlayerHud.jsx:801-815`).
- Pistas: popover fijo bajo el botón, ancho `clamp(420, vw−20, 860)`, bg `rgba(0,0,0,.72)` blur 6, 2 columnas Audio/Subtítulos; botón de pista `1.55rem`, activo borde `rgba(120,255,182,.7)` + bg `rgba(120,255,182,.14)` (`_player-hud.scss:319-400,689-741`; `PlayerHud.jsx:476-492`).
- Error: caja centrada máx 420, bg `rgba(30,30,30,.95)`, botón primario `rgba(primary,.85)` (`_player-hud.scss:26-98`).

### 4.5 Auto-ocultado y teclas (TV)
- **Auto-hide**: BRAND `player.hudAutoHideMs` (intv **6000**; mín 500; default 6000), solo si `isPlaying && !isLoading && !isSeeking`, y **nunca con un overlay abierto** (`PlayerHud.jsx:413-438`). Cualquier `keydown`/puntero/scroll re-muestra y re-arma (`:516-566`). Al ocultar cierra overlays.
- En TV los botones tienen `tabIndex 0` solo con HUD visible (`:863`).
- Foco inicial al abrir (280ms): **Play** si hay botones de reproducción, si no **Volver** (`usePlayerHudTvNavigation.js:25,62-80`).
- **BACK** → cierra el player (vuelve al home con foco en la tarjeta del último canal) (`:94-97`).
- HUD oculto: cualquier flecha/OK solo **despierta** el HUD y enfoca Play/Volver (`:99-115`).
- **UP/DOWN** con BRAND `player.channelChangeWithArrows` (intv `true`) en vivo pantalla completa y sin overlay → **zapping**: UP = siguiente en la lista (+1), DOWN = anterior; circular; despierta HUD (`usePlayerChannelZapping.js:37-107`; `PlayerHud.jsx:746-757`). **CH+/CH−** siempre zapean. LEFT/RIGHT: navegación espacial entre botones del topbar.
- Foco visual de los botones: anillo `TvFocusRing` (radio 999 copiado → círculo). Las reglas `.focused` azules `rgba(0,123,255,.9)` del scss son solo PC.

---

## 5. Login (TV) y Splash

### 5.1 Splash (`/` → `src/pages/SplashPage.jsx`, `src/styles/components/_splash.scss`)
- Pantalla `fixed`, 100%×100vh, bg `#000`, z 9999. Imagen `public/<brand>/splash.png` (intv 3840×2160) a pantalla completa `background-size: cover`, centrada (`_splash.scss:5-46`). Con BRAND `ui.splashAnimado` → `splash.gif`; con `ui.splashVideo` → video `cover` tras el poster (`brandConfig.js:252-255`; `packages/core/src/utils/splashLoader.js:13-23`).
- Duración mínima BRAND `ui.splashDuration` (intv **3000ms**) mientras resuelve sesión en paralelo; timeout de auth 60s; video máx 45s (`SplashPage.jsx:8,12,49-100`).
- Destino (`packages/core/src/services/splashAuthFlow.js`): sesión válida + licencia → ruta post-login (perfiles/smartcard/preload → `/home/inicio`); si no → `/login`.
- Fallback sin imagen: spinner 50×50, `border 4px rgba(255,255,255,.3)`, top blanco, 1s (`_splash.scss:59-67`).
- Antes del bundle, `index.html` pinta `html, body, #root { background:#000; color:#fff }` (`index.html:8-37`).

### 5.2 Login (`src/pages/LoginPage.jsx`, `src/styles/components/_login.scss`)
Estructura TV para intv (`LoginPage.jsx:653-770`; QR registro, olvidé contraseña, UDID y social **deshabilitados** en intv/TV):
```
.panaccess-login  (100vw×100vh, flex centrado, padding 1.5rem, bg #0a0a0a + imagen)
 └─ .login-card
     ├─ img.brand-logo (logo.png)
     ├─ h2.login-welcome "¡Te damos la bienvenida!"
     └─ form: [Usuario "Correo electrónico"] [Contraseña + ojo] [Ingresar]
```
- Fondo: `public/<brand>/background.png` (o BRAND `login.backgroundImage.assetPath` si `enabled`; intv no), `cover` centrado, precargado antes de mostrarse; velo `::before rgba(8,12,18,.45)` + `blur(2px)` (`LoginPage.jsx:518-554`; `_login.scss:10-37`).
- Card: bg `var(--login-card-background)` ← BRAND `login.theme.cardBackground` (intv `rgba(255,255,255,.05)`), `border 1px rgba(255,255,255,.08)`, `border-radius 1.75rem` (28), padding `2.25rem 2rem 2rem` (36/32/32), `max-width 28rem` (**448**), sombra `0 24px 64px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04)` (`_login.scss:57-69`).
- Logo en card: ancho `min(100%,11rem)` (176), `max-height clamp(3rem,8vh,4.5rem)` (= 72 @1080), contain, centrado, `margin-bottom 1rem` (`:71-84`). (intv `logo.png` 482×108.)
- Título: `1.125rem` (18) 500 `rgba(255,255,255,.95)` centrado, `margin-bottom 1.5rem` (`:86-95`).
- Inputs: 100% ancho, bg `--login-input-bg` (intv `rgba(255,255,255,.1)`), `border 1px --login-input-border` (intv `rgba(255,255,255,.2)`), texto `--login-input-text` (`#fff`), placeholder `--login-input-placeholder` (`rgba(255,255,255,.4)`), padding `.9rem 1rem`, radio `.75rem` (12), `font-size .98rem`, TV `min-height 3.25rem` (52); separación `.85rem` (`_login.scss:102-183`; `_tv-focus-ring.scss:184-204`).
- Toggle de contraseña inline: botón 3rem×2rem dentro del input a la derecha, ícono ojo SVG blanco 1.25rem (`_login.scss:186-234`).
- Botón Ingresar: 100% ancho, pill (radio 999), bg `--login-submit-bg` = BRAND `login.theme.submitBg` (intv `linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)` → `#011266` → `#0023d0`), texto `#fff` 600, `letter-spacing .02em`, padding `.95rem 1rem`, `1rem`; deshabilitado bg `rgba(255,255,255,.1)` opac .5; texto "Conectando..." al enviar (`_login.scss:485-552`; `LoginPage.jsx:727-735`).
- Error: caja `rgba(220,53,69,.2)`, borde `rgba(220,53,69,.4)`, texto `#ff6b7a` `.875rem`, radio 8 (`_login.scss:474-483`).
- **Foco TV**: solo el anillo flotante (3px `--focus-color`); en TV se neutralizan bordes/sombras/scale propios del login (`_tv-focus-ring.scss:74-102,145-181`).
- **Navegación TV** (`src/hooks/useLoginTvNavigation.js`): foco inicial en Usuario (`:57-63`); UP/DOWN entre campos (scope = form); en Contraseña RIGHT con caret al final → ojo; LEFT desde el ojo → Contraseña (`:71-97`); **OK en un input abre el teclado OSD** (inputs `readOnly` en TV) (`src/components/navigation/FocusableInput.jsx:53-98`); **BACK mantenido 1.6s → salir de la app** (`:105+`; `src/utils/tvNavigation/backLongPress.js:3,40`). En RN Fire TV se puede reemplazar el OSD por el teclado nativo.

---

## 6. Global: tema, variables, fuentes, foco

### 6.1 Mapeo BRAND → variables CSS (`applyTheme`, `src/utils/config.js:220-423`)
| Variable | Origen BRAND | intv | Línea |
|---|---|---|---|
| `--primary-color` / `--primary-color-rgb` | `ui.primaryColor` (hex 3/6/8 → tupla rgb) | `#011266ff` → `1, 18, 102` | 232, 241-274 |
| `--secondary-color` / `-rgb` | `ui.secondaryColor` | `#0023d0ff` → `0, 35, 208` | 233, 275-278 |
| `--epg-line-color` | `ui.epgLineColorTime` | `#3333FF` | 234 |
| `--bouquet-timeship-color` | `bouquets.timeshipColor ?? ui.epgLineColorTime` | `#3333FF` | 235-238 |
| `--epg-cards-*` | `EPG.epgCards*` | ver intv.js | 280-295 |
| `--player-loading-*` | `ui.playerLoading.premium` | premium | 296-309 |
| `--font-family` | `ui.fontFamily` | `Roboto, sans-serif` | 310 |
| `html[data-focus]` | `ui.focus.enabled` | `on` | 316-320 |
| `--focus-color` / `-rgb` | `ui.focus.color` → fallback `secondaryColor`/`primaryColor` | `#3355FF` → `51, 85, 255` | 323-336 |
| `--tv-focus-scale/ring/ring2/shadow` | `ui.focus.scale/ring/ring2/shadow` | 1.05 / `0 0 0 4px rgba(primary,.7)` / `0 0 0 8px rgba(primary,.35)` / `0 12px 30px rgba(primary,.55)` — **solo los usa `.focused` (no TV)** | 343-346; `global.scss:146-158` |
| `--sidebar-bg`, `--sidebar-panel-bg-theme`, `--sidebar-text`, `--sidebar-submenu-bg/-text` | `ui.sidebar.*` | `rgb(0,4,253)` … | 349-358 |
| `--search-*` | `ui.search.*` | — | 145-190 |
| `--account-*` | `account.theme.*` | — | 200-214 |
| `--login-*` | `login.theme.*` (+ `inputs`, `social`, `forgotPasswordModal`) | ver intv.js | 370-415 |
| `--home-background-image` | probe de `public/<brand>/background.{png,webp,jpg,jpeg,svg}` | `background.png` | 367; 86-137 |
| `html[data-theme]` | `ui.theme` | `light` (aplica `background #f5f5f5`/texto oscuro al root; el home lo tapa con su fondo y textos blancos explícitos) | 418; `global.scss:32-40` |

Defaults si la marca no define (`src/styles/global.scss:7-29`): `--primary-color #667eea`, `--secondary-color #764ba2`, `--epg-line-color #3333FF`, `--focus-color = primary`, fuente `system-ui, Avenir, Helvetica, Arial, sans-serif`, `line-height 1.5`, antialiased.

### 6.2 Fuentes
- **No se carga ninguna webfont** (ni `@font-face` ni Google Fonts): `index.html` solo tiene CSS crítico; la familia viene de BRAND `ui.fontFamily` vía `--font-family` (`global.scss:8`). intv `Roboto` → en Fire TV (Android) Roboto es la fuente del sistema: en RN usar `fontFamily` por defecto / `'sans-serif'`.
- Pesos usados: 400, 500, 600, 700, 800, 900. Números con `font-variant-numeric: tabular-nums` en horas/LCN (RN: `fontVariant: ['tabular-nums']`).

### 6.3 TvFocusRing (anillo de foco único)
`src/components/navigation/TvFocusRing.jsx`, `src/styles/_tv-focus-ring.scss:4-25`
- Un `div` `position:fixed`, `z-index 2147483000`, `pointer-events:none`, que se **mueve** sobre el elemento enfocado (`translate3d`, sin transición).
- Borde **`3px solid var(--focus-color)`** (intv `#3355FF`), `box-shadow: 0 0 0 1px rgba(focus-rgb,.35), 0 0 18px rgba(focus-rgb,.45)`.
- Geometría: rect del objetivo **+4px por lado** (`RING_INSET_PX = 4`) y `border-radius` copiado del objetivo (fallback 10px) (`:4,145-174`).
- Objetivo visual: para tarjetas de canal el marco interno (`.channel-card-frame`/`.channel-card-lwn-frame`); para banners `.home-ad-media`/`.home-ad-slide`; si no, el propio elemento (`:28-39`). **Excluye todo lo que está dentro de `.home-sidebar`** (`:14-15`).
- Se re-sincroniza en focusin/focusout, scroll (captura), resize, `ResizeObserver` del objetivo y anclas de layout, y evento `tv-focus-ring-sync` (`:187-261`).
- Sin escala ni "lift" en TV: `_tv-focus-ring.scss:29-71` anula `transform/box-shadow/filter` en `.focused` y descendientes.
- Equivalente RN: overlay absoluto único o borde 3px + glow en el item enfocado (`onFocus`), radio = radio del item + 4, sin scale.

---

## 7. Assets intv usados por la TV

`public/intv/` (resueltos con `getBrandAsset(brand, path)` = `${BASE_URL}${brand}/${path}`, `packages/core/src/utils/assetLoader.js:17-22`; mapa en `brandConfig.js:290-301`):
| Archivo | Tamaño | Uso |
|---|---|---|
| `splash.png` | 3840×2160 | Splash (poster) |
| `background.png` | 3840×2160 | Fondo Home (`--home-background-image`) y fondo Login |
| `logo.png` | 482×108 | Login card; `InicioHeader` si `showLogo` |
| `logo-top.png` | 1200×472 | `assets.logoTop` (Topbar PC; no usado en TV sidebar) |
| `placeholder_220x160.png` | 440×320 | Fallback de logo/imagen de tarjeta de canal |
| `avatars/1.png … 9.png` | 677×677 | Avatar de perfil en sidebar (ids 87–95), solo si `features.profiles` (intv `false`) — `src/constants/images.js:19-43` |

Referenciados pero **inexistentes** en intv: `logo-white.png`, `logo_black.png`, `favicon.ico`, `splash.gif`/video. **`public/shared/` no existe** en el repo (es el fallback de `getSharedAsset`, `assetLoader.js:29-32`).
Íconos del sidebar: SVG embebidos en `src/components/HomeNavIcon.jsx` (originales en `src/constants/sidebar/*.svg`). Íconos del HUD: `src/components/AppIcon.jsx`.
Imágenes remotas: logos `${drm}/cdn/public/images/{logo2id}/v/thumb.png`, imágenes de evento EPG, pósters VOD, media de ads.

---

## 8. Datos que necesita cada pantalla

| Pantalla / componente | Store / servicio / hook | Datos |
|---|---|---|
| Splash | `useBrand()` (`splashDuration`, assets); `resolveSplashDestination` (`packages/core/src/services/splashAuthFlow.js`) → `panaccessService.initialize/validateSession`, `reactivateLicense`, `reactivateSession`, `userSession` | sesión/licencia → ruta |
| Login | `useBrand()` (`login.*`, assets); flujo de login de core (`loginFlow`), `deviceSession` (intv `enabled`) | credenciales → sesión |
| Preload (`/preload`, `src/pages/PreloadDataPage.jsx:27-38`) | `usePreload()` → `loadEPG`, `loadVOD`, `loadCatchup`, `loadAds` | precarga antes de `/home` |
| Gate de rutas EPG | `PreloadGate required="epg"` (`src/components/preload/HomeEpgRoutesLayout.jsx`) | espera `epg.status==='ready'` para Inicio/Buscador/Canales/EPG |
| Sidebar | `useHomeNavItems()` → `usePreload()` (`vod`, `catchup`, `epg.bouquetsWithChannels`), `hasTvRadioServiceBouquets` (tvDataService), `getSubscriberName()` (userSession), `useActiveProfile()`, `useOsmsStore.unreadCount`, `getProfileAvatars()` | items visibles, nombre/avatar, badge |
| Fondo / tema | `applyTheme(brand)` (`src/utils/config.js`) + `brand.assets.get` | variables CSS |
| InicioHeader | `useHomeHeaderState()` (canal enfocado, set por `BouquetPage`/`TvRadioServicesPage`), `getCurrentEpgEvent` (`packages/core/src/utils/epgCurrentEvent`), `useDeviceTime` | canal + epgItems now/next, hora |
| BouquetWall (Inicio/Canales) | `usePreload().epg` = `preloadStore` (`packages/core/src/store/preloadStore.js:205-345`, carga vía `tvDataService.getBouquetsWithChannels` + `loadEPGForStreams`, cache local) → `bouquetsWithChannels[]` (cada bouquet: `bouquetId,name,priority,isMain,bouquetLayouts|customData|layoutType,items[]`; cada canal: `id,lcn,name,logo2id,img,bgColor,url/streamUrl,epgItems[]`); filtros `filterBouquetsForInicio/ForTvRadioServices`, `sortBouquetsByPriority`; `resolveBouquetLayoutForDevice` | rails + tarjetas |
| ChannelCard | `channel.epgItems` + `getCurrentEpgEvent` (título, horas, imagen, % progreso); `useParental()` (bloqueo); `useBrand()` (`drm` para logo, placeholder); `buildChannelLogoUrl` | tarjeta |
| Más vistos | `useMostWatchedBouquet()` → `mostWatchedChannelsService.getTopChannelsGlobal` (telemetría `login.telemetry`) + `buildMostWatchedItems(resp, epg.streams)` | bouquet sintético |
| Riel VOD Recomendado | `usePreload().vod` (`loadVOD`) → `vod.vodRecommended`, `vod.categories`; `usePlayer().play`, `useParentalGate().requestPlayMedia` | pósters + detalle |
| AdZone | `usePreload().ads` (`loadAds` → `panaccessService.getAds`, `preloadStore.js:479+`) → `ads.top[]`, `ads.bottom[]` (`file, name, displayTime, dismissTime, actionUrl, …`, mapeo en `packages/core/src/utils/adsData.js`); `createAdActivateHandler({epgStreams, play, requestPlayChannel, requestPlayMedia, navigate, panaccessService})` | banners + acción |
| Reproducción desde tarjeta | `useParentalGate().requestPlayChannel`, `usePlayer().play({type:'service', id, url, item})`, `panaccessService.getStreamM3u8Url/normalizePlaybackUrl` | stream |
| PlayerHud | `usePlayer()` (`state: type,id,url,item,isPlaying,isLoading,isSeeking,currentTime,duration,liveSecondsLate,volume,muted`, `close, pause, play, backward, forward, skipLiveBy, goLive, refreshTracks`, pistas); `usePreload().epg.streams` → `buildZappingChannelList`; `item.epgItems` → now/next; `useParental()` + `useParentalGate()` (candado/PIN); `useBrand().player.*` (`hudAutoHideMs`, `channelChangeWithArrows`, `closeChannelSidebarOnSelect`, `showSeekbarOnLive`, `showPlaybackButtonsOnLive`), `EPG.enabled`, `account.sections.parentalControl`; `EpgEventModal` para Info | HUD, zapping, overlays |
| Restauración de foco post-player | `homeShellLastContentFocus` (`rememberMainShellFocus`, `scheduleRestoreMainShellFocus({channelId})`) | foco a la tarjeta del canal |
| Globales del Home | `useOsmsPolling` (cada 2 min, si `features.osms`), `ParentalGateHost`, `EpgReminderHost`, `OsmsNotificationHost`, `InactivityHost` (`player.inactivity*`) (`HomePage.jsx:94,167-170`) | modales globales |
