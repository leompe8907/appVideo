/**
 * Modelo de filas/columnas del muro de bouquets en Inicio (TV).
 * Cada `.horizontal-slide` con tarjetas = una fila; cada `.bouquet-grid-vertical-content` = una fila.
 * @param {HTMLElement | null | undefined} wall
 * @returns {HTMLElement[][]}
 */
export function buildInicioBouquetChannelRows(wall) {
  if (!wall) return [];
  const rows = [];
  try {
    wall.querySelectorAll('.bouquet-row-carousel .horizontal-slide').forEach((slide) => {
      const cards = [...slide.querySelectorAll('.channel-card')];
      if (cards.length) rows.push(cards);
    });
    wall.querySelectorAll('.bouquet-grid-horizontal .horizontal-slide').forEach((slide) => {
      const cards = [...slide.querySelectorAll('.channel-card')];
      if (cards.length) rows.push(cards);
    });
    wall.querySelectorAll('.bouquet-grid-vertical-content').forEach((content) => {
      const cards = [...content.querySelectorAll('.channel-card')];
      if (cards.length) rows.push(cards);
    });
  } catch {
    /* noop */
  }
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
