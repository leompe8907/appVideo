/**
 * "¿Quién está viendo?" con los perfiles propios de Wind
 * (`features.profilesSource: 'wind'`; ver `windProfileSession.js`).
 *
 * - Al abrir la app vuelve a entrar sola al último perfil si no tiene PIN (o
 *   si la cuenta tiene un único perfil sin PIN). "Cambiar perfil" (Mi cuenta)
 *   llega con `state.switchProfile` y siempre muestra la lista.
 * - Si la cuenta no tiene perfiles en el backend (`profiles_disabled`) o no
 *   hay sesión con el backend, la app sigue como antes de los perfiles.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { FocusableButton } from '../components/navigation/FocusableButton';
import { FocusableInput } from '../components/navigation/FocusableInput';
import ConfirmModal from '../components/ConfirmModal';
import { MessageModal } from '../components/MessageModal';
import ParentalPinGate from '../components/parental/ParentalPinGate';
import AppIcon from '../components/AppIcon';
import { WindProfileFormModal } from '../components/Profile/WindProfileFormModal';
import { maxAgeLabel } from '../components/Profile/windProfileAge';
import { useTvInitialFocus } from '../hooks/useTvInitialFocus';
import { focusManager, createZoneId } from '../navigation/FocusManager';
import { getProfileAvatars } from '../constants/images';
import panaccessService from '@appvideo/core/services/panaccessService';
import { getActiveLicense, setLoggedOut } from '@appvideo/core/utils/userSession';
import { waitForDeviceSessionAuth } from '@appvideo/core/services/loginFlow';
import {
  isProfilesDisabledError,
  listProfiles,
  resetProfilePin,
  verifyProfilePin,
} from '@appvideo/core/services/windProfilesService';
import {
  enterProfile,
  forgetActiveProfile,
  takeOverProfileLicense,
} from '@appvideo/core/services/windProfileSession';
import { useActiveProfileStore } from '@appvideo/core/store/activeProfileStore';
import '../styles/pages/_profile.scss';

const HOME_ROUTE = '/home/inicio';

/** Sin perfiles: lo mismo que hacía la app antes (home con licencia, si no elegir tarjeta). */
function routeWithoutProfiles() {
  return getActiveLicense()?.licenseKey ? HOME_ROUTE : '/smartcard';
}

