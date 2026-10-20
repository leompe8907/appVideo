/**
 * Crear o editar un perfil externo (`externalProfilesService.js`): nombre, avatar,
 * infantil, edad máxima y PIN propio del perfil (opcional, de 4 a 6 dígitos;
 * NO es el PIN de la tarjeta). Al editar un perfil con PIN, quien abre el
 * modal ya lo verificó y lo pasa en `currentPin` para el PATCH/DELETE.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { useBrand } from '../../contexts/BrandContext';
import { FocusableInput } from '../navigation/FocusableInput';
import { FocusableButton } from '../navigation/FocusableButton';
import { AvatarOption } from './AvatarOption';
import ConfirmModal from '../ConfirmModal';
import { getProfileAvatars } from '../../constants/images';
import { MAX_AGE_OPTIONS, maxAgeLabel } from './externalProfileAge';
import { focusManager, createZoneId } from '../../navigation/FocusManager';
import { focusElementSafe } from '../../navigation/spatialNavigation';
import {
  createProfile,
  deleteProfile,
  updateProfile,
} from '@appvideo/core/services/externalProfilesService';

const KIDS_DEFAULT_MAX_AGE = 10;
const PIN_RE = /^\d{4,6}$/;

function errorMessage(t, err, fallback) {
  switch (err?.code) {
    case 'name_taken':
      return t('profile.errorNameTaken', { defaultValue: 'Ya tienes un perfil con ese nombre.' });
    case 'no_free_license':
      return t('profile.errorNoFreeLicense', { defaultValue: 'Tu plan no permite más perfiles.' });
    case 'invalid_pin_format':
      return t('profile.pinFormatError', { defaultValue: 'El PIN debe tener de 4 a 6 dígitos.' });
    case 'owner_profile':
      return t('profile.errorOwner', { defaultValue: 'El perfil principal no se puede eliminar.' });
    default:
      return err?.message || fallback;
  }
}

export function ExternalProfileFormModal({ mode, profile, currentPin, onClose, onSaved, onDeleted }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const { currentBrand } = useBrand();
  const avatars = useMemo(() => getProfileAvatars(currentBrand?.brand), [currentBrand]);
  const isEdit = mode === 'edit';

  const [name, setName] = useState(() => profile?.name || '');
  const [avatarId, setAvatarId] = useState(() => profile?.avatarId ?? avatars[0]?.id ?? null);
  const [isKids, setIsKids] = useState(() => profile?.isKids === true);
  const [maxAge, setMaxAge] = useState(() => (profile ? profile.maxAge ?? null : null));
  const [newPin, setNewPin] = useState('');
  const [removePin, setRemovePin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rootRef = useRef(null);
  const [zoneId] = useState(() => createZoneId('external-profile-form'));

  useEffect(() => {
    focusManager.push(zoneId, { containerEl: rootRef.current, onBack: () => onClose?.() });
    return () => focusManager.pop(zoneId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isTV) return undefined;
    const timer = setTimeout(() => focusElementSafe(document.getElementById('external-profile-name')), 300);
    return () => clearTimeout(timer);
  }, [isTV]);

  const toggleKids = () => {
    const next = !isKids;
    setIsKids(next);
    // Mismo default que el backend: un perfil infantil sin edad queda en 10.
    if (next && maxAge == null) setMaxAge(KIDS_DEFAULT_MAX_AGE);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('profile.createNameRequired'));
      return;
    }
    if (newPin && !PIN_RE.test(newPin)) {
      setError(t('profile.pinFormatError', { defaultValue: 'El PIN debe tener de 4 a 6 dígitos.' }));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        const changes = { name: trimmed, avatarId, isKids, maxAge };
        if (removePin) changes.newPin = null;
        else if (newPin) changes.newPin = newPin;
        await updateProfile(profile.id, changes, currentPin);
      } else {
        await createProfile({ name: trimmed, avatarId, isKids, maxAge, pin: newPin || undefined });
      }
      onSaved?.();
    } catch (err) {
      setError(errorMessage(t, err, isEdit ? t('profile.editError') : t('profile.createError')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    setIsSubmitting(true);
    setError(null);
    try {
      await deleteProfile(profile.id, currentPin);
      onDeleted?.();
    } catch (err) {
      setError(errorMessage(t, err, t('profile.deleteError')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={rootRef} className="create-profile-overlay" role="dialog" aria-modal="true" aria-labelledby="external-profile-title">
      <ConfirmModal
        open={confirmDelete}
        title={t('profile.deleteTitle')}
        message={t('profile.deleteMessage', { name: profile?.name || '' })}
        confirmText={t('profile.deleteConfirm')}
        cancelText={t('profile.deleteCancel')}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      <div className="create-profile-modal create-profile-modal--wizard create-profile-modal--external">
        <h2 id="external-profile-title" className="create-profile-title">
          {isEdit ? t('profile.editTitle') : t('profile.createTitle')}
        </h2>

        <form onSubmit={handleSubmit} className="create-profile-form">
          <div className="form-group">
            <label htmlFor="external-profile-name">{t('profile.createName')}</label>
            <FocusableInput
              id="external-profile-name"
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
                  selected={avatarId === img.id}
                  onSelect={() => setAvatarId(img.id)}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          </div>

          <div className="form-group">
            <FocusableButton
              type="button"
              className={`external-profile-toggle ${isKids ? 'active' : ''}`}
              aria-pressed={isKids}
              onClick={toggleKids}
              disabled={isSubmitting}
            >
              {t('profile.kidsLabel', { defaultValue: 'Perfil infantil' })}: {isKids ? t('common.yes', { defaultValue: 'Sí' }) : t('common.no', { defaultValue: 'No' })}
            </FocusableButton>
          </div>

          <div className="form-group">
            <label>{t('profile.maxAgeLabel', { defaultValue: 'Contenido permitido hasta' })}</label>
            <div className="external-profile-chips" role="group">
              {MAX_AGE_OPTIONS.map((value) => (
                <FocusableButton
                  key={String(value)}
                  type="button"
                  className={`external-profile-chip ${maxAge === value ? 'active' : ''}`}
                  aria-pressed={maxAge === value}
                  onClick={() => setMaxAge(value)}
                  disabled={isSubmitting}
                >
                  {maxAgeLabel(t, value)}
                </FocusableButton>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="external-profile-pin">
              {isEdit && profile?.hasPin
                ? t('profile.changePin', { defaultValue: 'Nuevo PIN (vacío para no cambiarlo)' })
                : t('profile.createPin')}
            </label>
            <FocusableInput
              id="external-profile-pin"
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('profile.pinPlaceholder', { defaultValue: '4 a 6 dígitos' })}
              disabled={isSubmitting || removePin}
              maxLength={6}
              autoComplete="off"
            />
            {isEdit && profile?.hasPin && (
              <FocusableButton
                type="button"
                className={`external-profile-toggle ${removePin ? 'active' : ''}`}
                aria-pressed={removePin}
                onClick={() => setRemovePin((v) => !v)}
                disabled={isSubmitting}
              >
                {t('profile.removePin', { defaultValue: 'Quitar el PIN' })}
              </FocusableButton>
            )}
          </div>

          {error && <div className="create-profile-error">{error}</div>}

          <div className="create-profile-actions">
            <FocusableButton type="submit" disabled={isSubmitting} className="create-profile-btn create-profile-btn-primary">
              {isSubmitting
                ? (isEdit ? t('profile.editSubmitting') : t('profile.createSubmitting'))
                : (isEdit ? t('profile.editSubmit') : t('profile.createSubmit'))}
            </FocusableButton>
            {isEdit && !profile?.isOwner && (
              <FocusableButton
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={isSubmitting}
                className="create-profile-btn create-profile-btn-secondary"
              >
                {t('profile.deleteConfirm')}
              </FocusableButton>
            )}
            <FocusableButton type="button" onClick={onClose} disabled={isSubmitting} className="create-profile-btn create-profile-btn-secondary">
              {t('profile.editCancel')}
            </FocusableButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ExternalProfileFormModal;
