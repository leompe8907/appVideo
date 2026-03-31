/**
 * Modal para crear un nuevo perfil (lógica OTT).
 * Usa la primera licencia disponible (smartCard no asignada a ningún perfil).
 * Formulario: nombre, avatar (imageId). La licencia y el PIN vienen de la tarjeta seleccionada.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';
import { FocusableInput } from '../navigation/FocusableInput';
import { FocusableButton } from '../navigation/FocusableButton';
import * as SpatialNavigation from '@noriginmedia/norigin-spatial-navigation';
import panaccessService from '../../services/panaccessService';
import Img from '../../constants/images';

const DEFAULT_IMAGE_ID = Img && Img.length > 0 ? Img[0].id : null;

const getCardKey = (card) => card?.KEY ?? card?.key ?? card?.licenseKey ?? card?.Key ?? '';

export function CreateProfileModal({ smartCards = [], profiles = [], onClose, onSuccess }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const [name, setName] = useState('');
  const [imageId, setImageId] = useState(DEFAULT_IMAGE_ID);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const availableCard = smartCards.find(
    (card) => !profiles.some((profile) => profile.sn === getCardKey(card))
  );

  // Focus inicial en TV
  useEffect(() => {
    if (isTV) {
      const timer = setTimeout(() => {
        const setFocus = SpatialNavigation.setFocus || SpatialNavigation.focus || SpatialNavigation.default?.setFocus;
        if (setFocus && typeof setFocus === 'function') {
          setFocus('create-profile-name');
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTV]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('profile.createNameRequired'));
      return;
    }

    if (!availableCard) {
      setError(t('profile.noCards'));
      return;
    }

    const licenseKey = getCardKey(availableCard);
    const pin = availableCard.pin ?? availableCard.PIN ?? availableCard.Pin ?? '';

    setIsSubmitting(true);
    setError(null);

    try {
      await panaccessService.createProfile({
        name: trimmedName,
        imageId: Number(imageId),
        license: licenseKey,
        pin,
      }, { enableRetry: false });

      setSuccessMessage(t('profile.createSuccess'));
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err) {
      console.error('[CreateProfileModal] Error:', err);
      setError(err?.errorInfo?.userMessage || err?.message || t('profile.createError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-profile-overlay" role="dialog" aria-modal="true" aria-labelledby="create-profile-title">
      <div className="create-profile-modal">
        <h2 id="create-profile-title" className="create-profile-title">{t('profile.createTitle')}</h2>

        <form onSubmit={handleSubmit} className="create-profile-form">
          <div className="form-group">
            <label htmlFor="create-profile-name">{t('profile.createName')}</label>
            <FocusableInput
              id="create-profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('profile.createNamePlaceholder')}
              disabled={isSubmitting}
              focusKey="create-profile-name"
              maxLength={50}
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label>{t('profile.createAvatar')}</label>
            <div className="create-profile-avatars">
              {Img.map((img) => (
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
              onEnterPress={handleSubmit}
              disabled={isSubmitting}
              focusKey="create-profile-submit"
              className="create-profile-btn create-profile-btn-primary"
            >
              {isSubmitting ? t('profile.createSubmitting') : t('profile.createSubmit')}
            </FocusableButton>
            <FocusableButton
              type="button"
              onClick={onClose}
              onEnterPress={onClose}
              disabled={isSubmitting}
              focusKey="create-profile-cancel"
              className="create-profile-btn create-profile-btn-secondary"
            >
              {t('profile.createCancel')}
            </FocusableButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function AvatarOption({ img, selected, onSelect, disabled }) {
  const { ref, focused } = useSpatialNavigation({
    onEnterPress: disabled ? undefined : () => onSelect(),
    focusKey: `create-profile-avatar-${img.id}`,
    isFocusable: !disabled,
  });

  const handleClick = () => {
    if (!disabled) onSelect();
  };

  const handleKeyDown = (e) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={-1}
      className={`create-profile-avatar-option ${selected ? 'selected' : ''} ${focused ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={img.id.toString()}
      data-focus-key={`create-profile-avatar-${img.id}`}
    >
      <img src={img.img} alt="" className="create-profile-avatar-img" />
      {selected && <span className="create-profile-avatar-check">✓</span>}
    </div>
  );
}

export default CreateProfileModal;
