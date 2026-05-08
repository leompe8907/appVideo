// Primitivas de foco para navegación TV (LRUD).
// No dependen de React; pueden usarse desde hooks o handlers imperativos.

/**
 * Intenta enfocar un elemento por id de forma segura.
 * Retorna true si el foco se aplicó.
 */
export function focusById(id) {
  if (!id) return false;
  try {
    const el = document.getElementById(String(id));
    if (!el) return false;
    if (el.disabled) return false;
    if (typeof el.tabIndex === 'number' && el.tabIndex === -1) return false;
    el.focus();
    return true;
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
    const el = document.getElementById(id);
    if (el && !el.disabled && el.tabIndex !== -1) {
      try {
        el.focus();
        return id;
      } catch {
        // probar siguiente
      }
    }
    i += delta;
  }
  return null;
}
