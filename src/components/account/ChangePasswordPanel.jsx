/**
 * Panel nativo de "cambiar contraseña". Solo se monta en PC/web cuando el
 * brand tiene `login.deviceSession.enabled` (ver `MiCuentaPage.jsx`) -- en
 * TV o brands sin este backend se sigue usando el QR existente.
 *
 * Dos flujos posibles, elegidos por marca (2026-09-14, ver
 * docs/CAMBIO_CONTRASENA_OTP_2026-09-14.md en Back-Wind-V2) vía
 * `login.deviceSession.changePasswordFlow` en `src/config/brands/<slug>.js`:
 *   - 'otp' (default): código de 6 dígitos por correo, sin pedir la
 *     contraseña actual -- `OtpChangePasswordFlow` más abajo.
 *   - 'old_password': formulario original (contraseña actual + nueva) --
 *     `OldPasswordChangeFlow` más abajo.
 * El backend mantiene los dos endpoints activos siempre para cualquier
 * marca -- este parámetro solo decide qué UI se muestra, no depende de
 * ningún flag del lado del servidor (ver `FeatureConfig.CHANGE_PASSWORD_OTP_ENABLED`,
 * que es un freno de emergencia aparte, no un selector).
 *
 * El backend invalida TODOS los JWT y revoca todos los dispositivos
 * vinculados al cambiar la contraseña (mismo `sync_password_locally` en
 * los dos flujos), así que ambos fuerzan logout completo tras un éxito.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  changePassword,
  confirmPasswordChangeOtp,
  requestPasswordChangeOtp,
} from '../../services/accountSecurityService';
import { clearSessionBeforeNewLogin } from '../../services/loginFlow';
// Los estilos de este panel viven en styles/pages/_mi-cuenta.scss (importado
// desde MiCuentaPage.jsx), no acá -- ver el comentario en ese archivo sobre
// por qué (chunk de CSS separado que se rompía en el build de producción).

const MIN_LENGTH = 8;
const MAX_LENGTH = 255;
const OTP_LENGTH = 6;

// Política de contraseña -- debe mantenerse sincronizada con
// wind/utils/password_policy.py (backend, Wind). Es solo un atajo para dar
// feedback inmediato antes del round-trip; el backend sigue siendo la
// fuente de verdad y valida esto mismo de nuevo.
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

const PASSWORD_POLICY_ERROR_DEFAULTS = {
  changePasswordTooShort: `La contraseña debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres.`,
  changePasswordInvalidChars: 'La contraseña tiene caracteres no permitidos.',
  changePasswordMissingUpper: 'La contraseña debe incluir al menos una letra mayúscula.',
  changePasswordMissingNumber: 'La contraseña debe incluir al menos un número.',
};

// Códigos de error del paso de OTP (ver wind/services/password_change_otp.py
// en Back-Wind-V2) que deben devolver al usuario al paso "verify" en vez de
// mostrarse en el paso de nueva contraseña -- son problemas del código, no
// de la contraseña que acaba de escribir.
const OTP_STEP_ERROR_CODES = new Set(['otp_incorrect', 'otp_locked', 'otp_missing_or_expired']);

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

/**
 * Flujo original: pide la contraseña actual + la nueva en un solo paso.
 * Seleccionado con `login.deviceSession.changePasswordFlow: 'old_password'`.
 */
