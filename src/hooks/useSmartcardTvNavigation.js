import { useEffect } from 'react';
import { getTvActionFromKeyEvent, TV_ACTION } from '../utils/tvRemote';
import {
  createBackLongPress,
  exitAppBestEffort,
  findFocusableElements,
  focusById,
  focusElement,
  focusNextElementInList,
} from '../utils/tvNavigation';

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
const MODAL_FOCUS_DELAY_MS = 100;

/**
 * Hook de navegación remota (LRUD + BACK + long-press) para `SmartCardPage`.
 *
 * Responsabilidades:
 *  - Aplicar foco inicial inteligente según el estado de la página
 *    (lista de licencias / error / vacío / modal de confirmación).
 *  - Navegar verticalmente entre items de la lista (incluido el item de logout).
 *  - Atrapar el foco dentro de los modales (confirmación "licencia en uso" y
 *    `MessageModal` de error).
 *  - Mapear BACK a las acciones esperadas:
 *      * Modal abierto → cerrar (cancelar / dismiss).
 *      * Setting license → consumir y no hacer nada (evita salidas accidentales).
 *      * Estado normal → ejecutar logout (equivalente al botón visible).
 *  - Long-press de BACK para salir de la app (Tizen/webOS).
 *
 * Diseño: el hook orquesta solo foco. La lógica de negocio (activar licencia,
 * cerrar modales, logout) vive en el componente padre y se inyecta como
 * callbacks memoizadas.
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
 * @param {() => void} params.onCancelConfirmInUse Cerrar confirm sin aceptar.
 * @param {() => void} params.onCloseResultModal Cerrar modal de mensaje.
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
  onCancelConfirmInUse,
  onCloseResultModal,
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
  // 2) Foco al abrir el modal de confirmación "licencia en uso".
  //    Por defecto el botón "Sí".
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isTV || !isConfirmInUseOpen) return undefined;
    const timer = setTimeout(() => {
      focusById(SMARTCARD_FOCUS_IDS.CONFIRM_YES);
    }, MODAL_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isTV, isConfirmInUseOpen]);

  // -------------------------------------------------------------------------
  // 3) Listener LRUD + BACK + long-press.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isTV) return undefined;

    const back = createBackLongPress({ onTrigger: exitAppBestEffort });

    const handleBackAction = (e) => {
      if (!e.repeat) back.arm();

      if (isConfirmInUseOpen) {
        e.preventDefault();
        e.stopPropagation();
        onCancelConfirmInUse?.();
        return;
      }
      if (isResultModalOpen) {
        e.preventDefault();
        e.stopPropagation();
        onCloseResultModal?.();
        return;
      }
      if (isSettingLicense) {
        // Activación en curso: consumir BACK para evitar salidas accidentales.
        // El long-press sigue armado para permitir la salida explícita de app.
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Estado normal: BACK = logout (equivalente al botón visible).
      e.preventDefault();
      e.stopPropagation();
      onLogoutBack?.();
    };

    const handleConfirmInUseAction = (action, e) => {
      if (action === TV_ACTION.LEFT) {
        e.preventDefault();
        e.stopPropagation();
        focusById(SMARTCARD_FOCUS_IDS.CONFIRM_YES);
        return;
      }
      if (action === TV_ACTION.RIGHT) {
        e.preventDefault();
        e.stopPropagation();
        focusById(SMARTCARD_FOCUS_IDS.CONFIRM_NO);
        return;
      }
      if (action === TV_ACTION.UP || action === TV_ACTION.DOWN) {
        // Mantener el foco dentro del par yes/no.
        e.preventDefault();
        e.stopPropagation();
        const activeId = document.activeElement?.id || '';
        if (
          activeId !== SMARTCARD_FOCUS_IDS.CONFIRM_YES &&
          activeId !== SMARTCARD_FOCUS_IDS.CONFIRM_NO
        ) {
          focusById(SMARTCARD_FOCUS_IDS.CONFIRM_YES);
        }
      }
      // ENTER se maneja por el click natural del botón.
    };

    const handleResultModalAction = (action, e) => {
      // Único botón "cerrar"; mantener foco en él ante UDLR.
      if (
        action === TV_ACTION.UP ||
        action === TV_ACTION.DOWN ||
        action === TV_ACTION.LEFT ||
        action === TV_ACTION.RIGHT
      ) {
        e.preventDefault();
        e.stopPropagation();
        focusById(SMARTCARD_FOCUS_IDS.MESSAGE_MODAL_CLOSE);
      }
    };

    const handleListAction = (action, e, active) => {
      const root = containerRef?.current;
      const items = findFocusableElements(root, SMARTCARD_LIST_SELECTOR);

      if (action === TV_ACTION.UP) {
        e.preventDefault();
        e.stopPropagation();
        focusNextElementInList(active, items, 'up');
        return;
      }
      if (action === TV_ACTION.DOWN) {
        e.preventDefault();
        e.stopPropagation();
        focusNextElementInList(active, items, 'down');
      }
      // LEFT/RIGHT/ENTER: dejar comportamiento por defecto.
    };

    const handleFallbackAction = (action, e) => {
      // Foco fuera de un destino conocido: llevarlo a un punto seguro.
      if (action !== TV_ACTION.UP && action !== TV_ACTION.DOWN) return;
      e.preventDefault();
      e.stopPropagation();
      const root = containerRef?.current;
      const items = findFocusableElements(root, SMARTCARD_LIST_SELECTOR);
      if (items.length > 0) {
        focusElement(items[0]);
      } else {
        focusById(SMARTCARD_FOCUS_IDS.BACK_BUTTON);
      }
    };

    const onKeyDown = (e) => {
      const action = getTvActionFromKeyEvent(e);
      if (!action) return;

      if (action === TV_ACTION.BACK) {
        handleBackAction(e);
        return;
      }

      // Mientras se está activando una licencia, evitar mover foco entre items
      // (la UI muestra un overlay bloqueante). BACK ya fue tratado arriba.
      if (isSettingLicense) return;

      if (isConfirmInUseOpen) {
        handleConfirmInUseAction(action, e);
        return;
      }

      if (isResultModalOpen) {
        handleResultModalAction(action, e);
        return;
      }

      const root = containerRef?.current;
      const active = document.activeElement;
      const isInList =
        root &&
        active &&
        root.contains(active) &&
        typeof active.matches === 'function' &&
        active.matches(SMARTCARD_LIST_SELECTOR);

      if (active?.id === SMARTCARD_FOCUS_IDS.BACK_BUTTON) {
        // Botón único en estado error/empty: solo ENTER tiene efecto.
        return;
      }

      if (isInList) {
        handleListAction(action, e, active);
        return;
      }

      handleFallbackAction(action, e);
    };

    const onKeyUp = (e) => {
      const action = getTvActionFromKeyEvent(e);
      if (action !== TV_ACTION.BACK) return;
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
  }, [
    isTV,
    isConfirmInUseOpen,
    isResultModalOpen,
    isSettingLicense,
    containerRef,
    onCancelConfirmInUse,
    onCloseResultModal,
    onLogoutBack,
  ]);
}
