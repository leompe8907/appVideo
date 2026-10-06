# Buscador: búsqueda por bouquet y por categoría

Documento del equipo de apps (Android e iOS) para el equipo web (appVideo). Fecha: 05/10/2026.

Las apps nativas agregaron al buscador la **búsqueda por grupo**. Lo pasamos para que appVideo se comporte igual en Samsung, LG y web.

## Qué cambia para el usuario

Hasta ahora el buscador solo comparaba lo escrito con el **nombre** de cada cosa: canales (por nombre o número), catchups (por nombre), programas de la guía (por título) y películas (por título). Si alguien escribía "infantil", no aparecía nada salvo que un canal se llamara así.

Ahora, además, **si lo escrito coincide con el nombre de un grupo, el buscador trae todo su contenido**:

| Si lo escrito coincide con el nombre de… | Se agrega a los resultados |
|---|---|
| Un **bouquet** (de Inicio o de Canales) | **Servicios:** todos sus canales. **Catchup:** el catchup de esos canales, del más nuevo al más viejo. **Guía:** lo que está en emisión o por venir en esos canales, **hoy y mañana**. |
| Un **grupo de catchup** | **Catchup:** sus programas. |
| Una **categoría de películas** | **VOD:** sus películas. |

La búsqueda por nombre de siempre se mantiene. Lo del grupo **se suma** a esos resultados, sin repetir nada.

## Ejemplo

Supongamos que hay un bouquet **Infantiles** con Zoo Moo (350), KidStory TV (351) y Storyland TV (352), y una categoría de películas **Infantil**. El usuario escribe "infantil":

```
[Todos] [Servicios] [Catchup] [Guía] [VOD]

Servicios   ← los canales del bouquet Infantiles
  350  Zoo Moo
  351  KidStory TV
  352  Storyland TV

Catchup     ← lo grabado de esos 3 canales, del más nuevo al más viejo
  Peppa Pig · Zoo Moo · ayer 18:00
  Bluey · KidStory TV · ayer 17:30

Guía        ← en emisión o por venir en esos 3 canales, hoy y mañana
  Paw Patrol · Zoo Moo · hoy 19:00
  Mickey · Storyland TV · mañana 09:30

VOD         ← las películas de la categoría Infantil
  Toy Story · Coco · Frozen
```

Si además algún canal, programa o película tiene "infantil" en su propio nombre, también aparece, como siempre, una sola vez.

## Reglas exactas

Son las mismas en Android y en iOS: están una sola vez, en el código compartido (`SearchGroups`).

1. **Cuándo aplica:** solo si lo escrito tiene **3 caracteres o más** (sin contar espacios al principio y al final) y **no es solo números**.
   - Con 1 o 2 letras casi todos los bouquets coincidirían y el buscador traería el catálogo entero.
   - Si son solo números, se sigue buscando por número de canal, como hasta ahora.
2. **Cómo se compara:** el **nombre del grupo contiene** lo escrito, sin importar mayúsculas ni tildes. "infan" encuentra "Infantiles"; "pelicula" encuentra "Películas".
   - Normalización: pasar a minúsculas y reemplazar `á à â ã ä å → a`, `é è ê ë → e`, `í ì î ï → i`, `ó ò ô õ ö → o`, `ú ù û ü → u`, `ñ → n`, `ç → c`.
3. **Qué bouquets:** **todos**, los de Inicio (`isMain = true`) y los de Canales (`isMain = false`). Un canal que está en dos bouquets que coinciden aparece una sola vez.
4. **Catchup de un bouquet:** los programas de los grupos de catchup cuyo `epgStreamId` es el de alguno de los canales del bouquet. Se ordenan **del más nuevo al más viejo** (por `start`), como el resto de la app.
5. **Guía de un bouquet:** los programas de esos canales que **no terminaron** (`end >= ahora`) y que **empiezan antes del final de mañana** (medianoche al terminar mañana, en la hora del dispositivo). Se ordenan por hora de comienzo.
6. **Grupo de catchup:** si el nombre del grupo coincide, se agregan todos sus programas (con el mismo orden del punto 4).
7. **Categoría de películas:** si el nombre de la categoría coincide, se agregan sus películas. En Android se usan las bibliotecas y los géneros, sin las categorías de adultos.
8. **Sin repetidos:** lo que ya apareció por la búsqueda por nombre no se vuelve a agregar. Para esto se usa el id de cada cosa: canal, catchup, programa de la guía (canal + comienzo) y película.
9. **Filtros:** cada tipo respeta el filtro elegido arriba. Con **VOD** se ven solo las películas de la categoría; con **Guía**, solo la guía del bouquet; y así con los demás.

