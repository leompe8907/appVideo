import { focusElementSafe, scrollElementIntoVisibleScrollAncestors } from './homeShellNavigation';
import { getVodRowFocusables } from './vodTvGrid';

/** @type {HTMLElement | null} */
let lastVodPageFocusEl = null;
/** @type {HTMLElement | null} */
let lastVodCategoryFocusEl = null;
/** @type {string} */
let lastVodScrollRootSelector = '.vod-page .vod-content';

function isRestorable(el, root) {
  if (!(el instanceof HTMLElement)) return false;
  try {
    if (!document.documentElement.contains(el)) return false;
    if (root instanceof HTMLElement && !root.contains(el)) return false;
    if (el.hasAttribute('disabled')) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') {
      return false;
    }
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  } catch {
    return false;
  }
}

/**
 * @param {HTMLElement | null | undefined} el
 * @param {string} [scrollRootSelector]
 */
export function rememberVodPageFocus(el, scrollRootSelector) {
  if (el instanceof HTMLElement) {
    lastVodPageFocusEl = el;
    if (scrollRootSelector) lastVodScrollRootSelector = scrollRootSelector;
  }
}

/** @param {HTMLElement | null | undefined} el */
export function rememberVodCategoryFocus(el) {
  if (el instanceof HTMLElement) lastVodCategoryFocusEl = el;
}

export function clearVodCategoryFocusMemory() {
  lastVodCategoryFocusEl = null;
}

function queryScrollRoot() {
  return document.querySelector(lastVodScrollRootSelector);
}

/**
 * Tras cerrar el detalle VOD: volver al modal de categoría o a la página/carril.
 * @param {boolean} categoryModalOpen
 */
export function restoreVodFocusAfterDetailClose(categoryModalOpen) {
  const run = () => {
    if (categoryModalOpen) {
      const grid = document.querySelector('.vod-category-grid');
      if (grid instanceof HTMLElement) {
        if (isRestorable(lastVodCategoryFocusEl, grid)) {
          if (focusElementSafe(lastVodCategoryFocusEl)) {
            scrollElementIntoVisibleScrollAncestors(lastVodCategoryFocusEl, grid);
          }
          return;
        }
        const list = getVodRowFocusables(grid);
        if (list[0] && focusElementSafe(list[0])) {
          scrollElementIntoVisibleScrollAncestors(list[0], grid);
        }
      }
      return;
    }

    const scrollRoot = queryScrollRoot();
    if (scrollRoot instanceof HTMLElement && isRestorable(lastVodPageFocusEl, scrollRoot)) {
      if (focusElementSafe(lastVodPageFocusEl)) {
        scrollElementIntoVisibleScrollAncestors(lastVodPageFocusEl, scrollRoot);
      }
      return;
    }

    if (scrollRoot instanceof HTMLElement) {
      const list = getVodRowFocusables(scrollRoot);
      if (list[0]) {
        focusElementSafe(list[0]);
        scrollElementIntoVisibleScrollAncestors(list[0], scrollRoot);
      }
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
}

/** Tras cerrar el modal de categoría VOD. */
export function restoreVodPageFocusAfterCategoryClose() {
  clearVodCategoryFocusMemory();
  restoreVodFocusAfterDetailClose(false);
}
