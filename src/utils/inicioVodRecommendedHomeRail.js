import { getVodRowFocusables } from './vodTvGrid';

/**
 * @param {HTMLElement | null | undefined} scrollRoot — `.bouquet-inicio-scroll`
 * @returns {HTMLElement | null}
 */
function getFirstVisibleVodRecommendedFocusable(scrollRoot) {
  if (!(scrollRoot instanceof HTMLElement)) return null;
  const row = scrollRoot.querySelector('.bouquet-vod-recommended .vod-row-cards');
  if (!(row instanceof HTMLElement)) return null;
  const list = getVodRowFocusables(row);
  return list[0] ?? null;
}

/**
 * True si el foco está en el primer ítem visible del carril VOD recomendados de Inicio
 * (puede ser "Ver todas" o la primera película, según DOM).
 * @param {HTMLElement} activeElement
 * @param {HTMLElement | null | undefined} scrollRoot
 * @returns {boolean}
 */
export function isLeftmostVodRecommendedRailFocusable(activeElement, scrollRoot) {
  if (!(activeElement instanceof HTMLElement) || !(scrollRoot instanceof HTMLElement)) return false;
  const first = getFirstVisibleVodRecommendedFocusable(scrollRoot);
  return Boolean(first && first === activeElement);
}
