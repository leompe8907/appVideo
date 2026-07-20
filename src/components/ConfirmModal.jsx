import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getTvActionFromKeyEvent, TV_ACTION } from '../utils/tvRemote';

/** Delay antes de aplicar el foco inicial: da tiempo a que el portal termine de montarse. */
const INITIAL_FOCUS_DELAY_MS = 50;

export function ConfirmModal({
  open,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}) {
  const cancelBtnRef = useRef(null);
  const confirmBtnRef = useRef(null);

  // Foco inicial: sin esto, con control remoto el foco del documento queda en el
  // elemento que abrió el modal (oculto tras el overlay) y solo BACK responde.
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      const target = cancelBtnRef.current || confirmBtnRef.current;
      target?.focus();
    }, INITIAL_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const action = getTvActionFromKeyEvent(e);
      const hasCancel = typeof onCancel === 'function';
      const hasConfirm = typeof onConfirm === 'function';

      if (action === TV_ACTION.BACK) {
        if (hasCancel) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
          return;
        }
        if (hasConfirm) {
          e.preventDefault();
          e.stopPropagation();
          onConfirm();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (hasCancel) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
          return;
        }
        if (hasConfirm) {
          e.preventDefault();
          e.stopPropagation();
          onConfirm();
        }
        return;
      }

      // Navegación LEFT/RIGHT entre Confirmar/Cancelar (mismo orden visual que el DOM).
      if (action === TV_ACTION.LEFT || action === TV_ACTION.RIGHT) {
        const order = [confirmBtnRef.current, cancelBtnRef.current].filter(Boolean);
        if (order.length < 2) return;
        const active = document.activeElement;
        const idx = order.indexOf(active);
        if (idx === -1) return;
        const nextIdx = action === TV_ACTION.RIGHT ? idx + 1 : idx - 1;
        const next = order[nextIdx];
        if (next) {
          e.preventDefault();
          e.stopPropagation();
          next.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const showCancel = typeof onCancel === 'function';

  return createPortal(
    <div className="confirm-modal-overlay" role="dialog" aria-modal="true">
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

