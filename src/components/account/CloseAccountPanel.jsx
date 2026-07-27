/**
 * Panel nativo de "eliminar cuenta". Solo se monta en PC/web cuando el
 * brand tiene `login.deviceSession.enabled` (ver `MiCuentaPage.jsx`) -- en
 * TV o brands sin este backend se sigue usando el QR existente.
 *
 * Acción irreversible: desaprovisiona el suscriptor en PanAccess. Doble
 * fricción a propósito -- escribir una palabra de confirmación exacta,
 * más un `ConfirmModal` final -- antes de disparar la llamada.
 *
 * NOTA: si el backend de destino tiene reCAPTCHA obligatorio
 * (`RECAPTCHA_SECRET_KEY` configurado), esta llamada fallará con
 * `RecaptchaFailed` -- ver el comentario en `accountSecurityService.js`.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmModal from '../ConfirmModal';
import { closeAccount } from '../../services/accountSecurityService';
import { clearSessionBeforeNewLogin } from '../../services/loginFlow';
import '../../styles/components/_account-security.scss';

const CONFIRM_WORD = 'ELIMINAR';

export function CloseAccountPanel({ brandConfig, brand }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [typedWord, setTypedWord] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const canSubmit = typedWord.trim().toUpperCase() === CONFIRM_WORD;

  const goToLogin = () => {
    clearSessionBeforeNewLogin();
    navigate('/login', { replace: true });
  };

  const handleConfirmed = async () => {
    setIsConfirmOpen(false);
    setIsSubmitting(true);
    setError('');
    try {
      const result = await closeAccount(brandConfig, brand, { reason: 'user_app_close' });
      if (!result?.success) {
        throw new Error(result?.message || t('account.deleteAccountError', { defaultValue: 'No se pudo eliminar la cuenta.' }));
      }
      setSuccess(true);
    } catch (err) {
      setError(err?.message || t('account.deleteAccountError', { defaultValue: 'No se pudo eliminar la cuenta.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="account-security-panel">
        <div className="account-security-success">
          {t('account.deleteAccountSuccess', { defaultValue: 'Tu cuenta fue eliminada.' })}
        </div>
        <button type="button" className="account-security-btn account-security-btn--primary" onClick={goToLogin}>
          {t('account.goToLogin', { defaultValue: 'Ir a iniciar sesión' })}
        </button>
      </div>
    );
  }

  return (
    <div className="account-security-panel">
      <ConfirmModal
        open={isConfirmOpen}
        title={t('account.deleteAccountConfirmTitle', { defaultValue: 'Eliminar cuenta' })}
        message={t('account.deleteAccountConfirmMessage', {
          defaultValue: 'Esta acción es irreversible: perderás el acceso al servicio. ¿Deseas continuar?',
        })}
        confirmText={t('settings.confirm', { defaultValue: 'Confirmar' })}
        cancelText={t('settings.cancel', { defaultValue: 'Cancelar' })}
        onConfirm={handleConfirmed}
        onCancel={() => setIsConfirmOpen(false)}
      />

      <p className="account-security-hint account-security-hint--danger">
        {t('account.deleteAccountWarning', {
          defaultValue: 'Eliminar tu cuenta es irreversible: perderás acceso al servicio y a todo tu contenido asociado.',
        })}
      </p>

      <label className="account-security-label" htmlFor="close-account-confirm">
        {t('account.deleteAccountTypeLabel', {
          defaultValue: `Escribe "${CONFIRM_WORD}" para confirmar`,
          word: CONFIRM_WORD,
        })}
      </label>
      <input
        id="close-account-confirm"
        type="text"
        className="account-security-input"
        value={typedWord}
        onChange={(e) => setTypedWord(e.target.value)}
        disabled={isSubmitting}
        autoComplete="off"
      />

      {error && <div className="account-security-error">{error}</div>}

      <button
        type="button"
        className="account-security-btn account-security-btn--danger"
        disabled={!canSubmit || isSubmitting}
        onClick={() => setIsConfirmOpen(true)}
      >
        {isSubmitting
          ? t('account.changePasswordSubmitting', { defaultValue: 'Actualizando...' })
          : t('account.deleteAccountSubmit', { defaultValue: 'Eliminar cuenta' })}
      </button>
    </div>
  );
}

export default CloseAccountPanel;
