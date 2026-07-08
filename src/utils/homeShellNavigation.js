/**
 * Utilidades de foco para navegación shell Home (TV): sidebar ↔ contenido.
 */

import { requestTvFocusRingSync } from '../components/navigation/TvFocusRing';
import { buildVodBouquetRows } from './vodTvGrid';

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
 * Primer foco según la ruta activa (evita enfocar la sección anterior tras sidebar).
 * @param {HTMLElement} mainEl
 * @param {string} [pathname]
 * @returns {{ target: HTMLElement, scrollRoot: HTMLElement } | null}
 */
function resolveFirstMainFocusTarget(mainEl, pathname) {
  const path = pathname || window.location.pathname || '';

  if (path === '/home/vod') {
    const content = mainEl.querySelector('.vod-page .vod-content');
    if (content instanceof HTMLElement) {
      const rows = buildVodBouquetRows(content);
      const first = rows[0]?.[0];
      if (first instanceof HTMLElement && isRoughlyVisible(first)) {
        return { target: first, scrollRoot: content };
      }
      const errBtn = mainEl.querySelector('.vod-page .vod-error-refresh-button');
      if (errBtn instanceof HTMLElement && isRoughlyVisible(errBtn)) {
        return { target: errBtn, scrollRoot: content };
      }
    }
    return null;
  }

  if (path === '/home/inicio' || path === '/home/servicios-tv-radio') {
    const scroll = mainEl.querySelector('.bouquet-inicio-scroll');
    if (scroll instanceof HTMLElement) {
      const list = getVisibleFocusablesInContainer(scroll);
      if (list[0] instanceof HTMLElement) {
        return { target: list[0], scrollRoot: scroll };
      }
    }
  }

  if (path === '/home/buscador') {
    const search = mainEl.querySelector('.search-page');
    if (search instanceof HTMLElement) {
      const list = getVisibleFocusablesInContainer(search);
      if (list[0] instanceof HTMLElement) {
        return { target: list[0], scrollRoot: search };
      }
    }
  }

  const list = getVisibleFocusablesInContainer(mainEl);
  const target = list[0];
  if (!(target instanceof HTMLElement)) return null;

  const bouquetScroll = target.closest('.bouquet-inicio-scroll');
  if (bouquetScroll instanceof HTMLElement) {
    return { target, scrollRoot: bouquetScroll };
  }
  const vodContent = target.closest('.vod-page .vod-content');
  if (vodContent instanceof HTMLElement) {
    return { target, scrollRoot: vodContent };
  }
  const stack = mainEl.querySelector('.home-content-stack');
  return { target, scrollRoot: stack instanceof HTMLElement ? stack : mainEl };
}

/**
 * Tras elegir una sección en el sidebar (TV): primer foco visible del `main`.
 * Reintenta hasta que la ruta nueva haya montado el contenido.
 *
 * @param {{ maxAttempts?: number, pathname?: string }} [opts]
 * @returns {() => void}
 */
export function scheduleFocusFirstMainContent(opts = {}) {
  const maxAttempts = typeof opts.maxAttempts === 'number' ? opts.maxAttempts : 48;
  const pathname = typeof opts.pathname === 'string' ? opts.pathname : window.location.pathname || '';
  let cancelled = false;
  let attempt = 0;

  const tryOnce = () => {
    if (cancelled) return;
    const mainEl = document.querySelector('main.home-content[data-home-scope="content"]');
    if (!(mainEl instanceof HTMLElement)) {
      attempt += 1;
      if (attempt < maxAttempts) requestAnimationFrame(tryOnce);
      return;
    }

    const resolved = resolveFirstMainFocusTarget(mainEl, pathname);
    if (resolved?.target instanceof HTMLElement && focusElementSafe(resolved.target)) {
      scrollElementIntoVisibleScrollAncestors(resolved.target, resolved.scrollRoot);
      requestTvFocusRingSync();
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
