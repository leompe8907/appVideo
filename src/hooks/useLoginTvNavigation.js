import { useEffect, useRef, useState } from 'react';
import {
  getCaretInfo,
  getTvActionFromKeyEvent,
  isTextInputElement,
  TV_ACTION,
} from '../utils/tvRemote';
import {
  createBackLongPress,
  exitAppBestEffort,
  findFocusableIds,
  focusById,
  focusFirstAvailable,
  focusNextInList,
} from '../utils/tvNavigation';

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
});

// Selector para el auto-discovery de botones de acción dentro del form.
const LOGIN_ACTIONS_SELECTOR = '[data-tv-nav="login-actions"]';

// Pequeño retraso para asegurar que los elementos condicionales estén en el DOM
// (botones que aparecen tras estados como `isSubmitting`, social, etc.).
const REBUILD_DELAY_MS = 0;
const INITIAL_FOCUS_DELAY_MS = 0;

const LOGIN_STATIC_FOCUS_IDS = [
  LOGIN_FOCUS_IDS.USERNAME,
  LOGIN_FOCUS_IDS.PASSWORD,
  LOGIN_FOCUS_IDS.PASSWORD_TOGGLE,
  LOGIN_FOCUS_IDS.FORGOT_PASSWORD,
  LOGIN_FOCUS_IDS.SUBMIT,
  LOGIN_FOCUS_IDS.REGISTER,
  LOGIN_FOCUS_IDS.SUBSCRIBE,
  LOGIN_FOCUS_IDS.UDID,
];

/**
 * Hook que encapsula toda la lógica de navegación remota (LRUD + BACK +
 * long-press para salir) específica del LoginPage en TV.
 *
 * Responsabilidades:
 *  - Aplicar foco inicial al campo username al cargar.
 *  - Descubrir dinámicamente los IDs de los botones de acción del login
 *    (los marcados con `data-tv-nav="login-actions"`).
 *  - Instalar listeners de keydown/keyup en window con `capture: true` y
 *    traducir el input remoto a movimientos de foco según las reglas del
 *    Login (inputs ↔ toggle ↔ botones), incluyendo:
 *      * password → password-toggle con RIGHT solo si el caret está al final.
 *      * cierre de modales con BACK + restauración de foco.
 *      * long-press del BACK para salir de la app (Samsung Tizen / webOS).
 *
 * Diseño: el hook es "tonto" sobre el dominio (no sabe de auth). Solo
 * orquesta foco. Recibe callbacks para cerrar los modales que existen en el
 * componente padre.
 *
 * @param {object} params
 * @param {boolean} params.isTV
 * @param {React.RefObject<HTMLElement>} params.loginFormRef
 * @param {boolean} params.isQrModalOpen
 * @param {boolean} params.isUdidModalOpen
 * @param {boolean} params.isSubmitting
 * @param {boolean} params.forgotPasswordEnabled
 * @param {boolean} params.udidEnabled
 * @param {boolean} params.googleEnabled
 * @param {boolean} params.facebookEnabled
 * @param {() => void} params.onCloseQrModal
 * @param {() => void} params.onCloseUdidModal
 * @returns {{ buttonIds: string[] }}
 */
