import { buildColumnFlowGridRows } from './horizontalBouquetGrid';

/** @type {WeakMap<HTMLElement, { rows: HTMLElement[][], signature: string }>} */
const wallRowsCache = new WeakMap();

function getWallLayoutSignature(wall) {
  const cardCount = wall.querySelectorAll('.channel-card').length;
  // No incluir scrollTop: invalidar al hacer scroll forzaba rebuild completo en cada flecha.
  return `${cardCount}|${wall.offsetHeight}|${wall.offsetWidth}`;
}

/**
 * Fuerza recomputo de filas en el próximo `buildInicioBouquetChannelRows` para ese muro.
 * @param {HTMLElement | null | undefined} wall
 */
export function invalidateInicioBouquetWallRowsCache(wall) {
  if (wall instanceof HTMLElement) {
    wallRowsCache.delete(wall);
  }
}

/**
 * Agrupa tarjetas de canal en filas visuales (misma altura en pantalla).
 * Cubre grid vertical, grid row-flow (logo+LCN), etc.
 * @param {HTMLElement[]} cards
 * @returns {HTMLElement[][]}
 */
export function groupChannelCardsIntoVisualRows(cards) {
  const list = cards.filter((c) => c instanceof HTMLElement);
  if (!list.length) return [];
  if (list.length === 1) return [list];

  const items = list.map((card) => {
    const r = card.getBoundingClientRect();
    const height = r.height > 0 ? r.height : 1;
    return {
      card,
      cy: r.top + height / 2,
      left: r.left,
      height,
    };
  });

  const heights = items.map((i) => i.height).filter((h) => h > 1);
  const refHeight = heights.length
    ? heights.reduce((a, b) => a + b, 0) / heights.length
    : 48;
  const rowThreshold = Math.max(28, refHeight * 0.45);

  items.sort((a, b) => {
    if (Math.abs(a.cy - b.cy) > rowThreshold) return a.cy - b.cy;
    return a.left - b.left;
  });

  const rows = [];
  let current = [items[0].card];
  let rowCy = items[0].cy;

  for (let i = 1; i < items.length; i += 1) {
    const item = items[i];
    if (Math.abs(item.cy - rowCy) <= rowThreshold) {
      current.push(item.card);
    } else {
      rows.push(current);
      current = [item.card];
      rowCy = item.cy;
    }
  }
  rows.push(current);

  return rows.map((row) => {
    return [...row].sort((a, b) => {
      const la = a.getBoundingClientRect().left;
      const lb = b.getBoundingClientRect().left;
      return la - lb;
    });
  });
}

/**
 * Filas lógicas de un track grid horizontal (flow column o row).
 * @param {HTMLElement} track
 * @returns {HTMLElement[][]}
 */
function buildRowsFromHorizontalGridTrack(track) {
  const flow = track.getAttribute('data-grid-flow') || 'column';
  const rowsN = parseInt(track.getAttribute('data-grid-rows') || '1', 10) || 1;
  const cards = [...track.querySelectorAll('.channel-card')];
  if (!cards.length) return [];

  if (flow === 'column') {
    return buildColumnFlowGridRows(cards, rowsN);
  }

  return groupChannelCardsIntoVisualRows(cards);
}

/**
 * Modelo de filas/columnas del muro de bouquets en Inicio (TV).
 * @param {HTMLElement | null | undefined} wall
 * @returns {HTMLElement[][]}
 */
export function buildInicioBouquetChannelRows(wall) {
  if (!wall) return [];

  const signature = getWallLayoutSignature(wall);
  const cached = wallRowsCache.get(wall);
  if (cached && cached.signature === signature) {
    return cached.rows;
  }

  const rows = [];
  try {
    wall.querySelectorAll('.bouquet-horizontal-grid-track').forEach((track) => {
      if (track instanceof HTMLElement) {
        rows.push(...buildRowsFromHorizontalGridTrack(track));
      }
    });
    wall.querySelectorAll('.bouquet-grid-vertical-content').forEach((content) => {
      const cards = [...content.querySelectorAll('.channel-card')];
      if (cards.length) rows.push(...groupChannelCardsIntoVisualRows(cards));
    });
  } catch {
    /* noop */
  }

  wallRowsCache.set(wall, { rows, signature });
  return rows;
}

/**
 * @param {HTMLElement} card
 * @param {HTMLElement[][]} rows
 * @returns {{ ri: number, ci: number } | null}
 */
export function findChannelCardCellInRows(card, rows) {
  for (let ri = 0; ri < rows.length; ri += 1) {
    const ci = rows[ri].indexOf(card);
    if (ci >= 0) return { ri, ci };
  }
  return null;
}

/**
 * True si `activeElement` es la tarjeta más a la izquierda de su fila en el muro.
 * @param {HTMLElement} activeElement
 * @param {HTMLElement | null | undefined} scrollRoot
 * @returns {boolean}
 */
export function isLeftmostChannelCardInInicioWall(activeElement, scrollRoot) {
  if (!(scrollRoot instanceof HTMLElement) || !(activeElement instanceof HTMLElement)) return false;
  const card = activeElement.closest('.channel-card');
  if (!card || !scrollRoot.contains(card)) return false;
  const wall = scrollRoot.querySelector('.bouquet-wall');
  if (!wall || !wall.contains(card)) return false;
  const rows = buildInicioBouquetChannelRows(wall);
  const pos = findChannelCardCellInRows(card, rows);
  return Boolean(pos && pos.ci === 0);
}
