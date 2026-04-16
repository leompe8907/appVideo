/**
 * Modal de confirmación para eliminar un perfil.
 * Muestra el nombre del perfil y botones Eliminar / Cancelar.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { FocusableButton } from '../navigation/FocusableButton';

import panaccessService from '../../services/panaccessService';

export function DeleteProfileModal({ profile, onClose, onSuccess }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (isTV) {
      const timer = setTimeout(() => {
        const btn = document.getElementById('delete-profile-cancel');
        if (btn) btn.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTV]);

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
    <div className="create-profile-overlay delete-profile-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-profile-title">
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
