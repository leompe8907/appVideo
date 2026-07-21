/**
 * Motor de navegación espacial (geometría de pantalla) para control remoto TV.
 *
 * Idea central: no importa si un contenedor es un CSS grid, un flex, una lista
 * absoluta o un modal — el algoritmo solo necesita la posición real en pantalla
 * (`getBoundingClientRect`) del elemento con foco y de los candidatos visibles.
 * Esto reemplaza los modelos lógicos de fila/columna que antes tenía cada
 * pantalla (`inicioBouquetTvGrid.js`, `vodTvGrid.js`, `useEpgCardsTvNav.js`,
 * etc. — ya eliminados): un solo algoritmo sirve para el muro de Inicio, VOD,
 * EPG, Search, modales, Sidebar y cualquier pantalla nueva, sin escribir un
 * hook por pantalla.
 *
 * Referencia conceptual: mismo enfoque que W3C CSS Spatial Navigation y librerías
 * como js-spatial-navigation — penalizar fuerte el desalineamiento perpendicular,
 * usar la distancia en el eje de movimiento como desempate.
 */

import { requestTvFocusRingSync } from '../components/navigation/TvFocusRing';

/**
 * Selector de elementos potencialmente enfocables (mismo criterio en toda la app).
 *
 * Cada regla excluye explícitamente `tabindex="-1"`: un control nativo (input,
 * button, etc.) con `tabIndex={-1}` está deliberadamente sacado del orden de
 * navegación (ej. `ParentalPinGate` en TV, donde el PIN se ingresa con el
 * teclado numérico en pantalla, no escribiendo en el `<input>`), y sin esta
 * exclusión el motor de geometría lo encontraría igual por ser un `<input>`.
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]:not([href=""]):not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * @param {Element | null | undefined} el
 * @returns {boolean}
 */
