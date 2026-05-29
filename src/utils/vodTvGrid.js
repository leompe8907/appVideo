import { getVisibleFocusablesInContainer } from './homeShellNavigation';
import { groupChannelCardsIntoVisualRows } from './inicioBouquetTvGrid';

/** Contenedor de carril horizontal de tarjetas VOD (`.vod-row-cards`). */
export const VOD_ROW_CARDS_SELECTOR = '.vod-row-cards';

/**
 * @param {HTMLElement | null | undefined} rowEl
 * @returns {HTMLElement[]}
 */
export function getVodRowFocusables(rowEl) {
  if (!(rowEl instanceof HTMLElement)) return [];
  return getVisibleFocusablesInContainer(rowEl);
}

/**
 * Filas de bouquets VOD: cada `.vod-row-cards` = una fila horizontal.
 * @param {HTMLElement | null | undefined} root
 * @returns {HTMLElement[][]}
 */
export function buildVodBouquetRows(root) {
  if (!root) return [];
  const rows = [];
  try {
    root.querySelectorAll(VOD_ROW_CARDS_SELECTOR).forEach((rowEl) => {
      const cards = getVodRowFocusables(rowEl);
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
export function findVodCardCellInRows(card, rows) {
  for (let ri = 0; ri < rows.length; ri += 1) {
    const ci = rows[ri].indexOf(card);
    if (ci >= 0) return { ri, ci };
  }
  return null;
}

/**
 * @param {HTMLElement} activeElement
 * @param {HTMLElement | null | undefined} rowEl
 * @returns {boolean}
 */
export function isLeftmostVodCardInRow(activeElement, rowEl) {
  if (!(activeElement instanceof HTMLElement) || !(rowEl instanceof HTMLElement)) return false;
  const list = getVodRowFocusables(rowEl);
  return list.length > 0 && list[0] === activeElement;
}

/**
 * True si `activeElement` es la primera tarjeta visible de su fila VOD dentro de `root`.
 * @param {HTMLElement} activeElement
 * @param {HTMLElement | null | undefined} root — p. ej. `.vod-page .vod-content`
 * @returns {boolean}
 */
export function isLeftmostVodCardInVodPage(activeElement, root) {
  if (!(activeElement instanceof HTMLElement) || !(root instanceof HTMLElement)) return false;
  const card = activeElement.closest('.vod-card');
  if (!card || !root.contains(card)) return false;
  const rowEl = card.closest(VOD_ROW_CARDS_SELECTOR);
  if (!rowEl || !root.contains(rowEl)) return false;
  return isLeftmostVodCardInRow(activeElement, rowEl);
}

/** Filas visuales del grid del modal de categoría (`.vod-category-grid`). */
export function buildVodCategoryGridRows(gridEl) {
  if (!(gridEl instanceof HTMLElement)) return [];
  const cards = getVodRowFocusables(gridEl);
  if (!cards.length) return [];
  return groupChannelCardsIntoVisualRows(cards);
}

export const VOD_DETAIL_FOCUS_SELECTOR = '[data-tv-nav="vod-detail"]';
export const VOD_CATEGORY_GRID_SELECTOR = '.vod-category-grid';
