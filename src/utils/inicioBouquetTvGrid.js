/** @type {WeakMap<HTMLElement, { rows: HTMLElement[][], signature: string }>} */
const wallRowsCache = new WeakMap();

function getWallLayoutSignature(wall) {
  const cardCount = wall.querySelectorAll('.channel-card').length;
  const scrollRoot = wall.closest('.bouquet-inicio-scroll');
  const scrollTop = scrollRoot instanceof HTMLElement ? scrollRoot.scrollTop : 0;
  return `${cardCount}|${scrollTop}|${wall.offsetHeight}|${wall.offsetWidth}`;
}

/**
 * Agrupa tarjetas de canal en filas visuales (misma altura en pantalla).
 * Cubre grid vertical, carruseles con flex-wrap (logo+LCN), etc.
 * Carruseles de una sola fila siguen siendo una fila lógica.
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
 * Modelo de filas/columnas del muro de bouquets en Inicio (TV).
 * Cada contenedor de tarjetas se parte en filas visuales (wrap, grid, etc.).
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
    wall.querySelectorAll('.bouquet-row-carousel .horizontal-slide').forEach((slide) => {
      const cards = [...slide.querySelectorAll('.channel-card')];
      if (cards.length) rows.push(...groupChannelCardsIntoVisualRows(cards));
    });
    wall.querySelectorAll('.bouquet-grid-horizontal .horizontal-slide').forEach((slide) => {
      const cards = [...slide.querySelectorAll('.channel-card')];
      if (cards.length) rows.push(...groupChannelCardsIntoVisualRows(cards));
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
 * True si `activeElement` es (o está dentro de) la tarjeta de canal más a la izquierda
 * de **su** fila en `.bouquet-wall` dentro de `scrollRoot` (cualquier bouquet del muro de Inicio).
 * @param {HTMLElement} activeElement
 * @param {HTMLElement | null | undefined} scrollRoot — p. ej. `.bouquet-inicio-scroll`
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
