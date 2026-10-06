# VEGA — Especificación de diseño TV, parte 2 (VOD, Detalle VOD, Reproducción VOD, Buscador, Mi Cuenta)

> Continúa `docs/VEGA_DESIGN_SPEC.md`: rigen **todas** sus reglas de §0 y §6 (1rem = 16px; px calculados a **1920×1080**; 1vw = 19.2px; 1vh = 10.8px; **1vmin = 10.8px**; en TV **no** se aplica la clase `.focused` → el foco visible es el anillo único `TvFocusRing` de 3px `--focus-color` (intv `#3355FF`) a +4px del elemento; sí aplican las pseudo-clases `:focus`/`:focus-visible` puntuales que se indican).
> Marca de referencia **intv** (`packages/core/src/config/brands/intv.js`). "BRAND:" = valor leído de la config de marca en runtime.
> Área de contenido del Home en TV: `main` en x = **115.2**, ancho **1804.8** × 1080 (sidebar colapsado de 6vw, ver spec 1 §1.2). Los overlays VOD empiezan en `left: var(--home-sidebar-width)` = 115.2 (`_vod.scss:338,1084`).
> En el web, los botones heredan `font-size: 1em` (`global.scss:84-89`) y `border-radius: 8px`; los `em` de tarjetas/botones se resuelven sobre 16px salvo indicación.

---

## 1. Página VOD (`/home/vod` → `src/pages/VodPage.jsx`)

### 1.1 `vod.layout` (BRAND) — qué cambia realmente
- `const vodLayout = currentBrand?.vod?.layout === 'classic' ? 'classic' : 'hero'` (`VodPage.jsx:44`). Cualquier valor ≠ `"classic"` (incluido ausente) = `"hero"`.
- **El layout NO cambia la página**: no existe hero/banner destacado en la grilla de VOD. Solo decide qué **modal de detalle** se abre: `hero` → `VodDetailModal` (§2), `classic` → `VodDetailModalClassic` (§2.6) (`VodPage.jsx:215-230`). Igual en el Buscador (`SearchPage.jsx:465,629-643`).
- intv: `vod.layout: "hero"`. `vod.add` no se usa en el código. De `vod.vodDetail` **solo se lee `contentPosition`** (`VodDetailModal.jsx:100-103`); el resto de claves (`descriptionMaxLength`, `showReleaseYear`, `heroGradientOpacity`, `posterWidthMin/Max`, `categoryTagBackground`, `playButtonColor`, `starRatingColor`, …) **no tienen efecto** (valores hardcodeados en SCSS/JSX, ver §2).

### 1.2 Estructura
```
.home-content-stack (HomeShellContent.jsx:76-101)
 ├─ InicioHeader  ← se monta (homeShell.header.vod=true, header.activado.tv=true) pero intv no tiene áreas → no renderiza nada
 ├─ (sin AdZone: homeShell.ads.vod=false)
 └─ .home-content-outlet
     └─ .vod-page (relative, 100%×100%, flex column, overflow hidden, bg transparent → se ve el fondo del Home)   _vod.scss:8-16
         ├─ .vod-overlay (abs inset 0, sin color, pointer-events none)                                           :18-26
         └─ .vod-container (flex:1 column, padding 1rem = 16)                                                    :98-106
             ├─ header.vod-header (mb 0.5rem = 8) > h1.vod-title "Películas"                                    VodPage.jsx:140-142
             └─ .vod-content (flex:1, overflow-y auto, sin scrollbar) — ÚNICO scroll vertical                    :171-177
                 └─ section.vod-row × N  (h2.vod-row-title + carril horizontal)                                  VodPage.jsx:171-197
```
| Elemento | Estilo TV | px @1080 | Ref |
|---|---|---|---|
| `.vod-title` | 1.85rem, 600, `#fff`, `text-shadow 0 1px 3px rgba(0,0,0,.5)`, margin 0 | **29.6** | `_vod.scss:120-126,1252-1254` |
| `.vod-content` | `padding-bottom 2.85rem`, `scroll-padding-block-end 2rem`, `scroll-behavior:auto` | 45.6 / 32 | `:1246-1251` |
| `.vod-row` | `margin-bottom 1.75rem` | 28 | `:1258-1260` |
| `.vod-row-title` | 1.45rem, 600, `rgba(255,255,255,.95)`, `margin 0 0 .5rem` | **23.2**, mb 8 | `:184-189,1255-1257` |
| Carril TV (`[data-native-horizontal-rail]`, scroll nativo, sin Embla) | `display:flex; align-items:center; overflow-x:auto` (sin scrollbar), `padding: 1.25rem 0`, `padding-inline-end 1.75rem` | 20 arriba/abajo, 28 der. | `:223-238`; `EmblaHorizontalRail.jsx:226-240` |
| Separación entre tarjetas | cada `.vod-card` `margin-left: calc(1rem + .5rem)` (también la 1ª) | **24** | `:235-237` |
| Último row | `padding-bottom 1.5rem` en su carril | 24 | `:1261-1263` |

### 1.3 Contenido y orden de las filas
- Fuente: `usePreload().vod` (`categories`, `allVods`, `status`, `error`). Carga: si `status==='idle'` → `loadVOD(brand,{t})`; si `status==='error'` (1 sola vez por montaje) → `loadVOD(brand,{t, force:true, enableRetry:true})` (`VodPage.jsx:54-64`).
- `categories` = salida de `prepareDataForVOD` (`packages/core/src/services/vodService.js:75-139`): géneros de grupos `type 5/6` con sus vods; el grupo `type 6` (**Recomendados**) se **excluye** (solo va al riel de Inicio); se agrega categoría **"Séries"** (`id 0`, i18n `vod.seriesCategory`) con todos los `isSeries===true` ordenados por nombre; todo ordenado **alfabéticamente por `name`**. Si la librería no trae grupos → una categoría sintética `id -2` "Películas" con las películas por `libraryReleaseDate` desc (`:89-98`).
- Por fila: **máx. 9** `VodCard` (`ITEMS_PER_ROW = 9`) + tarjeta **"Ver más"** (`VodSeeMoreCard`) si la categoría tiene > 9 (`VodPage.jsx:28,181-193`).
- Vacío: `<p class="vod-no-content">` "No hay contenido VOD disponible." `1rem`, `rgba(255,255,255,.7)`, `margin-top 2rem` (`:245-249`).
- Cargando: skeleton barra texto (60%, máx 520) + skeleton card (90%, máx 920 × 180) + "Cargando VOD…" (`VodPage.jsx:144-154`).
- Error: texto `#ffb3b3` + botón "Refrescar página" (`padding .55rem .9rem` = 8.8/14.4, radio 10, borde `1px rgba(255,255,255,.22)`, bg `rgba(255,255,255,.12)`, 600, `#fff`) → `window.location.reload()` (`VodPage.jsx:156-167`; `_vod.scss:128-165`). En RN: re-disparar `loadVOD(force)`.
- Deep-link desde publicidad: `location.state.adOpenVodId` → busca en `allVods` y abre el detalle (`VodPage.jsx:67-80`).