export function WindProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentBrand, appName, getImage } = useBrand();
  const { isTV } = useDevice();
  const switchProfile = location.state?.switchProfile === true;

  const [profiles, setProfiles] = useState([]);
  const [slots, setSlots] = useState({ total: 0, used: 0, free: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [pinPrompt, setPinPrompt] = useState(null); // { profile, purpose: 'enter' | 'edit' }
  const [inUse, setInUse] = useState(null); // selection de un resultado `in_use`
  const [form, setForm] = useState(null); // { mode, profile, currentPin }
  const [resetFor, setResetFor] = useState(null);
  const autoEnterTried = useRef(false);

  const avatars = useMemo(() => getProfileAvatars(currentBrand?.brand), [currentBrand]);
  const avatarUrl = (avatarId) => avatars.find((a) => a.id === avatarId)?.img || null;

  const leaveWithoutProfiles = useCallback(() => {
    forgetActiveProfile();
    navigate(routeWithoutProfiles(), { replace: true });
  }, [navigate]);

  const doEnter = useCallback(async (profile, pin) => {
    setBusyId(profile.id);
    try {
      const result = await enterProfile(currentBrand, profile, { pin });
      if (result.status === 'ok') {
        navigate(HOME_ROUTE, { replace: true });
      } else if (result.status === 'in_use') {
        setInUse(result.selection);
      } else {
        // Cuenta sin licencias sincronizadas todavía: elegir tarjeta como siempre.
        useActiveProfileStore.getState().setActiveProfile({
          id: profile.id, name: profile.name, imageId: profile.avatarId, source: 'wind',
          maxAge: profile.maxAge, isKids: profile.isKids, hasPin: profile.hasPin,
        });
        navigate('/smartcard', { replace: true });
      }
    } finally {
      setBusyId(null);
    }
  }, [currentBrand, navigate]);

  const showError = useCallback((err, fallback) => {
    if (err?.code === 'pin_locked') {
      setMessage(t('profile.pinLocked', { defaultValue: 'Demasiados intentos. Intenta de nuevo en unos minutos.' }));
    } else {
      setMessage(err?.message || fallback);
    }
  }, [t]);

  const handleSelect = useCallback(async (profile) => {
    if (busyId != null) return;
    if (profile.hasPin) {
      setPinPrompt({ profile, purpose: 'enter' });
      return;
    }
    try {
      await doEnter(profile);
    } catch (err) {
      showError(err, t('profile.errorActivate'));
    }
  }, [busyId, doEnter, showError, t]);

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!(await waitForDeviceSessionAuth())) {
        leaveWithoutProfiles();
        return;
      }
      const data = await listProfiles();
      setProfiles(data.profiles);
      setSlots(data.slots);

      if (!switchProfile && !autoEnterTried.current) {
        autoEnterTried.current = true;
        const rememberedId = useActiveProfileStore.getState().id;
        const remembered = data.profiles.find((p) => p.id === rememberedId);
        const only = data.profiles.length === 1 ? data.profiles[0] : null;
        const target = remembered || only;
        if (target && !target.hasPin) {
          await handleSelect(target);
        }
      }
    } catch (err) {
      if (isProfilesDisabledError(err)) {
        leaveWithoutProfiles();
        return;
      }
      setError(err?.message || t('profile.errorLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [handleSelect, leaveWithoutProfiles, switchProfile, t]);

  useEffect(() => {
    fetchProfiles();
    // Solo al montar: fetchProfiles cambia con handleSelect/busyId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useTvInitialFocus('.profiles-grid', [profiles.length, isLoading]);

  const submitPin = async (pin) => {
    const { profile, purpose } = pinPrompt || {};
    if (!profile) return true;
    try {
      if (purpose === 'edit') {
        await verifyProfilePin(profile.id, pin);
        setPinPrompt(null);
        setForm({ mode: 'edit', profile, currentPin: pin });
      } else {
        // El modal sigue abierto mientras se prueba la licencia: si el PIN es
        // incorrecto, él mismo muestra el error y deja reintentar.
        await doEnter(profile, pin);
        setPinPrompt(null);
      }
      return true;
    } catch (err) {
      if (err?.code === 'pin_incorrect') return false;
      setPinPrompt(null);
      showError(err, t('profile.errorActivate'));
      return true;
    }
  };

  const handleEdit = (profile) => {
    if (profile.hasPin) setPinPrompt({ profile, purpose: 'edit' });
    else setForm({ mode: 'edit', profile, currentPin: undefined });
  };

  const handleTakeOver = async () => {
    const selection = inUse;
    setInUse(null);
    setBusyId(selection?.profile?.id ?? null);
    try {
      const result = await takeOverProfileLicense(currentBrand, selection);
      if (result.status === 'ok') navigate(HOME_ROUTE, { replace: true });
      else setMessage(t('profile.errorActivate'));
    } finally {
      setBusyId(null);
    }
  };

  const handleBack = () => {
    panaccessService.logout();
    setLoggedOut();
    navigate('/login');
  };

  const afterFormChange = () => {
    setForm(null);
    fetchProfiles();
  };

  const backgroundPath = currentBrand?.assets?.background || getImage('background.png');
  const elsewhere = inUse?.activeElsewhere?.[0]?.deviceModel || t('profile.otherDevice', { defaultValue: 'otro dispositivo' });

  return (
    <div className="profile-page" style={backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}>
      {form && (
        <WindProfileFormModal
          mode={form.mode}
          profile={form.profile}
          currentPin={form.currentPin}
          onClose={() => setForm(null)}
          onSaved={afterFormChange}
          onDeleted={afterFormChange}
        />
      )}
      {resetFor && (
        <ResetPinModal
          profile={resetFor}
          onClose={() => setResetFor(null)}
          onDone={() => {
            setResetFor(null);
            fetchProfiles();
          }}
        />
      )}
      <ParentalPinGate
        open={!!pinPrompt}
        title={pinPrompt?.profile?.name || ''}
        message={t('profile.enterPin', { defaultValue: 'Ingresa el PIN del perfil' })}
        onCancel={() => setPinPrompt(null)}
        onSubmit={submitPin}
      />
      <ConfirmModal
        open={!!inUse}
        title={t('profile.inUseTitle', { defaultValue: 'Perfil en uso' })}
        message={t('profile.inUseMessage', {
          name: inUse?.profile?.name || '',
          device: elsewhere,
          defaultValue: '{{name}} se está viendo en {{device}} y no quedan pantallas libres. Si continúas aquí, se detendrá allá.',
        })}
        confirmText={t('profile.inUseConfirm', { defaultValue: 'Continuar aquí' })}
        cancelText={t('common.cancel', { defaultValue: 'Cancelar' })}
        onConfirm={handleTakeOver}
        onCancel={() => setInUse(null)}
      />
      {message && <MessageModal type="error" message={message} onClose={() => setMessage(null)} />}

      <div className="profile-overlay"></div>
      <div className="profile-container">
        <header className="profile-header">
          {currentBrand?.assets?.logo && <img src={currentBrand.assets.logo} alt={appName} className="profile-logo" />}
          <h1 className="profile-title">{t('profile.whoIsWatching')}</h1>
        </header>

        {error && (
          <div className="profile-error">
            <p className="profile-error-text">{error}</p>
            <div className="wind-profile-error-actions">
              <FocusableButton className="profile-back-button" onClick={fetchProfiles}>
                {t('common.retry', { defaultValue: 'Reintentar' })}
              </FocusableButton>
              <FocusableButton className="profile-back-button" onClick={leaveWithoutProfiles}>
                {t('profile.continueWithoutProfile', { defaultValue: 'Continuar sin perfil' })}
              </FocusableButton>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="profile-loading">
            <div className="loading-spinner"></div>
            <p>{t('profile.loadingProfiles')}</p>
          </div>
        ) : (
          <div className={`profiles-grid ${busyId != null ? 'profiles-grid-disabled' : ''}`}>
            {profiles.map((profile, index) => (
              <WindProfileCard
                key={profile.id}
                index={index}
                profile={profile}
                imageUrl={avatarUrl(profile.avatarId)}
                isBusy={busyId === profile.id}
                disabled={busyId != null}
                isTV={isTV}
                onSelect={() => handleSelect(profile)}
                onEdit={() => handleEdit(profile)}
                onForgotPin={profile.hasPin ? () => setResetFor(profile) : null}
              />
            ))}
            {slots.free > 0 && (
              <div
                className="profile-card profile-card-add"
                role="button"
                tabIndex={0}
                aria-label={t('profile.addProfileAria')}
                onClick={() => !isTV && setForm({ mode: 'create', profile: null })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setForm({ mode: 'create', profile: null });
                  }
                }}
              >
                <div className="profile-avatar-wrapper">
                  <div className="profile-avatar profile-avatar-add"><span className="add-icon">+</span></div>
                </div>
                <div className="profile-name">{t('profile.addProfile')}</div>
              </div>
            )}
          </div>
        )}

        {!isLoading && slots.total > 0 && (
          <p className="wind-profile-slots">
            {t('profile.slotsInfo', {
              used: slots.used,
              total: slots.total,
              defaultValue: '{{used}} de {{total}} perfiles',
            })}
          </p>
        )}

        <footer className="profile-footer">
          <FocusableButton className="profile-back-button" onClick={handleBack}>
            {t('common.backLogout')}
          </FocusableButton>
        </footer>
      </div>
    </div>
  );
}

function WindProfileCard({ profile, index, imageUrl, isBusy, disabled, isTV, onSelect, onEdit, onForgotPin }) {
  const { t } = useTranslation();
  const activate = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) onSelect();
    }
  };
  const action = (fn) => ({
    onClick: (e) => {
      e.stopPropagation();
      if (!disabled) fn();
    },
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) fn();
      }
    },
    tabIndex: disabled ? -1 : 0,
  });

  return (
    <div className={`profile-card ${isBusy ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}>
      <div
        id={`profile-${index}`}
        className="profile-card-select"
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={t('profile.profileAria', { name: profile.name })}
        onClick={() => !disabled && !isTV && onSelect()}
        onKeyDown={activate}
      >
        <div className="profile-avatar-wrapper">
          <div className="profile-avatar">
            {imageUrl ? (
              <img src={imageUrl} alt={profile.name} className="profile-avatar-image" />
            ) : (
              <span className="profile-avatar-fallback">👤</span>
            )}
          </div>
          {profile.hasPin && (
            <span className="wind-profile-lock" aria-label={t('profile.hasPin', { defaultValue: 'Con PIN' })}>
              <AppIcon name="lock" size={16} />
            </span>
          )}
          {isBusy && <div className="profile-selected-indicator"><span className="loading-spinner" /></div>}
        </div>
        <div className="profile-name">{profile.name}</div>
        {(profile.isKids || profile.maxAge != null) && (
          <div className="wind-profile-badge">
            {profile.isKids ? t('profile.kidsBadge', { defaultValue: 'Infantil' }) : null}
            {profile.isKids && profile.maxAge != null ? ' · ' : null}
            {profile.maxAge != null ? maxAgeLabel(t, profile.maxAge) : null}
          </div>
        )}
      </div>
      <div className="profile-card-actions">
        <button type="button" className="profile-card-edit" {...action(onEdit)} aria-label={t('profile.editProfileAria', { name: profile.name })}>
          {t('profile.editButton')}
        </button>
        {onForgotPin && (
          <button type="button" className="profile-card-edit" {...action(onForgotPin)}>
            {t('profile.forgotPin', { defaultValue: 'Olvidé el PIN' })}
          </button>
        )}
      </div>
    </div>
  );
}

/** "Olvidé el PIN": la contraseña de la cuenta quita el PIN del perfil (o pone uno nuevo). */
function ResetPinModal({ profile, onClose, onDone }) {
  const { t } = useTranslation();
  const rootRef = useRef(null);
  const [zoneId] = useState(() => createZoneId('wind-reset-pin'));
  const [password, setPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    focusManager.push(zoneId, { containerEl: rootRef.current, onBack: () => onClose?.() });
    return () => focusManager.pop(zoneId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || isSubmitting) return;
    if (newPin && !/^\d{4,6}$/.test(newPin)) {
      setError(t('profile.pinFormatError', { defaultValue: 'El PIN debe tener de 4 a 6 dígitos.' }));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await resetProfilePin(profile.id, password, newPin || undefined);
      onDone?.();
    } catch (err) {
      setError(
        err?.code === 'current_password_incorrect'
          ? t('profile.wrongPassword', { defaultValue: 'La contraseña no es correcta.' })
          : err?.message || t('profile.editError'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={rootRef} className="create-profile-overlay" role="dialog" aria-modal="true">
      <div className="create-profile-modal create-profile-modal--wizard create-profile-modal--wind">
        <h2 className="create-profile-title">{t('profile.forgotPin', { defaultValue: 'Olvidé el PIN' })}: {profile.name}</h2>
        <form onSubmit={handleSubmit} className="create-profile-form">
          <div className="form-group">
            <label htmlFor="wind-reset-password">{t('profile.accountPassword', { defaultValue: 'Contraseña de la cuenta' })}</label>
            <FocusableInput
              id="wind-reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="current-password"
            />
          </div>
          <div className="form-group">
            <label htmlFor="wind-reset-pin">{t('profile.newPinOptional', { defaultValue: 'PIN nuevo (vacío para quitarlo)' })}</label>
            <FocusableInput
              id="wind-reset-pin"
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={isSubmitting}
              maxLength={6}
              autoComplete="off"
            />
          </div>
          {error && <div className="create-profile-error">{error}</div>}
          <div className="create-profile-actions">
            <FocusableButton type="submit" disabled={isSubmitting || !password} className="create-profile-btn create-profile-btn-primary">
              {t('profile.editSubmit')}
            </FocusableButton>
            <FocusableButton type="button" onClick={onClose} disabled={isSubmitting} className="create-profile-btn create-profile-btn-secondary">
              {t('profile.editCancel')}
            </FocusableButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default WindProfilePage;
