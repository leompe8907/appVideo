# VEGA — Especificación de diseño TV, parte 3 (Catchup, Detalle de evento EPG, Reproducción catchup, Guía EPG, Recordatorios)

> Continúa `docs/VEGA_DESIGN_SPEC.md` y `docs/VEGA_DESIGN_SPEC_2.md`: rigen **todas** sus reglas de §0 y §6 (1rem = 16px; px a **1920×1080**; 1vw = 19.2px; 1vh = 10.8px; **1vmin = 10.8px**; en TV **no** se aplica `.focused` → el foco visible es el anillo único `TvFocusRing` de 3px `--focus-color` a +4px del elemento, sin scale). Los `em` se resuelven sobre 16px (botones heredan `font-size:1em`).
> **Marca de referencia: `bromteck`** (`packages/core/src/config/brands/bromteck.js`), porque tiene **catchup y EPG habilitados**. intv y wind tienen `EPG.enabled:false` → en ellas `/home/epg` redirige a `/home/inicio` (`src/App.jsx:80-87`) y no hay link/botón EPG; el catchup sí está (`catchup.enabled:true`).
> "BRAND:" = valor leído de la config de marca en runtime. Ancho del área de contenido = **W** (intv con sidebar colapsado: W = 1804.8, ver spec 1 §1.2).

### Valores BRAND relevantes (bromteck / intv / wind)
| Clave | bromteck | intv | wind | Uso real |
|---|---|---|---|---|
| `catchup.enabled` | true | true | true | Muestra ítem de menú + carga (`useHomeNavItems.js:32,53,76`; `CatchupPage.jsx:98,107`) |
| `catchup.ui.activeLayout` | `rails` | `rails` | `rails` | Layout de la página (`CatchupPage.jsx:99`) |
| `catchup.ui.showAllLayouts` | false | false | false | true → `rails` + `legacy` apilados (`:201-204`) |
| `catchup.layouts.{rails,legacy}.enabled` | true | true | true | `false` oculta ese layout (`:207`) |
| `EPG.enabled` | **true** | false | false | Ruta/links/botón HUD de la guía (`App.jsx:82`) |
| `EPG.epgPast` | **true** | true | false | Columna "Antes" en la guía (`EpgCards.jsx:105`) |
| `EPG.daysOffset` / `hoursLimit` | 2 / 12 | 2 / 12 | 2 / 12 | `pastDays` de la URL EPG / filtro ±h alrededor de ahora (`tvDataService.js:359-360`; `epgService.js:42-67,193-213`) |
| `EPG.epgCardsChannelActiveBg` | `#0A4385` | `#0A2135` | `#0A2135` | Fondo de la celda de canal con programa en vivo (inline `EpgCards.jsx:277-279`) |
| `EPG.epgCardsHeaderBg` | `#5880afff` | `#0A2135` | `#0A2135` | `--epg-cards-table-header-bg` (`config.js:284-287`) |
| `EPG.epgCardsProgramLiveBg` | `#6C8EB6` | `#415463` | `#415463` | `--epg-cards-program-live-bg` (`config.js:288-291`) |
| `EPG.epgCardsProgramLiveProgressBg` | `#6C8EB6` | `#3B9FAC` | `#3B9FAC` | `--epg-cards-program-live-progress-bg` (`config.js:292-295`) |
| `EPG.reminderLeadSeconds` | 60 | 60 | 60 | Antelación del popup (`EpgReminderHost.jsx:58-59`) |
| `EPG.reminderShowWhilePlaying` | false | false | false | Popup con player activo (`:60,70`) |
| `EPG.epgPagesPastEnabled`, `epgCardsLaterGlobal`, `epgCloseModalOnPlayLive`, `EPG.epgLineColorTime` | — | — | — | **Sin uso en el código** (solo documentados en `brands.js:247-259`). El modal SIEMPRE se cierra al reproducir en vivo |
| `ui.primaryColor` | `#004c77` | `#011266ff` | — | Fondo del botón primario del modal EPG (`epg-common.scss:224`) |
| `ui.focus.color` | `#004c77` | `#3355FF` | `#3AA3AE` | Anillo de foco |
| `features.showRating` | true | true | — | "+N" de clasificación en la columna de canal |
| `homeShell.header.catchup` / `ads.catchup` | true / false | true / false | — | Header de Inicio sobre Catchup (si `header.activado.tv` y hay áreas) / sin publicidad |

---

## 1. Página Catchup (`/home/catchup` → `src/pages/CatchupPage.jsx`)