### 1.4 `VodCard` (`src/components/vod/VodCard.jsx`, `_vod.scss:264-325,1264-1276`)
| Parte | TV | px |
|---|---|---|
| Tarjeta (`button.vod-card`) | ancho `14em`, columna, bg transparente, sin borde/padding, texto a la izquierda | **224** de ancho, ≈ 368 alto |
| Póster | alto fijo `21em` (2:3), `border-radius 8px`, `border 2px rgba(255,255,255,.2)`, bg `rgba(40,40,40,.8)`, img `object-fit:cover` | **224×336** |
| Placeholder (sin URL) | `linear-gradient(135deg,#2a2a2a,#1a1a1a)` | — |
| Título | `1.15rem`, `#fff`, `line-height 1.3`, 1 línea con ellipsis, `margin-top .5rem` | **18.4**, mt 8 |
- Imagen: `item.posterListURL || item.posterInfoURL || getVodImageUrl(drm, image1Id, 'posterList')` (`VodCard.jsx:10-13`). Título: `name || title`.
- Foco TV: anillo `TvFocusRing` alrededor de **toda la tarjeta** (póster + título), radio 8+4. **Sin scale** (el `scale(1.05)` y borde `secondaryColor` de `.focused` no aplican en TV, `_vod.scss:311-324`).
- OK (Enter/Space) → `onSelect(item)` → abre detalle (`VodPage.jsx:108-112`).

### 1.5 "Ver más" (`VodSeeMoreCard.jsx`, `_vod.scss:1046-1080,1277-1287`)
Mismo tamaño que `VodCard` (224 × póster 336, mismo borde/fondo). Dentro del póster un **"+"** centrado `3.5em` (= 56px), 700, `rgba(255,255,255,.9)`; debajo título "Ver más" (18.4, como `.vod-card-title`). OK → abre `VodCategoryModal` con **todos** los vods de la categoría.

### 1.6 `VodCategoryModal` (grilla del género) (`src/components/vod/VodCategoryModal.jsx`, `_vod.scss:1082-1200,1300-1340`)
- Overlay `fixed`, `left 115.2`, top/right/bottom 0, `z-index 100`, `padding 1rem`, bg `rgba(0,0,0,.8)`, contenido centrado.
- Panel: 100%×100% con `max-width 95vw`, `max-height 95vh` → ≈ **1772.8 × 1026**; bg `rgba(28,28,28,.98)`, radio 12, borde `2px rgba(255,255,255,.15)`, `box-shadow 0 20px 60px rgba(0,0,0,.6)`.
- Header: flex `space-between`, `padding 1rem 3rem` (16/48), `border-bottom 1px rgba(255,255,255,.1)`. Título = nombre del género `1.75rem` (**28**) 600 `#fff`. Botón **"Cerrar"** (texto en TV; ícono X en PC): `min-height 48`, `padding-inline 1.5rem` (24), `1.15rem` (18.4) 600, `#fff`, bg `rgba(255,255,255,.15)`, borde `1px rgba(255,255,255,.3)`, radio 8.
- Grilla: `grid` columnas fijas de **224** (`auto-fill`), `justify-content: space-evenly`, `gap 1.25rem` (20), `padding 1.5rem 3rem 2rem` (24/48/32), alto `80vh` (**864**) con `overflow-y:auto` sin scrollbar → **6 columnas** a 1080p. Tarjetas = `VodCard` idénticas a §1.4.
- Foco: al abrir, primer card de la grilla (`focusFirstIn('.vod-category-grid')`); zona modal en `FocusManager` (foco confinado). UP desde la 1ª fila → "Cerrar" (geometría). **BACK** → cierra y el `FocusManager.pop` devuelve el foco a la tarjeta "Ver más". OK sobre un card → abre el detalle **encima** del modal (el modal de género queda abierto); al cerrar el detalle se vuelve a la grilla (`VodPage.jsx:114-118`).

### 1.7 Foco y teclas en la página
| Tecla | Comportamiento | Ref |
|---|---|---|
| Foco inicial | primer enfocable de `.vod-page .vod-content` (1ª tarjeta de la 1ª fila) cuando cambia `status`/nº de categorías | `VodPage.jsx:52`; `useTvInitialFocus.js:19-28` |
| RIGHT | **confinado a la fila actual** (`moveFocus('right', row)`); en la última tarjeta ("Ver más") se consume sin moverse | `VodPage.jsx:93-105` |
| LEFT | geometría; desde la 1ª tarjeta entra al sidebar | — |
| UP / DOWN | geometría entre filas; auto-scroll vertical/horizontal con margen 20px, sin animación (`scroll-margin-inline .75rem 1.25rem`, `scroll-margin-block .35rem` en la card) | `_vod.scss:1266-1268`; spec 1 §0 |
| OK | abre detalle (o grilla en "Ver más") | — |
| BACK | sin modal: `navigate(-1)` (HomeInputDispatcher, spec 1 §1.6); con modal: cierra el modal superior | — |
| Volver del player | el detalle sigue abierto y re-enfoca "Reproducir" (§2.5) | `HomePage.jsx:123-132` |

---

## 2. `VodDetailModal` (layout `hero`) — `src/components/vod/VodDetailModal.jsx`, `_vod.scss:336-756,1342-1414`

### 2.1 Capas
```
.vod-detail-overlay  fixed, left 115.2, top/right/bottom 0, z 100, bg rgba(0,0,0,.85)          _vod.scss:336-348
 ├─ .vod-detail-backdrop (abs inset 0; click → cerrar)
 └─ .vod-detail-modal.vod-detail-hero-layout  100% × 100% (1804.8 × 1080), sin radio/borde      :356-366
     ├─ .vod-detail-hero  abs inset 0, bg #111, background-image = item.backgroundImageURL,
     │                    size cover, position center top, no-repeat                              :368-375; jsx:118,252-257
     │    └─ .vod-detail-hero-gradient  linear-gradient(to top, rgba(0,0,0,.95) 0%, rgba(0,0,0,.6) 30%, transparent 60%)   :377-382
     ├─ (botón Cerrar: solo PC o modo infoOnly desde el player — en TV NO hay botón cerrar, se usa BACK)   jsx:260-271
     └─ .vod-detail-content  abs inset 0, padding 2rem 2.5rem 2.5rem (32/40/40), column, gap 1.25rem (20),
                             overflow-y auto sin scrollbar; justify según BRAND vod.vodDetail.contentPosition
                             (top→flex-start, middle→center, bottom/def→flex-end; intv "bottom")    :409-434
         ├─ .vod-detail-content-inner (row): [póster] [info]
         └─ .vod-detail-episodes (solo series)
```
### 2.2 Imágenes
| Uso | Campo (orden de prioridad) | Plantilla por defecto (`vodService.js:15-19`) |
|---|---|---|
| Fondo hero | `backgroundImageURL` (de `image3Id`); si no hay → fondo `#111` | `${drm}/cv_data_pub/images/{image3Id}/v/original.jpg` |
| Póster | `posterInfoURL` → `posterListURL` → `getVodImageUrl(drm,image1Id,'posterInfo')` | `…/{image1Id}/v/vod_poster_info.jpg` (list: `vod_poster_list.jpg`) |
| `extraImageURL` (`image2Id`, original) | **no se usa en hero** (solo classic) | `…/{image2Id}/v/original.jpg` |
`drm` = BRAND `drm`; plantillas sobreescribibles con BRAND `vod.imageUrlTemplates` (`vodService.js:149-150`).

