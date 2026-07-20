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
    el.focus({ preventScroll: true });
    return true;
  } catch {
    try {
      el.focus();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Intenta enfocar un elemento por id de forma segura.
 * @param {string} id
 * @param {Map<string, HTMLElement>} [cache] Mapa opcional id → elemento (evita getElementById en D-pad).
 */
export function focusById(id, cache) {
  if (!id) return false;
  const key = String(id);
  try {
    const cached = cache?.get?.(key);
    if (cached) return focusElement(cached);
    const el = document.getElementById(key);
    if (el && cache) cache.set(key, el);
    return focusElement(el);
  } catch {
    return false;
  }
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
