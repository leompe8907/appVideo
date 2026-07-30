/**
 * Modal para crear un nuevo perfil (lógica OTT).
 * Usa la primera licencia disponible (smartCard no asignada a ningún perfil).
 *
 * Wizard de 2 pasos (nombre -> avatar) en vez de un formulario único: con
 * control remoto, menos elementos enfocables por pantalla hace la
 * navegación mucho más predecible que saltar entre input, grilla de
 * avatares y botones todo junto. El teclado en pantalla de TV no necesita
 * ningún cambio acá -- `FocusableInput` ya lo dispara solo (ver
 * `components/navigation/FocusableInput.jsx`), este wizard solo le da a ese
 * paso su propia pantalla en vez de compartirla con el resto del formulario.
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

const getCardKey = (card) => card?.KEY ?? card?.key ?? card?.licenseKey ?? card?.Key ?? '';

export function CreateProfileModal({ smartCards = [], profiles = [], onClose, onSuccess }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const { currentBrand } = useBrand();
  // Avatares locales por marca (`public/<marca>/avatars/`, ver `getProfileAvatars`)
  // en vez del array estático de antes -- por eso ya no hay una constante
  // `DEFAULT_IMAGE_ID` a nivel de módulo, se calcula acá adentro.
  const avatars = useMemo(() => getProfileAvatars(currentBrand?.brand), [currentBrand]);
  const [step, setStep] = useState(1); // 1: nombre, 2: avatar
  const [name, setName] = useState('');
  const [imageId, setImageId] = useState(() => avatars[0]?.id ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const rootRef = useRef(null);
  const zoneIdRef = useRef(null);
  if (!zoneIdRef.current) zoneIdRef.current = createZoneId('create-profile-modal');

  // El handler de BACK (registrado una sola vez más abajo) necesita leer el
  // paso ACTUAL, no el que había en el render donde se registró -- de ahí el
  // ref en vez de leer `step` directo dentro del closure.
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const availableCard = smartCards.find(
    (card) => !profiles.some((profile) => profile.sn === getCardKey(card))
  );

  // Navegación (LEFT/RIGHT/UP/DOWN por geometría, BACK vuelve al paso 1 o
  // cierra el modal si ya estaba en el paso 1) delegada a una zona de
  // FocusManager, igual que otros modales.
  useEffect(() => {
    const zoneId = zoneIdRef.current;
    focusManager.push(zoneId, {
      containerEl: rootRef.current,
      onBack: () => {
        if (stepRef.current === 2) {
          setError(null);
          setStep(1);
        } else {
          onClose?.();
        }
      },
    });
    return () => {
      focusManager.pop(zoneId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus inicial en TV, tanto al abrir el modal como al cambiar de paso.
  useEffect(() => {
    if (!isTV) return undefined;
    const timer = setTimeout(() => {
      if (step === 1) {
        focusElementSafe(document.getElementById('create-profile-name'));
      } else {
        const firstAvatar = rootRef.current?.querySelector('.create-profile-avatar-option');
        if (firstAvatar) focusElementSafe(firstAvatar);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isTV, step]);

  const handleStepOneSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('profile.createNameRequired'));
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleBackToStepOne = () => {
    setError(null);
    setStep(1);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      // No debería pasar (ya se validó en el paso 1), pero si pasa, volver
      // ahí en vez de mostrar el error en una pantalla sin el input.
      setStep(1);
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
    <div ref={rootRef} className="create-profile-overlay" role="dialog" aria-modal="true" aria-labelledby="create-profile-title">
      <div className="create-profile-modal create-profile-modal--wizard">
        <div className="create-profile-progress" aria-hidden="true">
          <span className={`create-profile-progress-dot${step === 1 ? ' active' : ''}`} />
          <span className={`create-profile-progress-dot${step === 2 ? ' active' : ''}`} />
        </div>

        {step === 1 ? (
          <form onSubmit={handleStepOneSubmit} className="create-profile-step">
            <div className="create-profile-step-label">
              {t('profile.createStepOf', { current: 1, total: 2, defaultValue: 'Paso 1 de 2' })}
            </div>
            <h2 id="create-profile-title" className="create-profile-title">
              {t('profile.createStepNameTitle', { defaultValue: '¿Cómo se llama?' })}
            </h2>

            <FocusableInput
              id="create-profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('profile.createNamePlaceholder')}
              aria-label={t('profile.createName')}
              maxLength={50}
              autoComplete="off"
              className="create-profile-name-input"
            />

            {error && <div className="create-profile-error">{error}</div>}

            <div className="create-profile-actions">
              <FocusableButton
                type="submit"
                className="create-profile-btn create-profile-btn-primary"
              >
                {t('profile.createNext', { defaultValue: 'Siguiente' })}
              </FocusableButton>
              <FocusableButton
                type="button"
                onClick={onClose}
                className="create-profile-btn create-profile-btn-secondary"
              >
                {t('profile.createCancel')}
              </FocusableButton>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="create-profile-step">
            <div className="create-profile-step-label">
              {t('profile.createStepOf', { current: 2, total: 2, defaultValue: 'Paso 2 de 2' })}
            </div>
            <h2 id="create-profile-title" className="create-profile-title">
              {t('profile.createStepAvatarTitle', { defaultValue: 'Elegí un avatar' })}
            </h2>

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

            {error && <div className="create-profile-error">{error}</div>}
            {successMessage && <div className="create-profile-success">{successMessage}</div>}

            <div className="create-profile-actions">
              <FocusableButton
                type="submit"
                disabled={isSubmitting}
                className="create-profile-btn create-profile-btn-primary"
              >
                {isSubmitting ? t('profile.createSubmitting') : t('profile.createSubmit')}
              </FocusableButton>
              <FocusableButton
                type="button"
                onClick={handleBackToStepOne}
                disabled={isSubmitting}
                className="create-profile-btn create-profile-btn-secondary"
              >
                {t('profile.createBack', { defaultValue: 'Atrás' })}
              </FocusableButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default CreateProfileModal;
