/**
 * Navegación UP/DOWN del menú de canales del player en O(1): la fila siguiente es la hermana del DOM.
 * El motor geométrico (`moveFocus`) recorre las ~200 filas con getComputedStyle + getBoundingClientRect
 * en cada tecla, y en una TV, con el hilo ya ocupado por el descifrado del video, eso se notaba lento.
 */

/**
 * Nuevo `scrollTop` para que la fila quede dentro de la vista con `margin` px de aire (o el mismo si ya está).
 * @param {{ rowTop: number, rowHeight: number, scrollTop: number, viewHeight: number, margin?: number }} p
 */
export function computeListScrollTop({ rowTop, rowHeight, scrollTop, viewHeight, margin = 20 }) {
  let next = scrollTop;
  if (rowTop < scrollTop + margin) next = rowTop - margin;
  else if (rowTop + rowHeight > scrollTop + viewHeight - margin) next = rowTop + rowHeight - viewHeight + margin;
  return Math.max(0, next);
}

/**
 * Mueve el foco a la fila hermana anterior/siguiente.
 * @param {HTMLElement} listEl contenedor de las filas
 * @param {string} rowSelector selector de una fila
 * @param {'up'|'down'} direction
 * @returns {boolean} true si la tecla debe consumirse (también en los extremos, para no saltar fuera de la lista)
 */
export function moveRowFocus(listEl, rowSelector, direction) {
  const current = document.activeElement;
  if (!(current instanceof HTMLElement) || !listEl.contains(current)) return false;
  const row = current.closest(rowSelector);
  if (!row) return false;
  let next = direction === 'down' ? row.nextElementSibling : row.previousElementSibling;
  while (next && !next.matches(rowSelector)) {
    next = direction === 'down' ? next.nextElementSibling : next.previousElementSibling;
  }
  if (!next) return true;
  next.focus({ preventScroll: true });
  listEl.scrollTop = computeListScrollTop({
    rowTop: next.offsetTop,
    rowHeight: next.offsetHeight,
    scrollTop: listEl.scrollTop,
    viewHeight: listEl.clientHeight,
  });
  return true;
}
