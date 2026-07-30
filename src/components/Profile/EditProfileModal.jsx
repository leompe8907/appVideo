/**
 * Modal para editar un perfil YA CREADO: nombre y/o avatar. A diferencia de
 * `CreateProfileModal`, acá no hace falta elegir/asignar una licencia (el
 * perfil ya tiene una) -- solo llama a `panaccessService.changeProfile`.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { useBrand } from '../../contexts/BrandContext';

import { FocusableInput } from '../navigation/FocusableInput';
import { FocusableButton } from '../navigation/FocusableButton';
import { AvatarOption } from './AvatarOption';

import panaccessService from '../../services/panaccessService';
import { getProfileAvatars } from '../../constants/images';
import { focusManager, createZoneId } from '../../navigation/FocusManager';
import { focusElementSafe } from '../../navigation/spatialNavigation';

export function EditProfileModal({ profile, onClose, onSuccess }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const { currentBrand } = useBrand();
  const avatars = useMemo(() => getProfileAvatars(currentBrand?.brand), [currentBrand]);

  const [name, setName] = useState(() => profile?.name || '');
  const [imageId, setImageId] = useState(() => profile?.imageId ?? avatars[0]?.id ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const rootRef = useRef(null);
  const zoneIdRef = useRef(null);
  if (!zoneIdRef.current) zoneIdRef.current = createZoneId('edit-profile-modal');

  // Navegación (LEFT/RIGHT/UP/DOWN por geometría, BACK cancela) delegada a una
  // zona de FocusManager, igual que Create/DeleteProfileModal.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Focus inicial en TV
  useEffect(() => {
    if (isTV && profile) {
      const timer = setTimeout(() => {
        focusElementSafe(document.getElementById('edit-profile-name'));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTV, profile]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting || !profile?.id) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('profile.createNameRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await panaccessService.changeProfile({
        profileId: profile.id,
        name: trimmedName,
        imageId: Number(imageId),
      }, { enableRetry: false });

      setSuccessMessage(t('profile.editSuccess'));
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err) {
      console.error('[EditProfileModal] Error:', err);
      setError(err?.errorInfo?.userMessage || err?.message || err?.cause?.message || t('profile.editError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!profile) return null;

  return (
    <div ref={rootRef} className="create-profile-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
      <div className="create-profile-modal create-profile-modal--wizard">
        <h2 id="edit-profile-title" className="create-profile-title">{t('profile.editTitle')}</h2>

        <form onSubmit={handleSubmit} className="create-profile-form">
          <div className="form-group">
            <label htmlFor="edit-profile-name">{t('profile.createName')}</label>
            <FocusableInput
              id="edit-profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('profile.createNamePlaceholder')}
              disabled={isSubmitting}
              maxLength={50}
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label>{t('profile.createAvatar')}</label>
            <div className="create-profile-avatars">
              {avatars.map((img) => (
                <AvatarOption
                  key={img.id}
                  img={img}
                  selected={imageId === img.id}
                  onSelect={() => setImageId(img.id)}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          </div>

          {error && <div className="create-profile-error">{error}</div>}
          {successMessage && <div className="create-profile-success">{successMessage}</div>}

          <div className="create-profile-actions">
            <FocusableButton
              type="submit"
              disabled={isSubmitting}
              className="create-profile-btn create-profile-btn-primary"
            >
              {isSubmitting ? t('profile.editSubmitting') : t('profile.editSubmit')}
            </FocusableButton>
            <FocusableButton
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="create-profile-btn create-profile-btn-secondary"
            >
              {t('profile.editCancel')}
            </FocusableButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfileModal;