### 2.3 Bloque póster + info (TV)
| Elemento | Estilo | px @1080 | Ref |
|---|---|---|---|
| Póster `.vod-detail-poster-wrap` | ancho `18em`, 2:3, radio 8, borde `2px rgba(255,255,255,.15)`, `box-shadow 0 8px 32px rgba(0,0,0,.5)`, bg `#1a1a1a`, img `object-fit: fill`; `margin-right 2rem` | **288×432**, mr 32 | `:449-465,1346-1349` |
| Columna info | `flex:1`, columna, `justify-content: space-around` | — | `:473-480` |
| Título | `2.5rem` 700 `#fff`, `text-shadow 0 2px 8px rgba(0,0,0,.6)`, mb .5rem | **40**, mb 8 | `:482-488,1350-1352` |
| Fila meta | flex-wrap, hijos con `margin-right 1.25rem` y `margin-bottom .75rem`; fila mb .75rem | 20 / 12 / 12 | `:490-496,1353-1359` |
| Ítem meta | `1.45rem`, `rgba(255,255,255,.9)`, padding `.15em .4em` | **23.2** (pad 3.5/9.3) | `:498-502,1373-1377` |
- Orden de la fila meta (`jsx:285-311`):
  1. **Año**: 4 primeros dígitos de `libraryReleaseDate` (`/^(\d{4})/`).
  2. **Duración**: `floor(duration/60)` + " min" (`duration` en **segundos**; se oculta si ≤ 0).
  3. **Clasificación**: `parentalRating` como badge `"+N"` (antepone `+` si falta): borde `1px rgba(255,255,255,.5)`, radio 4, 600 (`:504-512`).
  4. **Géneros**: chips con `categoryName` / `categoryNames[]` / nombres de `item.categories` resueltos contra `categories` de la página (solo géneros; los ids de actor/director no matchean). Chip: bg `rgba(255,255,255,.12)`, borde `1px rgba(255,255,255,.2)`, radio 4, padding `.2em .5em`, separación 5.6 (`:521-529,1360-1366`).
  5. **Estrellas** (si `rating > 0`): `rating/10` sobre 5; estrella `1em` (23.2) con `clip-path` de estrella; llena = `var(--secondary-color)` (intv `#0023d0`), vacía `rgba(255,255,255,.3)`, media = gradiente 50/50; separación 2.4 (`:537-551,1367-1372`). (No depende de `features.showRating`.)
- **Dirección** (fila extra, `marginTop 10`): un chip "Dirección: A, B" y **Reparto** (`marginTop 6`): chip "Reparto: …". Fuentes: `directorNames`/`actorNames` (enriquecidos en `loadVODData` desde grupos de categoría `type 7`/"Direção" y `type 3`/"Actor", `vodService.js:166-221`) + `cast/actors/actor/elenco` y `directors/director/diretor/direction`; si el item trae `customDataUrl` se hace `fetch` del JSON y se usa ese objeto como fuente (`jsx:149-202`).
- **Descripción** (`item.description || seriesInfo.description`): `1.2rem` (**19.2**), `line-height 1.5`, `rgba(255,255,255,.9)`; contenedor `max-width 90%`, mb 12. Si > **180** caracteres (constante `DESCRIPTION_MAX_LENGTH`, no BRAND) se corta + "…" y aparece botón **"Leer más" / "Leer menos"**: texto subrayado `1.1rem` (17.6) `rgba(255,255,255,.85)`, sin fondo/padding, mt 5.6; enfocable (re-sincroniza el anillo al cambiar de tamaño) (`jsx:106-111,329-343`; `:553-575`).
- Error `#e57373` 14.4; "Cargando VOD…" mientras se piden los episodios.
- **Botón "Reproducir"** (`#vod-detail-play`): ícono play 18 + texto, `padding .65rem 1.5rem` (10.4/24), `1.3rem` (**20.8**) 600, bg `var(--primary-color)` (intv `#011266`), `#fff`, radio 6, sin borde; contenedor con márgenes `0 6px 12px` y mt 4. `:focus-visible` agrega `outline 2px rgba(255,255,255,.9)` offset 2 (`:592-640`).

### 2.4 Episodios (solo `isSeries === true`)
- Al abrir: `panaccessService.getVodSeriesInfo({ seriesId: item.id, enableRetry:false })` → `episodes = data.episodes ?? data.seasons.flatMap(s => s.episodes) ?? []` (`jsx:204-225`). Campos usados del episodio: `id ?? vodId`, `name ?? title ?? episodeTitle ?? "Episode N"`, `posterListURL ?? getVodImageUrl(drm,image1Id,'posterList')`, `duration` (seg).
- Sección `.vod-detail-episodes` (mt 8): título "Episodios" `1.4rem` (22.4) 600 `#fff` mb 12; **lista horizontal** con scroll-x sin scrollbar, separación 16, pb 8 (`:642-670,1385-1387`).
- Tarjeta episodio `.vod-episode-btn`: **160px** ancho, columna, bg `rgba(255,255,255,.08)`, borde `2px rgba(255,255,255,.2)`, radio 8, overflow hidden. Thumb 16:9 (**160×90**) bg `#1a1a1a`, img cover, ícono play 16 centrado (`rgba(255,255,255,.9)`, sombra). Info padding 8/9.6: nombre `1.05rem` (16.8) 500 ellipsis; duración "N min" `.95rem` (15.2) `rgba(255,255,255,.65)` (`:675-756,1388-1393`).
- "Reproducir" en serie = reproduce **el 1er episodio**; si la serie vino sin episodios se muestra además un 2º botón "Reproducir" (fallback, sin id) que no hace nada útil (`jsx:239-245,382-396`).

