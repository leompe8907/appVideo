/**
 * Utilidades de foco para navegación shell Home (TV): sidebar ↔ contenido.
 */

const FOCUSABLE_SELECTOR =
  'a[href]:not([href=""]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * @param {Element | null | undefined} el
 * @returns {boolean}
 */
function isRoughlyVisible(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  try {
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
 * @param {Element | null | undefined} container
 * @returns {HTMLElement[]}
 */
export function getVisibleFocusablesInContainer(container) {
  if (!container || !(container instanceof HTMLElement)) return [];
  try {
    const nodes = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
    const out = [];
    for (const n of nodes) {
      if (!(n instanceof HTMLElement)) continue;
      if (!isRoughlyVisible(n)) continue;
      out.push(n);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * @param {HTMLElement} el
 * @returns {boolean}
 */
export function focusElementSafe(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  try {
    el.focus({ preventScroll: true });
    return document.activeElement === el;
  } catch {
    return false;
  }
}

/**
 * Indica si el elemento puede desplazarse en al menos un eje.
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isScrollableContainer(el) {
  try {
    const s = window.getComputedStyle(el);
    const ox = s.overflowX;
    const oy = s.overflowY;
    const sx = ox === 'auto' || ox === 'scroll';
    const sy = oy === 'auto' || oy === 'scroll';
    if (!sx && !sy) return false;
    return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  } catch {
    return false;
  }
}

/**
 * Desplaza cada ancestro con scroll entre `el` y `topAncestor` (incl.) para que `el` quede
 * dentro del viewport del contenedor (márgenes en px). Orden: de adentro hacia afuera.
 * @param {HTMLElement} el
 * @param {HTMLElement} topAncestor
 * @param {{ margin?: number }} [opts]
 */
export function scrollElementIntoVisibleScrollAncestors(el, topAncestor, opts = {}) {
  if (!(el instanceof HTMLElement) || !(topAncestor instanceof HTMLElement)) return;
  if (!topAncestor.contains(el)) return;
  const margin = typeof opts.margin === 'number' ? opts.margin : 20;

  /** @type {HTMLElement[]} */
  const chain = [];
  let p = el.parentElement;
  while (p) {
    if (!topAncestor.contains(p)) break;
    if (isScrollableContainer(p)) chain.push(p);
    if (p === topAncestor) break;
    p = p.parentElement;
  }

  for (const container of chain) {
    try {
      const style = window.getComputedStyle(container);
      const canY = style.overflowY === 'auto' || style.overflowY === 'scroll';
      const canX = style.overflowX === 'auto' || style.overflowX === 'scroll';

      let er = el.getBoundingClientRect();
      let cr = container.getBoundingClientRect();

      if (canY && container.scrollHeight > container.clientHeight + 1) {
        if (er.top < cr.top + margin) {
          container.scrollTop += er.top - cr.top - margin;
        }
        er = el.getBoundingClientRect();
        cr = container.getBoundingClientRect();
        if (er.bottom > cr.bottom - margin) {
          container.scrollTop += er.bottom - cr.bottom + margin;
        }
      }

      er = el.getBoundingClientRect();
      cr = container.getBoundingClientRect();

      if (canX && container.scrollWidth > container.clientWidth + 1) {
        if (er.left < cr.left + margin) {
          container.scrollLeft += er.left - cr.left - margin;
        }
        er = el.getBoundingClientRect();
        cr = container.getBoundingClientRect();
        if (er.right > cr.right - margin) {
          container.scrollLeft += er.right - cr.right + margin;
        }
      }
    } catch {
      /* noop */
    }
  }
}

const HORIZONTAL_RAIL_SELECTOR = '[data-horizontal-scroll-rail], .horizontal-slide';

/**
 * Scroll vertical del muro + carril horizontal (última tarjeta visible por completo).
 * @param {HTMLElement} el
 * @param {HTMLElement} scrollRoot
 * @param {{ railMargin?: number }} [opts]
 */
export function scrollFocusIntoBouquetMuro(el, scrollRoot, opts = {}) {
  const railMargin = typeof opts.railMargin === 'number' ? opts.railMargin : 32;
  const rail = el.closest?.(HORIZONTAL_RAIL_SELECTOR);
  if (rail instanceof HTMLElement && scrollRoot.contains(rail)) {
    scrollElementIntoVisibleScrollAncestors(el, rail, { margin: railMargin });
  }
  if (scrollRoot instanceof HTMLElement) {
    scrollElementIntoVisibleScrollAncestors(el, scrollRoot);
  }
}
