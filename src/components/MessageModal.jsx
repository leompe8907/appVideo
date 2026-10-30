/**
 * Modal genérico para mostrar un mensaje (éxito o error) con un botón Cerrar.
 * Usado en ProfilePage (activar perfil) y SmartCardPage (seleccionar tarjeta).
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../contexts/DeviceContext';
import { FocusableButton } from './navigation/FocusableButton';
import AppIcon from './AppIcon';
import { focusManager, createZoneId } from '../navigation/FocusManager';
import { focusElementSafe } from '../navigation/spatialNavigation';

export function MessageModal({ type = 'success', message, onClose }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const rootRef = useRef(null);
  const zoneIdRef = useRef(null);
  if (!zoneIdRef.current) zoneIdRef.current = createZoneId('message-modal');

  // Navegación (BACK cierra; LEFT/RIGHT/UP/DOWN quedan escopadas al modal — en
  // la práctica un único botón "Cerrar", así que no hay a dónde moverse) delegada
  // al motor central en vez de depender de que la pantalla que lo abre la trampee.
  useEffect(() => {
    if (!message) return undefined;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  useEffect(() => {
    if (isTV && message) {
      const timer = setTimeout(() => {
        focusElementSafe(document.getElementById('message-modal-close'));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTV, message]);

  if (!message) return null;

  const isSuccess = type === 'success';

  return (
    <div ref={rootRef} className="create-profile-overlay message-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="message-modal-title">
      <div className="create-profile-modal message-modal">
        <h2 id="message-modal-title" className="create-profile-title message-modal-title">
          {isSuccess ? t('common.success') : t('common.error')}
        </h2>
        <div className={`message-modal-content ${isSuccess ? 'message-modal-success' : 'message-modal-error'}`}>
          <span className="message-modal-icon" aria-hidden="true">
            <AppIcon name={isSuccess ? 'done' : 'warning'} size={22} />
          </span>
          <p className="message-modal-text">{message}</p>
        </div>
        <div className="create-profile-actions">
          <FocusableButton
            type="button"
            onClick={onClose}
            id="message-modal-close"
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
