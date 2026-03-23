# Catchup (pendiente a revisar)

## Estado actual (en el repo)
- **Pantalla independiente**: implementada en `/home/catchup` como `src/pages/CatchupPage.jsx`.
- **Carga centralizada**: `src/contexts/PreloadContext.jsx` ahora tiene estado `catchup` y una función `loadCatchup()` que intenta:
  - `getCatchupGroups`
  - `getCatchupEvents` por cada grupo
  - `getRecordingTasks` para “grabados”
- **Relación con EPG**:
  - `EpgEventModal` habilita el botón **“Watch / Catchup”** si el evento trae algún identificador tipo `catchupId`/`catchup_id`/`catchupEventId`.
  - `EpgCards` pasa ese callback y navega a `/home/catchup` enviando `location.state.catchupId`.
- **3 diseños por marca** (config en `src/config/brands.js`):
  - `catchup.ui.activeLayout`: `'legacy' | 'timeline' | 'netflix'`
  - `catchup.ui.showAllLayouts`: si `true`, se renderizan los 3 a la vez para revisión

## Limitaciones conocidas (impacto en pruebas)
- Con la marca **`intv`**: **no hay catchup**, por lo que:
  - No se puede validar la **paridad visual** ni la **funcionalidad end-to-end**.
  - Solo se puede validar comportamiento “estático”/lógica de front sin datos reales.
- La normalización de datos de catchup en React intenta ser tolerante, pero **depende del shape real** que entregue el backend. Ejemplos:
  - campos posibles de IDs: `catchupId`, `catchup_id`, `catchupEventId`, `id`, etc.
  - fechas posibles: `startDate`/`start`, `endDate`/`end`, `duration`

## Qué falta validar cuando haya una marca/escenario con catchup
1. **Contrato de API**:
   - ¿Cómo vienen exactamente `catchupId`, `start/end` y `duration` en `getCatchupEvents`?
   - ¿Qué trae `getCatchupGroups` para `epgStreamId` y `catchupGroupId`?
   - ¿Qué devuelve `getRecordingTasks` y cómo mapeamos `recordingTaskId -> event -> catchupId`?
2. **Auto-play desde EPG**:
   - Entrar a `/home/catchup` con `location.state.catchupId` debe reproducir el stream correcto.
3. **FOCUS/TV**:
   - Navegación espacial en los botones de tarjetas de catchup (especialmente el layout “timeline” y “netflix”).
   - Verificar el comportamiento en dispositivos TV con remoto (cuando exista “Return” para cerrar).
4. **Cierre del modal / UX**:
   - Confirmar que el overlay del player en catchup no tape indebidamente los layouts (y que el scroll funciona).
5. **Traducciones**:
   - En `CatchupPage` hay textos hardcodeados en algunos headers (ej. “Grabados”, “Recomendados”).
   - Ajustar para que use `t()` y claves equivalentes a lo que tengas en i18n.
6. **“Recomendados”**:
   - Por ahora se arma una lista simple (eventos más recientes) y se limita `slice(0, 30)`.
   - Validar si el negocio real requiere otro ranking.

## Datos relevantes del cambio (para rastreo)
- Pantalla: `src/pages/CatchupPage.jsx`
- Estilo: `src/styles/pages/_catchup.scss`
- Contexto: `src/contexts/PreloadContext.jsx` (estado `catchup` + `loadCatchup`)
- EPG:
  - `src/components/epg/EpgEventModal.jsx` (habilita “Watch / Catchup” y foco TV)
  - `src/components/epg/EpgCards.jsx` (navega a `/home/catchup` con `catchupId`)
- Routing: `src/App.jsx` (ruta hija `home/catchup` -> `CatchupPage`)
- Brands: `src/config/brands.js` (objeto `catchup` con layouts)

## Pendientes fuera de Catchup (revisión adicional)
- Hubo un cambio no planeado observado en `src/styles/pages/_bouquet.scss` (solo aparece como delta en git).
  - Si esto no era deseado, se recomienda revertirlo cuando confirmemos.

## Checklist de “cuando haya catchup”
- [ ] Probar `legacy` en TV y PC
- [ ] Probar `timeline` en TV (scroll vertical y foco)
- [ ] Probar `netflix` en TV
- [ ] Probar reproducción de “Grabados” y “Recomendados”
- [ ] Probar “Watch / Catchup” desde EPG (modal -> navegar a catchup -> reproducir)
- [ ] Confirmar si hay botón “Return” en remoto para cerrar/volver

