# Catchup — Alternativas de diseño

Documento de referencia para la pantalla **Catchup** (`CatchupPage`). Describe tres enfoques de UI/UX, sus trade-offs y el estado de implementación.

---

## Contexto actual

| Aspecto | Estado |
|--------|--------|
| Datos | Preload único vía `loadCatchup` en `preloadStore.js` (grupos por canal + eventos) |
| Layouts existentes | **Solo carriles por canal** (`ChannelsRailsCatchupLayout`) |
| Tarjeta actual | `CatchupCard` — póster 16:9 + título + fecha/hora |
| Auto-refresh al fin de emisión | **No implementado** — eventos sin `catchupId` quedan deshabilitados hasta recargar |
| Navegación TV dedicada | Parcial (tabIndex en botones; sin hook tipo `useVodPageTvNav`) |

**Objetivos de rediseño:** mejor escaneabilidad por canal, rendimiento con muchos eventos, coherencia visual con VOD/bouquets, y base para navegación TV.

---

## Alternativa 1 — Carriles por canal (estilo VOD / bouquets)

**ID de layout:** `rails`  
**Estado:** ✅ **Único layout en producción**

### Descripción

Una fila horizontal por cada **grupo/canal** de catchup. Cada fila muestra tarjetas tipo póster (16:9) con título y hora de inicio. Scroll horizontal nativo en TV y Embla + flechas en PC.

```
┌─────────────────────────────────────────────────────────────┐
│  Catchup                                                    │
├─────────────────────────────────────────────────────────────┤
│  12 · TVE                                                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐     [Ver más]   │
│  │    │ │    │ │    │ │    │ │    │ │    │                  │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                  │
│                                                               │
│  24 · Antena 3                                                │
│  ┌────┐ ┌────┐ ┌────┐ ...                                    │
└─────────────────────────────────────────────────────────────┘
```

### Comportamiento

- **Preview:** 9 eventos por carril + tarjeta «Ver más» si hay más.
- **Modal de grupo:** al pulsar «Ver más», grid con todos los eventos del canal.
- **Eventos sin `catchupId`:** tarjeta atenuada y no reproducible (igual que legacy).
- **Rendimiento:** `content-visibility: auto` en cada sección de canal; imágenes con `loading="lazy"`.

### Pros

- Familiar para usuarios de VOD e Inicio (misma metáfora de carriles).
- Escala bien verticalmente (muchos canales) limitando ítems visibles por fila.
- Reutiliza `EmblaHorizontalRail` y patrones ya probados en TV.

### Contras

- Menos útil si el usuario busca «todo lo de ayer» sin importar el canal.
- Requiere modal o segunda pantalla para ver el catálogo completo de un canal largo.

### Archivos

| Archivo | Rol |
|---------|-----|
| `src/components/catchup/ChannelsRailsCatchupLayout.jsx` | Layout principal |
| `src/components/catchup/CatchupCard.jsx` | Tarjeta póster 16:9 |
| `src/components/catchup/CatchupSeeMoreCard.jsx` | «Ver más» por carril |
| `src/components/catchup/CatchupGroupModal.jsx` | Modal con todos los eventos del canal |
| `src/utils/catchupEvent.js` | Helpers compartidos (título, imagen, hora, id) |
| `src/styles/pages/_catchup.scss` | Estilos `--rails` |
| `brands.js` → `catchup.ui.activeLayout: 'rails'` | Activación por marca |

---

## Alternativa 2 — Timeline virtualizada

**Estado:** ❌ Descartado (no se implementará en esta iteración).

---

## Alternativa 3 — Hub en capas (disponible / en emisión / grabados)

**ID de layout:** `hub`  
**Estado:** ✅ Implementado (revisión pendiente)

### Descripción

Pantalla en **tres zonas** con prioridad de consumo:

1. **Disponible ahora** — eventos con `catchupId` listos para reproducir.
2. **En emisión** — programas en directo aún sin catchup (badge «Termina en X min»).
3. **Mis grabaciones** — tareas de DVR (`catchup.recorded`).

### Comportamiento (implementado)

- **Hero** con el evento disponible más reciente.
- Carril **Más disponible** con el resto de eventos reproducibles.
- Lista **En emisión** (sin `catchupId`, `endDate` futuro).
- Carril **Mis grabaciones**.
- Countdown actualizado cada 30 s.

### Archivos

| Archivo | Rol |
|---------|-----|
| `HubCatchupLayout.jsx` | Layout principal |
| `CatchupOnAirRow.jsx` | Fila en emisión |
| `catchupHub.js` | Clasificación por capas |

### Fase 2 (pendiente)

- Auto-refresh al cruzar `endDate`.
- Hero por canal favorito.

### Pros

- Comunica claramente **qué se puede ver ya** vs. qué llegará en minutos.
- Integra grabaciones personales en un solo hub.
- Base natural para auto-refresh post-emisión.

### Contras

- Lógica de estado temporal más compleja.
- Tres zonas en una pantalla → riesgo de sobrecarga visual.

### Cuándo elegirla

Productos con **grabaciones DVR** y usuarios que esperan contenido «apenas termine el programa».

---

## Matriz comparativa

| Criterio | 1 · Carriles | 2 · Timeline | 3 · Hub |
|----------|-------------|--------------|---------|
| Escaneo por canal | ★★★★★ | ★★☆☆☆ | ★★★☆☆ |
| Escaneo por fecha/hora | ★★☆☆☆ | ★★★★★ | ★★★☆☆ |
| Coherencia con VOD/Home | ★★★★★ | ★★★☆☆ | ★★★★☆ |
| Rendimiento (muchos eventos) | ★★★★☆ | ★★★★★ | ★★★☆☆ |
| Complejidad implementación | Baja | Alta | Media-alta |
| Auto-refresh post-emisión | Neutral | Neutral | **Encaja bien** |
| Navegación TV | Reutiliza patrón VOD | Requiere diseño nuevo | Requiere tabs/capas |

---

## Configuración (`brands.js`)

```javascript
catchup: {
  enabled: true,
},
```

---

## Próximos pasos sugeridos

1. **Revisión** del layout `rails` (UX, densidad, modal «Ver más»).
2. Hook `useCatchupPageTvNav` alineado con VOD.
3. Auto-refresh cuando termine la emisión (referencia legacy pendiente de migrar).
4. Decidir si `timeline-v2` o `hub` sustituye o complementa layouts actuales.

---

*Última actualización: junio 2026*