export function isVisibleFocusable(el) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hasAttribute('disabled')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.closest('[data-tv-nav-blocked="true"]')) return false;
  try {
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') {
      return false;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    // Fuera de la ventana visible (scrolleado lejos): no es un candidato útil de foco directo.
    if (r.bottom < -50 || r.top > window.innerHeight + 50) return false;
    if (r.right < -50 || r.left > window.innerWidth + 50) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Candidatos enfocables visibles dentro de un `root` (por defecto, todo el documento).
 * @param {HTMLElement | Document | null | undefined} root
 * @returns {HTMLElement[]}
 */
export function getFocusableCandidates(root) {
  const scope = root instanceof HTMLElement ? root : document.body;
  if (!scope) return [];
  try {
    const nodes = Array.from(scope.querySelectorAll(FOCUSABLE_SELECTOR));
    return nodes.filter(isVisibleFocusable);
  } catch {
    return [];
  }
}

/**
 * Puntúa un candidato para moverse en `direction` desde `fromRect`.
 * Menor puntaje = mejor candidato. `null` = el candidato no está en esa dirección.
 * @param {DOMRect} fromRect
 * @param {DOMRect} toRect
 * @param {'left'|'right'|'up'|'down'} direction
 * @returns {number | null}
 */
function scoreCandidate(fromRect, toRect, direction) {
  const fromCenterX = fromRect.left + fromRect.width / 2;
  const fromCenterY = fromRect.top + fromRect.height / 2;
  const toCenterX = toRect.left + toRect.width / 2;
  const toCenterY = toRect.top + toRect.height / 2;

  if (direction === 'right' || direction === 'left') {
    const primary = direction === 'right' ? toRect.left - fromRect.right : fromRect.left - toRect.right;
    if (primary < -1) return null; // el candidato no está realmente hacia ese lado
    const overlapTop = Math.max(fromRect.top, toRect.top);
    const overlapBottom = Math.min(fromRect.bottom, toRect.bottom);
    const overlap = Math.max(0, overlapBottom - overlapTop);
    const perpDist = Math.abs(fromCenterY - toCenterY);
    return Math.max(primary, 1) + perpDist * 2.2 - overlap * 0.6;
  }

  if (direction === 'down' || direction === 'up') {
    const primary = direction === 'down' ? toRect.top - fromRect.bottom : fromRect.top - toRect.bottom;
    if (primary < -1) return null;
    const overlapLeft = Math.max(fromRect.left, toRect.left);
    const overlapRight = Math.min(fromRect.right, toRect.right);
    const overlap = Math.max(0, overlapRight - overlapLeft);
    const perpDist = Math.abs(fromCenterX - toCenterX);
    return Math.max(primary, 1) + perpDist * 2.2 - overlap * 0.6;
  }

  return null;
}

/**
 * Busca el mejor candidato visualmente en `direction` a partir de `currentEl`, dentro de `root`.
 * @param {HTMLElement} currentEl
 * @param {'left'|'right'|'up'|'down'} direction
 * @param {HTMLElement | Document | null | undefined} [root]
 * @returns {HTMLElement | null}
 */
export function findNextFocusable(currentEl, direction, root) {
  if (!(currentEl instanceof HTMLElement)) return null;
  let fromRect;
  try {
    fromRect = currentEl.getBoundingClientRect();
  } catch {
    return null;
  }

  const candidates = getFocusableCandidates(root).filter((el) => el !== currentEl);

  let best = null;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    let toRect;
    try {
      toRect = candidate.getBoundingClientRect();
    } catch {
      continue;
    }
    const score = scoreCandidate(fromRect, toRect, direction);
    if (score === null) continue;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/**
 * Enfoca `el` sin lanzar si el navegador rechaza el foco (elemento removido, etc).
 * @param {HTMLElement | null | undefined} el
 * @returns {boolean}
 */
export function focusElementSafe(el) {
  if (!(el instanceof HTMLElement)) return false;
  try {
    el.focus({ preventScroll: true });
    return document.activeElement === el;
  } catch {
    return false;
  }
}

function isScrollableContainer(el) {
  try {
    const s = window.getComputedStyle(el);
    const sx = s.overflowX === 'auto' || s.overflowX === 'scroll';
    const sy = s.overflowY === 'auto' || s.overflowY === 'scroll';
    if (!sx && !sy) return false;
    return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  } catch {
    return false;
  }
}

function getScrollableAncestorsChain(el, topAncestor) {
  const chain = [];
  if (!(el instanceof HTMLElement)) return chain;
  const top = topAncestor instanceof HTMLElement ? topAncestor : document.body;
  if (!top.contains(el)) return chain;
  let p = el.parentElement;
  while (p) {
    if (isScrollableContainer(p)) chain.push(p);
    if (p === top) break;
    p = p.parentElement;
  }
  return chain;
}

/**
 * Guarda scrollTop/scrollLeft de los contenedores scrolleables entre `el` y
 * `topAncestor`, para poder deshacer un auto-scroll no deseado.
 * @param {HTMLElement} el
 * @param {HTMLElement} [topAncestor]
 */
function snapshotScrollPositions(el, topAncestor) {
  return getScrollableAncestorsChain(el, topAncestor).map((container) => ({
    container,
    top: container.scrollTop,
    left: container.scrollLeft,
  }));
}

/** @param {Array<{container: HTMLElement, top: number, left: number}>} snapshots */
function restoreScrollPositions(snapshots) {
  for (const { container, top, left } of snapshots) {
    try {
      container.scrollTop = top;
      container.scrollLeft = left;
    } catch {
      /* noop */
    }
  }
}

/**
 * Desplaza los ancestros scrolleables entre `el` y `topAncestor` para que `el`
 * quede visible. Genérico: no asume estructura de fila/columna.
 * @param {HTMLElement} el
 * @param {HTMLElement} [topAncestor]
 * @param {{ margin?: number }} [opts]
 */
export function scrollIntoViewWithinAncestors(el, topAncestor, opts = {}) {
  if (!(el instanceof HTMLElement)) return;
  const top = topAncestor instanceof HTMLElement ? topAncestor : document.body;
  if (!top.contains(el)) return;
  const margin = typeof opts.margin === 'number' ? opts.margin : 20;

  const chain = [];
  let p = el.parentElement;
  while (p) {
    if (isScrollableContainer(p)) chain.push(p);
    if (p === top) break;
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
        if (er.top < cr.top + margin) container.scrollTop += er.top - cr.top - margin;
        er = el.getBoundingClientRect();
        cr = container.getBoundingClientRect();
        if (er.bottom > cr.bottom - margin) container.scrollTop += er.bottom - cr.bottom + margin;
      }

      er = el.getBoundingClientRect();
      cr = container.getBoundingClientRect();
      if (canX && container.scrollWidth > container.clientWidth + 1) {
        if (er.left < cr.left + margin) container.scrollLeft += er.left - cr.left - margin;
        er = el.getBoundingClientRect();
        cr = container.getBoundingClientRect();
        if (er.right > cr.right - margin) container.scrollLeft += er.right - cr.right + margin;
      }
    } catch {
      /* noop */
    }
  }
}