### 1.1 Estructura
Ruta fuera de `HomeEpgRoutesLayout` (no espera la EPG) (`App.jsx:183`). Dentro de `HomeShellContent` con `sectionKey='catchup'` (`HomeShellContent.jsx:35`).
```
.catchup-page (relative, 100%×100%, overflow hidden, bg #0f1117 + var(--home-background-image) cover/center)   _catchup.scss:5-16
 ├─ .catchup-overlay  abs inset 0, rgba(0,0,0,.6), z1, sin eventos                                             :18-24
 ├─ .catchup-content  relative z2, 100% alto, overflow auto (ÚNICO scroll vertical)                             :102-116
 │   ├─ header.catchup-header  (columna, mb 14; hijos separados 6)                                             :118-128
 │   │   ├─ h1.catchup-title "Catchup"                                                                         CatchupPage.jsx:224
 │   │   └─ .catchup-subtitle "Cargando..." (solo status==='loading')                                          :225
 │   ├─ .catchup-error (solo status==='error')                                                                 :228-235
 │   └─ .catchup-layouts (columna; hijos separados 26) → ChannelsRailsCatchupLayout                            :237-241
 └─ EpgEventModal detailContext="catchup" (portal)                                                             :244-255
```
| Elemento | Estilo | px @1080 | Ref |
|---|---|---|---|
| `.catchup-content` padding | `clamp(12px,1.8vmin,20px)` lados/arriba, `clamp(14px,2.2vmin,24px)` abajo | **19.44** / abajo **23.76** | `_catchup.scss:114-115` |
| `.catchup-title` | `clamp(18px,2.2vmin,25px)`, **800**, `#fff`, margin 0 | **23.76** | `:130-136` |
| `.catchup-subtitle` | `clamp(12px,1.3vmin,15px)`, `rgba(255,255,255,.7)` | 14.04 | `:138-142` |
| `.catchup-error` | bg `rgba(255,255,255,.06)`, borde `1px rgba(255,255,255,.12)`, radio 14, padding 16, texto `rgba(255,255,255,.85)`, hijos separados 12 | — | `:144-157` |
| Botón "Refrescar página" | bg `rgba(255,255,255,.12)`, borde `1px rgba(255,255,255,.18)`, radio 12, padding `clamp(7,1vmin,11)` `clamp(10,1.4vmin,16)`, `#fff`, alineado a la izquierda | 10.8 / 15.12 | `:159-167`. Acción `window.location.reload()` → en RN `loadCatchup(brand,{force:true})` |
| `.catchup-empty` | `rgba(255,255,255,.7)`, padding `14px 0`, 16px | — | `:273-276` |

### 1.2 Layout `rails` (activo) — `src/components/catchup/ChannelsRailsCatchupLayout.jsx`
- Un **carril horizontal por grupo de catchup (= canal)** en el orden de `catchup.groups` (ordenados por `lcn` asc en el store). Se omiten grupos sin eventos (`:13`).
- Por carril: **máx. 9** `CatchupCard` (`ITEMS_PER_RAIL = 9`, eventos en el **orden del API**, sin reordenar) + tarjeta **"Ver más"** si hay > 9 (`:8,20-45`).
- Título del carril: `getCatchupGroupTitle` = `"{lcn} · {name}"` (sin lcn → solo nombre; fallback `catchupGroupId` o "Canal") (`catchupEvent.js:191-195`).
- Cada sección: `content-visibility:auto; contain-intrinsic-size: auto 280px` (virtualización CSS; en RN usar `FlatList` vertical) (`:29`).

| Elemento | Estilo TV | px | Ref (`_catchup.scss`) |
|---|---|---|---|
| Separación entre secciones | `margin-bottom 8` (layout) + `4` (sección) | 12 | `:279-291` |
| `.catchup-rail-title` | `1.05rem`, **600**, `rgba(255,255,255,.95)`, `margin 12px 0 8px` | **16.8** | `:296-301` |
| Carril TV (`[data-native-horizontal-rail]`, scroll nativo) | `display:flex; align-items:flex-start; overflow-x:auto` sin scrollbar, `padding 1.25rem 0`, `padding-inline-end 1.75rem` | 20 arriba/abajo, 28 der. | `:330-347` |
| Separación de tarjetas | cada `.catchup-card` `margin-left: calc(1rem + .5rem)` (también la 1ª) | **24** | `:343-346` |

### 1.3 `CatchupCard` (`src/components/catchup/CatchupCard.jsx`, `_catchup.scss:351-428`)
| Parte | TV | px |
|---|---|---|
| Tarjeta `button.catchup-card` | ancho `11.5em`, bg transparente, sin borde/padding, texto izq. | **184** ancho, ≈ 103.5 + 5.6 + 17.7 + 3.2 + ≤ 28.8 |
| Póster `.catchup-card-poster` | 100% ancho, **16:9**, radio 8, `border 2px rgba(255,255,255,.2)`, bg `rgba(40,40,40,.8)`, img `cover` | **184×103.5** |
| Imagen | `getEventImage(event)` = `imageUrl ‖ imageUrl2 ‖ catchupImageUrl ‖ posterUrl ‖ image ‖ poster`; sin URL o error → `placeholder_220x160` de la marca; si también falla → div `linear-gradient(135deg,#2a2a2a,#1a1a1a)` | `catchupEvent.js:42-52`; `BrandFallbackImage.jsx:17-41` |
| Título | `.85rem`, `#fff`, lh 1.3, 1 línea ellipsis, `margin-top .35rem`; texto `getEventTitle` (`languages[0].title ‖ title ‖ name ‖ programTitle ‖ eventName`, vacío → "—") | **13.6**, mt 5.6 |
| Fecha/hora | `.72rem`, `rgba(255,255,255,.72)`, lh 1.25, máx 2 líneas, `margin-top .2rem`; texto `fmtCatchupSchedule` = `toLocaleDateString(lang,{day:'2-digit',month:'short',year:'numeric'}) + " · " + HH:mm` → p.ej. **"05 oct 2026 · 21:30"** | **11.52**, mt 3.2; `catchupEvent.js:66-86` |
| Sin id de catchup (`getCatchupId` null) | clase `unavailable` → **opacity .45**, sigue enfocable/clicable | `:420-427` |
- Foco TV: anillo alrededor de la tarjeta completa, sin scale (el `scale(1.05)` y borde `$secondary-color` de `.focused` no aplican, `:405-418`).
- OK → `onSelectEvent(event, group)` → abre `EpgEventModal` (§2) con `channel = catchupGroupToChannel(group)` (`CatchupPage.jsx:159-164`; `catchupEvent.js:221-235`).