### 2.5 Foco y teclas
- Zona modal en `FocusManager` (foco confinado al overlay; LRUD por geometría) (`jsx:57-71`).
- **Foco inicial**: 400ms después de terminar de cargar → `#vod-detail-play` (`jsx:73-80`). Orden visual: UP desde Reproducir → "Leer más" (si existe); DOWN → fila de episodios; LEFT/RIGHT entre episodios.
- **OK** en Reproducir/episodio → reproduce (§3). El modal **no se cierra** al reproducir desde la página VOD; el player se superpone.
- **BACK**: si el player está activo, lo maneja el HUD (cierra el player); si no → `onClose` y el foco vuelve a la tarjeta de origen (o a la grilla del género).
- Al cerrar el player: 400ms → foco de nuevo en `#vod-detail-play` (`jsx:83-98`); HomePage no restaura foco del shell si hay detalle VOD abierto (`HomePage.jsx:128`).
- Modo `infoOnly` (info desde el player): sin botones de reproducir/episodios, con botón cerrar `#player-vod-info-close` enfocado.

### 2.6 Layout `classic` (`VodDetailModalClassic.jsx`, `_vod.scss:758-1044,1416-1478`) — breve
- Pantalla completa (desde x=115.2) bg `rgba(20,20,20,.98)`, padding 24, sin hero ni gradiente. Sin botón cerrar en TV.
- **Película**: franja superior `flex 0 0 55%` (TV): columna izquierda 40% (mr 24) con póster `object-fit: contain` (`extraImageURL` → `posterInfoURL` → `posterListURL` → image1/2/3) y **botón play circular** 100×100 centrado encima (bg `rgba(233,233,233,.5)`, ícono `#333`, `#vod-classic-play`, foco inicial a 400ms). Derecha: título `2.1rem` (33.6) 600; géneros unidos por coma `1.2rem` (19.2) `rgba(255,255,255,.8)`; duración (600) + 5 estrellas `1.1em`; Dirección/Reparto con `<strong>`; descripción completa `1.25rem` (20). Mitad inferior vacía ("Parecidos", min 80).
- **Serie**: dos columnas: izquierda 55% (mr 24) = póster (58% alto) + info; derecha 45% = "Episodios" `1.35rem` (21.6) centrado + **lista vertical** de botones (play 16 + nombre ellipsis), `1.15rem` (18.4), padding 9.6/12, bg `rgba(255,255,255,.08)`, borde `1px rgba(255,255,255,.2)`, radio `3rem` (píldora), mb 8. BACK → cerrar.

---

## 3. Inicio de reproducción VOD

1. Detalle → `handlePlay(vodItem)` (`VodDetailModal.jsx:227-237`; idéntico en classic):
   ```js
   const vodId = vodItem?.id ?? vodItem?.vodId;
   const url = panaccessService.getVodM3u8Url({ vodId });
   onPlay({ type: 'vod', id: vodId, url, item: vodItem, autoPlay: true });
   ```
   Para series `vodItem` = el **episodio** (`id` del episodio = vodId reproducible).
2. URL (`packages/core/src/services/panaccessService.js:722-730`):
   `${client.baseUrl sin "/" final}/index.php?requestMode=function&f=getVodM3u8&plain=true&vodId=${vodId}&sessionId=${sessionId}&m3u8`
   con `sessionId = userSession.getSessionId() || client.sessionId || ''` (sin `encodeURIComponent`). Lanza si el servicio no está inicializado (→ `setError(vod.errorPlay)`).
3. Gate parental (página VOD `VodPage.jsx:124-134`; buscador `SearchPage.jsx:468-478`):
   `requestPlayMedia({ item, ratingRaw: item.parentalRating, title: t('parental.restrictedTitle'), message: t('parental.restrictedMessage'), playFn: () => play(params) })`.
   `parentalGateStore.requestPlayMedia` (`packages/core/src/store/parentalGateStore.js:259-300`) llama `playFn` directo si: control parental deshabilitado por marca (`account.sections.parentalControl`), o deshabilitado por el usuario, o sin PIN, o `ratingEnabled !== true`, o rating ≤ `ratingAllowedMax` (def. 18), o ya desbloqueado; si no, pide PIN.
   Diferencia: en **Buscador** el detalle se **cierra** antes de reproducir; en **VodPage** queda abierto debajo del player.
4. `PlayerContext.play({ type:'vod', id, url, item, autoPlay:true, mediaOption:{}, drmConfig:{} })` (`src/contexts/PlayerContext.jsx:535-605`): re-normaliza la URL con `panaccessService.normalizePlaybackUrl(url)` (reemplaza `sessionId=` por el actual, `:789+`); si es el mismo contenido (type+id+url) solo hace `engine.play()`; si no, resetea estado (`currentTime 0`, `duration 0`, pistas vacías), `telemetryService.recordSwitch`, y `engine.load(url, { type:'vod', autoPlay, mediaOption, drmConfig })`.
   - **No hay resume / posición guardada**: siempre arranca en 0 (no existe persistencia de progreso VOD en el código).
   - La restauración de pistas guardadas solo aplica a `type 'service'` (`PlayerContext.jsx:240`).
   - HUD para VOD: botones de playback y **seekbar siempre visibles** (`PlayerHud.jsx:690-694,919-922`), ver spec 1 §4.
5. `getVodSeriesInfo` (`panaccessService.js:682-695`): `callAuthenticatedApi('getVodSeriesInfo', { seriesId })` (sessionId lo inyecta `callAuthenticatedApi`). Forma consumida: `{ description?, episodes?: Episode[] } | { seasons: [{ episodes: Episode[] }] }`; no se muestra selector de temporadas (se aplanan).
6. Catálogo (`loadVODData`, `vodService.js:147-226`): `getVodLibraries()` → `library.categoryGroups` (géneros `type 5`, recomendados `type 6`, actores `type 3`, directores `type 7`) → `getVodContent({offset, limit:100})` paginado hasta offset 1000 → `prepareDataForVOD` (agrega `posterListURL/posterInfoURL` de `image1Id`, `extraImageURL` de `image2Id`, `backgroundImageURL` de `image3Id`, `baseImageUrl`). Timeout de seguridad en `preloadStore.loadVOD` (`preloadStore.js:376-420`).

---

## 4. Buscador (`/home/buscador` → `src/pages/SearchPage.jsx`, `_search.scss`)

