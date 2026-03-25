/**
 * EPG: evento "al aire" y ventana temporal — misma lógica que en bouquets (BouquetLayouts).
 * Centralizado para que el player HUD y la grilla usen la misma fuente de verdad.
 */

/**
 * @param {Array} epgItems
 * @returns {object|null}
 */
export function getCurrentEpgEvent(epgItems) {
  if (!Array.isArray(epgItems) || epgItems.length === 0) return null;
  const now = Date.now();
  let lastValid = null;
  for (const event of epgItems) {
    const startMs = event.startDate?.valueOf?.() ?? new Date(event.start).getTime();
    const endMs = event.endDate?.valueOf?.() ?? new Date(event.end).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue;
    lastValid = event;
    if (now >= startMs && now <= endMs) return event;
    if (now < startMs) return lastValid ?? event;
  }
  return lastValid ?? epgItems[0] ?? null;
}

/**
 * @param {object|null} event
 * @returns {{ startMs: number, endMs: number }|null}
 */
export function getEpgEventTimeBoundsMs(event) {
  if (!event) return null;
  const startMs = event.startDate?.valueOf?.() ?? new Date(event.start).getTime();
  const endMs = event.endDate?.valueOf?.() ?? new Date(event.end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;
  return { startMs, endMs };
}

/**
 * Ventana del evento EPG actual para un canal con `epgItems` (preload / bouquets).
 * @param {Array} epgItems
 * @returns {{ startMs: number, endMs: number }|null}
 */
export function resolveLiveWindowFromEpgItems(epgItems) {
  const ev = getCurrentEpgEvent(epgItems);
  return getEpgEventTimeBoundsMs(ev);
}
