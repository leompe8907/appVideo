import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { navigationRouter } from '../../navigation/NavigationRouter';
import { moveFocus } from '../../navigation/spatialNavigation';
import { useDevice } from '../../contexts/DeviceContext';
import { TV_ACTION, isEditableTextInputElement } from '../../utils/tvRemote';
import {
  dismissEpgReminderOverlayFromDom,
  dismissOsdKeyboardOverlayFromDom,
  isEpgEventModalOverlayInDom,
  isOsdKeyboardOverlayInDom,
  shouldDeferHomeShellNavigation,
} from '../../utils/homeShellOverlays';

/**
 * Dispatcher de BACK (y RIGHT al final de fila en TV) para el shell Home (rutas /home/*).
 *
 * El cruce de foco Sidebar ↔ contenido (antes manejado aquí con LRUD manual y
 * varias funciones "isLeftmost*" por pantalla) ya NO hace falta: el motor de
 * navegación espacial genérico (`NavigationRouter` + `spatialNavigation.js`)
 * mueve el foco por geometría real — como el sidebar está visualmente a la
 * izquierda del contenido, LEFT/RIGHT cruza entre ambos automáticamente sin
 * ningún puente manual, sin importar qué pantalla esté activa.
 *
 * Lo único que sigue siendo semántico (no espacial) es BACK: cerrar overlays
 * específicos (recordatorio EPG, teclado OSD) antes que nada, o navegar hacia
 * atrás en las subrutas de /home/*. Se registra como handler 'global' del
 * router central en vez de mantener su propio listener de `keydown` aparte.
 */
/**
 * Filas que scrollean horizontal por su cuenta: canales (bouquet horizontal y
 * grilla vertical), catchup y películas (también "Recomendado" del inicio).
 */
const ROW_SELECTOR = '[data-bouquet-id], .catchup-rail-section, .vod-row-cards';

export function HomeInputDispatcher({ isPlayerActive }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isTV } = useDevice();

  // TV: RIGHT en el último canal de una fila. Cada fila scrollea horizontal por
  // su cuenta y el motor de geometría busca en TODO el documento (incluye
  // tarjetas fuera de pantalla), así que al no haber nada más a la derecha
  // dentro de la fila terminaba "saltando" a una tarjeta de otra fila que cae
  // más a la derecha. Acotamos la búsqueda a la fila activa: si hay otra
  // tarjeta a la derecha DENTRO de la fila, se mueve igual que antes; si no, se
  // consume la tecla sin hacer nada (igual que Fire TV). LEFT no se toca:
  // cruzar desde la primera tarjeta hacia el Sidebar es lo esperado.
  useEffect(() => {
    if (!isTV || isPlayerActive) return undefined;
    const unregister = navigationRouter.register('global', (action) => {
      if (action !== TV_ACTION.RIGHT) return false;
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return false;
      const row = active.closest(ROW_SELECTOR);
      if (!row) return false;
      moveFocus('right', row);
      return true;
    });
    return unregister;
  }, [isTV, isPlayerActive]);

  useEffect(() => {
    const unregister = navigationRouter.register('global', (action, e) => {
      if (action !== TV_ACTION.BACK) return false;
      if (e.repeat) return false;

      // Recordatorio EPG (puede mostrarse con player activo): antes que delegar al HUD.
      if (isEpgEventModalOverlayInDom()) {
        if (dismissEpgReminderOverlayFromDom()) return true;
      }

      // Teclado virtual OSD: cerrar overlay y bloquear BACK nativo del WebView.
      if (isOsdKeyboardOverlayInDom()) {
        if (dismissOsdKeyboardOverlayFromDom()) return true;
      }

      if (isPlayerActive) return false;
      if (shouldDeferHomeShellNavigation()) return true;
      if (isEditableTextInputElement(document.activeElement)) return false;

      const path = location.pathname || '';
      if (path.startsWith('/home/') && path !== '/home/inicio') {
        navigate(-1);
        return true;
      }

      // /home/inicio: no consumir BACK (permite salida SO / historial real del WebView).
      return false;
    });
    return unregister;
  }, [isPlayerActive, location.pathname, navigate]);

  return null;
}

export default HomeInputDispatcher;
