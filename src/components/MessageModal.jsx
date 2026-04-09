/**
 * Modal genérico para mostrar un mensaje (éxito o error) con un botón Cerrar.
 * Usado en ProfilePage (activar perfil) y SmartCardPage (seleccionar tarjeta).
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../contexts/DeviceContext';
import { FocusableButton } from './navigation/FocusableButton';
import { useSpatialSetFocus } from '../hooks/navigation/useSpatialNavigation';

export function MessageModal({ type = 'success', message, onClose }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const setFocus = useSpatialSetFocus();

  useEffect(() => {
    if (isTV) {
      const timer = setTimeout(() => {
        if (typeof setFocus === 'function') setFocus('message-modal-close');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTV, setFocus]);

  if (!message) return null;

  const isSuccess = type === 'success';

  return (
    <div className="create-profile-overlay message-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="message-modal-title">
      <div className="create-profile-modal message-modal">
        <h2 id="message-modal-title" className="create-profile-title message-modal-title">
          {isSuccess ? t('common.success') : t('common.error')}
        </h2>
        <div className={`message-modal-content ${isSuccess ? 'message-modal-success' : 'message-modal-error'}`}>
          <span className="message-modal-icon" aria-hidden="true">
            {isSuccess ? '✓' : '⚠'}
          </span>
          <p className="message-modal-text">{message}</p>
        </div>
        <div className="create-profile-actions">
          <FocusableButton
            type="button"
            onClick={onClose}
            onEnterPress={onClose}
            onArrowPress={() => false}
            focusKey="message-modal-close"
            className="create-profile-btn create-profile-btn-primary"
          >
            {t('common.close')}
          </FocusableButton>
        </div>
      </div>
    </div>
  );
}

export default MessageModal;