### 4.1 Estructura y medidas (sin InicioHeader ni ads)
```
.search-page  abs inset 0 del outlet (1804.8×1080), z 10                         _search.scss:4-10
 ├─ .search-overlay  abs inset 0, bg var(--search-overlay-bg)                     :11-16
 └─ .search-container  abs, inset clamp(8px,1.2vmin,18px)=12.96; padding clamp(12px,1.8vmin,24px)=19.44;
                       bg var(--search-panel-bg); radio 10; flex column; overflow hidden   :23-53
     ├─ .search-header  flex row, bg --search-header-bg, color --search-header-text, radio 5, padding 10, mb 12   :55-75
     │    ├─ input#search-input-tv.search-input  (FocusableInput, readOnly en TV)
     │    └─ button#search-clear-btn.search-clear "Limpiar"   (mr 10 entre ambos)
     ├─ .search-tabs  (si hay query y ≥1 categoría con resultados)
     └─ .search-results  flex:1, overflow-y auto (sin scrollbar), bg --search-results-area-bg, radio 10; TV padding 14 16
          ├─ .search-count  "N resultados"
          └─ (tab Todos) .search-section × 4 ó (tab X) .search-list
```
| Elemento | Estilo (TV) | Colores intv (BRAND `ui.search.*`, mapeo `src/utils/config.js:145-190`) |
|---|---|---|
| Overlay / panel | — | overlay `rgba(0,0,0,.35)`; panel `rgba(248,249,255,.98)` |
| Header | radio 5, padding 10 | bg `#e8ebff`, texto `#1a1a2e` |
| Input | `1.5rem` (**24**), alto `2.6em` (**62.4**), padding `0 10px`, radio 8, borde 2 transparente (`:77-104`) | bg `rgba(255,255,255,.85)`, texto `#1a1a2e`, placeholder `rgba(26,26,46,.45)`; **:focus**: bg `#fff`, borde `#3355FF`, `box-shadow 0 0 0 2px rgba(51,85,255,.35)` |
| Limpiar | `padding 10px 20px`, `1.1rem` (17.6) 600, radio 8, borde 2px (`:106-140`) | bg `#dc3545`, texto `#fff`, borde `rgba(255,255,255,.18)`; :focus borde `--focus-color #3355FF` + halo 2px; hover `#c82333` |
| Tabs | contenedor centrado, wrap, `min-height 4.5rem` (72), mb 16; cada tab píldora (radio 999) `1.45rem` (**23.2**), `padding 12px 26px`, separación der. 24 / abajo 13.6 (`:158-205,207-232`) | bg `rgba(51,85,255,.1)`, texto `rgba(26,26,46,.85)`; :focus `rgba(51,85,255,.18)`; activa `#3355FF`/`#fff`; activa+foco `#2244dd` |
| Contador | `1.5rem` (24) 600, mb 12, padding 0 6 | `rgba(26,26,46,.55)` |
| Vacío | `1.4rem` (22.4), centrado, padding 16 8: "Escribe para buscar" / "No se encontraron resultados." | `rgba(26,26,46,.75)` |
| Título de sección | `1.75rem` (**28**) 700, padding 10 16, radio 8, mb 8; secciones separadas 10 | texto `#1a1a2e`, bg `rgba(51,85,255,.08)` |
| Grilla `.search-list` | **6 columnas** iguales, `gap 10px` → ≈ **276** de ancho por tarjeta (`:343-354`) | — |
| Tarjeta `.search-result` | columna centrada, padding `12px 14px`, radio 10, borde 1px, `min-height 24rem` (**384**), alto auto, texto centrado; **:focus** → bg hover, borde foco, `scale(1.04)` (aplica en TV porque es `:focus`) (`:356-385,250-254`) | bg `#ffffff`, borde `#d0d5f0`; foco bg `#f0f2ff`, borde `#3355FF` |
| Imagen | ancho 100%, alto `13.5em` (**216**), `object-fit: contain`, radio 5; EPG `7.5em` (120); placeholder 9em (144) (`:387-410`) | bg `rgba(51,85,255,.06)` |
| Nombre (canal/VOD/catchup) | `1.5rem` (**24**), `line-height 1.35`, máx 2 líneas, mt 8; LCN delante `0.85em` 700 opac .75 mr 4 | `#1a1a2e` |
| Meta VOD (`Actor: X` / `Dirección: X` / `Año: 2020`) | `1.3rem` (20.8), 1 línea ellipsis, mt 4 — solo si el título no matcheó | `rgba(26,26,46,.65)` |
| EPG | fila canal "LCN Nombre" (20.8, nombre 600 2 líneas) + título del evento 24 700 (3 líneas) + "dd/mm/aaaa HH:mm - HH:mm" 20.8 | meta `rgba(26,26,46,.65)` |
Imagen con fallbacks en `onError`: EPG → logo del canal; VOD serie → `vodPosterFallback`; luego placeholder de marca (`useBrandPlaceholderUrl`, intv `placeholder_220x160.png`) (`SearchPage.jsx:35-90`).

### 4.2 Qué se busca (`packages/core/src/services/searchService.js:307-390`)
`searchAll({ query: debouncedQuery, services: epg.streams, vods: vod.allVods, catchupGroups: catchup.groups, vodDrmBaseUrl: brand.drm })` — búsqueda **local** sobre datos precargados, `toLowerCase` + `indexOf` (sin quitar acentos), mínimo 1 carácter, debounce **300ms** (`getSearchDebounceMs`), resultados ordenados por relevancia desc y deduplicados por `type:id`.
| Tipo | Campos | Relevancia | Imagen (`logo`) |
|---|---|---|---|
| `service` (canal) | `name`/`title` y **LCN** | max(texto, LCN: exacto 600 / prefijo 400 / contiene 150) | `img || logo` |
| `vod` | título; `actorNames`; `directorNames`; año (query de 4 dígitos = año de `libraryReleaseDate` → 430) | texto; actor/director ×0.82 | películas: `backgroundImageURL → posterInfoURL → posterListURL → extraImageURL → img → image1/2/3`; series: background (fallback posterInfo) |
| `catchup` | nombre del evento en `catchup.groups[].events` | texto | `imageUrl/imageUrl2/catchupImageUrl/img/posterUrl` |
| `epg` | título de eventos **en curso o futuros** de `stream.epgItems` | texto | imagen del evento → logo canal |
Texto: exacto +1000, prefijo +500, contiene +100, +50 por palabra igual, +25 por palabra con prefijo, −len/10.
- **intv**: `EPG.enabled=false` → los resultados `epg` se descartan y no aparece la tab EPG (`SearchPage.jsx:156,233`). `catchup.enabled=true` → sí catchup. Al entrar se dispara `loadVOD` / `loadCatchup` si están `idle` (`:207-211`).
- Tabs (orden): **Todos** (oculta si < 2 categorías con resultados), **Canales** (`search.tabServices`), EPG, VOD, Catchup; cada una oculta si no tiene resultados (`:237-245,507-515`). En "Todos" las secciones van en orden Canales → VOD → Catchup → EPG. Tab inexistente → cae a "Todos".
- Estado de sesión (`useSearchSessionStore`, zustand en memoria, `packages/core/src/store/searchSessionStore.js`): `query`, `activeTab`, `focusedResultKey` (`"type:id"`) persisten al salir y volver; TTL 1h (`isExpired` → reset al entrar); se resetea si cambia la marca, al logout, y se borra `focusedResultKey` si cambia el catálogo.

