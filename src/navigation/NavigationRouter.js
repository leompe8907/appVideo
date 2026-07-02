import { getTvActionFromKeyEvent, TV_ACTION } from '../utils/tvRemote';
import { isOsdKeyboardOverlayInDom } from '../utils/homeShellOverlays';
import { focusManager } from './FocusManager';

/**
 * Router de navegación central para Smart TVs.
 * Escucha eventos 'keydown' en una ubicación única (window con capture: true)
 * y los despacha a la zona activa actual registrada. Evita colisiones
 * y fugas de memoria típicas de listeners múltiples e independientes.
 */
class NavigationRouter {
  constructor() {
    this.handlers = new Map();
    this.isActive = false;
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  /**
   * Registra un callback de navegación para una zona específica.
   *
   * @param {string} zoneId Nombre único de la zona (ej. 'sidebar', 'login-form', 'global')
   * @param {(action: string, event: KeyboardEvent) => boolean} handler Callback que procesa la acción y retorna true si fue consumida.
   */
  register(zoneId, handler) {
    this.handlers.set(zoneId, handler);
    console.log(`[NavigationRouter] Zona registrada: "${zoneId}"`);
  }

  /**
   * Remueve la zona de navegación registrada.
   *
   * @param {string} zoneId
   */
  unregister(zoneId) {
    this.handlers.delete(zoneId);
    console.log(`[NavigationRouter] Zona eliminada: "${zoneId}"`);
  }

  /**
   * Inicia el listener centralizado en window.
   */
  start() {
    if (this.isActive) return;
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    this.isActive = true;
    console.log('[NavigationRouter] Listener central activado.');
  }

  /**
   * Detiene el listener centralizado.
   */
  stop() {
    if (!this.isActive) return;
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    this.isActive = false;
    console.log('[NavigationRouter] Listener central desactivado.');
  }

  onKeyDown(e) {
    // Teclado OSD abierto: bloquear BACK nativo del WebView; el cierre lo gestiona VirtualKeyboard / HomeInputDispatcher.
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

    const activeZoneId = focusManager.getActiveZoneId();
    const handler = this.handlers.get(activeZoneId);

    let consumed = false;

    if (handler) {
      try {
        consumed = handler(action, e) === true;
      } catch (err) {
        console.error(`Error en handler de navegación para zona "${activeZoneId}":`, err);
      }
    }

    // Si el handler específico no consumió la tecla (o no hay uno activo),
    // intentamos despachar al handler 'global' de fallback.
    if (!consumed && activeZoneId !== 'global') {
      const globalHandler = this.handlers.get('global');
      if (globalHandler) {
        try {
          consumed = globalHandler(action, e) === true;
        } catch (err) {
          console.error('Error en handler de navegación global:', err);
        }
      }
    }

    if (consumed) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
}

export const navigationRouter = new NavigationRouter();
export default navigationRouter;
