import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FocusableButton } from '../navigation/FocusableButton';
import AppIcon from '../AppIcon';
import { formatFullDate } from '../../utils/osmsFormat';
import { getTvActionFromKeyEvent, TV_ACTION } from '../../utils/tvRemote';

export function OsmsMessageModal({ open, message, locale, onClose, onMarkRead }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const action = getTvActionFromKeyEvent(e);
      if (action === TV_ACTION.BACK || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [open, onClose]);

  if (!open || !message) return null;

  const dateText = formatFullDate(message.time, locale);
  const body = message.message || t('osms.noMessage');

  return createPortal(
    <div
      className="osms-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('osms.detail')}
      onClick={() => onClose?.()}
    >
      <div className="osms-modal" onClick={(e) => e.stopPropagation()}>
        <header className="osms-modal__header">
          <FocusableButton
            type="button"
            className="osms-modal__back"
            onClick={() => onClose?.()}
            id="osms-modal-back"
          >
            <AppIcon name="back" size={20} />
            <span>{t('osms.back', { defaultValue: 'Volver' })}</span>
          </FocusableButton>
          <time className="osms-modal__date" dateTime={message.time?.toISOString?.()}>
            {dateText}
          </time>
        </header>

        <div className="osms-modal__body">
          <p className="osms-modal__message">{body}</p>
        </div>

        <footer className="osms-modal__footer">
          <FocusableButton
            type="button"
            className="osms-modal__mark-read"
            onClick={() => onMarkRead?.()}
            id="osms-modal-mark-read"
          >
            {t('osms.markRead', { defaultValue: 'Marcar leído' })}
          </FocusableButton>
        </footer>
      </div>
    </div>,
    document.body
  );
}

export default OsmsMessageModal;