### 4.3 Entrada de texto en TV: `FocusableInput` + `VirtualKeyboard`
- En TV el `<input>` es **readOnly** (no abre IME). **OK** sobre el input → `showKeyboard({ title: placeholder ("Canales, Categoría o Programa"), type:'text', mask:false, initialValue })` (`src/components/navigation/FocusableInput.jsx:53-100`; `src/contexts/OsdKeyboardContext.jsx`). La query se actualiza **solo al confirmar** (OK del teclado) → debounce 300ms → resultados; Cancelar/BACK no cambia nada. Al cerrar, foco vuelve al input.
- `VirtualKeyboard` (`src/components/navigation/VirtualKeyboard.jsx`, `src/styles/components/_virtual-keyboard.scss`), overlay propio a pantalla completa:
| Parte | Estilo | px @1080 |
|---|---|---|
| Overlay | `fixed inset 0`, z 9999, centrado, padding `clamp(.75rem,2.5vmin,2rem)`, bg `rgba(6,7,10,.94)`, texto `#fff` | padding 27 |
| Caja | ancho 90%, `max-height 94vh`, bg `#16171c`, borde `1px rgba(255,255,255,.1)`, radio `clamp(.85rem,1.8vmin,1.5rem)`, padding `clamp(1.5rem,4.5vmin,3rem)`, sombra `0 1.2vmin 3.5vmin rgba(0,0,0,.45)` | ≈1679 ancho, radio 19.4, padding 48 |
| Título | `clamp(1.4rem,3.6vmin,2.25rem)` 600, `rgba(255,255,255,.85)`, centrado, `letter-spacing .03em`, mb `clamp(1rem,2.8vmin,2rem)` | 36, mb 30.2 |
| Preview | alto `clamp(4rem,8.5vmin,6.5rem)`, bg `rgba(0,0,0,.4)`, borde `2px rgba(255,255,255,.14)`, radio 12.96, texto `clamp(1.65rem,4.5vmin,2.85rem)` 500 centrado `letter-spacing .06em`; caret 3px × `clamp(1.8rem,5vmin,3rem)` color `--focus-color` parpadeo 1s; mb 37.8 | alto 91.8, texto 45.6, caret 48 |
| Grilla | padding 32.4, bg `rgba(0,0,0,.22)`, borde `1px rgba(255,255,255,.06)`, radio 15.1; filas separadas 18.36; teclas separadas 16.2 | — |
| Tecla | `flex:1`, alto `clamp(4.25rem,8.8vmin,6.9rem)`, bg `rgba(255,255,255,.08)`, borde `1px rgba(255,255,255,.1)`, radio 10.8, `clamp(1.7rem,4.4vmin,2.9rem)` 500; **:focus** bg `#fff`, texto `#0d0d0f`, 700, `scale(1.05)` | alto 95, texto 46.4 |
| Fila acciones | mt 12.96 + `border-top 1px rgba(255,255,255,.07)` + pt 18.36; teclas separadas 15.1; texto `clamp(1.25rem,3.4vmin,2.1rem)` 600 `rgba(255,255,255,.78)`, bg `rgba(255,255,255,.05)`; :focus bg `--focus-color`/#fff; activa (Mayús on) igual; "× Todo" deshabilitado opac .4 | texto 33.6 |
| Pesos flex acciones | `#+=`/ABC 1.15 · `⇧ Mayús` 1.15 · `[ Espacio ]` 2.4 · `◄` 0.85 · `►` 0.85 · `⌫ Borrar` 1.3 · `× Todo` 1.3 · `Cancelar` 1.3 (bg `rgba(239,71,111,.16)`, borde `.3`, texto `#ff9fb3`; foco `#ef476f`) · `OK` 1.3 (bg `rgba(6,214,160,.16)`, texto `#74f0cc`; foco `#06d6a0`/`#0d1a16`) | — |
- Layouts 4×10 por idioma de i18n (es: fila 3 termina en `ñ`, fila 4 `… m @ . _`; en; pt con `ç`) + layout de símbolos 4×10; teclado numérico 3×4 (`1-9`, `Cancelar 0 OK`, caja `min(78vw,58vmin)` = 626) solo para `inputMode="numeric"` (`VirtualKeyboard.jsx:6-41`).
- Navegación propia por fila/columna (no geométrica): LEFT/RIGHT sin wrap; DOWN desde la fila 4 baja a la acción según columna (`0→#+=, 1→Mayús, 2-3→Espacio, 4→◄, 5→►, 6→Borrar, 7→Todo, 8→Cancelar, 9→OK`), UP vuelve a la columna mapeada. OK = pulsar tecla; ◄/► mueven el caret; BACK/Escape (o Backspace con valor vacío) = cancelar. Foco inicial: tecla `1` (fila 0 col 0) (`:274-384`).

### 4.4 Foco y teclas en el Buscador (`src/hooks/useSearchPageTvNav.js`)
| Situación | Comportamiento |
|---|---|
| Foco inicial / al volver | si hay `focusedResultKey` y resultados → ese resultado (con scroll); si no → el **input** (reintenta 30 frames) (`:74-122`) |
| En el input | **LEFT** → ítem "Buscador" del sidebar; **RIGHT** → "Limpiar"; **DOWN** → 1ª tab visible o 1er resultado; UP no hace nada; **OK** → teclado OSD (`:125-150`) |
| Tabs / resultados | navegación por geometría (6 columnas); cada foco en un resultado hace scroll dentro de `.search-container` y guarda su key (`:153-174`) |
| OK en tab | cambia `activeTab` (no cambia el foco) |
| OK en Limpiar | `setQuery('')` → vuelve el estado "Escribe para buscar" |
| BACK | `navigate(-1)` (el input readOnly no cuenta como editable); con modal abierto cierra el modal. `Escape` sobre el input además limpia la query (`SearchPage.jsx:490-495`) |
| OK en resultado | `service` → URL `channel.url/streamUrl/hlsUrl/hls` o `getStreamM3u8Url({streamId})` → `normalizePlaybackUrl` → `requestPlayChannel({channel, playFn: play({type:'service', id, url, item: channel})})`; `vod` → abre `VodDetailModal` (layout según BRAND) con `item.raw`; `catchup` → `EpgEventModal` (`detailContext="catchup"`, "Ver" → `getCatchupM3u8Url({catchupId})` + `requestPlayMedia` + `play({type:'catchup'})`); `epg` → `EpgEventModal` (Ver en vivo / Ver catchup) (`SearchPage.jsx:291-458,603-643`) |

