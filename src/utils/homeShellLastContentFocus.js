/**
 * Recuerda el último foco del `main` (tarjeta, botón, etc.) para restaurarlo con RIGHT desde el sidebar
 * o al cerrar el reproductor. Se invalida al cambiar de ruta (`HomeInputDispatcher`).
 */

import {
  focusElementSafe,
  scrollElementIntoVisibleScrollAncestors,
} from './homeShellNavigation';

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
    if (el.closest('.home-shell-ui--hidden')) return false;
    if (el.closest('.home-global-player--active')) return false;
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
 * @param {HTMLElement} el
 * @param {HTMLElement} mainEl
 */
function scrollRestoredElementIntoView(el, mainEl) {
  const bouquetScroll = el.closest('.bouquet-inicio-scroll');
  if (bouquetScroll instanceof HTMLElement) {
    scrollElementIntoVisibleScrollAncestors(el, bouquetScroll);
    return;
  }
  const stack = mainEl.querySelector('.home-content-stack');
  if (stack instanceof HTMLElement) {
    scrollElementIntoVisibleScrollAncestors(el, stack);
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

/**
 * Tras cerrar el reproductor: reintenta enfocar el último elemento del `main` hasta que el shell
 * sea visible y el foco se aplique (el shell puede seguir oculto un frame tras `isPlayerActive`).
 *
 * @param {{ maxAttempts?: number }} [opts]
 * @returns {() => void} cancelar reintentos
 */
export function scheduleRestoreMainShellFocus(opts = {}) {
  const maxAttempts = typeof opts.maxAttempts === 'number' ? opts.maxAttempts : 24;
  let cancelled = false;
  let attempt = 0;

  const tryOnce = () => {
    if (cancelled) return;
    const main = document.querySelector('main.home-content[data-home-scope="content"]');
    if (!(main instanceof HTMLElement)) {
      attempt += 1;
      if (attempt < maxAttempts) requestAnimationFrame(tryOnce);
      return;
    }

    const restored = getRestoredMainFocusTargetIfValid(main);
    if (restored && focusElementSafe(restored)) {
      scrollRestoredElementIntoView(restored, main);
      return;
    }

    attempt += 1;
    if (attempt < maxAttempts) requestAnimationFrame(tryOnce);
  };

  const id = requestAnimationFrame(() => {
    requestAnimationFrame(tryOnce);
  });

  return () => {
    cancelled = true;
    cancelAnimationFrame(id);
  };
}
