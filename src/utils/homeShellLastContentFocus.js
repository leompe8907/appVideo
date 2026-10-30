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
 * Busca la tarjeta de canal (`data-id`, ver BouquetLayouts.jsx) que corresponde
 * al canal que está sonando AHORA, en vez de reusar la referencia recordada al
 * abrir el player (que queda desactualizada si el usuario hizo zapping
 * adentro del player -- ese cambio nunca toca la grilla de Inicio).
 * @param {HTMLElement | null | undefined} mainEl
 * @param {string | number | null | undefined} channelId
 * @returns {HTMLElement | null}
 */
function getChannelCardFocusTarget(mainEl, channelId) {
  if (!(mainEl instanceof HTMLElement)) return null;
  if (channelId === null || channelId === undefined || channelId === '') return null;
  try {
    const selector = `[data-id="${CSS.escape(String(channelId))}"]`;
    const candidate = mainEl.querySelector(selector);
    return isRestorableFocusTarget(candidate, mainEl) ? candidate : null;
  } catch {
    return null;
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
 * @param {{ maxAttempts?: number, channelId?: string | number | null }} [opts]
 *   `channelId`: id del último canal en vivo reproducido (antes de que close()
 *   lo limpie a null) -- si su tarjeta sigue visible en la grilla, se prioriza
 *   sobre el elemento recordado al abrir (que sería el del canal de ENTRADA,
 *   no el actual, si hubo zapping en el medio).
 * @returns {() => void} cancelar reintentos
 */
export function scheduleRestoreMainShellFocus(opts = {}) {
  const maxAttempts = typeof opts.maxAttempts === 'number' ? opts.maxAttempts : 24;
  const channelId = opts.channelId ?? null;
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

    const channelCard = getChannelCardFocusTarget(main, channelId);
    if (channelCard && focusElementSafe(channelCard)) {
      scrollRestoredElementIntoView(channelCard, main);
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