---

## 5. Mi Cuenta (`/home/mi-cuenta` → `src/pages/MiCuentaPage.jsx`, `_mi-cuenta.scss`)

### 5.1 Qué se muestra en TV para intv
Layout de dos columnas: **menú** (nav izquierda) + **contenido**. En TV **siempre QR** para los links (los paneles nativos `ChangePasswordPanel`/`LinkedDevicesPanel`/`CloseAccountPanel` solo en PC con `login.deviceSession.enabled`, `MiCuentaPage.jsx:60`). **No hay selector de idioma** en la app (idioma = `localStorage app_language` → idioma del sistema → `es`, `packages/core/src/locales/i18n.js:20-37`). No se muestra nombre de suscriptor ni lista de licencias (solo smartcard activa en "Acerca de").

Menú (en orden), flags BRAND `account.links.*.enabled` (≠ false → visible, aun sin URL) y `account.sections.*` (default true):
| # | Ítem | Flag intv | Acción (OK) |
|---|---|---|---|
| Título | "Mi cuenta" | — | — |
| 1 | Cambiar contraseña | `links.changePassword` enabled, url `https://backend.wind.do/wind/login/` | selecciona → QR de la URL |
| 2 | Dispositivos vinculados | `links.linkedDevices` enabled, url `""` | selecciona → caja QR con "Esta marca aún no configuró este enlace." |
| 3 | Suscripción | `links.subscription` enabled, url `""` | ídem |
| — | divisor | | |
| 4 | (Cambiar perfil) | `features.profiles` = false → oculto | `navigate('/profile')` |
| 5 | Control parental | `sections.parentalControl` true | `navigate('/home/control-parental')` (ParentalSettingsPage) |
| 6 | (Mensajes) | `features.osms` = false → oculto | inline (`osmsInline`) o `/home/osms` |
| 7 | Acerca de la App | `sections.about` true | selecciona → lista "Acerca de" |
| 8 | Refrescar | `sections.refresh` true | `navigate('/preload?redirect=/home/mi-cuenta')` (recarga EPG/VOD/catchup/ads) |
| 9 | Eliminar cuenta | `links.deleteAccount` enabled, url `""` | selecciona → QR/aviso (sin estilo danger en el menú) |
| 10 | Cerrar sesión | `sections.logout` true | ConfirmModal → `clearSessionBeforeNewLogin()` + `navigate('/login', {replace:true})` |
| 11 | Salir | `sections.exitApp` true (**solo TV**), clase `danger` | ConfirmModal → `exitAppBestEffort()` (Tizen exit / `window.close`; en RN: `BackHandler.exitApp()`) |
Ítem seleccionado inicial: 1er link (`changePassword`); si no hay links, "Acerca de" (`:120-135`). La selección cambia **solo con OK** (no con foco).

Contenido:
- Reloj `HH:mm` (`useDeviceTime`, locale `ui.locale`) arriba a la derecha.
- Link seleccionado: título = label; fila `[caja QR] [pasos 1-2-3]`: "1 Abra la cámara de su smartphone o tablet." / "2 Escanea el código QR que aparece en pantalla." / "3 <texto específico del link>" (`account.step3*`). QR generado con `QRCode.toDataURL(url, { width:256, margin:1 })` (`:142-158,324-350`).
- "Acerca de la App": filas `[label, valor]` no vacías: App (`appName` "inTV Play"), Marca (`brand`), Versión (`version` "2.0.2" o env), Usuario (`getCredentials().username`), Smartcard (`getActiveLicense().licenseKey`), Desarrollado por (`developedBy` — intv trae la entidad HTML literal `"inTV&#174,"`, decodificar a "inTV®"), Zona horaria (`Intl…timeZone`) (`:160-179`).

### 5.2 Estilos TV (`_mi-cuenta.scss`; colores BRAND `account.theme` → `--account-*`, `src/utils/config.js:200-214`)
| Elemento | Estilo | px @1080 | intv |
|---|---|---|---|
| `.mi-cuenta-page` | flex row, `min-height 100%`, `max-height 100vh`, overflow-y auto sin scrollbar, `box-shadow 0 18px 40px rgba(0,0,0,.18)` (`:14-26`) | 1804.8 × 1080 | — |
| Menú `.mi-cuenta-sidebar` | font base TV `clamp(1.2rem,2.5vh,1.8rem)`, `min-width 18em`, padding `1.35em 1em`, columna, `border-right 1px rgba(255,255,255,.08)`; hijos mb .15em (`:28-44,274-282`) | base **27**, ancho ≥ **486**, pad 36.5/27 | bg `#0b2a4a` |
| Título menú | `1.35em` 700, margin `.25em .6em 1em` (`:46-51`) | **36.5**, mb 27 | `rgba(255,255,255,.88)` |
| Divisor | 1px, margin `.85em .6em` (`:63-67`) | 23 / 16.2 | `rgba(255,255,255,.18)` |
| Ítem `.mi-cuenta-item` | texto izq., `.98em`, padding `.7em .9em`, radio `.75em`, sin borde, bg transparente; separación .15em; `:focus-visible` bg `rgba(255,255,255,.08)` (`:69-85`) | **26.5**, pad 18.5/23.8, radio 19.8, sep ≈4 | texto `rgba(255,255,255,.88)` |
| Ítem activo | bg activo, texto activo, 600 (`:87-91`) | — | bg `#5c8fc4`, texto `#fff` |
| Ítem danger ("Salir") | color danger; activo: bg danger / texto `#1a1a1a` (`:93-100`) | — | `#ff8080` |
| Contenido | `flex:1`, relativo, padding `clamp(18px,2.6vmin,30px) clamp(22px,3.2vmin,38px) clamp(20px,2.8vmin,32px)` (`:102-120`) | 28.1 / 34.6 / 30.2 | bg `#061a2e`, texto `rgba(255,255,255,.88)` |
| Reloj | abs `top clamp(14px,2vmin,24px)`, `right clamp(18px,2.6vmin,32px)`, `clamp(1.1rem,1.9vmin,1.4rem)`, tabular-nums, opac .9 (`:122-133`) | top 21.6, right 28.1, **20.5** | — |
| Título contenido | `clamp(1.2rem,2.1vmin,1.55rem)` 700, mb 28, `padding-right` reserva reloj `clamp(70px,9vmin,110px)` (`:135-146`) | **22.7**, pr 97.2 | `#8fb9e8` |
| Fila QR | flex wrap `space-evenly`, hijos `margin 0 0 40px 40px` (`:148-158`) | — | — |
| Caja QR | `13em` × `13em`, radio 14, contain (`:160-177`) | **208×208** | bg `#9dc3ec` |
| Aviso sin URL | padding 16, centrado, `.85rem`, `rgba(10,20,30,.65)` (`:179-184`) | 13.6 | — |
| Pasos | columna `max-width 28em`, separación 18, `line-height 1.4`; número círculo 26×26, `.8rem` 700, mr 14 (`:186-222`) | texto 16, máx 448, num 12.8 | círculo bg `#12365c`, texto `#fff` |
| Lista "Acerca de" | `max-width 34em`, filas `padding 10px 14px`, radio 10, bg `rgba(255,255,255,.06)`, separación 10; label opac .75; valor 600 der. (`:224-258`) | máx 544, texto 16 | — |
Nota: el contenido (QR, pasos, acerca de) **no** tiene escalado TV (queda en 16px); en RN conviene escalar a la par del menú.