### 1.4 "Ver más" (`CatchupSeeMoreCard.jsx`, `_catchup.scss:430-449`)
Misma caja que la tarjeta (184, póster 16:9 con borde 2px) con bg `rgba(255,255,255,.08)`, "+" centrado `2.5rem` (**40**) peso 300 `rgba(255,255,255,.85)`; label "Ver más" (estilo título). OK → abre `CatchupGroupModal` con todos los eventos del grupo.

### 1.5 `CatchupGroupModal` (`src/components/catchup/CatchupGroupModal.jsx`, `_catchup.scss:451-527`)
| Parte | Estilo | px |
|---|---|---|
| Overlay | `fixed; left: var(--home-sidebar-width); top/right/bottom 0; z 100`; bg `rgba(0,0,0,.85)`; centra el modal | left 115.2 (intv) |
| Modal | `width min(96vw,1200px)`, `max-height 88vh`, columna, bg `rgba(18,20,28,.98)`, borde `1px rgba(255,255,255,.12)`, radio 16, padding `18 20 22` | **1200** × ≤ 950.4 |
| Header | flex space-between, mb 16, gap 12; título `1.25rem` 700 `#fff` = `"{lcn} · {name}"` | 20 |
| Cerrar | En TV texto **"Cerrar"** (PC: ícono X 18); bg `rgba(255,255,255,.1)`, borde `1px rgba(255,255,255,.18)`, radio 10, padding `clamp(6,.9vmin,9)` `clamp(9,1.2vmin,14)`, `#fff` | 9 / 12.96 |
| Grilla | `grid auto-fill minmax(11.5em,1fr)`, gap 16, padding `4 2 8`, scroll vertical sin scrollbar | 5 columnas de ~218 (tarjeta 184 a la izq. de cada celda) |
- Foco inicial: primera tarjeta de la grilla (`focusFirstIn('.catchup-group-grid')`). Zona de foco propia (`focusManager.push`) → **BACK cierra** el modal (`:18-30`). Clic en fondo cierra.
- OK sobre tarjeta → `onSelectEvent(event, group)` y cierra el modal → se abre el detalle (§2).

### 1.6 Layout `legacy` (no activo en ninguna marca; solo con `showAllLayouts` o `activeLayout:'legacy'`)
Por grupo: `h2.catchup-group-title` (`clamp(15,1.7vmin,20)`=18.36, 800, margin `18 0 12`) + grilla `auto-fill minmax(11.5em,1fr)` gap 12 de botones horizontales `.catchup-event-card`: bg `rgba(255,255,255,.06)`, borde `1px rgba(255,255,255,.10)`, radio 14, padding 10.8, grid `70.2px 1fr` gap 10; imagen 70.2×52.92 radio 10; título 14.04 700 2 líneas; hora `HH:mm` 11.88 `rgba(255,255,255,.75)` mt 6 (`CatchupPage.jsx:27-86`; `_catchup.scss:179-271`).

### 1.7 Sección "Grabados" — **no existe en la UI**
`catchup.recorded` se calcula (§5) y la clave i18n `catchup.recorded` = "Grabados" existe, pero **ninguna pantalla la renderiza**. Solo se usa para decidir si mostrar el ítem de menú: se oculta si `status==='ready'` y `groups` y `recorded` están vacíos (`useHomeNavItems.js:70-76`). No hay filtros, días ni pestañas en Catchup.

### 1.8 Estados, foco y teclas
- Carga: al montar, si `catchup.status==='idle'` → `loadCatchup(brand)` (`CatchupPage.jsx:105-111`; también lo dispara el menú, `useHomeNavItems.js:53`).
- **Loading**: el store pone `groups: []` mientras carga → se ven a la vez "Cargando..." (subtítulo) **y** "Sin catchup disponible" (vacío del layout). En RN conviene mostrar solo el cargando (spinner/skeleton).
- **Error**: caja + "Refrescar página"; los layouts no se renderizan. Si había datos en caché el store queda `ready` con los datos viejos.
- **Vacío**: "Sin catchup disponible".
- Foco inicial: primer enfocable en `.catchup-content` (re-dispara al cambiar `status`/`groups.length`) → primera tarjeta del primer carril (o el botón Refrescar) (`CatchupPage.jsx:118`).
- D-pad por geometría (sin handlers propios): LEFT/RIGHT dentro del carril (auto-scroll horizontal), UP/DOWN entre carriles (auto-scroll vertical con margen 20). LEFT en la 1ª tarjeta → sidebar. BACK → comportamiento global del home.
- **Deep-link autoplay**: si `location.state.catchupId` (o `catchup_id`) llega (desde la guía, el HUD o publicidad) y hay grupos cargados, busca el evento (`findCatchupEventInGroups(groups, id, state.epgStreamId)`: primero en el grupo con ese `epgStreamId`, luego en todos, comparando `id/eventId/catchupId/catchup_id/catchupEventId`) y **reproduce directo sin abrir el modal** (una sola vez por montaje). Si no lo encuentra, intenta con `{id: lookupId}` (`CatchupPage.jsx:171-199`; `catchupEvent.js:123-162`).

---

## 2. `EpgEventModal` (`src/components/epg/EpgEventModal.jsx`, estilos `src/components/epg/epg-common.scss:4-252`)