function OldPasswordChangeFlow({ brandConfig, brand }) {
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

    const trimmedCurrent = currentPass.trim();
    if (!trimmedCurrent) {
      setError(t('account.changePasswordCurrentRequired', { defaultValue: 'Ingresa tu contraseña actual.' }));
      return;
    }

    const policyErrorKey = getPasswordPolicyErrorKey(newPass);
    if (policyErrorKey) {
      setError(
        t(`account.${policyErrorKey}`, {
          defaultValue: PASSWORD_POLICY_ERROR_DEFAULTS[policyErrorKey],
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

/**
 * Flujo nuevo (2026-09-14): código OTP por correo, 4 pasos. Default para
 * cualquier marca que no fije `changePasswordFlow: 'old_password'`.
 */
function OtpChangePasswordFlow({ brandConfig, brand }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState('request'); // request | verify | new_password | success
  const [maskedEmail, setMaskedEmail] = useState('');
  // Input de correo del paso "request" (2026-09-16, patrón estilo Netflix
  // para acciones sensibles): el usuario re-escribe su correo como paso de
  // confirmación. El backend valida que coincida con el de la cuenta
  // autenticada (request.user.email) -- si no coincide, no genera ni envía
  // ningún código y devuelve error, que se muestra abajo sin salir de este
  // paso (ver profile_password_otp_request_view en Back-Wind-V2).
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const goToLogin = () => {
    clearSessionBeforeNewLogin();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => {
        goToLogin();
      }, 3000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const resetToRequest = () => {
    setStep('request');
    setOtpCode('');
    setNewPass('');
    setConfirmPass('');
    setError('');
  };

  const handleSendCode = async (e) => {
    e?.preventDefault?.();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      const result = await requestPasswordChangeOtp(brandConfig, brand, email.trim());
      if (!result?.success) {
        throw new Error(
          result?.message || t('account.changeOtpRequestError', { defaultValue: 'No se pudo enviar el código.' }),
        );
      }
      setMaskedEmail(result.masked_email || '');
      setStep('verify');
    } catch (err) {
      setError(err?.message || t('account.changeOtpRequestError', { defaultValue: 'No se pudo enviar el código.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueFromCode = (e) => {
    e.preventDefault();
    setError('');
    const trimmed = otpCode.trim();
    if (trimmed.length !== OTP_LENGTH || !/^\d+$/.test(trimmed)) {
      setError(
        t('account.changeOtpInvalidFormat', { defaultValue: `Ingresa los ${OTP_LENGTH} dígitos del código.` }),
      );
      return;
    }
    setStep('new_password');
  };

  const handleSubmitNewPassword = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    const policyErrorKey = getPasswordPolicyErrorKey(newPass);
    if (policyErrorKey) {
      setError(
        t(`account.${policyErrorKey}`, {
          defaultValue: PASSWORD_POLICY_ERROR_DEFAULTS[policyErrorKey],
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
      const result = await confirmPasswordChangeOtp(brandConfig, brand, otpCode.trim(), newPass);
      if (!result?.success) {
        throw new Error(
          result?.message || t('account.changePasswordError', { defaultValue: 'No se pudo cambiar la contraseña.' }),
        );
      }
      setStep('success');
    } catch (err) {
      const message = err?.message || t('account.changePasswordError', { defaultValue: 'No se pudo cambiar la contraseña.' });
      if (OTP_STEP_ERROR_CODES.has(err?.code)) {
        // Problema con el código, no con la contraseña -- lo mandamos de
        // vuelta al paso de verificación en vez de dejarlo acá (ver
        // OTP_STEP_ERROR_CODES arriba).
        setStep('verify');
        setError(message);
      } else {
        // p. ej. password_rejected_by_panaccess -- el código sigue siendo
        // válido (el backend no lo consume en este caso), así que se queda
        // acá para que pueda reintentar con otra contraseña sin pedir un
        // código nuevo.
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="account-security-panel">
        <div className="account-security-success">
          {t('account.changeOtpSuccess', {
            defaultValue:
              '¡Contraseña actualizada! Se cerró sesión en todos tus dispositivos por tu seguridad. Inicia sesión de nuevo con tu nueva contraseña.',
          })}
        </div>
        <button type="button" className="account-security-btn account-security-btn--primary" onClick={goToLogin}>
          {t('account.goToWindTV', { defaultValue: 'Ir a WindTV' })}
        </button>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <form className="account-security-panel" onSubmit={handleContinueFromCode}>
        <p className="account-security-hint">
          {t('account.changeOtpVerifyHint', {
            defaultValue: maskedEmail
              ? `Hemos enviado a tu correo ${maskedEmail} un código de ${OTP_LENGTH} dígitos. No olvides revisar la bandeja de spam.`
              : `Hemos enviado un código de ${OTP_LENGTH} dígitos a tu correo. No olvides revisar la bandeja de spam.`,
          })}
        </p>

        <label className="account-security-label" htmlFor="change-password-otp">
          {t('account.changeOtpCodeLabel', { defaultValue: 'Código de acceso único' })}
        </label>
        <input
          id="change-password-otp"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          className="account-security-input"
          style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.2em' }}
          value={otpCode}
          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
          maxLength={OTP_LENGTH}
          disabled={isSubmitting}
          required
        />

        {error && <div className="account-security-error">{error}</div>}

        <button type="submit" className="account-security-btn account-security-btn--primary" disabled={isSubmitting}>
          {t('account.changeOtpContinue', { defaultValue: 'Continuar' })}
        </button>
        <button
          type="button"
          className="account-security-btn account-security-btn--ghost"
          disabled={isSubmitting}
          onClick={resetToRequest}
        >
          {t('account.changeOtpCancel', { defaultValue: 'Cancelar' })}
        </button>
        <button
          type="button"
          className="account-security-btn account-security-btn--ghost"
          disabled={isSubmitting}
          onClick={handleSendCode}
        >
          {t('account.changeOtpResend', { defaultValue: '¿No recibiste el código? Enviar de nuevo' })}
        </button>
      </form>
    );
  }

  if (step === 'new_password') {
    return (
      <form className="account-security-panel" onSubmit={handleSubmitNewPassword}>
        <p className="account-security-hint">
          {t('account.changeOtpNewPasswordHint', {
            defaultValue: 'Ingresa tu nueva contraseña.',
          })}
        </p>

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
            : t('account.changeOtpSave', { defaultValue: 'Guardar contraseña' })}
        </button>
        <button
          type="button"
          className="account-security-btn account-security-btn--ghost"
          disabled={isSubmitting}
          onClick={() => {
            setError('');
            setStep('verify');
          }}
        >
          {t('account.changeOtpBack', { defaultValue: 'Atrás' })}
        </button>
      </form>
    );
  }

  // step === 'request'
  return (
    <form className="account-security-panel account-security-panel--centered" onSubmit={handleSendCode}>
      <div className="account-security-icon account-security-icon--lock" aria-hidden="true" />

      <p className="account-security-hint account-security-hint--plain">
        {t('account.changeOtpRequestHint', {
          defaultValue: 'Enviaremos un código de verificación a tu correo electrónico.',
        })}
      </p>

      <input
        type="email"
        className="account-security-input account-security-input--centered"
        placeholder={t('account.changeOtpEmailPlaceholder', { defaultValue: 'Escribe tu correo' })}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        disabled={isSubmitting}
        required
      />

      {error && <div className="account-security-error">{error}</div>}

      <button
        type="submit"
        className="account-security-btn account-security-btn--primary account-security-btn--pill"
        disabled={isSubmitting}
      >
        {isSubmitting
          ? t('account.changeOtpSending', { defaultValue: 'Enviando...' })
          : t('account.changeOtpSendCode', { defaultValue: 'Enviar correo' })}
      </button>
    </form>
  );
}

export function ChangePasswordPanel({ brandConfig, brand }) {
  // 'old_password' es el único valor que activa el flujo viejo -- cualquier
  // otra cosa (incluido no definirlo, marcas nuevas, typos) cae en 'otp' por
  // defecto (ver login.deviceSession.changePasswordFlow en config/brands.js).
  const flow = brandConfig?.login?.deviceSession?.changePasswordFlow === 'old_password' ? 'old_password' : 'otp';

  if (flow === 'old_password') {
    return <OldPasswordChangeFlow brandConfig={brandConfig} brand={brand} />;
  }
  return <OtpChangePasswordFlow brandConfig={brandConfig} brand={brand} />;
}

export default ChangePasswordPanel;