export function useLoginTvNavigation({
  isTV,
  loginFormRef,
  isQrModalOpen,
  isUdidModalOpen,
  isSubmitting,
  qrRegisterEnabled,
  forgotPasswordEnabled,
  udidEnabled,
  googleEnabled,
  facebookEnabled,
  onCloseQrModal,
  onCloseUdidModal,
}) {
  const [buttonIds, setButtonIds] = useState([]);

  // Mantener una referencia "siempre fresca" a buttonIds para que el handler
  // de teclado (que se rearma cuando cambia buttonIds) no necesite cerrar
  // sobre estado obsoleto.
  const buttonIdsRef = useRef(buttonIds);
  const focusCacheRef = useRef(new Map());

  const rebuildFocusCache = (actionIds = buttonIdsRef.current) => {
    const map = new Map();
    const ids = [...LOGIN_STATIC_FOCUS_IDS, ...actionIds];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el instanceof HTMLElement) map.set(id, el);
    }
    focusCacheRef.current = map;
  };

  const focusId = (id) => focusById(id, focusCacheRef.current);

  useEffect(() => {
    buttonIdsRef.current = buttonIds;
  }, [buttonIds]);

  // -------------------------------------------------------------------------
  // 1) Foco inicial al montar (TV)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isTV) return undefined;
    rebuildFocusCache();
    const timer = setTimeout(() => {
      focusId(LOGIN_FOCUS_IDS.USERNAME);
    }, INITIAL_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isTV]);

  // -------------------------------------------------------------------------
  // 2) Auto-discovery de botones navegables
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isTV) return undefined;
    const root = loginFormRef?.current;
    if (!root) return undefined;

    const rebuild = () => {
      const ids = findFocusableIds(root, LOGIN_ACTIONS_SELECTOR);
      setButtonIds((prev) => {
        if (areArraysEqual(prev, ids)) return prev;
        rebuildFocusCache(ids);
        return ids;
      });
      rebuildFocusCache(ids);
    };

    const t = setTimeout(rebuild, REBUILD_DELAY_MS);
    return () => clearTimeout(t);
  }, [
    isTV,
    loginFormRef,
    isSubmitting,
    qrRegisterEnabled,
    forgotPasswordEnabled,
    udidEnabled,
    googleEnabled,
    facebookEnabled,
  ]);

  // -------------------------------------------------------------------------
  // 3) Listener LRUD + BACK + long-press
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isTV) return undefined;

    const back = createBackLongPress({ onTrigger: exitAppBestEffort });

    const handleBackAction = (e) => {
      if (!e.repeat) back.arm();

      if (isQrModalOpen) {
        e.preventDefault();
        e.stopPropagation();
        onCloseQrModal?.();
        setTimeout(
          () => focusFirstAvailable(
            [LOGIN_FOCUS_IDS.SUBSCRIBE, LOGIN_FOCUS_IDS.SUBMIT, LOGIN_FOCUS_IDS.USERNAME],
            focusCacheRef.current
          ),
          0,
        );
        return;
      }
      if (isUdidModalOpen) {
        e.preventDefault();
        e.stopPropagation();
        onCloseUdidModal?.();
        setTimeout(
          () => focusFirstAvailable(
            [LOGIN_FOCUS_IDS.UDID, LOGIN_FOCUS_IDS.SUBMIT, LOGIN_FOCUS_IDS.USERNAME],
            focusCacheRef.current
          ),
          0,
        );
        return;
      }
      // Sin modal: no consumimos BACK corto (lo deja al SO o a un futuro
      // diálogo de confirmación).
    };

    const handleModalActiveAction = (action, e) => {
      if (action === TV_ACTION.ENTER) return;
      if (action === TV_ACTION.UP || action === TV_ACTION.DOWN) {
        e.preventDefault();
        e.stopPropagation();
        const closeId = isQrModalOpen
          ? LOGIN_FOCUS_IDS.MODAL_CLOSE_QR
          : LOGIN_FOCUS_IDS.MODAL_CLOSE_UDID;
        focusId(closeId);
      }
    };

    const handleInputAction = (action, e, active, activeId) => {
      if (action === TV_ACTION.DOWN) {
        e.preventDefault();
        e.stopPropagation();
        if (activeId === LOGIN_FOCUS_IDS.USERNAME) {
          focusId(LOGIN_FOCUS_IDS.PASSWORD);
          return;
        }
        if (activeId === LOGIN_FOCUS_IDS.PASSWORD) {
          if (forgotPasswordEnabled && focusId(LOGIN_FOCUS_IDS.FORGOT_PASSWORD)) return;
          focusId(LOGIN_FOCUS_IDS.SUBMIT);
          return;
        }
      }

      if (action === TV_ACTION.UP) {
        e.preventDefault();
        e.stopPropagation();
        if (activeId === LOGIN_FOCUS_IDS.PASSWORD) {
          focusId(LOGIN_FOCUS_IDS.USERNAME);
        }
        return;
      }

      if (action === TV_ACTION.RIGHT && activeId === LOGIN_FOCUS_IDS.PASSWORD) {
        const caret = getCaretInfo(active);
        if (caret.end >= caret.length) {
          e.preventDefault();
          e.stopPropagation();
          focusId(LOGIN_FOCUS_IDS.PASSWORD_TOGGLE);
        }
        return;
      }

      if (action === TV_ACTION.ENTER) {
        e.preventDefault();
        return;
      }
    };

    const handleForgotPasswordAction = (action, e) => {
      if (action === TV_ACTION.DOWN) {
        e.preventDefault();
        e.stopPropagation();
        focusId(LOGIN_FOCUS_IDS.SUBMIT);
        return;
      }
      if (action === TV_ACTION.UP) {
        e.preventDefault();
        e.stopPropagation();
        focusId(LOGIN_FOCUS_IDS.PASSWORD);
      }
    };

    const handlePasswordToggleAction = (action, e) => {
      if (action === TV_ACTION.DOWN) {
        e.preventDefault();
        e.stopPropagation();
        focusId(LOGIN_FOCUS_IDS.SUBMIT);
        return;
      }
      if (action === TV_ACTION.UP) {
        e.preventDefault();
        e.stopPropagation();
        focusId(LOGIN_FOCUS_IDS.PASSWORD);
        return;
      }
      if (action === TV_ACTION.LEFT) {
        e.preventDefault();
        e.stopPropagation();
        focusId(LOGIN_FOCUS_IDS.PASSWORD);
      }
      // ENTER lo maneja el click del botón.
    };

    const handleButtonAction = (action, e, activeId) => {
      const ids = buttonIdsRef.current;
      if (action === TV_ACTION.DOWN) {
        e.preventDefault();
        e.stopPropagation();
        focusNextInList(activeId, ids, 'down', focusCacheRef.current);
        return;
      }
      if (action === TV_ACTION.UP) {
        e.preventDefault();
        e.stopPropagation();
        const isFirst = ids[0] === activeId;
        if (isFirst) {
          if (forgotPasswordEnabled && focusId(LOGIN_FOCUS_IDS.FORGOT_PASSWORD)) return;
          if (!focusId(LOGIN_FOCUS_IDS.PASSWORD_TOGGLE)) {
            focusId(LOGIN_FOCUS_IDS.PASSWORD);
          }
          return;
        }
        focusNextInList(activeId, ids, 'up', focusCacheRef.current);
      }
      // LEFT/RIGHT no mapeado en botones por ahora.
    };

    const handleFallbackAction = (action, e) => {
      if (action === TV_ACTION.DOWN) {
        e.preventDefault();
        e.stopPropagation();
        focusFirstAvailable(
          [LOGIN_FOCUS_IDS.SUBMIT, LOGIN_FOCUS_IDS.PASSWORD, LOGIN_FOCUS_IDS.USERNAME],
          focusCacheRef.current
        );
      } else if (action === TV_ACTION.UP) {
        e.preventDefault();
        e.stopPropagation();
        focusFirstAvailable(
          [LOGIN_FOCUS_IDS.PASSWORD, LOGIN_FOCUS_IDS.USERNAME],
          focusCacheRef.current
        );
      }
    };

    const onKeyDown = (e) => {
      if (document.querySelector('.osd-keyboard-container')) {
        return;
      }
      const action = getTvActionFromKeyEvent(e);
      if (!action) return;

      if (action === TV_ACTION.BACK) {
        handleBackAction(e);
        return;
      }

      // Modal abierto: atrapar el foco en el botón de cerrar.
      if (isQrModalOpen || isUdidModalOpen) {
        handleModalActiveAction(action, e);
        return;
      }

      const active = document.activeElement;
      const activeId = active?.id ? String(active.id) : '';

      if (isTextInputElement(active)) {
        handleInputAction(action, e, active, activeId);
        return;
      }

      if (activeId === LOGIN_FOCUS_IDS.PASSWORD_TOGGLE) {
        handlePasswordToggleAction(action, e);
        return;
      }

      if (activeId === LOGIN_FOCUS_IDS.FORGOT_PASSWORD) {
        handleForgotPasswordAction(action, e);
        return;
      }

      const ids = buttonIdsRef.current;
      if (activeId && ids.includes(activeId)) {
        handleButtonAction(action, e, activeId);
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
    isQrModalOpen,
    isUdidModalOpen,
    forgotPasswordEnabled,
    onCloseQrModal,
    onCloseUdidModal,
  ]);

  return { buttonIds };
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function areArraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