### 2.1 Layout (idéntico en todos los contextos)
Portal a `body`. Fuente base 16px.
| Parte | Estilo | px | Ref |
|---|---|---|---|
| Overlay | `fixed inset 0; z 10000`; flex centrado; **sin color de fondo** (la pantalla de atrás queda 100% visible); clic fuera cierra | — | `:4-11`; jsx `:166-172` |
| Caja | `60vw × 80vh`, radio 16, bg `rgb(20,20,20)`, borde `1px rgba(255,255,255,.12)`, columna con `justify-content: space-around`, overflow hidden | **1152 × 864** centrada | `:13-23` |
| Header | flex space-between, gap 12, padding `18 18 12` | — | `:25-31` |
| ├ Logo canal | `12em × 10em`, `contain`, radio 12, bg `rgba(255,255,255,.06)`; `channel.img‖imageUrl‖logoUrl‖logo‖icon` → placeholder de marca | **192×160** | `:66-72` |
| ├ Nombre canal | `2.5em` **700** `#fff` | **40** | `:60-64` |
| ├ Fila meta (gap 20, items gap 8): LCN `1.5em` 700 `rgba(255,255,255,.75)` · ["+{rating}" 14px 700 `rgba(255,255,255,.85)`] `HH:mm - HH:mm` `1.5em` 700 `rgba(255,255,255,.85)` · `"{N} min"` `1.5em` 700 `rgba(255,255,255,.75)` | 24 / 14 / 24 / 24 | `:54-103`; jsx `:184-201` |
| ├ Imagen del evento (derecha) | `180 × máx 110`, `contain`, radio 12, bg `rgba(255,255,255,.06)`; `imageUrl‖imageUrl2‖catchupImageUrl‖imageUrlVod‖imageUrl_vod‖img‖image‖posterUrl` → placeholder | 180×≤110 | `:157-171`; jsx `:70-79,207-212` |
| └ Botón X (`#epg-event-close`) | bg `rgba(255,255,255,.08)`, borde `1px rgba(255,255,255,.12)`, padding `10 14`, radio 12, ícono close 18 | ≈ 46×40 | `:111-118` |
| Body | padding `0 18 18`, columna gap 8 | — | `:124-129` |
| ├ Título `h2` | `2.5em` 700 `#fff`; vacío → "Sin título" | **40** | `:131-136` |
| ├ Badge | pill: padding `6 10`, radio 999, bg `rgba(255,255,255,.08)`, `#fff`, 16px; texto **"Catchup"** (contexto catchup) / **"En vivo"** (`isLive`) / **"No en vivo"** | — | `:143-150`; jsx `:232-238` |
| └ Descripción | `1.3em`, lh 1.5, `rgba(255,255,255,.85)`, scroll vertical propio; `languages[0].extendedDescription ‖ description ‖ extendedDescription ‖ description ‖ summary`; vacío → "Sin descripción" | **20.8** | `:173-207`; `catchupEvent.js:30-40` |
| Footer (si `showActions`) | padding `14 18 18`, flex izq., gap 12 | — | `:216-221` |
| Botón primario | bg `var(--primary-color)` (bromteck `#004c77`), texto **`#000`**, sin borde, padding `12 16`, radio 12, **700**, 16px | alto ≈ 48 | `:223-230` |
| Botón secundario | bg `rgba(255,255,255,.08)`, borde `1px rgba(255,255,255,.12)`, `#fff`, padding `12 16`, radio 12, 400 | — | `:237-243` |
| Texto "no disponible" | `.95rem`, `rgba(255,255,255,.7)`, lh 1.4 | 15.2 | `:209-214` |
- Duración = `round((end-start)/60000)` min; horas `HH:mm` locales (`jsx :82-97,156-161`).
- Navegación: zona `focusManager` propia (LRUD por geometría escopado al modal); **BACK cierra** (`:51-63`).

### 2.2 Lógica de botones (`EpgEventModal.jsx:99-118,249-292`)
`catchupStreamId = getCatchupStreamId(event)` = `event.id ?? catchupId ?? catchup_id ?? catchupEventId ?? eventId` (≤0 o vacío → null). `isPast = now > end` (sin fechas: true solo en contexto catchup); `isFuture = now < start`.

| Contexto | Botones (orden) | Foco inicial (2×rAF) |
|---|---|---|
| **Catchup** (`detailContext='catchup'`, `canPlayLive=false`) | Solo **"Reproducir"** (`#epg-event-watch-catchup`) si hay `catchupStreamId`; si no, texto "Este programa aún no está disponible en catchup". Ojo: el botón lleva clases `secondary`+`primary`; en la cascada gana `secondary` en bg/borde/color → se ve **secundario con texto 700** (bg `rgba(255,255,255,.08)`, `#fff`) | "Reproducir" o, si no hay, la X |
| **Guía EPG** (`detailContext='epg'`) | 1) **"Reproducir canal (en vivo)"** (primario, `#epg-event-play-live`; `disabled` si el canal no resuelve URL) — siempre, sea pasado/actual/futuro. 2) **"Ver (Catchup)"** (secundario) solo si `isPast && catchupStreamId`. 3) **"Recordarme"/"Recordado"** (secundario, `#epg-event-remind`) solo si `isFuture` | play-live si `canPlayLive`; si no → remind (futuro) → catchup → X |
| **HUD en vivo (Info)** (`showActions=false`) | Sin footer (solo X) | X |

Acciones:
- **Catchup → "Reproducir"**: cierra modal + `playCatchup(event)` (§3) (`CatchupPage.jsx:166-169`).
- **Guía → "Reproducir canal (en vivo)"**: cierra modal SIEMPRE y `requestPlayChannel({channel, playFn: play({type:'service', id: channel.id ?? channel.lcn, url, item: channel, autoPlay:true})})`; URL = `channel.url‖streamUrl‖hlsUrl‖hls` o `getStreamM3u8Url({streamId: channel.id ?? channel.epgStreamId})`, normalizada (`EpgCards.jsx:138-177,377-382`).
- **Guía → "Ver (Catchup)"**: NO reproduce en el sitio: `navigate('/home/catchup', {state:{catchupId, epgStreamId: channel.epgStreamId ?? event.epgStreamId, from:'epg'}})` → la página Catchup autoreproduce (§1.8) (`EpgCards.jsx:383-395`). Como los eventos EPG traen `id`, el botón aparece en casi todo programa pasado aunque el operador no tenga catchup de ese canal.
- **Guía → "Recordarme"**: toggle en `epgReminderStore` (§4.5); el modal queda abierto. El label se calcula con `hasReminder(id)` en el render del padre, y el selector devuelve una función estable → **el texto no se actualiza hasta el próximo re-render** (tick de 15s). En RN suscribirse a `reminders`.
- **HUD Info**: `onWatchCatchup` navega a `/home/catchup` con `{catchupId, from:'player-info'}` (inalcanzable sin footer) (`PlayerHud.jsx:1476-1494`).

