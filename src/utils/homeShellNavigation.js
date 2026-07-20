/**
 * Utilidades de foco compartidas del shell Home (TV).
 *
 * El posicionamiento de foco inicial al navegar entre secciones (sidebar →
 * contenido) ahora lo resuelve el motor de navegación espacial genérico
 * (`focusFirstIn` en `src/navigation/spatialNavigation.js`), no este módulo.
 * Lo que queda acá son utilidades de bajo nivel (foco seguro, scroll de
 * elementos enfocados dentro de contenedores con overflow) que todavía usa
 * `homeShellLastContentFocus.js` para restaurar el foco tras cerrar el
 * reproductor.
 */

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
