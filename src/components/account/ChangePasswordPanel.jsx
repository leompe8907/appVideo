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
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { changePassword } from '../../services/accountSecurityService';
import { clearSessionBeforeNewLogin } from '../../services/loginFlow';
// Los estilos de este panel viven en styles/pages/_mi-cuenta.scss (importado
// desde MiCuentaPage.jsx), no acá -- ver el comentario en ese archivo sobre
// por qué (chunk de CSS separado que se rompía en el build de producción).

const MIN_LENGTH = 8;

export function ChangePasswordPanel({ brandConfig, brand }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const goToLogin = () => {
    clearSessionBeforeNewLogin();
    navigate('/login', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (newPass.length < MIN_LENGTH) {
      setError(
        t('account.changePasswordTooShort', {
          defaultValue: `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`,
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
      const result = await changePassword(brandConfig, brand, newPass);
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

      <label className="account-security-label" htmlFor="change-password-new">
        {t('account.changePasswordNewLabel', { defaultValue: 'Nueva contraseña' })}
      </label>
      <input
        id="change-password-new"
        type="password"
        className="account-security-input"
        value={newPass}
        onChange={(e) => setNewPass(e.target.value)}
        autoComplete="new-password"
        disabled={isSubmitting}
        required
      />

      <label className="account-security-label" htmlFor="change-password-confirm">
        {t('account.changePasswordConfirmLabel', { defaultValue: 'Confirmar nueva contraseña' })}
      </label>
      <input
        id="change-password-confirm"
        type="password"
        className="account-security-input"
        value={confirmPass}
        onChange={(e) => setConfirmPass(e.target.value)}
        autoComplete="new-password"
        disabled={isSubmitting}
        required
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