---

## 3. Reproducción de catchup

### 3.1 URL (`panaccessService.getCatchupM3u8Url`, `packages/core/src/services/panaccessService.js:738-746`)
```
{baseUrl sin "/" final}/index.php?requestMode=function&f=getCatchupM3u8&plain=true&catchupId={id}&sessionId={sessionId}&m3u8
```
- `id = getCatchupStreamId(event)` (§2.2) — es el **`event.id` del API de catchup** (paridad 10foot), no el `eventId` de rejilla (`catchupEvent.js:97-110`).
- `sessionId = userSession.getSessionId() ‖ client.sessionId`. `baseUrl = client.baseUrl`. Lanza si el servicio no está inicializado.
- Luego `normalizePlaybackUrl(raw)` (`:789-845`): reemplaza `sessionId=` por el actual (el caso Wind solo reescribe URLs con `streamId`, no afecta catchup). Se vuelve a normalizar dentro de `PlayerContext.play` (`PlayerContext.jsx:546-552`).

### 3.2 Llamada a `play` (`CatchupPage.jsx:134-157`)
```js
requestPlayMedia({                       // gate parental por clasificación (PIN)
  item: event, ratingRaw: event?.parentalRating,
  title: 'Contenido restringido', message: 'Ingresa el PIN para reproducir contenido restringido por clasificación.',
  playFn: () => play({ type: 'catchup', id: streamId, url, item: event, autoPlay: true }),
});
```
- `item` = **el evento de catchup** (no el canal). Si no hay URL o id → no hace nada (solo warn DEV).
- `PlayerContext.play` (`:535-600`): si mismo `type+id+url` → solo `engine.play()`; si no, `telemetryService.recordSwitch({type:'catchup', id, item})`, resetea pistas y estado (`isLoading:true`, `currentTime/duration 0`, sin ventana live) y `engine.load(url,{type,autoPlay})`.
- Telemetría catchup: acciones `CATCHUP_STARTED 16` / `STOPPED_PREMATURELY 17` / `FINISHED 18`; confirma tras `MIN_TIME_VOD_OR_CATCHUP_MS = 30 s`; payload `catchupId = item.id ?? item.catchupId ?? id`, `catchupName = item.name ?? item.title`, `catchupGroupId`, `catchupGroupName` (solo en el inicio) (`telemetryService.js:49,75-77,104-117,149-160`).

### 3.3 HLS: sesión y keys (`f=getCatchupKey`)
- Todas las requests al middleware (`index.php` con `requestMode=m3u8|mekey`, `getCatchupM3u8`, `…&m3u8`) llevan `sessionId` actual inyectado/reemplazado (`packages/core/src/player/panaccessPlayback.js:6-15,43-52`; web: `sessionHlsXhrSetup.js`).
- La key AES-128 del manifiesto catchup apunta a `…f=getCatchupKey…` y llega **envuelta (32 bytes)**: `isPanaccessRotatingKeyUri` la detecta (`mekey`, `f=getcatchupkey`, `f=getvodkey`) y se **descifra con AES-128-CBC (key/IV fijas)** para obtener la key real de 16 bytes antes de pasarla al decodificador (`panaccessPlayback.js:33-41`; web `HlsPlaybackController.js:35-50,92-131`). Sin esto: segmentos 200 OK pero `fragParsingError` infinito.
- **Vega ya lo tiene portado**: `apps/vega/src/player/keyUnwrap.ts` + `VegaHlsPlayer.js:14,97`. Diferencia con vivo: vivo usa `requestMode=mekey` (key distinta por `chunk=`), catchup `f=getCatchupKey`; el mecanismo de unwrap es el mismo.

### 3.4 HUD con `type:'catchup'` (resto igual a spec 1 §4)
| Aspecto | Catchup | Ref `PlayerHud.jsx` |
|---|---|---|
| Botones centro | **Rew 10s / Play-Pausa / Fwd 10s** siempre (`backward(10)`/`forward(10)`) | `:690-694,1098-1101` |
| Seekbar | **Siempre visible**: tiempos `currentTime` / `duration` del video, barra 6px con relleno `linear-gradient(90deg,#4ed3ff,#8efeb3)`; sin chip "−mm:ss" ni pill "En vivo" | `:386-408,919-923,1196-1211` |
| Foco inicial HUD | **Play** | `usePlayerHudTvNavigation.js:62-80` |
| Bottombar | `channelMeta` sale del **evento**: logo = `item.img‖imageUrl‖…` (→ la imagen del evento), LCN = `item.lcn` (normalmente vacío), nombre = `item.name ‖ channelName ‖ 'catchup'`; sin filas "En este momento/Siguiente" ni rango (no hay `epgItems`) | `:366-379,1213-1240` |
| Zapping UP/DOWN, CH±; skip/go-live | No aplica (zapping solo con `isLiveService`; `skipLiveBy`/`goLive` salen si `type !== 'service'`) | `PlayerHud.jsx:359,746-757`; `PlayerContext.jsx:712-735` |
| Info | Caja `.player-hud__overlay` genérica (no `EpgEventModal`, que es solo para vivo con evento actual) | `:365,797-815` |
| BACK | Cierra el player y vuelve a la página Catchup | spec 1 §4.5 |

