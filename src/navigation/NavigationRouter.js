import { getTvActionFromKeyEvent, isTextInputElement, TV_ACTION } from '../utils/tvRemote';
import { isOsdKeyboardOverlayInDom } from '../utils/homeShellOverlays';
import { focusManager } from './FocusManager';
import { moveFocus } from './spatialNavigation';

/**
 * Router de navegación central para Smart TVs — ÚNICO listener de `keydown`
 * de toda la app para LEFT/RIGHT/UP/DOWN/BACK.
 *
 * A diferencia de la versión anterior (que solo despachaba a handlers
 * registrados manualmente por pantalla, y que en la práctica nadie registraba),
 * ahora resuelve el movimiento de foco con el motor de navegación espacial
 * (`spatialNavigation.js`) por geometría real en pantalla. Esto es lo que
 * permite que cualquier pantalla nueva (grid, flex, lista, modal) navegue
 * correctamente sin escribir un hook de TV nav dedicado: basta con que sus
 * elementos sean enfocables (`tabIndex`, `button`, `a[href]`, etc).
 *
 * El registro manual (`register`/`unregister`) se conserva para casos que no
 * son navegación espacial pura (ej. atajos específicos de una pantalla), pero
 * ya no es requisito para que LRUD funcione.
 */
class NavigationRouter {
  constructor() {
    /** @type {Map<string, Array<(action: string, event: KeyboardEvent) => boolean>>} */
    this.handlers = new Map();
    this.isActive = false;
    // El router siempre escucha BACK/semántica (modales deben poder cerrarse con
    // Escape en cualquier dispositivo). El movimiento de foco por geometría
    // (LEFT/RIGHT/UP/DOWN) solo aplica cuando `spatialNavEnabled` es true —
    // en la práctica, solo en TV; en web se navega con mouse/tab nativo.
    this.spatialNavEnabled = true;
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  /** @param {boolean} enabled */
  setSpatialNavEnabled(enabled) {
    this.spatialNavEnabled = Boolean(enabled);
  }

  /**
   * Registra un callback de navegación adicional para una zona específica.
   * Se invoca ANTES del motor espacial (en orden inverso al de registro, el
   * widget más "interno"/reciente primero); si algún handler retorna `true`,
   * consume la tecla y el motor espacial no se ejecuta ese ciclo.
   *
   * Varios componentes pueden registrar handlers para la misma zona (ej.
   * 'global') sin pisarse entre sí — a diferencia de una única función por zona.
   *
   * @param {string} zoneId Nombre único de la zona (ej. 'player-hud', 'global')
   * @param {(action: string, event: KeyboardEvent) => boolean} handler
   * @returns {() => void} función para desregistrar (equivalente a `unregister`)
   */
  register(zoneId, handler) {
    if (typeof handler !== 'function') return () => {};
    const list = this.handlers.get(zoneId) || [];
    list.push(handler);
    this.handlers.set(zoneId, list);
    return () => this.unregister(zoneId, handler);
  }

  /**
   * Remueve un handler de una zona. Si se omite `handler`, remueve todos los
   * handlers de esa zona.
   * @param {string} zoneId
   * @param {(action: string, event: KeyboardEvent) => boolean} [handler]
   */
  unregister(zoneId, handler) {
    if (!handler) {
      this.handlers.delete(zoneId);
      return;
    }
    const list = this.handlers.get(zoneId);
    if (!list) return;
    const next = list.filter((fn) => fn !== handler);
    if (next.length) this.handlers.set(zoneId, next);
    else this.handlers.delete(zoneId);
  }

  /**
   * Ejecuta los handlers registrados de una zona en orden; retorna `true`
   * apenas alguno consuma la tecla.
   * @param {string} zoneId
   * @param {string} action
   * @param {KeyboardEvent} e
   * @returns {boolean}
   */
  runZoneHandlers(zoneId, action, e) {
    const list = this.handlers.get(zoneId);
    if (!list || !list.length) return false;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      try {
        if (list[i](action, e) === true) return true;
      } catch (err) {
        console.error(`[NavigationRouter] Error en handler de zona "${zoneId}":`, err);
      }
    }
    return false;
  }

  /** Inicia el listener centralizado en window. */
  start() {
    if (this.isActive) return;
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    this.isActive = true;
  }

  /** Detiene el listener centralizado. */
  stop() {
    if (!this.isActive) return;
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    this.isActive = false;
  }

