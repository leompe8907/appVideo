import { useEffect } from 'react';

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
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="confirm-modal-overlay" role="dialog" aria-modal="true">
      <div className="confirm-modal">
        {title ? <h4 className="confirm-modal__title">{title}</h4> : null}
        {message ? <p className="confirm-modal__message">{message}</p> : null}
        <div className="confirm-modal__actions">
          <button type="button" className="confirm-modal__btn confirm-modal__btn--primary" onClick={onConfirm}>
            {confirmText || 'Aceptar'}
          </button>
          <button type="button" className="confirm-modal__btn" onClick={onCancel}>
            {cancelText || 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;