---

## 4. Guía EPG (`/home/epg` → `src/pages/EpgCardsPage.jsx` → `src/components/epg/EpgCards.jsx`)

> **No es una rejilla temporal**: no hay regla de horas, ni celdas proporcionales a la duración, ni selector de días, ni paginación hacia atrás/adelante. Es una **tabla de canales × 3–4 "slots" relativos al momento actual**: [Antes] · Ahora · Siguiente · Más tarde. `epgPagesPastEnabled` no se usa.

### 4.1 Montaje y carga
- Ruta dentro de `HomeEpgRoutesLayout` → `PreloadGate required="epg"`: la página solo se monta con `epg` ya precargado (`HomeEpgRoutesLayout.jsx:8-14`). Protegida por `EpgGuardRoute` (`EPG.enabled`). Sin header de Inicio ni publicidad (`HomeShellContent` no tiene sectionKey para epg).
- Canales = `dedupeStreams(epg.streams)` ordenados por `lcn` **asc** (LCN 0 primero, a diferencia del zapping) (`EpgCards.jsx:127-130`). Reloj interno `nowMs` cada **15 s** (`:120-125`).
- Sin estado vacío propio: sin canales solo se ven el título y la cabecera de la tabla.

### 4.2 Estructura y medidas
```
.epg-page (bg #0f1117 + --home-background-image; además hereda de _layout.scss/_pages.scss: padding 2rem=32, radio 8, color #fff)
 └─ .epg-page-content (relative z2, 100% alto)
     └─ .epg-cards-page (columna, 100% alto, overflow hidden, #fff)
         ├─ .epg-cards-header  padding 18 18 10, gap 6
         │   ├─ h1 "Guía de canales"  22px 800
         │   └─ "Selecciona un programa"  14px rgba(255,255,255,.7)
         └─ .epg-cards-grid  (flex 1, overflow-y auto = ÚNICO scroll; padding 0 12; scrollbar fina 10px)
             ├─ .epg-cards-table-header (sticky top 0)
             └─ .epg-cards-row × N
```
(`_epg.scss:4-17,96-110`; `_layout.scss:150-156`; `_pages.scss:114-117`; `epg-common.scss:254-484`.) El padding de 32 viene de la cascada de estilos globales sobre `.epg-page`; en RN reproducir 32 alrededor.

Columnas (`grid-template-columns: minmax(0,200px) minmax(0,1fr)`, gap 14): canal **200** | slots. Slots: `repeat(N, minmax(0,1fr))`, gap 12, `N = epgPast ? 4 : 3`. Con W = 1804.8: zona de slots = W − 64 − 24 − 200 − 14 = **1502.8** → 4 col ≈ **366.7** c/u (bromteck) / 3 col ≈ 492.9.

| Elemento | Estilo | px | Ref `epg-common.scss` |
|---|---|---|---|
| Cabecera tabla | sticky top 0, z2, alto `5em`, radio `1rem`, padding-bottom 10, bg `var(--epg-cards-table-header-bg)` (BRAND `EPG.epgCardsHeaderBg`, bromteck `#5880afff`, default `rgb(0,0,0)`), `backdrop-filter blur(4px)`, borde inf. `1px rgba(255,255,255,.06)`, texto centrado | alto **80**, radio 16 | `:329-347` |
| "Canal" | `2em` 700 `rgba(255,255,255,.55)`, pt 6 | **32** | `:349-354` |
| "Antes"/"Ahora"/"Siguiente"/"Más tarde" | `2em` 700 `rgba(255,255,255,.6)`, pt 6, 1 línea ellipsis | **32** | `:361-370` |
| Fila | padding `10 0`, borde inf. `1px rgba(255,255,255,.06)` | — | `:372-381` |
| Celda canal | columna centrada, gap 6: LCN `1.5em` `rgba(255,255,255,.7)`; logo `8em×6em` contain radio 12 (oculto si falla); nombre `1.5em` 700 `#fff`; "+{parentalRating}" 12px `rgba(255,255,255,.75)` (si `features.showRating`) | LCN 24, logo **128×96**, nombre 24 | `:383-416`; jsx `:272-301` |
| Celda canal "activa" (slot Ahora en vivo o canal reproducible sin EPG) | inline: bg BRAND `EPG.epgCardsChannelActiveBg` (bromteck `#0A4385`, fallback `rgba(10,67,133,.3)`), padding 8, radio 14 | — | jsx `:274-283` |
| Tarjeta programa `.epg-card` | bg `rgba(255,255,255,.06)`, borde `1px rgba(255,255,255,.10)`, radio 14, padding 12, columna gap 8, **min-height 92** | — | `:427-437` |
| Tarjeta en vivo (`--live-now`) | bg `var(--epg-cards-program-live-bg)` (bromteck `#6C8EB6`) | — | `:439-445` |
| Deshabilitada (sin evento) | opacity **.35**, `tabIndex -1` → **no enfocable** | — | `:452-454`; jsx `:72` |
| Título | `1.5em` 700 `#fff`, lh 1.2, máx 2 líneas; vacío → "—" | **24** | `:456-466` |
| Horario | `"HH:mm - HH:mm"` 16px `rgba(255,255,255,.75)` | 16 | `:468-471` |
| Barra de progreso (solo en vivo) | `margin-top:auto`, alto `.6em`, radio 999, track `rgba(255,255,255,.14)`, relleno `var(--epg-cards-program-live-progress-bg)` (bromteck `#6C8EB6`); animación lineal hasta 100% en el tiempo restante | alto **9.6** | `:473-484`; jsx `:28-55` |

