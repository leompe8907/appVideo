# Buscador — diseño, funcionalidades y flujo

Documentación de la funcionalidad de búsqueda global de la app (`/home/buscador`). Cubre idea de diseño, qué busca y cómo, comportamiento en PC vs TV, estados visuales, flujo de selección por tipo de resultado, persistencia de sesión, configuración por marca y limitaciones conocidas.

## 1. Idea de diseño

El buscador es una **capa superpuesta (overlay modal)** sobre Inicio, no una página aparte con su propio fondo: se monta en `/home/buscador` dentro del layout de Home, y visualmente aparece como un panel flotante centrado sobre un fondo atenuado.

Busca en **cuatro tipos de contenido a la vez** con un solo campo de texto:

- **Canales en vivo** (`service`)
- **Programación EPG** (`epg`) — eventos de la guía, actuales o futuros
- **VOD** (`vod`) — título, actores, director, año
- **Catchup** (`catchup`) — eventos grabados/timeshift

Todo el filtrado ocurre **en memoria, contra datos ya cargados** por el preload de la app (`epg.streams`, `vod.allVods`, `catchup.groups`), no contra una API en vivo por cada tecla. Esto hace que la búsqueda sea instantánea y no dependa de la red una vez que el catálogo ya está cargado — el único tráfico de red que dispara el buscador es, después de elegir un resultado, resolver la URL de reproducción real (M3U8 de canal o de catchup).

## 2. Arquitectura / flujo de datos

```
usePreload()  ─┬─> epg.streams (canales + epgItems)
               ├─> vod.allVods
               └─> catchup.groups[].events
                        │
                        ▼
        searchAll({ query, services, vods, catchupGroups })   (searchService.js)
                        │  (debounce 300ms sobre el query)
                        ▼
              resultados normalizados + relevancia
                        │
                        ▼
              agrupados por tipo / tab activa   (SearchPage.jsx)
                        │
                        ▼
                 grilla de resultados (ResultItem)
                        │  click / Enter
                        ▼
        handleSelect(item) → según item.type:
          service → resolver URL → play() directo
          vod     → abrir VodDetailModal → Reproducir → play()
          catchup → abrir EpgEventModal (modo catchup) → play()
          epg     → abrir EpgEventModal (vivo o catchup) → play()
```

Archivos clave:

| Archivo | Rol |
|---|---|
| `src/pages/SearchPage.jsx` | Página/overlay, estados de UI, tabs, selección de resultados |
| `src/services/searchService.js` | Matching, scoring de relevancia, normalización de resultados |
| `src/store/searchSessionStore.js` | Persistencia de sesión (query/tab/foco) en memoria mientras se navega |
| `src/hooks/useSearchPageTvNav.js` | Reglas de navegación por control remoto específicas del input de texto |
| `src/components/navigation/FocusableInput.jsx` | Input que en TV bloquea el teclado nativo y abre el teclado en pantalla |
| `src/styles/pages/_search.scss` | Estilos, estados visuales, overrides de TV |

## 3. Cómo matchea (relevancia, no fuzzy)

El matching es por **substring** (no fuzzy/tolerante a errores de tipeo) con un sistema de puntaje de relevancia que ordena los resultados. `MIN_QUERY_LENGTH = 1`: con un solo carácter ya empieza a filtrar. Debounce fijo de **300ms** desde que el usuario deja de tipear (`DEBOUNCE_DELAY_MS`).

Normalización: solo `.toLowerCase()` — **sin quitar tildes/acentos**. Buscar "cancion" no encuentra "canción" y viceversa. Es una limitación real, no un bug pendiente de arreglar; documentado acá para que se sepa que es el comportamiento actual.

Puntaje base por texto (`calculateRelevance`):

- Coincidencia exacta: **+1000**
- El texto empieza con la búsqueda: **+500**
- Aparece en cualquier parte: **+100**
- Bonus por palabra completa / palabra que empieza igual: **+50 / +25** por cada combinación palabra-búsqueda × palabra-texto
- Penalización leve por longitud del texto (favorece títulos más cortos/precisos)

Reglas por tipo de contenido:

- **Canales**: matchea por nombre O por número de canal (LCN), y se usa el mejor puntaje de los dos (la búsqueda numérica por LCN tiene su propia escala: exacto +600, empieza con +400, contiene +150).
- **VOD**: matchea título (puntaje completo), y también actores/director (puntaje × 0.82, un poco más bajo que un match directo de título) y año de estreno exacto de 4 dígitos (+430 fijo). Si el título no matcheó pero sí actor/director/año, el resultado muestra por qué matcheó (ej. "Actor: Fulano", "Año: 2019").
- **Catchup**: matchea por título del evento grabado.
- **EPG**: matchea por título del programa, **solo eventos actuales o futuros** — programación ya finalizada se descarta antes de buscar.

Los resultados se deduplican (por tipo+id) y se ordenan de mayor a menor relevancia. No hay paginado ni virtualización: se renderiza toda la lista filtrada de una vez.

## 4. PC vs TV

**Input de texto:**
- En PC es un `<input>` normal, con foco automático al entrar a la página.
- En TV, el input queda en modo solo-lectura a propósito, para bloquear el teclado nativo de la plataforma. Al confirmar con el control remoto se abre un **teclado en pantalla propio** (numérico o de texto, multi-idioma) que escribe el resultado de vuelta en el input.