/**
 * Mueve el foco desde `document.activeElement` en `direction`, dentro de `root`.
 * @param {'left'|'right'|'up'|'down'} direction
 * @param {HTMLElement | Document | null | undefined} [root]
 * @returns {boolean} true si se movió el foco (la tecla debe considerarse consumida)
 */
export function moveFocus(direction, root) {
  const current = document.activeElement;
  if (!(current instanceof HTMLElement) || current === document.body) {
    // Sin foco real puesto todavía: colocar el primero disponible en vez de no hacer nada.
    const candidates = getFocusableCandidates(root);
    if (!candidates.length) return false;
    const scopeRoot = root instanceof HTMLElement ? root : undefined;
    const snapshots = snapshotScrollPositions(candidates[0], scopeRoot);
    const placed = focusElementSafe(candidates[0]);
    // Algunos WebViews de TV (Tizen/webOS 2019) no respetan `{ preventScroll: true }`
    // y hacen su propio auto-scroll "a ciegas" al enfocar — se ve como un pequeño
    // scroll de más antes de que el foco "asiente" en la posición correcta.
    // Deshacer ese auto-scroll ANTES de aplicar el nuestro (síncrono, mismo tick,
    // sin repintar de por medio) evita ese salto visible.
    restoreScrollPositions(snapshots);
    if (placed) scrollIntoViewWithinAncestors(candidates[0], scopeRoot);
    return placed;
  }

  const scopeRoot = root instanceof HTMLElement ? root : document.body;
  if (!scopeRoot.contains(current)) return false;

  const next = findNextFocusable(current, direction, scopeRoot);
  if (!next) return false;
  const snapshots = snapshotScrollPositions(next, scopeRoot);
  if (!focusElementSafe(next)) return false;
  restoreScrollPositions(snapshots);
  scrollIntoViewWithinAncestors(next, scopeRoot);
  try {
    requestTvFocusRingSync?.();
  } catch {
    /* noop */
  }
  return true;
}

/**
 * Coloca el foco en el primer candidato visible dentro de `root`, reintentando
 * unos frames si el contenido todavía no montó (reemplaza los ~8 pollings de
 * rAF que existían antes, uno por pantalla).
 * @param {HTMLElement | string} root Elemento o selector CSS
 * @param {{ maxAttempts?: number }} [opts]
 * @returns {() => void} función de cancelación
 */
export function focusFirstIn(root, opts = {}) {
  const maxAttempts = typeof opts.maxAttempts === 'number' ? opts.maxAttempts : 24;
  let cancelled = false;
  let attempts = 0;
  let rafId = null;

  const tryOnce = () => {
    if (cancelled) return;
    const scopeRoot = typeof root === 'string' ? document.querySelector(root) : root;
    if (scopeRoot instanceof HTMLElement) {
      const candidates = getFocusableCandidates(scopeRoot);
      if (candidates.length > 0) {
        const snapshots = snapshotScrollPositions(candidates[0], scopeRoot);
        const placed = focusElementSafe(candidates[0]);
        restoreScrollPositions(snapshots);
        if (placed) {
          scrollIntoViewWithinAncestors(candidates[0], scopeRoot);
          try {
            requestTvFocusRingSync?.();
          } catch {
            /* noop */
          }
          return;
        }
      }
    }
    attempts += 1;
    if (attempts < maxAttempts) {
      rafId = requestAnimationFrame(tryOnce);
    }
  };

  rafId = requestAnimationFrame(tryOnce);
  return () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
  };
}