### 4.3 Cálculo de slots (`src/components/epg/epgSlots.js:51-90`)
Eventos del canal (`channel.epgItems`) ordenados por `startDate`. `now` = evento con `start ≤ nowMs ≤ end`; si no hay → primer evento futuro; si tampoco → el último. `before = events[idxNow-1]` (solo con `epgPast`), `next = idxNow+1`, `later = idxNow+2`. `isLive` = `now` contiene a `nowMs`.
- Canal **sin EPG** pero con URL reproducible: la tarjeta "Ahora" se habilita con título = nombre del canal (o "Reproducir canal (en vivo)"), se trata como en vivo (`EpgCards.jsx:232-233,317-334`).
- Títulos: `languages[0].title ‖ title`.

### 4.4 Foco, teclas y OK
- Foco inicial: primera tarjeta habilitada de la grilla (`useTvInitialFocus('.epg-cards-page .epg-cards-grid', [channels.length])`). Ids `epg-card-{fila}-{col}`.
- D-pad por geometría: LEFT/RIGHT entre slots de la fila (las deshabilitadas se saltan; LEFT desde la 1ª → sidebar), UP/DOWN entre filas con auto-scroll vertical (la cabecera es sticky). Sin handlers propios; BACK = global del home.
- **OK** en cualquier tarjeta → `EpgEventModal` (contexto `epg`) con `{channel, event, isLive}` (`isLive` solo true para "Ahora" en vivo). Lo que se puede hacer según el programa (§2.2):

| Programa | Badge | Botones | Efecto principal |
|---|---|---|---|
| Pasado ("Antes", o "Ahora" ya terminado) | No en vivo | Reproducir canal (en vivo) · **Ver (Catchup)** | Catchup → navega a `/home/catchup` y autoreproduce |
| Actual ("Ahora" en vivo) | **En vivo** | **Reproducir canal (en vivo)** | Reproduce el canal en vivo (gate parental de canal) |
| Futuro ("Siguiente"/"Más tarde", o "Ahora" sin evento en curso) | No en vivo | Reproducir canal (en vivo) · **Recordarme/Recordado** | Toggle recordatorio |

### 4.5 Recordatorios (`packages/core/src/store/epgReminderStore.js`, `src/components/epg/EpgReminderHost.jsx`)
- **Store** (zustand): `{ reminders: Reminder[], dismissedUntilById: {[id]: untilMs} }`, persistido por marca en clave `epg.reminders.v1` como `{version:1, reminders, dismissedUntilById}` (`getBrandItem/setBrandItem`); se hidrata al crear y cuando cambia el backend de storage (Vega: AsyncStorage) (`:5-62`).
- `Reminder = { id: String(event.event_id ?? eventId ?? id), eventId, title, startMs, channelStableId: getChannelStableId(channel) }` (`EpgCards.jsx:396-411`). API: `addReminder` (reemplaza mismo id), `removeReminder(id)`, `hasReminder(id)`, `dismissReminderUntil(id, ms)`, `isDismissed(id, now)`, `resetOnLogout()`.
- **Host** (montado en `HomePage.jsx:168`, por lo tanto en todo `/home/*`): tick **250 ms**; ventana `[startMs − max(5, reminderLeadSeconds)·1000, startMs)`; si hay player activo y `!reminderShowWhilePlaying` → no muestra; toma el más próximo no descartado (`:58-93`).
- **Popup** (reutiliza las clases del modal EPG, 1152×864): título grande "Recordatorio" (40/700), meta "Este programa está por comenzar" (24/700), `h2` título del programa (40), badge **"Comienza en mm:ss"** (cuenta regresiva), descripción = nombre del canal (20.8). Footer: **"Cerrar"** (secundario, `#epg-reminder-close`) · **"Ir al canal"** (primario, `#epg-reminder-go`, foco inicial a 50 ms, deshabilitado si el canal no está en `epg.streams`) + X arriba (`:149-210`).
- Cerrar / BACK / clic fuera → `dismissReminderUntil(id, startMs)` (no vuelve a salir; el recordatorio queda guardado, nunca se purga). "Ir al canal" → `removeReminder(id)` + `requestPlayChannel` → `play({type:'service', …})` (`:105-147`).

---

## 5. Datos (core)

### 5.1 `preloadStore.loadCatchup(brand, {force?})` (`packages/core/src/store/preloadStore.js:514-675`)
- Estado `catchup = { status: 'idle'|'loading'|'ready'|'error', groups: [], recorded: [], progress: {loadedGroups, totalGroups}, error, lastLoadedAt }` (`:54-61`).
- No recarga si ya está `loading` o `ready` con datos (salvo `force`). Al empezar vacía `groups/recorded`.
- Pasos: `panaccessService.getCatchupGroups()` (lista en `catchupGroups|groups|items|answer`) → orden por `lcn` asc → por grupo, en **tandas de 4** en paralelo, `getCatchupEvents({epgStreamId: group.epgStreamId ?? epg_stream_id ?? epgStreamid})` (lista en `events|items|answer`; error de un grupo → `[]`) → `getRecordingTasks()` → `prepareRecorded`. Reintenta todo 1 vez con `enableRetry:true`. Error con caché previa → queda `ready` con lo viejo.
- **Grupo** (`groups[i]`) = objeto crudo del API + `events`. Campos usados: `catchupGroupId|catchup_group_id|id`, `name`, `lcn`, `epgStreamId|epg_stream_id`, `img|imageUrl|logoUrl|logo|icon`, `parentalRating`.
- **Evento** (`groups[i].events[j]`) = objeto crudo + derivados (`:584-607`):
```
{ ...raw (id, eventId, start, end?, duration (s), languages:[{title, description, extendedDescription}], imageUrl…, parentalRating?),
  catchupGroupId,                       // del grupo
  catchupId: id ?? catchupId ?? catchup_id ?? catchupEventId ?? eventId,
  startDate: Date | null,
  endDate:   Date | null,               // start + duration·1000 si hay duration, si no `end`
  durationSeconds }
```
- **`recorded`** (`packages/core/src/store/catchupRecorded.js:42-95`): tareas de `getRecordingTasks` (lista en `recordingTasks|items|tasks|answer`) con `mode === 4`, `catchupId > 0`, no `deleted`, cruzadas por id con los eventos cargados → `{ ...task, catchupId: Number, startDate: Date|null, event, image: group.img‖imageUrl‖posterUrl, lcn, catchupName: group.name }`, ordenadas por `startDate` asc. (No se muestra en UI, §1.7.)

