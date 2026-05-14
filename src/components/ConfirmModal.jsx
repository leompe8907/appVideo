import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getTvActionFromKeyEvent, TV_ACTION } from '../utils/tvRemote';

export function ConfirmModal({
  open,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}) {
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
          <button type="button" className="confirm-modal__btn confirm-modal__btn--primary" onClick={onConfirm}>
            {confirmText || 'Aceptar'}
          </button>
          {showCancel && (
            <button type="button" className="confirm-modal__btn" onClick={onCancel}>
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

