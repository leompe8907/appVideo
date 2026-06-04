# Cambios recientes (catchup + relacionados) — guía para revertir y probar

Documento generado para que puedas **revertir** el trabajo reciente del agente y comprobar si el catchup ya funcionaba antes.

**Fecha de referencia:** conversación catchup / reproducción / claves React (jun 2026).

---

## Objetivo de los cambios (resumen)

| Tema | Problema reportado | Intento de solución |
|------|-------------------|---------------------|
| Reproducir catchup | Modal OK pero sin video / `url` null o error HLS | Alinear `catchupId`, normalizar URL, URL directa `requestMode=m3u8` |
| Consola React | `Encountered two children with the same key` (`1077699`, etc.) | Claves únicas en carriles, secciones y slides Embla |
| `lower` before initialization | Tras cambio en `normalizePlaybackUrl` | Mover `const lower` antes de usarlo (bug introducido y corregido en la misma ronda) |

**Nota:** En tus logs posteriores, `play()` **sí llegaba a ejecutarse** con URL y `isPlayerActive: true`, pero HLS fallaba con `manifestParsingError` usando `requestMode=function&f=getCatchupM3u8`. Parte del trabajo apuntaba a pasar a `requestMode=m3u8&catchupId=...`.

---

## Paridad 10foot (estado actual recomendado)

Referencia: `10foot/docs/catchup-reproduccion.md`, `cv.getTopLevelCatchupM3u8Url(catchup.id)`.

| Regla | Implementación en appVideo |
|-------|---------------------------|
| Query `catchupId` en la URL | Siempre **`event.id`** del API (no `eventId` de rejilla EPG) |
| URL M3U8 | `requestMode=function&f=getCatchupM3u8&plain=true&catchupId=…` (`panaccessService.getCatchupM3u8Url`) — igual que 10foot |
| Resolver evento al navegar | `findCatchupEventInGroups(groups, lookupId, epgStreamId)` en `CatchupPage` |
| Helpers | `getCatchupStreamId` / `getCatchupId` en `src/utils/catchupEvent.js` (`id` primero) |
| Claves React duplicadas | `getCatchupGroupKey(group, index)` y `getCatchupRailItemKey` |

**Comprobar en red:** la petición debe llevar `catchupId=99412503` (ejemplo `event.id`), no `1077699` (`eventId` de tile).

---

## Archivos tocados (working tree actual)

### Catchup y reproducción (núcleo)

| Archivo | Cambios principales |
|---------|---------------------|
| `src/pages/CatchupPage.jsx` | `resolveCatchupUrl` con `normalizePlaybackUrl`; logs DEV; `playCatchup` usa `getCatchupId` como fallback; keys en layout legacy |
| `src/utils/catchupEvent.js` | `getCatchupId` ampliado (`catchup_id`, `catchupEventId`, …); `getCatchupRailItemKey()`; `getCatchupGroupKey(group, index)` |
| `src/services/panaccessService.js` | `getDirectM3u8CatchupUrl()`; `getCatchupM3u8Url()` delega en directo; bloque catchup en `normalizePlaybackUrl` (legacy `getCatchupM3u8`); fix orden de `lower` |
| `src/components/epg/EpgEventModal.jsx` | `catchupId` vía `getCatchupId(event)`; `canWatch` con `Number(catchupId) > 0` |
| `src/player/engines/web/windHlsManifest.js` | `windDirectM3u8FromAny` también reescribe catchup en host Wind |

### UI catchup (claves React)

| Archivo | Cambios principales |
|---------|---------------------|
| `src/components/catchup/ChannelsRailsCatchupLayout.jsx` | `groupIndex` en `getCatchupGroupKey`; keys en tarjetas con `getCatchupRailItemKey`; key en «Ver más» |
| `src/components/catchup/CatchupGroupModal.jsx` | Keys con `getCatchupRailItemKey` + `getCatchupGroupKey` |

### Compartidos (afectan más que catchup)

| Archivo | Cambios principales |
|---------|---------------------|
| `src/contexts/PlayerContext.jsx` | En `play()`, si el engine aún no existe, espera hasta ~5 s (50 × 100 ms) antes de abortar |
| `src/components/navigation/EmblaHorizontalRail.jsx` | Key de slide: `embla-${child.key}-${index}` para evitar colisiones en carriles (bouquet, catchup, VOD) |

### Misma sesión / rama paralela (HUD — no es catchup)

Si reviertes «todo lo reciente», ten en cuenta que también hay cambios de **HUD configurable** (pueden mezclarse en tu diff):

| Archivo | Estado |
|---------|--------|
| `src/components/player/PlayerHud.jsx` | Modificado (refactor toolbar) |
| `src/components/player/PlayerHudToolbar.jsx` | **Nuevo** (sin trackear en git si no lo añadiste) |
| `src/config/playerHudDefaults.js` | **Nuevo** |
| `src/utils/resolvePlayerHudZones.js` | **Nuevo** |
| `src/config/brands.js` | `player.hud` por marca (p. ej. cableatlantico) |

