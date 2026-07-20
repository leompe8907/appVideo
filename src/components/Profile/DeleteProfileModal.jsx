/**
 * Modal de confirmación para eliminar un perfil.
 * Muestra el nombre del perfil y botones Eliminar / Cancelar.
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { FocusableButton } from '../navigation/FocusableButton';
import { focusManager, createZoneId } from '../../navigation/FocusManager';
import { focusElementSafe } from '../../navigation/spatialNavigation';

import panaccessService from '../../services/panaccessService';

export function DeleteProfileModal({ profile, onClose, onSuccess }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const rootRef = useRef(null);
  const zoneIdRef = useRef(null);
  if (!zoneIdRef.current) zoneIdRef.current = createZoneId('delete-profile-modal');

  // Navegación (LEFT/RIGHT por geometría entre "Eliminar"/"Cancelar", BACK cancela)
  // delegada a una zona de FocusManager, igual que otros modales.
  useEffect(() => {
    if (!profile) return undefined;
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
  }, [profile, onClose]);

  useEffect(() => {
    if (isTV && profile) {
      const timer = setTimeout(() => {
        focusElementSafe(document.getElementById('delete-profile-cancel'));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTV, profile]);

  const handleConfirm = async (e) => {
    if (e) e.preventDefault();
    if (isDeleting || !profile?.id) return;

    setIsDeleting(true);
    setError(null);

    try {
      await panaccessService.deleteProfile({
        profileId: String(profile.id),
      }, { enableRetry: false });

      setSuccessMessage(t('profile.deleteSuccess'));
      setTimeout(() => {
        onSuccess?.();
      }, 1200);
    } catch (err) {
      console.error('[DeleteProfileModal] Error:', err);
      setError(err?.errorInfo?.userMessage || err?.message || err?.cause?.message || t('profile.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (!profile) return null;

  return (
    <div ref={rootRef} className="create-profile-overlay delete-profile-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-profile-title">
      <div className="create-profile-modal delete-profile-modal">
        <h2 id="delete-profile-title" className="create-profile-title">{t('profile.deleteTitle')}</h2>
        <p className="delete-profile-message">
          {t('profile.deleteMessage', { name: profile.name })}
        </p>

        {error && <div className="create-profile-error">{error}</div>}
        {successMessage && <div className="create-profile-success">{successMessage}</div>}

        <div className="create-profile-actions">
          <FocusableButton
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            id="delete-profile-confirm"
            className="create-profile-btn delete-profile-btn-confirm"
          >
            {isDeleting ? t('profile.deleteDeleting') : t('profile.deleteConfirm')}
          </FocusableButton>
          <FocusableButton
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            id="delete-profile-cancel"
            className="create-profile-btn create-profile-btn-secondary"
          >
            {t('profile.deleteCancel')}
          </FocusableButton>
        </div>
      </div>
    </div>
  );
}

export default DeleteProfileModal;