  onKeyDown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    // Mientras existan pantallas todavía no migradas al motor genérico (cada una
    // con su propio listener de keydown en window), este router y ese listener
    // legacy reciben el MISMO evento. Si el handler legacy ya llamó
    // `preventDefault()` (ya movió el foco él mismo), no hay que procesarlo de
    // nuevo aquí — si no se respeta esto, cada tecla mueve el foco DOS veces
    // (una por el hook viejo, otra por geometría desde la nueva posición) y
    // el usuario ve que "se salta" un elemento en cada pulsación.
    if (e.defaultPrevented) return;

    // Teclado OSD abierto: bloquear BACK nativo del WebView; el cierre lo gestiona
    // VirtualKeyboard/HomeInputDispatcher, no el router genérico.
    if (isOsdKeyboardOverlayInDom()) {
      const action = getTvActionFromKeyEvent(e);
      if (action === TV_ACTION.BACK) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    const action = getTvActionFromKeyEvent(e);
    if (!action) return;

    // --- BACK: semántico, no espacial. La zona modal activa decide, o se delega
    // a un handler 'global' registrado (p. ej. historial de rutas /home/*). ---
    if (action === TV_ACTION.BACK) {
      const activeZone = focusManager.getActiveZone();
      if (activeZone) {
        if (typeof activeZone.onBack === 'function') {
          // onBack puede devolver explícitamente `false` para señalar "no lo
          // manejé, dejá que el evento siga" (ej. detalle VOD con reproductor
          // activo: el HUD del player, aún no migrado, debe poder cerrarlo él).
          // Cualquier otro valor de retorno (incl. undefined) cuenta como manejado.
          const result = activeZone.onBack();
          if (result === false) return;
        } else {
          focusManager.pop();
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (this.runZoneHandlers('global', action, e)) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    // --- LEFT/RIGHT/UP/DOWN: motor de navegación espacial dentro del scope activo ---
    if (
      action === TV_ACTION.LEFT ||
      action === TV_ACTION.RIGHT ||
      action === TV_ACTION.UP ||
      action === TV_ACTION.DOWN
    ) {
      const activeEl = document.activeElement;

      // Handlers semánticos registrados (ej. salir de un input de texto hacia el
      // siguiente campo, abrir/cerrar un submenú) tienen prioridad SIEMPRE, incluso
      // con foco en un input editable — así una pantalla puede decidir "salir" del
      // campo en una dirección concreta (ej. DOWN en username → password) sin que el
      // caret se lo coma. Si el handler no consume la tecla (retorna false/undefined),
      // se sigue con el comportamiento por defecto de abajo.
      const activeZoneId = focusManager.getActiveZoneId();
      if (this.runZoneHandlers(activeZoneId, action, e)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Un input de texto (incluso los `readOnly` que usa TV para bloquear el IME
      // nativo: ver `FocusableInput`) puede querer mover el caret con las flechas
      // en vez de saltar de foco — y un <select> nativo usa las flechas para
      // cambiar de opción. El motor de geometría NUNCA debe asumir por defecto
      // que hay que salir de un input: si una pantalla concreta necesita "salir"
      // de un campo en una dirección (ej. DOWN de username → password), lo hace
      // explícitamente en su propio handler de zona (arriba), llamando a
      // `moveFocus`/`focusElementSafe` él mismo.
      if (isTextInputElement(activeEl)) return;
      if (activeEl instanceof HTMLElement && activeEl.tagName === 'SELECT') return;

      if (!this.spatialNavEnabled) return;

      const scopeEl = focusManager.getActiveScopeEl();
      const handled = moveFocus(action, scopeEl || document.body);
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    // --- CHANNEL_UP/CHANNEL_DOWN (CH+/CH-): sin geometría propia, se delegan
    // por completo a handlers de zona registrados (ej. zapping de canal del
    // reproductor). Antes cada consumidor de estas teclas necesitaba su propio
    // listener de `keydown` en `window`; ahora comparten el único listener
    // central igual que BACK/LRUD. Si ningún handler la consume, se deja pasar.
    if (action === TV_ACTION.CHANNEL_UP || action === TV_ACTION.CHANNEL_DOWN) {
      const activeZoneId = focusManager.getActiveZoneId();
      if (this.runZoneHandlers(activeZoneId, action, e)) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    // ENTER: comportamiento nativo del elemento enfocado (un <button>/<a> ya
    // dispara su onClick con OK/Enter del control remoto).
  }
}

export const navigationRouter = new NavigationRouter();
export default navigationRouter;
