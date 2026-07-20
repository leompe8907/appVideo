import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { focusManager, createZoneId } from '../navigation/FocusManager';
import { focusElementSafe } from '../navigation/spatialNavigation';

/** Delay antes de aplicar el foco inicial: da tiempo a que el portal termine de montarse. */
const INITIAL_FOCUS_DELAY_MS = 50;

/**
 * Modal de confirmación genérico. La navegación (LEFT/RIGHT entre botones,
 * BACK para cancelar) ya no la maneja este componente directamente: se
 * registra como zona en `FocusManager` y deja que el `NavigationRouter`
 * central (motor de navegación espacial) mueva el foco por geometría real
 * entre los botones, y que `onBack` decida qué hacer con BACK/Escape.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}) {
  const rootRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const zoneIdRef = useRef(null);
  if (!zoneIdRef.current) {
    zoneIdRef.current = createZoneId('confirm-modal');
  }

  useEffect(() => {
    if (!open) return undefined;
    const zoneId = zoneIdRef.current;
    const hasCancel = typeof onCancel === 'function';
    const hasConfirm = typeof onConfirm === 'function';

    focusManager.push(zoneId, {
      containerEl: rootRef.current,
      onBack: () => {
        if (hasCancel) onCancel();
        else if (hasConfirm) onConfirm();
      },
    });

    // Foco inicial: sin esto, con control remoto el foco del documento queda en el
    // elemento que abrió el modal (oculto tras el overlay) y solo BACK responde.
    const timer = setTimeout(() => {
      focusElementSafe(cancelBtnRef.current || confirmBtnRef.current);
    }, INITIAL_FOCUS_DELAY_MS);

    return () => {
      clearTimeout(timer);
      focusManager.pop(zoneId);
    };
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const showCancel = typeof onCancel === 'function';

  return createPortal(
    <div ref={rootRef} className="confirm-modal-overlay" role="dialog" aria-modal="true">
      <div className="confirm-modal">
        {title ? <h4 className="confirm-modal__title">{title}</h4> : null}
        {message ? <p className="confirm-modal__message">{message}</p> : null}
        <div className="confirm-modal__actions">
          <button
            type="button"
            ref={confirmBtnRef}
            className="confirm-modal__btn confirm-modal__btn--primary"
            onClick={onConfirm}
          >
            {confirmText || 'Aceptar'}
          </button>
          {showCancel && (
            <button
              type="button"
              ref={cancelBtnRef}
              className="confirm-modal__btn"
              onClick={onCancel}
            >
              {cancelText || 'Cancelar'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmModal;
