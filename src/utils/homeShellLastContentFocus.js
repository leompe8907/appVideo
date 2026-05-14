/**
 * Recuerda el último foco del `main` antes de pasar al sidebar (TV), para restaurarlo con RIGHT.
 * Se invalida al cambiar de ruta.
 */

/** @type {HTMLElement | null} */
let lastMainFocusEl = null;

export function rememberMainShellFocus(el) {
  if (el instanceof HTMLElement) {
    lastMainFocusEl = el;
  }
}

export function clearMainShellFocusMemory() {
  lastMainFocusEl = null;
}

/**
 * @param {HTMLElement | null | undefined} mainEl
 * @returns {boolean}
 */
function isRestorableFocusTarget(el, mainEl) {
  if (!(el instanceof HTMLElement) || !(mainEl instanceof HTMLElement)) return false;
  try {
    if (!document.documentElement.contains(el) || !mainEl.contains(el)) return false;
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
 * Devuelve el último foco recordado si sigue siendo válido dentro de `mainEl` (no lo borra).
 * @param {HTMLElement | null | undefined} mainEl
 * @returns {HTMLElement | null}
 */
export function getRestoredMainFocusTargetIfValid(mainEl) {
  if (isRestorableFocusTarget(lastMainFocusEl, mainEl)) {
    return lastMainFocusEl;
  }
  return null;
}
