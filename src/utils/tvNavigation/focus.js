// Primitivas de foco para navegación TV (LRUD).
// No dependen de React; pueden usarse desde hooks o handlers imperativos.

/**
 * Verifica si un elemento del DOM puede recibir foco según las convenciones
 * de la app: existe, no está disabled y no tiene tabIndex=-1.
 */
function isFocusable(el) {
  if (!el) return false;
  if (el.disabled) return false;
  if (typeof el.tabIndex === 'number' && el.tabIndex === -1) return false;
  return true;
}

/**
 * Intenta enfocar un elemento del DOM de forma segura.
 * Aplica los mismos chequeos que `focusById`.
 */
export function focusElement(el) {
  if (!isFocusable(el)) return false;
  try {
    el.focus();
    return true;
  } catch {
    return false;
  }
}

/**
 * Intenta enfocar un elemento por id de forma segura.
 * Retorna true si el foco se aplicó.
 */
export function focusById(id) {
  if (!id) return false;
  try {
    return focusElement(document.getElementById(String(id)));
  } catch {
    return false;
  }
}

/**
 * Enfoca el primer id disponible en la lista (best-effort).
 * Retorna el id efectivamente enfocado o null.
 */
export function focusFirstAvailable(ids) {
  if (!Array.isArray(ids)) return null;
  for (const id of ids) {
    if (focusById(id)) return id;
  }
  return null;
}

/**
 * Recolecta los `id` de los elementos navegables dentro de `root` que
 * matchean el selector dado (por defecto `[data-tv-nav]`).
 *
 * Solo retorna ids no vacíos y deduplicados (preservando el orden de aparición
 * en el DOM). El consumidor decide qué hacer con elementos disabled o con
 * tabIndex=-1; aquí solo nos encargamos del descubrimiento.
 */
export function findFocusableIds(root, selector = '[data-tv-nav]') {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  try {
    const nodes = Array.from(root.querySelectorAll(selector));
    const seen = new Set();
    const ids = [];
    for (const el of nodes) {
      const id = el && el.id ? String(el.id) : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  } catch {
    return [];
  }
}

/**
 * Mueve el foco al siguiente id navegable dentro de `ids` partiendo de
 * `fromId` y avanzando en `direction` ('up' | 'down').
 *
 * Salta elementos disabled o con tabIndex=-1.
 * Retorna el id enfocado, o null si no encontró un destino válido.
 */
export function focusNextInList(fromId, ids, direction) {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const delta = direction === 'up' ? -1 : 1;
  const fromIdx = ids.indexOf(fromId);
  let i = fromIdx >= 0 ? fromIdx + delta : (direction === 'up' ? ids.length - 1 : 0);
  while (i >= 0 && i < ids.length) {
    const id = ids[i];
    if (focusById(id)) return id;
    i += delta;
  }
  return null;
}

/**
 * Recolecta los HTMLElement navegables dentro de `root` que matcheen el
 * selector dado (por defecto `[data-tv-nav]`). Filtra elementos disabled
 * y con tabIndex=-1.
 *
 * Útil para listas dinámicas donde no querés asignar IDs sintéticos por
 * item (ej. items de un map). Preserva el orden de aparición en el DOM.
 */
export function findFocusableElements(root, selector = '[data-tv-nav]') {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  try {
    const nodes = Array.from(root.querySelectorAll(selector));
    return nodes.filter(isFocusable);
  } catch {
    return [];
  }
}

/**
 * Mueve el foco al siguiente HTMLElement navegable dentro de `elements`
 * partiendo de `currentEl` y avanzando en `direction` ('up' | 'down').
 *
 * Salta elementos disabled o con tabIndex=-1.
 * Retorna el elemento enfocado, o null si no encontró un destino válido.
 */
export function focusNextElementInList(currentEl, elements, direction) {
  if (!Array.isArray(elements) || elements.length === 0) return null;
  const delta = direction === 'up' ? -1 : 1;
  const fromIdx = elements.indexOf(currentEl);
  let i = fromIdx >= 0 ? fromIdx + delta : (direction === 'up' ? elements.length - 1 : 0);
  while (i >= 0 && i < elements.length) {
    const el = elements[i];
    if (focusElement(el)) return el;
    i += delta;
  }
  return null;
}
