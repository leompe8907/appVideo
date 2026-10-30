/**
 * EPG: evento "al aire" y ventana temporal — misma lógica que en bouquets (BouquetLayouts).
 * Centralizado para que el player HUD y la grilla usen la misma fuente de verdad.
 */

import { parseEpgDateToMs } from './epgTime';

/**
 * Inicio/fin del evento en ms. `startDate`/`endDate` son Date recién
 * cargados, pero al restaurar la caché persistente (JSON) llegan como `{}`:
 * en ese caso se usa `start`/`end` ("YYYY-MM-DD HH:mm:ss", UTC).
 * @returns {number} NaN si no hay fecha válida
 */
function eventMs(dateField, rawField) {
  const ms = parseEpgDateToMs(dateField) ?? parseEpgDateToMs(rawField);
  return ms == null ? NaN : ms;
}

/**
 * Título del evento: `languages[0].title` (formato de la API) o `title`.
 * @param {object|null} event
 * @returns {string}
 */
export function getEpgEventTitle(event) {
  if (!event) return '';
  if (event.languages?.[0]?.title) return event.languages[0].title;
  return event.title ?? '';
}

/**
 * @param {Array} epgItems
 * @returns {object|null}
 */
export function getCurrentEpgEvent(epgItems) {
  if (!Array.isArray(epgItems) || epgItems.length === 0) return null;
  const now = Date.now();
  let lastValid = null;
  for (const event of epgItems) {
    const startMs = eventMs(event.startDate, event.start);
    const endMs = eventMs(event.endDate, event.end);
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
  const startMs = eventMs(event.startDate, event.start);
  const endMs = eventMs(event.endDate, event.end);
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
