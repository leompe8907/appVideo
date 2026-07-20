import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FocusableButton } from '../navigation/FocusableButton';
import AppIcon from '../AppIcon';
import { formatFullDate } from '../../utils/osmsFormat';
import { focusManager, createZoneId } from '../../navigation/FocusManager';
import { focusElementSafe } from '../../navigation/spatialNavigation';

export function OsmsMessageModal({ open, message, locale, onClose, onMarkRead }) {
  const { t } = useTranslation();
  const rootRef = useRef(null);
  const zoneIdRef = useRef(null);
  if (!zoneIdRef.current) zoneIdRef.current = createZoneId('osms-message-modal');

  // Navegación (LEFT/RIGHT/UP/DOWN por geometría entre "Volver"/"Marcar leído",
  // BACK cierra) delegada a una zona de FocusManager, igual que otros modales.
  useEffect(() => {
    if (!open) return undefined;
    const zoneId = zoneIdRef.current;
    focusManager.push(zoneId, {
      containerEl: rootRef.current,
      onBack: () => {
        onClose?.();
      },
    });
    return () => {
      focusManager.pop(zoneId);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      focusElementSafe(document.getElementById('osms-modal-back'));
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open || !message) return null;

  const dateText = formatFullDate(message.time, locale);
  const body = message.message || t('osms.noMessage');

  return createPortal(
    <div
      ref={rootRef}
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