**Navegación por control remoto:**
La navegación general (entre tabs, resultados, sidebar) la resuelve el motor genérico de navegación espacial de toda la app (por geometría real en pantalla), no un código a medida para el buscador. Solo hay 3 reglas puntuales que ese motor no puede inferir solo para un campo de texto:
- ← (izquierda) desde el input → vuelve al sidebar
- → (derecha) desde el input → va al botón de limpiar
- ↓ (abajo) desde el input → baja a las tabs o a los resultados

También se recuerda cuál era la última tarjeta de resultado con foco, para restaurarlo si el usuario vuelve a entrar al buscador (por ejemplo, después de mirar el detalle de un contenido o volver de reproducir algo) — importante en TV porque no hay mouse para "hacer click de nuevo" en cualquier lado.

## 5. Estados visuales

- **Antes de tipear**: mensaje "Escribe para buscar".
- **Sin resultados**: mismo estilo visual, mensaje "No se encontraron resultados."
- **No hay estado de "cargando..."**: como el filtrado es instantáneo sobre datos ya en memoria, no hace falta spinner. Excepción: si el usuario entra al buscador antes de que VOD o Catchup terminen de cargar por primera vez, esos resultados simplemente no aparecen todavía (se completan solos cuando el catálogo termina de cargar, sin aviso explícito).
- **Contador de resultados**: "N resultado(s)".
- **Tabs**: Todos / Servicios / EPG / VOD / Catchup — cada una se oculta sola si no tiene resultados o si la búsqueda está vacía; "Todos" solo aparece si hay resultados en 2 o más categorías.
- **Grilla de resultados**: 6 columnas fijas, con una tarjeta de resultado propia del buscador (no reutiliza las tarjetas de canal del muro de bouquets), con presentación distinta según el tipo (canal: número + nombre; VOD: título + línea de actor/director/año si corresponde; EPG: canal + horario + título del programa recortado a 3 líneas; catchup: título + imagen).
- En la tab "Todos", los resultados se agrupan en secciones con título (Servicios, VOD, Catchup, EPG), cada una solo si tiene contenido.

## 6. Qué pasa al elegir un resultado

Depende del tipo:

- **Canal en vivo** → reproduce directo, sin modal intermedio (resuelve la URL del stream y llama a reproducir).
- **VOD** → abre el modal de detalle de VOD (el diseño hero o el clásico, según configuración de marca); desde ahí "Reproducir" arranca la reproducción.
- **Catchup** → abre el modal de evento (en modo detalle de catchup); desde ahí "Ver" resuelve la URL de catchup y reproduce.
- **Programa de EPG** → abre el modal de evento; si el programa está al aire ofrece "Ver en vivo", si ya pasó y tiene catchup disponible ofrece "Ver catchup".

Toda reproducción pasa por el control parental de la app (el mismo PIN/gate que aplica navegando normalmente) — el buscador no es un atajo que lo evite.

Atajos de teclado en PC: **Enter** reproduce/abre directamente el primer resultado de toda la búsqueda (sin importar la tab activa); **Escape** limpia el campo.

## 7. Persistencia de sesión (no hay historial de búsquedas)

No existe una lista de "búsquedas recientes" ni historial. Lo que sí se mantiene, mientras se navega dentro de la app (no sobrevive un refresh de página completo), es la **sesión actual del buscador**: el texto tipeado, la tab activa y qué tarjeta tenía el foco — así, si el usuario entra a mirar un contenido y vuelve al buscador, lo encuentra tal cual lo dejó. Esta sesión expira sola a la hora (1h) y se resetea si cambia de marca (`?brand=`) o si hace logout.

## 8. Configuración por marca

El buscador **no tiene una bandera para desactivarlo** — está siempre disponible para todas las marcas. Lo que sí varía por marca:

- **Posición en el sidebar**: cada marca puede definir su propio orden de navegación; el buscador puede aparecer primero o en cualquier posición.
- **Resultados de tipo EPG**: si la marca tiene la guía completa (EPG) desactivada, los resultados de tipo "programación" también se ocultan del buscador (no solo el acceso a la pantalla de guía).
- **Tema visual**: colores de fondo, overlay, tabs, tarjetas de resultado, textos, etc. son 100% personalizables por marca vía configuración; si una marca no define nada puntual, se usa un tema oscuro por defecto.

## 9. Rendimiento

- El filtrado pesado (`searchAll`) solo se recalcula 300ms después de que el usuario deja de tipear, no en cada tecla.
- Los distintos resultados derivados (lista completa, agrupados, tab activa) están memoizados, así que cambiar de tab no vuelve a ejecutar la búsqueda completa.
- No hay virtualización de la grilla de resultados — con catálogos de VOD muy grandes, en teoría se podrían renderizar muchas tarjetas de una sola vez. No es un problema reportado hoy, pero es un punto a tener en cuenta si el catálogo de alguna marca crece mucho.

## 10. Limitaciones conocidas

- **No hay tolerancia a errores de tipeo ni acentos** (buscar "pelicula" no encuentra "película"). No es fuzzy search.
- **No hay historial de búsquedas recientes.**
- **La sesión de búsqueda no sobrevive un refresh completo del navegador/TV** (sí sobrevive navegar dentro de la app).
- **Sin paginación/virtualización** de resultados — potencial punto a revisar si algún catálogo de VOD crece mucho.
