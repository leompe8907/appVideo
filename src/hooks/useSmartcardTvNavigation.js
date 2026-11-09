import { useEffect } from 'react';
import { TV_ACTION } from '../utils/tvRemote';
import {
  createBackLongPress,
  exitAppBestEffort,
  findFocusableElements,
  focusById,
  focusElement,
} from '../utils/tvNavigation';
import { navigationRouter } from '../navigation/NavigationRouter';

// ---------------------------------------------------------------------------
// Constantes locales del SmartCard TV
// ---------------------------------------------------------------------------

/**
 * IDs de elementos focusables de la página SmartCard.
 * Centralizados acá para que el JSX y el handler usen la misma fuente de verdad.
 *
 * Nota: `MESSAGE_MODAL_CLOSE` está alineado con el id que ya expone el
 * componente compartido `MessageModal` (no lo cambia este hook).
 */
export const SMARTCARD_FOCUS_IDS = Object.freeze({
  BACK_BUTTON: 'smartcard-back',
  CONFIRM_YES: 'smartcard-confirm-yes',
  CONFIRM_NO: 'smartcard-confirm-no',
  MESSAGE_MODAL_CLOSE: 'message-modal-close',
});

/** Selector del auto-discovery de items de la lista de licencias. */
export const SMARTCARD_LIST_SELECTOR = '[data-tv-nav="smartcard-item"]';

const INITIAL_FOCUS_DELAY_MS = 300;

/**
 * Hook de navegación remota para `SmartCardPage`.
 *
 * La navegación entre items de la lista de licencias (UP/DOWN) y entre los
 * botones Sí/No del modal de confirmación (LEFT/RIGHT) ya no necesita reglas
 * propias: son elementos planos en su contenedor y el motor de geometría
 * genérico (`NavigationRouter`) los resuelve solo — el modal de confirmación
 * y el `MessageModal` de resultado se registran como zonas de `FocusManager`
 * en el propio `SmartCardPage.jsx` (`push`/`pop`/`onBack`), que además atrapa
 * el foco dentro de cada uno.
 *
 * Lo que este hook sí conserva (porque no es navegación espacial):
 *  - Foco inicial inteligente según el estado de la página.
 *  - BACK = logout cuando no hay ningún modal abierto (la zona activa de
 *    `FocusManager` intercepta BACK antes que esto cuando hay un modal).
 *  - Bloquear cualquier movimiento mientras se activa una licencia
 *    (`isSettingLicense`, overlay bloqueante).
 *  - Long-press de BACK para salir de la app (Tizen/webOS).
 *
 * @param {object} params
 * @param {boolean} params.isTV
 * @param {React.RefObject<HTMLElement>} params.containerRef Ref al contenedor que envuelve
 *        los items de licencias y el botón de back.
 * @param {boolean} params.isLoading
 * @param {boolean} params.hasError
 * @param {boolean} params.hasLicenses
 * @param {boolean} params.isSettingLicense
 * @param {boolean} params.isConfirmInUseOpen
 * @param {boolean} params.isResultModalOpen
 * @param {() => void} params.onLogoutBack BACK sin modal → cerrar sesión.
 */
export function useSmartcardTvNavigation({
  isTV,
  containerRef,
  isLoading,
  hasError,
  hasLicenses,
  isSettingLicense,
  isConfirmInUseOpen,
  isResultModalOpen,
  onLogoutBack,
}) {
  // -------------------------------------------------------------------------
  // 1) Foco inicial al montar / cambiar el "estado macro" de la pantalla.
  //
  // Solo re-enfoca si el foco no está ya en un elemento navegable dentro
  // del container; así no se interrumpe al usuario navegando.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isTV) return undefined;
    if (isLoading) return undefined;
    if (isConfirmInUseOpen || isResultModalOpen) return undefined;

    const timer = setTimeout(() => {
      const root = containerRef?.current;
      const active = document.activeElement;
      if (root && active && root.contains(active)) {
        // El usuario ya tiene foco dentro del container; no interrumpir.
        return;
      }

      if (hasError || !hasLicenses) {
        focusById(SMARTCARD_FOCUS_IDS.BACK_BUTTON);
        return;
      }

      const items = findFocusableElements(root, SMARTCARD_LIST_SELECTOR);
      if (items.length > 0) {
        focusElement(items[0]);
      }
    }, INITIAL_FOCUS_DELAY_MS);

    return () => clearTimeout(timer);
  }, [
    isTV,
    isLoading,
    hasError,
    hasLicenses,
    isConfirmInUseOpen,
    isResultModalOpen,
    containerRef,
  ]);

  // -------------------------------------------------------------------------
  // 2) BACK sin modal (logout) + bloqueo de movimiento durante la activación.
  //
  // Se registra en la zona 'global': el router solo la ejecuta cuando NO hay
  // ninguna zona de FocusManager activa, es decir, cuando ningún modal está
  // abierto (el modal de confirmación y `MessageModal` interceptan BACK ellos
  // mismos vía su propia zona antes de que esto se ejecute).
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isTV) return undefined;

    const unregister = navigationRouter.register('global', (action) => {
      if (action === TV_ACTION.BACK) {
        if (isSettingLicense) return true; // consumir: evitar salidas accidentales
        onLogoutBack?.();
        return true;
      }
      if (isSettingLicense) return true; // overlay bloqueante: no mover foco
      return false;
    });

    return unregister;
  }, [isTV, isSettingLicense, onLogoutBack]);

  // -------------------------------------------------------------------------
  // 3) Long-press de BACK para salir de la app (no es navegación espacial).
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isTV) return undefined;

    const back = createBackLongPress({ onTrigger: exitAppBestEffort });

    const isBackKey = (e) => {
      const key = String(e.key || '');
      const code = String(e.code || '');
      const keyCode = Number(e.keyCode || e.which || 0);
      return (
        key === 'Escape' ||
        code === 'Escape' ||
        keyCode === 27 ||
        key === 'Backspace' ||
        keyCode === 8 ||
        key === 'GoBack' ||
        key === 'BrowserBack' ||
        keyCode === 10009 ||
        keyCode === 461
      );
    };

    const onKeyDown = (e) => {
      if (!isBackKey(e)) return;
      if (!e.repeat) back.arm();
    };

    const onKeyUp = (e) => {
      if (!isBackKey(e)) return;
      const triggered = back.didTrigger();
      back.clear();
      if (triggered) {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch {
          // noop
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      back.reset();
    };
  }, [isTV]);
}

export default useSmartcardTvNavigation;
