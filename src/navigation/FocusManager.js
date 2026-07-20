/**
 * Administrador central de la pila (stack) de foco/zonas para Smart TVs.
 *
 * Cada zona representa un "scope" activo de navegación (un modal, un overlay,
 * el teclado virtual, etc). Mientras haya una zona en el stack:
 *  - `NavigationRouter` busca candidatos de foco SOLO dentro de `containerEl`
 *    (si se indica), en vez de en todo el documento — esto "atrapa" LEFT/RIGHT/
 *    UP/DOWN dentro del modal sin que cada componente escriba su propio
 *    keydown ni su propio modelo de grilla.
 *  - BACK invoca `onBack` de la zona si existe; si no, hace `pop()` (cierra la
 *    zona y restaura el foco anterior).
 */
class FocusManager {
  constructor() {
    /** @type {Array<{ zoneId: string, previousActiveElement: Element|null, containerEl: HTMLElement|null, defaultFocusId: string|null, onBack: (() => void)|null }>} */
    this.stack = [];
  }

  /**
   * Empuja un nuevo contexto de foco (ej. un modal que se abre).
   * Guarda el elemento con foco previo para restaurarlo en `pop()`.
   *
   * @param {string} zoneId Identificador único de la zona (ej. 'confirm-modal', 'vod-category-grid')
   * @param {{ containerEl?: HTMLElement|null, defaultFocusId?: string|null, onBack?: (() => void)|null }} [opts]
   */
  push(zoneId, opts = {}) {
    const { containerEl = null, defaultFocusId = null, onBack = null } = opts;
    const prevActive = document.activeElement;

    // Si la zona ya está en el stack, no la duplicamos (evita push repetidos por re-render).
    this.stack = this.stack.filter((item) => item.zoneId !== zoneId);
    this.stack.push({ zoneId, previousActiveElement: prevActive, containerEl, defaultFocusId, onBack });

    if (defaultFocusId) {
      requestAnimationFrame(() => {
        const el = document.getElementById(defaultFocusId);
        if (el) {
          try {
            el.focus({ preventScroll: true });
          } catch {
            /* noop */
          }
        }
      });
    }
  }

  /**
   * Remueve la zona indicada (o la superior si no se indica `zoneId`) y
   * restaura el foco en el elemento que estaba activo antes de su `push`.
   *
   * @param {string} [zoneId] Si se omite, remueve la zona superior del stack.
   * @returns {object|null} La zona removida
   */
  pop(zoneId) {
    if (this.stack.length === 0) return null;

    let popped = null;
    if (zoneId) {
      const idx = this.stack.findIndex((item) => item.zoneId === zoneId);
      if (idx === -1) return null;
      [popped] = this.stack.splice(idx, 1);
    } else {
      popped = this.stack.pop();
    }

    // Restaurar foco al elemento previo si sigue en el documento.
    if (popped.previousActiveElement && document.body.contains(popped.previousActiveElement)) {
      requestAnimationFrame(() => {
        try {
          popped.previousActiveElement.focus({ preventScroll: true });
        } catch {
          /* noop */
        }
      });
    } else {
      // Fallback: enfocar el elemento por defecto de la zona que queda activa.
      const activeZone = this.getActiveZone();
      if (activeZone?.defaultFocusId) {
        requestAnimationFrame(() => {
          const el = document.getElementById(activeZone.defaultFocusId);
          if (el) {
            try {
              el.focus({ preventScroll: true });
            } catch {
              /* noop */
            }
          }
        });
      }
    }

    return popped;
  }

  /** Zona activa actual (tope de la pila) o `null` si no hay ninguna. */
  getActiveZone() {
    if (this.stack.length === 0) return null;
    return this.stack[this.stack.length - 1];
  }

  /** Identificador de la zona activa, o `'global'` si la pila está vacía. */
  getActiveZoneId() {
    const active = this.getActiveZone();
    return active ? active.zoneId : 'global';
  }

  /**
   * Elemento contenedor (scope) de la zona activa, o `null` si no hay zona
   * o la zona no declaró `containerEl` (en ese caso el scope es todo el documento).
   * @returns {HTMLElement | null}
   */
  getActiveScopeEl() {
    const active = this.getActiveZone();
    return active?.containerEl instanceof HTMLElement ? active.containerEl : null;
  }

  /** Limpia toda la pila (ej. al desmontar la app o cambiar de marca). */
  clear() {
    this.stack = [];
  }
}

export const focusManager = new FocusManager();
export default focusManager;

let zoneIdCounter = 0;

/**
 * Genera un `zoneId` único para un componente que puede montarse varias veces
 * a la vez (ej. varios modales del mismo tipo). Evita colisiones entre
 * instancias sin que cada componente tenga que inventar su propio contador.
 * @param {string} prefix
 * @returns {string}
 */
export function createZoneId(prefix) {
  zoneIdCounter += 1;
  return `${prefix}-${zoneIdCounter}`;
}
