import { useEffect } from 'react';
import { getCaretInfo, isTextInputElement, TV_ACTION } from '../utils/tvRemote';
import { createBackLongPress, exitAppBestEffort } from '../utils/tvNavigation';
import { navigationRouter } from '../navigation/NavigationRouter';
import { focusElementSafe, moveFocus } from '../navigation/spatialNavigation';

// ---------------------------------------------------------------------------
// Constantes locales del Login TV
// ---------------------------------------------------------------------------

// IDs de elementos focusables del Login. Centralizar acá evita que se
// "filtren" strings sueltos por el handler.
export const LOGIN_FOCUS_IDS = Object.freeze({
  USERNAME: 'username',
  PASSWORD: 'password',
  PASSWORD_TOGGLE: 'login-password-toggle',
  FORGOT_PASSWORD: 'login-forgot-password',
  SUBMIT: 'login-submit',
  REGISTER: 'login-register',
  SUBSCRIBE: 'login-subscribe',
  UDID: 'login-udid',
  MODAL_CLOSE_QR: 'login-modal-close-qr',
  MODAL_CLOSE_UDID: 'login-modal-close-udid',
  MODAL_CLOSE_FORGOT_QR: 'login-modal-close-forgot-qr',
});

const INITIAL_FOCUS_DELAY_MS = 0;

/**
 * Hook que encapsula la navegación remota específica del LoginPage en TV que
 * el motor genérico de navegación espacial NO puede resolver por sí solo:
 *
 *  - Foco inicial en el campo de usuario al montar.
 *  - Salir de los campos de texto (username/password) con UP/DOWN: un input
 *    editable normalmente se queda con las flechas para mover el caret, así
 *    que se registra una zona para decidir cuándo "salir" del campo en su
 *    lugar (reusa el mismo motor de geometría, `moveFocus`, para decidir el
 *    destino real en pantalla).
 *  - RIGHT en el campo de contraseña: solo pasa al botón de mostrar/ocultar
 *    si el caret ya está al final (si no, debe mover el caret nativamente).
 *  - Long-press de BACK para salir de la app (Samsung Tizen / webOS), que no
 *    es navegación espacial y por eso se mantiene como listener dedicado.
 *
 * El resto de la navegación (LEFT/RIGHT/UP/DOWN entre botones, atrapar el
 * foco dentro de los modales QR/UDID, BACK para cerrarlos) la resuelven el
 * motor de geometría genérico y `FocusManager` (push/pop en el propio
 * `LoginPage.jsx`), no este hook.
 *
 * @param {object} params
 * @param {boolean} params.isTV
 * @param {React.RefObject<HTMLElement>} params.loginFormRef
 */
export function useLoginTvNavigation({ isTV, loginFormRef }) {
  // -------------------------------------------------------------------------
  // 1) Foco inicial al montar (TV)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isTV) return undefined;
    const timer = setTimeout(() => {
      focusElementSafe(document.getElementById(LOGIN_FOCUS_IDS.USERNAME));
    }, INITIAL_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isTV]);

  // -------------------------------------------------------------------------
  // 2) Salir de username/password con UP/DOWN + RIGHT caret-aware en password
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isTV) return undefined;

    const unregister = navigationRouter.register('global', (action) => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return false;
      const activeId = active.id || '';
      const scope = loginFormRef?.current || document.body;

      if (activeId === LOGIN_FOCUS_IDS.PASSWORD && action === TV_ACTION.RIGHT) {
        const caret = getCaretInfo(active);
        if (caret.end >= caret.length) {
          return focusElementSafe(document.getElementById(LOGIN_FOCUS_IDS.PASSWORD_TOGGLE));
        }
        return false; // caret no está al final: dejar que mueva el cursor nativamente
      }

      if (activeId === LOGIN_FOCUS_IDS.PASSWORD_TOGGLE && action === TV_ACTION.LEFT) {
        return focusElementSafe(document.getElementById(LOGIN_FOCUS_IDS.PASSWORD));
      }

      if (
        isTextInputElement(active) &&
        (action === TV_ACTION.UP || action === TV_ACTION.DOWN)
      ) {
        return moveFocus(action, scope);
      }

      return false;
    });

    return unregister;
  }, [isTV, loginFormRef]);

  // -------------------------------------------------------------------------
  // 3) Long-press de BACK para salir de la app (no es navegación espacial)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isTV) return undefined;

    const back = createBackLongPress({ onTrigger: exitAppBestEffort });

    const onKeyDown = (e) => {
      const key = String(e.key || '');
      const code = String(e.code || '');
      const keyCode = Number(e.keyCode || e.which || 0);
      const isBack =
        key === 'Escape' ||
        code === 'Escape' ||
        keyCode === 27 ||
        key === 'Backspace' ||
        keyCode === 8 ||
        key === 'GoBack' ||
        key === 'BrowserBack' ||
        keyCode === 10009 ||
        keyCode === 461;
      if (!isBack) return;
      if (!e.repeat) back.arm();
    };

    const onKeyUp = (e) => {
      const key = String(e.key || '');
      const code = String(e.code || '');
      const keyCode = Number(e.keyCode || e.which || 0);
      const isBack =
        key === 'Escape' ||
        code === 'Escape' ||
        keyCode === 27 ||
        key === 'Backspace' ||
        keyCode === 8 ||
        key === 'GoBack' ||
        key === 'BrowserBack' ||
        keyCode === 10009 ||
        keyCode === 461;
      if (!isBack) return;
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

export default useLoginTvNavigation;
