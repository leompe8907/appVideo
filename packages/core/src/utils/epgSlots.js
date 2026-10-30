// Lógica pura de cálculo de slots EPG ("antes/ahora/siguiente/más tarde") y
// de progreso del evento en vivo. Separada de `EpgCards.jsx` a propósito:
// ese archivo solo puede exportar componentes (regla `react-refresh/only-
// export-components`) para que el Fast Refresh de Vite funcione bien; estas
// funciones son puro cálculo y además así se pueden testear sin montar nada.

import { parseEpgDateToMs } from './epgTime';

// Date, número o "YYYY-MM-DD HH:mm:ss" (UTC). Antes un string caía en la rama
// `valueOf` y devolvía null.
export function asMs(dateLike) {
  return parseEpgDateToMs(dateLike);
}

/** Inicio/fin del evento; `startDate`/`endDate` llegan como `{}` tras restaurar caché. */
const startOf = (ev) => asMs(ev?.startDate) ?? asMs(ev?.start);
const endOf = (ev) => asMs(ev?.endDate) ?? asMs(ev?.end);

export function formatHHmm(ms) {
  if (!ms || Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

// La guía calcula los slots de cada fila en cada render (cada 15 s y en cada
// pulsación): el orden se calcula una vez por lista de eventos. Las listas no
// se mutan (cada carga asigna un array nuevo), así que sirve de clave.
const sortedCache = new WeakMap();

function getSortedEvents(epgItems) {
  if (!Array.isArray(epgItems)) return [];
  let list = sortedCache.get(epgItems);
  if (!list) {
    list = [...epgItems].sort((a, b) => (startOf(a) ?? 0) - (startOf(b) ?? 0));
    sortedCache.set(epgItems, list);
  }
  return list;
}

/**
 * Calcula el % ya transcurrido y el tiempo restante (ms) de un evento en
 * vivo. Función pura para poder testear la lógica de `EpgLiveProgress` sin
 * necesidad de montar el componente / simular reflow del DOM.
 * @returns {{ elapsedPercent: number, remainingMs: number } | null}
 */
export function computeLiveProgressStyle(startMs, endMs, now = Date.now()) {
  if (startMs == null || endMs == null) return null;
  const total = endMs - startMs;
  if (!(total > 0)) return null;
  const elapsed = clamp(now - startMs, 0, total);
  return { elapsedPercent: (elapsed / total) * 100, remainingMs: total - elapsed };
}

const EMPTY_SLOTS = {
  before: null,
  now: null,
  next: null,
  later: null,
  isLive: false,
  canPageBefore: false,
  canPageLater: false,
  beforeOffset: 0,
  laterOffset: 0,
};

/**
 * `beforeOffset` / `laterOffset`: cuántos eventos se corrió el usuario en
 * "Antes" (hacia atrás) y "Más tarde" (hacia adelante) en esa fila; se acotan
 * a los datos y se devuelven ya acotados (para paginar una columna global
 * desde lo que esa fila muestra). `canPageBefore` / `canPageLater`: si hay
 * otro evento más allá.
 */
export function computeSlots(epgItems, { nowMs, epgPastEnabled = false, beforeOffset = 0, laterOffset = 0 } = {}) {
  const events = getSortedEvents(epgItems);
  if (!events.length || nowMs == null) return { ...EMPTY_SLOTS };

  let idxNow = events.findIndex((ev) => {
    const s = startOf(ev);
    const e = endOf(ev);
    if (s == null || e == null) return false;
    return nowMs >= s && nowMs <= e;
  });

  // Si no hay evento live, usamos:
  // - primer evento futuro como "now"
  // - si no hay futuro, el último evento como "now"
  if (idxNow < 0) {
    idxNow = events.findIndex((ev) => {
      const s = startOf(ev);
      if (s == null) return false;
      return s > nowMs;
    });
    if (idxNow < 0) idxNow = events.length - 1;
  }

  const now = events[idxNow] ?? null;
  const effBefore = epgPastEnabled ? clamp(beforeOffset, 0, Math.max(0, idxNow - 1)) : 0;
  const effLater = clamp(laterOffset, 0, Math.max(0, events.length - 1 - (idxNow + 2)));
  const beforeIdx = idxNow - 1 - effBefore;
  const laterIdx = idxNow + 2 + effLater;
  const before = epgPastEnabled ? events[beforeIdx] ?? null : null;
  const next = events[idxNow + 1] ?? null;
  const later = events[laterIdx] ?? null;

  const isLive = (() => {
    if (!now) return false;
    const s = startOf(now);
    const e = endOf(now);
    if (s == null || e == null) return false;
    return nowMs >= s && nowMs <= e;
  })();

  return {
    before,
    now,
    next,
    later,
    isLive,
    canPageBefore: epgPastEnabled && beforeIdx > 0,
    canPageLater: laterIdx < events.length - 1,
    beforeOffset: effBefore,
    laterOffset: effLater,
  };
}
