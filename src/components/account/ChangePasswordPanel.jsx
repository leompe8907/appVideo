/**
 * Panel nativo de "cambiar contraseña". Solo se monta en PC/web cuando el
 * brand tiene `login.deviceSession.enabled` (ver `MiCuentaPage.jsx`) -- en
 * TV o brands sin este backend se sigue usando el QR existente.
 *
 * El backend invalida TODOS los JWT y revoca todos los dispositivos
 * vinculados al cambiar la contraseña (ver `accountSecurityService.js`),
 * así que tras un éxito forzamos logout completo -- no hay forma de
 * "seguir logueado" con la contraseña vieja en caché local.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { changePassword } from '../../services/accountSecurityService';
import { clearSessionBeforeNewLogin } from '../../services/loginFlow';
// Los estilos de este panel viven en styles/pages/_mi-cuenta.scss (importado
// desde MiCuentaPage.jsx), no acá -- ver el comentario en ese archivo sobre
// por qué (chunk de CSS separado que se rompía en el build de producción).

const MIN_LENGTH = 8;
const MAX_LENGTH = 255;

// Política de contraseña -- debe mantenerse sincronizada con
// wind/utils/password_policy.py (backend, Wind). Es solo un atajo para dar
// feedback inmediato antes del round-trip; el backend sigue siendo la
// fuente de verdad y valida esto mismo de nuevo (si esta validación local
// quedara desactualizada respecto al backend, el peor caso es un 400 con
// `code=password_rejected_by_panaccess`/`password_policy_violation`, no un
// error silencioso).
const PASSWORD_ALLOWED_CHARS_RE = /^[A-Za-z0-9_!@#$%^&*()+=[\]{};:'",.<>/?~`|\\-]+$/;
const PASSWORD_HAS_UPPER_RE = /[A-Z]/;
const PASSWORD_HAS_DIGIT_RE = /[0-9]/;

function getPasswordPolicyErrorKey(password) {
  if (!password || password.length < MIN_LENGTH || password.length > MAX_LENGTH) {
    return 'changePasswordTooShort';
  }
  if (!PASSWORD_ALLOWED_CHARS_RE.test(password)) {
    return 'changePasswordInvalidChars';
  }
  if (!PASSWORD_HAS_UPPER_RE.test(password)) {
    return 'changePasswordMissingUpper';
  }
  if (!PASSWORD_HAS_DIGIT_RE.test(password)) {
    return 'changePasswordMissingNumber';
  }
  return null;
}

/** Input de contraseña con botón de mostrar/ocultar interno (ver `.account-security-password-field` en _account-security.scss). */
function PasswordToggleInput({
  id,
  value,
  onChange,
  autoComplete,
  disabled,
  required,
  minLength,
  maxLength,
  show,
  onToggleShow,
  t,
}) {
  return (
    <div className="account-security-password-field">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className="account-security-input"
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        disabled={disabled}
        required={required}
      />
      <button
        type="button"
        className="account-security-password-toggle"
        onClick={onToggleShow}
        disabled={disabled}
        aria-label={
          show
            ? t('account.hidePassword', { defaultValue: 'Ocultar contraseña' })
            : t('account.showPassword', { defaultValue: 'Mostrar contraseña' })
        }
      >
        <span
          className={`account-security-password-toggle__icon${show ? ' is-visible' : ''}`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

export function ChangePasswordPanel({ brandConfig, brand }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const goToLogin = () => {
    clearSessionBeforeNewLogin();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        goToLogin();
      }, 3000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    // El backend (ver accountSecurityService.changePassword) ya verifica
    // `oldPass` de verdad contra PanAccess -- acá solo se exige que el
    // campo no esté vacío antes del round-trip; la validación real (y el
    // mensaje "la contraseña actual no es correcta"/bloqueo por intentos)
    // llega en la respuesta de `changePassword()` más abajo (`err.code`
    // `old_password_incorrect`/`old_password_locked`). Antes esto se
    // comparaba contra una copia cacheada localmente en el dispositivo
    // (`getCredentials`), lo cual podía rechazar un cambio válido si esa
    // copia había quedado desactualizada (p. ej. la contraseña ya se
    // había cambiado desde otro dispositivo/el dashboard web).
    const trimmedCurrent = currentPass.trim();
    if (!trimmedCurrent) {
      setError(t('account.changePasswordCurrentRequired', { defaultValue: 'Ingresa tu contraseña actual.' }));
      return;
    }

    const policyErrorKey = getPasswordPolicyErrorKey(newPass);
    if (policyErrorKey) {
      const defaults = {
        changePasswordTooShort: `La contraseña debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres.`,
        changePasswordInvalidChars: 'La contraseña tiene caracteres no permitidos.',
        changePasswordMissingUpper: 'La contraseña debe incluir al menos una letra mayúscula.',
        changePasswordMissingNumber: 'La contraseña debe incluir al menos un número.',
      };
      setError(
        t(`account.${policyErrorKey}`, {
          defaultValue: defaults[policyErrorKey],
          count: MIN_LENGTH,
        }),
      );
      return;
    }
    if (newPass !== confirmPass) {
      setError(t('account.changePasswordMismatch', { defaultValue: 'Las contraseñas no coinciden.' }));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await changePassword(brandConfig, brand, trimmedCurrent, newPass);
      if (!result?.success) {
        throw new Error(
          result?.message || t('account.changePasswordError', { defaultValue: 'No se pudo cambiar la contraseña.' }),
        );
      }
      setSuccess(true);
    } catch (err) {
      setError(err?.message || t('account.changePasswordError', { defaultValue: 'No se pudo cambiar la contraseña.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="account-security-panel">
        <div className="account-security-success">
          {t('account.changePasswordSuccess', {
            defaultValue:
              'Contraseña actualizada. Por seguridad cerramos tu sesión en este dispositivo: inicia sesión de nuevo con tu nueva contraseña.',
          })}
        </div>
        <button type="button" className="account-security-btn account-security-btn--primary" onClick={goToLogin}>
          {t('account.goToLogin', { defaultValue: 'Ir a iniciar sesión' })}
        </button>
      </div>
    );
  }

  return (
    <form className="account-security-panel" onSubmit={handleSubmit}>
      <p className="account-security-hint">
        {t('account.changePasswordWarning', {
          defaultValue: 'Al cambiar tu contraseña se cerrará el acceso de todos tus dispositivos vinculados, incluido este.',
        })}
      </p>

      <label className="account-security-label" htmlFor="change-password-current">
        {t('account.changePasswordCurrentLabel', { defaultValue: 'Contraseña actual' })}
      </label>
      <PasswordToggleInput
        id="change-password-current"
        value={currentPass}
        onChange={(e) => setCurrentPass(e.target.value)}
        autoComplete="current-password"
        disabled={isSubmitting}
        required
        show={showCurrentPass}
        onToggleShow={() => setShowCurrentPass((s) => !s)}
        t={t}
      />

      <label className="account-security-label" htmlFor="change-password-new">
        {t('account.changePasswordNewLabel', { defaultValue: 'Nueva contraseña' })}
      </label>
      <PasswordToggleInput
        id="change-password-new"
        value={newPass}
        onChange={(e) => setNewPass(e.target.value)}
        autoComplete="new-password"
        minLength={MIN_LENGTH}
        maxLength={MAX_LENGTH}
        disabled={isSubmitting}
        required
        show={showNewPass}
        onToggleShow={() => setShowNewPass((s) => !s)}
        t={t}
      />
      <p className="account-security-field-hint">
        {t('account.changePasswordRulesHint', {
          defaultValue:
            'Entre 8 y 255 caracteres, con al menos una mayúscula y un número. También puedes usar símbolos como ! @ # $ % ^ & * ( ) + = - _ [ ] { } ; : \' " , . < > / ? ~ ` |',
        })}
      </p>

      <label className="account-security-label" htmlFor="change-password-confirm">
        {t('account.changePasswordConfirmLabel', { defaultValue: 'Confirmar nueva contraseña' })}
      </label>
      <PasswordToggleInput
        id="change-password-confirm"
        value={confirmPass}
        onChange={(e) => setConfirmPass(e.target.value)}
        autoComplete="new-password"
        disabled={isSubmitting}
        required
        show={showConfirmPass}
        onToggleShow={() => setShowConfirmPass((s) => !s)}
        t={t}
      />

      {error && <div className="account-security-error">{error}</div>}

      <button type="submit" className="account-security-btn account-security-btn--primary" disabled={isSubmitting}>
        {isSubmitting
          ? t('account.changePasswordSubmitting', { defaultValue: 'Actualizando...' })
          : t('account.changePasswordSubmit', { defaultValue: 'Cambiar contraseña' })}
      </button>
    </form>
  );
}

export default ChangePasswordPanel;