### 5.3 ConfirmModal (Cerrar sesión / Salir) (`src/components/ConfirmModal.jsx`, `_confirm-modal.scss`)
- Portal al body: overlay `fixed inset 0`, bg `rgba(0,0,0,.7)`, z 2000, padding 16, centrado. Caja `max-width 520`, bg `rgba(42,42,42,.95)`, radio 12, borde `2px rgba(255,255,255,.2)`, padding 24.
- Título 16 500 `#fff` centrado ("Cerrar sesión" / "Salir"); mensaje `rgba(255,255,255,.9)` 300 centrado ("¿Deseas cerrar sesión en este dispositivo?" / "¿Deseas salir de la aplicación?").
- Botones (margen `0 6px 12px`): **Confirmar** primero (bg `rgba(primary,.8)` = `rgba(1,18,102,.8)`, borde primary; foco: bg `rgba(secondary,.9)`, borde secondary) y **Cancelar** (bg `rgba(255,255,255,.15)`, borde `2px rgba(255,255,255,.3)`); padding 9.6/20, 15.2px, radio 8.
- Foco inicial en **Cancelar** (50ms); LEFT/RIGHT por geometría; BACK = cancelar.

### 5.4 Foco y teclas
- Foco inicial: primer enfocable de `.mi-cuenta-page` = "Cambiar contraseña" (`MiCuentaPage.jsx:140`).
- UP/DOWN por geometría en la lista del menú (el contenido no tiene enfocables en modo QR/Acerca de, así que RIGHT no lleva a nada; LEFT desde el menú entra al sidebar del Home).
- OK: según tabla §5.1. BACK: `navigate(-1)`.

---

## 6. Datos y funciones por pantalla

| Pantalla / componente | Store / servicio / hook | Datos / llamadas |
|---|---|---|
| VodPage | `usePreload()` → `vod {status, categories, allVods, error}`, `loadVOD(brand,{t,force,enableRetry})` (`packages/core/src/store/preloadStore.js:376+`) → `loadVODData` (`vodService.js:147`) → `panaccessService.getVodLibraries`, `getVodContent({offset,limit})`, `prepareDataForVOD`; `useBrand()` (`drm`, `vod.layout`); `useTvInitialFocus`; `navigationRouter.register` + `moveFocus` (RIGHT confinado) | filas por género + "Séries" |
| VodCard / VodSeeMoreCard | `getVodImageUrl(drm, image1Id, 'posterList')` (fallback) | `posterListURL/posterInfoURL`, `name` |
| VodCategoryModal | `focusManager.push/pop`, `focusFirstIn`; `useBrand().drm` | `vods[]` de la categoría |
| VodDetailModal (hero) / Classic | `panaccessService.getVodSeriesInfo({seriesId})`; `fetch(item.customDataUrl)` (metadatos extra); `usePlayer().state.url` (para BACK/refoco); `focusManager`; `requestTvFocusRingSync`; BRAND `vod.vodDetail.contentPosition` | `name, description, libraryReleaseDate, duration(s), parentalRating, rating(/10), categories/categoryName(s), actorNames, directorNames, posterInfoURL, backgroundImageURL, extraImageURL (classic), isSeries`; episodios `{id|vodId, name|title|episodeTitle, posterListURL|image1Id, duration}` |
| Reproducción VOD | `panaccessService.getVodM3u8Url({vodId})` (+ `userSession.getSessionId()`), `useParentalGate().requestPlayMedia` (`parentalGateStore`, `useParentalStore`), `usePlayer().play({type:'vod', id, url, item, autoPlay:true})` → `normalizePlaybackUrl`, `engine.load`, `telemetryService.recordSwitch` | sin resume |
| SearchPage | `usePreload()` → `epg.streams`, `vod.allVods/categories`, `catchup.groups`, `loadVOD`, `loadCatchup`; `searchAll`, `getSearchDebounceMs` (`searchService.js`); `useSearchSessionStore` (`query, activeTab, focusedResultKey, bindBrand, touchCatalogSnapshot, isExpired, reset`); `useSearchPageTvNav`; `FocusableInput` + `useOsdKeyboard().showKeyboard` → `VirtualKeyboard`; `useBrandPlaceholderUrl`; BRAND `EPG.enabled`, `vod.layout`, `drm`, `ui.search.*` | resultados `{type:'service'|'vod'|'catchup'|'epg', id, name, logo, lcn, channelName, startMs, endMs, vodSearchMeta, vodPosterFallback, raw}` |
| Search → reproducir | canal: `panaccessService.getStreamM3u8Url({streamId})`, `normalizePlaybackUrl`, `requestPlayChannel`, `play({type:'service'})`; catchup/EPG: `getCatchupM3u8Url({catchupId})`, `requestPlayMedia`, `play({type:'catchup'})`; `EpgEventModal`; `catchupGroupToChannel/catchupEventToChannel` (`src/utils/catchupEvent`) | — |
| MiCuentaPage | `useBrand()` (`appName`, `account.links`, `account.sections`, `account.theme`, `features.profiles/osms/osmsInline`, `version`, `developedBy`, `ui.locale`); `isParentalControlEnabledForBrand`; `isDeviceSessionEnabled` (`deviceAuthService`); `useDeviceTime`; `QRCode.toDataURL`; `getCredentials()`, `getActiveLicense()` (`packages/core/src/utils/userSession.js:125,203`); `clearSessionBeforeNewLogin()` (`packages/core/src/services/loginFlow.js:49`: `panaccessService.logout`, cierre WS device session, limpia storage preservando `device_token`); `exitAppBestEffort()` (`src/utils/tvNavigation/backLongPress.js:12`); `ConfirmModal`; `useTvInitialFocus` | QR, "Acerca de", logout/salir |
| Control parental (destino) | `/home/control-parental` → `src/pages/ParentalSettingsPage.jsx` (no cubierto aquí) | — |