### 5.2 EPG (`packages/core/src/services/epgService.js`, vía `tvDataService`)
- URL por canal: `{epgCdnUrl}/?pid=guest.home.login&requestMode=download&d=epg&apiToken={epgApiToken}&accessToken={SHA256(key+operator+key+streamId+key)}&operator={operator}&epgStreamId={id}&pastDays={EPG.daysOffset}&unzipped=true` (`:42-67`). Canales en tandas de 5, timeout 90 s, normalización en worker.
- Filtro: solo eventos con `|start − ahora| ≤ EPG.hoursLimit` h (12) → la guía cubre ~12 h atrás / 12 h adelante; se agregan `startDate`/`endDate` (objetos con `valueOf()` = ms) (`:193-213`).
- `epg.streams[]` (canal): `id`, `lcn`, `name`, `img|imageUrl|logoUrl|logo|icon`, `epgStreamId`, `parentalRating`, `url?`, `epgItems[]`. Evento EPG (podado en caché de disco, `preloadStore.js:85-128`): `id, eventId, event_id, start, end, startDate, endDate, title, name, programTitle, eventName, imageUrl, imageUrl2, catchupImageUrl, posterUrl, image, poster, description, extendedDescription, summary, languages[{title, description, extendedDescription}]`. Caché EPG en disco 30 min (`:78`).

### 5.3 Utilidades compartibles tal cual
`src/utils/catchupEvent.js` (títulos, imagen, fechas, `getCatchupStreamId`, `findCatchupEventInGroups`, `catchupGroupToChannel`, claves) y `src/components/epg/epgSlots.js` (`computeSlots`, `computeLiveProgressStyle`, `formatHHmm`) son JS puro sin DOM → moverlos a `packages/core` o copiarlos a Vega.

---

## Datos y funciones por pantalla

| Pantalla | Datos (store/campo) | Funciones / servicios | Navegación / salida |
|---|---|---|---|
| **Catchup** `/home/catchup` | `usePreload().catchup.{status, groups, error}` (`recorded` solo para el menú); BRAND `catchup.*` | `loadCatchup(brand[, {force}])`; `getCatchupGroupTitle`, `getEventTitle/Image/StartMs`, `fmtCatchupSchedule`, `getCatchupId`; `catchupGroupToChannel`; `findCatchupEventInGroups` (deep-link) | OK tarjeta → `EpgEventModal` (catchup); "Ver más" → `CatchupGroupModal`; `location.state.catchupId` → autoplay |
| **CatchupGroupModal** | `group.events` completos | `focusManager.push/pop`, `focusFirstIn` | OK → detalle; BACK → cierra |
| **EpgEventModal (catchup)** | `event`, `channel` sintético del grupo | `getCatchupStreamId`, `getEventDescription` | "Reproducir" → §3; BACK/X → cierra |
| **EpgEventModal (guía)** | `event`, `channel` (`epg.streams`), `nowMs`, `hasReminder` | `resolveChannelLiveUrl` (`getStreamM3u8Url` + `normalizePlaybackUrl`), `requestPlayChannel`, `add/removeReminder` | En vivo → player `service`; Ver (Catchup) → `/home/catchup` `{catchupId, epgStreamId, from:'epg'}` |
| **Reproducción catchup** | `event` como `item` | `getCatchupStreamId` → `getCatchupM3u8Url({catchupId})` → `normalizePlaybackUrl` → `requestPlayMedia({ratingRaw: event.parentalRating})` → `play({type:'catchup', id, url, item:event, autoPlay:true})`; HLS con `sessionId` + unwrap `f=getCatchupKey` (`apps/vega/src/player/keyUnwrap.ts`); telemetría 16/17/18 | HUD: seekbar + Rew/Play/Fwd 10s; BACK → página Catchup |
| **Guía EPG** `/home/epg` | `usePreload().epg.streams[].epgItems` (precargado por `PreloadGate`); BRAND `EPG.{enabled, epgPast, epgCards*}`, `features.showRating` | `dedupeStreams`, `getChannelStableId`, `computeSlots`, `computeLiveProgressStyle`; reloj 15 s | OK tarjeta → `EpgEventModal` (guía) |
| **Recordatorio (popup global)** | `useEpgReminderStore.{reminders, dismissedUntilById}`; `epg.streams`; `player.state.url`; BRAND `EPG.reminderLeadSeconds/ShowWhilePlaying` | `isDismissed`, `dismissReminderUntil`, `removeReminder`, `requestPlayChannel` → `play({type:'service'})`; tick 250 ms | "Ir al canal" → player en vivo; Cerrar/BACK → snooze hasta el inicio |
