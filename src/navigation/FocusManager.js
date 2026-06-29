/**
 * Administrador central de la pila (stack) de foco para Smart TVs.
 * Permite que modales, overlays y vistas guarden el foco anterior, capturen
 * la interacción y restauren el foco original automáticamente al cerrarse.
 */
class FocusManager {
  constructor() {
    this.stack = []; // Elementos de la pila: { zoneId, previousActiveElement, defaultFocusId }
  }

  /**
   * Empuja un nuevo contexto de foco (ej. un modal que se abre).
   * Almacena el elemento que tenía el foco antes para poder restaurarlo después.
   *
   * @param {string} zoneId Identificador único de la zona (ej. 'parental-pin', 'search-suggest')
   * @param {string} [defaultFocusId] ID del elemento a enfocar por defecto en esta zona
   */
  push(zoneId, defaultFocusId = null) {
    const prevActive = document.activeElement;
    
    // Si la zona ya está en el stack, no la duplicamos
    this.stack = this.stack.filter(item => item.zoneId !== zoneId);
    
    this.stack.push({
      zoneId,
      previousActiveElement: prevActive,
      defaultFocusId
    });

    console.log(`[FocusManager] Push zone: "${zoneId}". Stack size: ${this.stack.length}`);

    if (defaultFocusId) {
      requestAnimationFrame(() => {
        const el = document.getElementById(defaultFocusId);
        if (el) {
          try { el.focus({ preventScroll: true }); } catch { /* noop */ }
        }
      });
    }
  }

  /**
   * Remueve el contexto de foco superior (ej. al cerrar un modal)
   * y restaura el foco en el elemento que estaba activo antes.
   *
   * @returns {object|null} La zona removida
   */
  pop() {
    if (this.stack.length === 0) return null;
    const popped = this.stack.pop();
    console.log(`[FocusManager] Pop zone: "${popped.zoneId}". Stack size: ${this.stack.length}`);

    // Restaurar foco al elemento previo
    if (popped.previousActiveElement && document.body.contains(popped.previousActiveElement)) {
      requestAnimationFrame(() => {
        try { popped.previousActiveElement.focus({ preventScroll: true }); } catch { /* noop */ }
      });
    } else {
      // Fallback: enfocar el primer elemento de la zona activa actual
      const activeZone = this.getActiveZone();
      if (activeZone?.defaultFocusId) {
        requestAnimationFrame(() => {
          const el = document.getElementById(activeZone.defaultFocusId);
          if (el) {
            try { el.focus({ preventScroll: true }); } catch { /* noop */ }
          }
        });
      }
    }

    return popped;
  }

  /**
   * Retorna la zona activa actual (la que está en el tope de la pila).
   */
  getActiveZone() {
    if (this.stack.length === 0) return null;
    return this.stack[this.stack.length - 1];
  }

  /**
   * Retorna el identificador de la zona activa o 'global' si la pila está vacía.
   */
  getActiveZoneId() {
    const active = this.getActiveZone();
    return active ? active.zoneId : 'global';
  }

  /**
   * Limpia toda la pila.
   */
  clear() {
    this.stack = [];
    console.log('[FocusManager] Stack cleared');
  }
}

export const focusManager = new FocusManager();
export default focusManager;