Si solo quieres probar catchup «como antes», puedes revertir **solo** la tabla «Catchup y reproducción» + «UI catchup» + decidir si mantienes Embla/PlayerContext.

---

## Detalle por archivo (catchup)

### `src/services/panaccessService.js`

**Antes (comportamiento original):**

```text
getCatchupM3u8Url →
  .../index.php?requestMode=function&f=getCatchupM3u8&plain=true&catchupId=...&sessionId=...&m3u8
```

**Después:**

```text
getDirectM3u8CatchupUrl →
  .../index.php?requestMode=m3u8&catchupId=...&sessionId=...

getCatchupM3u8Url() → llama a getDirectM3u8CatchupUrl()
```

`normalizePlaybackUrl`: si la URL contiene `getCatchupM3u8`, intenta reescribir a directo; `const lower` debe declararse **antes** del bloque catchup (se corrigió un `ReferenceError`).

### `src/pages/CatchupPage.jsx`

- `resolveCatchupUrl`: `getCatchupM3u8Url` + `normalizePlaybackUrl`; try/catch con warn en DEV.
- `playCatchup`: `catchupIdArg ?? getCatchupId(event)`; si no hay URL, warn y return (no llama a `play`).
- Layout legacy: `key={getCatchupGroupKey(group, groupIndex)}`.

### `src/components/epg/EpgEventModal.jsx`

- Antes: `catchupId = event?.catchupId ?? event?.catchup_id ?? event?.catchupEventId`
- Después: `getCatchupId(event)` (incluye `id` / `eventId` como en preload)
- `canWatch`: `Number(catchupId) > 0` (antes `> -1`)

### `src/utils/catchupEvent.js`

- `getCatchupRailItemKey(event, groupKey, index)` → `"${groupKey}:${startMs|idx}:${id}:${index}"`
- `getCatchupGroupKey(group, index)` → `"${base}__${index}"` si hay índice (evita duplicar key de `<section>` cuando varios grupos comparten `epgStreamId`)

### `src/contexts/PlayerContext.jsx`

- `play()` ya no sale al instante si `engineRef` es null: espera creación async del engine.

---

## Cómo revertir

### Opción A — Revertir solo archivos catchup + Embla + PlayerContext (recomendado para tu prueba)

```powershell
cd c:\Users\Leonard\Desktop\appVideo

git checkout -- src/pages/CatchupPage.jsx
git checkout -- src/utils/catchupEvent.js
git checkout -- src/services/panaccessService.js
git checkout -- src/components/epg/EpgEventModal.jsx
git checkout -- src/components/catchup/ChannelsRailsCatchupLayout.jsx
git checkout -- src/components/catchup/CatchupGroupModal.jsx
git checkout -- src/player/engines/web/windHlsManifest.js
git checkout -- src/contexts/PlayerContext.jsx
git checkout -- src/components/navigation/EmblaHorizontalRail.jsx
```

### Opción B — Revertir todo el diff actual (incluye HUD y brands)

```powershell
git checkout -- src/components/player/PlayerHud.jsx
git checkout -- src/config/brands.js
# ... más los de la opción A

# Archivos nuevos (borrar si no los quieres):
# src/components/player/PlayerHudToolbar.jsx
# src/config/playerHudDefaults.js
# src/utils/resolvePlayerHudZones.js
```

### Opción C — `git stash` antes de revertir

```powershell
git stash push -m "catchup+hud cambios agente" -- `
  src/pages/CatchupPage.jsx `
  src/utils/catchupEvent.js `
  src/services/panaccessService.js `
  ...
```

---

## Qué comprobar al probar «antes»

1. **Consola al abrir Catchup:** ¿aparecen warnings de key `1077699` / `1077620`?
2. **Reproducir desde modal:** ¿`[PlayerContext] action:play` con URL?
3. **URL en Network:** ¿`requestMode=function&f=getCatchupM3u8` o otra?
4. **HLS:** ¿`manifestParsingError` o reproduce?
5. **HomePage:** `isPlayerActive true` y `isPlaying: true` tras cargar.

Si **antes** también fallaba con `manifestParsingError`, el problema es de backend/URL/manifiesto, no solo de los últimos cambios de UI/claves.

Si **antes** reproducía y **después** no, el diff en `panaccessService` / `normalizePlaybackUrl` es el candidato principal.

---

## Contexto de conversación (no código)

- **`tracks` en HUD:** botón Audio/Subtítulos; se oculta si no hay opciones (`hasTrackOptions`).
- **Build:** el usuario pidió no ejecutar `npm run build` en adelante.
- **Error `lower`:** introducido al añadir bloque catchup en `normalizePlaybackUrl`; corregido moviendo `const lower` arriba — si reviertes a mitad de ese cambio, puede volver el `ReferenceError`.

---

## Archivos que este doc no creó en el repo

Solo este markdown. El resto son modificaciones listadas arriba.

Si tras revertir quieres reaplicar solo la URL directa m3u8 sin el resto, se puede hacer un parche mínimo en `getCatchupM3u8Url` únicamente.