## Cómo implementarlo (pseudocódigo)

Después de armar los resultados por nombre, como ya se hace hoy:

```js
const MIN_LENGTH = 3;
const EPG_DAYS = 2; // hoy y mañana

const normalize = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); // quita tildes (incluye ñ → n, ç → c)

function appliesToGroups(query) {
  const q = query.trim();
  return q.length >= MIN_LENGTH && !/^\d+$/.test(q);
}

function isGroup(name, query) {
  return !!name && normalize(name).includes(normalize(query.trim()));
}

function addGroupMatches(query, catalog, results) {
  if (!appliesToGroups(query)) return;

  // 1. Canales de los bouquets que coinciden (todos: Inicio y Canales), sin repetir.
  const bouquetChannels = uniqueBy(
    catalog.bouquets.filter((b) => isGroup(b.name, query)).flatMap((b) => channelsOf(b)),
    (c) => c.id,
  );
  addUnique(results.channels, bouquetChannels, (c) => c.id);

  // 2. Catchup de esos canales y de los grupos de catchup que coinciden, del más nuevo al más viejo.
  const epgIds = new Set(bouquetChannels.map((c) => c.epgStreamId));
  const catchups = catalog.catchupGroups
    .filter((g) => epgIds.has(g.epgStreamId) || isGroup(g.name, query))
    .flatMap((g) => g.catchups)
    .sort((a, b) => b.start - a.start);
  addUnique(results.catchups, catchups, (c) => c.id);

  // 3. Guía de esos canales: en emisión o por venir, hasta el final de mañana.
  const now = Date.now();
  const until = startOfToday().getTime() + EPG_DAYS * 24 * 60 * 60 * 1000;
  const events = bouquetChannels
    .flatMap((c) => epgOf(c))
    .filter((e) => e.end >= now && e.start < until)
    .sort((a, b) => a.start - b.start);
  addUnique(results.events, events, (e) => `${e.epgStreamId}-${e.start}`);

  // 4. Películas de las categorías que coinciden (sin las de adultos).
  const movies = catalog.vodCategories
    .filter((cat) => !cat.isAdult && isGroup(cat.name, query))
    .flatMap((cat) => moviesOf(cat));
  addUnique(results.movies, movies, (m) => m.id);
}
```

`channelsOf`, `catchups`, `epgOf` y `moviesOf` son lo que appVideo ya tiene para armar Inicio, la guía, el catchup y el catálogo: la relación entre bouquets y canales, la guía por `epgStreamId` y las películas por categoría. `addUnique` agrega solo lo que todavía no está en la lista.

## Cómo probarlo

1. Escribir el nombre (o parte) de un bouquet, por ejemplo "infantil", "nacional" o "internac". Tienen que aparecer:
   - todos los canales del bouquet;
   - su catchup, del más nuevo al más viejo;
   - su guía de hoy y mañana, sin programas que ya terminaron.
2. Escribir el nombre de una categoría de películas. Tienen que aparecer sus películas.
3. Escribir "in" (2 letras). **No** tiene que traer bouquets enteros, solo lo que coincide por nombre.
4. Escribir un número, como "35". Tiene que buscar por número de canal, como siempre.
5. Escribir el nombre de un canal que además está en un bouquet que coincide. Tiene que aparecer **una sola vez**.
6. Cambiar entre los filtros (Servicios, Catchup, Guía, VOD) y ver que cada uno muestra lo suyo.
7. Probar con tildes y mayúsculas: "PELÍCULAS", "peliculas" y "Películas" dan lo mismo.

## Dónde está en las apps nativas

- **Reglas comunes:** `shared/src/commonMain/kotlin/com/panaccess/android/streaming/shared/search/SearchGroups.kt` (largo mínimo, días de guía, normalización y comparación).
- **Android:** `SearchRepositoryImpl.searchGroups()` (`app/src/main/java/com/panaccess/android/streaming/data/repository/SearchRepositoryImpl.kt`). La guía de varios canales sale de una consulta nueva a la base local: `EpgEventsDao.getEpgEventsForStreamsBetween`.
- **iOS:** `SearchResults.addGroupMatches()` (`iosApp/Sources/Main/SearchScreen.swift`).
