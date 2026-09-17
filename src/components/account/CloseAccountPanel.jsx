/**
 * Panel nativo de "eliminar cuenta". Solo se monta en PC/web cuando el
 * brand tiene `login.deviceSession.enabled` (ver `MiCuentaPage.jsx`) -- en
 * TV o brands sin este backend se sigue usando el QR existente.
 *
 * Flujo con confirmación por correo (2026-09-08/09/17, mockup del cliente
 * "Flujo | Mi cuenta - Eliminar cuenta"; ver
 * docs/NUEVO_FLUJO_ELIMINACION_CUENTA_2026-09-08.md en Back-Wind-V2).
 * Reemplaza al flujo viejo de escribir la palabra "ELIMINAR" + cierre
 * inmediato (`closeAccount()`, que se deja sin usar por si hace falta
 * revertir rápido). Ya NO cierra la cuenta al toque: solo agenda la
 * eliminación para la fecha de corte de la suscripción, después de que el
 * usuario confirma un enlace que le llega por correo.
 *
 * A pedido del cliente (2026-09-17): hay varios casos de usuarios
 * "curiosos" que eliminaban su cuenta sin querer -- por eso este flujo mete
 * fricción a propósito, en capas, dándole al usuario 3 oportunidades de
 * arrepentirse ANTES de que salga ningún correo, más una cuarta (el enlace
 * en sí) para confirmar de verdad:
 *   1. Checkbox "entiendo que es permanente" (paso `warning`).
 *   2. Popup "¿Estás seguro?" (`ConfirmModal`).
 *   3. Re-escribir el correo de la cuenta (paso `email`) -- el backend
 *      valida que coincida con `request.user.email`, mismo patrón que
 *      `ChangePasswordPanel.jsx` usa para cambio de contraseña; si no
 *      coincide, no se genera ni se envía nada (`code: "email_mismatch"`).
 *   4. El enlace del correo (fuera de esta app -- página web del backend).
 *
 * reCAPTCHA v3 (ver `accountSecurityService.js`/`recaptchaService.js`): se
 * genera y se manda solo si `VITE_RECAPTCHA_SITE_KEY` está configurada acá
 * y el backend de destino tiene `RECAPTCHA_SECRET_KEY` -- sin ambas, no
 * bloquea nada.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmModal from '../ConfirmModal';
import { requestAccountDeletion } from '../../services/accountSecurityService';
// Los estilos de este panel viven en styles/pages/_mi-cuenta.scss /
// styles/components/_account-security.scss (importados desde
// MiCuentaPage.jsx), no acá -- ver el comentario en ese archivo sobre por
// qué (chunk de CSS separado que se rompía en el build de producción).

// Reenvío del correo ("¿No te llegó? Reenviar correo" del mockup): el
// backend no tiene cooldown propio en este endpoint (solo el throttle
// genérico de ProfileThrottle, ver docs/NUEVO_FLUJO_ELIMINACION_CUENTA_2026-09-08.md),
// así que este pequeño cooldown del lado del cliente es solo para evitar
// clicks repetidos accidentales, no una medida de seguridad.
const RESEND_COOLDOWN_SECONDS = 20;

/**
 * Mapa `code` (ver deviceAuthService.js::parseJsonResponse, que adjunta el
 * JSON del backend en `err.data`) -> key de i18next para este flujo. Mismo
 * patrón que `OTP_ERROR_I18N` en ChangePasswordPanel.jsx. No todos los
 * errores posibles de este endpoint traen `code` (p. ej. reCAPTCHA fallido
 * usa `error_type`, la feature deshabilitada no trae ninguno) -- para esos
 * casos se cae al `err.message` crudo del backend (fallback), igual que ya
 * se acepta en el flujo de OTP para códigos no mapeados.
 */
const DELETE_ERROR_I18N = {
  email_mismatch: {
    key: 'deleteAccountEmailMismatch',
    defaultValue: 'El correo no coincide con tu cuenta.',
  },
  already_closed: {
    key: 'deleteAccountAlreadyClosed',
    defaultValue: 'Esta cuenta ya está cerrada.',
  },
  closure_already_scheduled: {
    key: 'deleteAccountAlreadyScheduled',
    defaultValue: 'Ya hay una eliminación en curso para esta cuenta.',
  },
  no_email_on_file: {
    key: 'deleteAccountNoEmailOnFile',
    defaultValue: 'No hay un correo registrado para esta cuenta. Contacta a soporte.',
  },
};

function translateDeletionError(t, code, fallbackMessage) {
  const entry = code ? DELETE_ERROR_I18N[code] : null;
  if (!entry) return fallbackMessage;
  return t(`account.${entry.key}`, { defaultValue: entry.defaultValue });
}

/** "Fecha de corte" en formato legible, en el idioma activo. `null` si no hay dato (ver `scheduled_for` en la respuesta del backend, puede faltar si el suscriptor nunca sincronizó `lastExpiryTime`). */
function formatCutoffDate(isoDate, language) {
  if (!isoDate) return null;
  try {
    return new Intl.DateTimeFormat(language || undefined, { dateStyle: 'long' }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

export function CloseAccountPanel({ brandConfig, brand }) {
  const { t, i18n } = useTranslation();

  const [step, setStep] = useState('warning'); // warning | email | check_email
  const [understood, setUnderstood] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [scheduledFor, setScheduledFor] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const resetAll = () => {
    setStep('warning');
    setUnderstood(false);
    setIsConfirmOpen(false);
    setEmail('');
    setMaskedEmail('');
    setScheduledFor(null);
    setError('');
    setResendCooldown(0);
  };

  const sendDeletionRequest = async (typedEmail) => {
    setIsSubmitting(true);
    setError('');
    try {
      const result = await requestAccountDeletion(brandConfig, brand, {
        email: typedEmail.trim(),
        reason: 'user_app_delete_request',
      });
      if (!result?.success) {
        throw new Error(
          result?.message || t('account.deleteAccountError', { defaultValue: 'No se pudo eliminar la cuenta.' }),
        );
      }
      setMaskedEmail(result.masked_email || '');
      setScheduledFor(result.scheduled_for || null);
      setStep('check_email');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const fallback = err?.message || t('account.deleteAccountError', { defaultValue: 'No se pudo eliminar la cuenta.' });
      setError(translateDeletionError(t, err?.data?.code, fallback));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmedModal = () => {
    setIsConfirmOpen(false);
    setError('');
    setStep('email');
  };

  const handleSubmitEmail = (e) => {
    e.preventDefault();
    if (isSubmitting || !email.trim()) return;
    sendDeletionRequest(email);
  };

  const handleResend = () => {
    if (isSubmitting || resendCooldown > 0 || !email.trim()) return;
    sendDeletionRequest(email);
  };

  const cutoffDate = formatCutoffDate(scheduledFor, i18n.language);

  if (step === 'check_email') {
    return (
      <div className="account-security-panel account-security-panel--centered">
        <div className="account-security-icon account-security-icon--mail-check" aria-hidden="true" />

        <h3 className="account-security-hint--plain account-security-title">
          {t('account.deleteAccountCheckEmailTitle', { defaultValue: 'Revisa tu correo electrónico' })}
        </h3>

        <p className="account-security-hint--plain">
          {t('account.deleteAccountCheckEmailSent', {
            defaultValue: 'Hemos enviado un enlace para eliminar tu cuenta a:',
          })}
        </p>

        <div className="account-security-email-badge">{maskedEmail}</div>

        {cutoffDate && (
          <p className="account-security-hint--plain">
            {t('account.deleteAccountCutoffNotice', {
              date: cutoffDate,
              defaultValue: `Tu suscripción estará activa hasta finalizar la fecha de corte: ${cutoffDate}`,
            })}
          </p>
        )}

        <p className="account-security-hint--plain">
          {t('account.deleteAccountWillExecuteOnCutoff', {
            defaultValue: 'La eliminación se ejecutará en esa fecha.',
          })}
        </p>

        <p className="account-security-hint--plain account-security-hint--italic">
          {t('account.deleteAccountCheckEmailSpamHint', {
            defaultValue: 'Si no encuentras el correo, revisa la carpeta de spam o solicita un nuevo envío.',
          })}
        </p>

        {error && <div className="account-security-error">{error}</div>}

        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          <button
            type="button"
            className="account-security-btn account-security-btn--ghost account-security-btn--pill-split"
            onClick={resetAll}
          >
            {t('account.deleteAccountBack', { defaultValue: 'Volver' })}
          </button>
          <button
            type="button"
            className="account-security-btn account-security-btn--primary account-security-btn--pill-split"
            disabled={isSubmitting || resendCooldown > 0}
            onClick={handleResend}
          >
            {resendCooldown > 0
              ? t('account.deleteAccountResendCooldown', {
                  count: resendCooldown,
                  defaultValue: `Reenviar correo (${resendCooldown}s)`,
                })
              : t('account.deleteAccountResend', { defaultValue: 'Reenviar correo' })}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'email') {
    return (
      <form
        className="account-security-panel account-security-panel--centered account-security-panel--delete-email"
        onSubmit={handleSubmitEmail}
      >
        <div className="account-security-icon account-security-icon--lock" aria-hidden="true" />

        <p className="account-security-hint--plain">
          {t('account.deleteAccountEmailStepHint', {
            defaultValue: 'Para continuar, escribe el correo asociado a tu cuenta.',
          })}
        </p>

        <input
          type="email"
          className="account-security-input account-security-input--centered"
          placeholder={t('account.deleteAccountEmailPlaceholder', { defaultValue: 'Escribe tu correo' })}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          disabled={isSubmitting}
          required
        />

        {error && <div className="account-security-error">{error}</div>}

        <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '22rem' }}>
          <button
            type="button"
            className="account-security-btn account-security-btn--ghost account-security-btn--pill-split"
            disabled={isSubmitting}
            onClick={() => {
              setError('');
              setStep('warning');
            }}
          >
            {t('account.deleteAccountCancel', { defaultValue: 'Cancelar' })}
          </button>
          <button
            type="submit"
            className="account-security-btn account-security-btn--primary account-security-btn--pill-split"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t('account.deleteAccountSending', { defaultValue: 'Enviando...' })
              : t('account.deleteAccountSendConfirmEmail', { defaultValue: 'Enviar correo de confirmación' })}
          </button>
        </div>
      </form>
    );
  }

  // step === 'warning'
  return (
    <div className="account-security-panel account-security-panel--warning-centered">
      <ConfirmModal
        open={isConfirmOpen}
        variant="danger"
        icon="warning"
        cancelAsLink
        title={t('account.deleteAccountConfirmTitle', { defaultValue: '¿Estás seguro?' })}
        message={t('account.deleteAccountConfirmMessage', {
          defaultValue: 'Para proteger tu cuenta, enviaremos un correo electrónico a la dirección asociada.',
        })}
        confirmText={t('account.deleteAccountConfirmProceed', { defaultValue: 'Enviar correo de confirmación' })}
        cancelText={t('settings.cancel', { defaultValue: 'Cancelar' })}
        onConfirm={handleConfirmedModal}
        onCancel={() => setIsConfirmOpen(false)}
      />

      <div className="account-security-danger-card">
        <div className="account-security-icon account-security-icon--warning" aria-hidden="true" />
        <div className="account-security-danger-card__body">
          <p className="account-security-danger-card__title">
            {t('account.deleteAccountWarningTitle', { defaultValue: 'Eliminar tu cuenta es una acción permanente' })}
          </p>
          <p className="account-security-danger-card__text">
            {t('account.deleteAccountWarning', {
              defaultValue: 'Eliminar tu cuenta es irreversible: perderás acceso al servicio y a todo tu contenido asociado de forma permanente.',
            })}
          </p>
        </div>
      </div>

      <ul className="account-security-list">
        <li>{t('account.deleteAccountEffectProfile', { defaultValue: 'Se eliminará tu perfil y tus datos personales.' })}</li>
        <li>{t('account.deleteAccountEffectSubscription', { defaultValue: 'Perderás acceso a tu suscripción.' })}</li>
        <li>{t('account.deleteAccountEffectDevices', { defaultValue: 'Se cerrará la sesión en todos tus dispositivos.' })}</li>
        <li>{t('account.deleteAccountEffectIrreversible', { defaultValue: 'No podrás recuperar esta cuenta una vez eliminada.' })}</li>
      </ul>

      <p className="account-security-text">
        {t('account.deleteAccountCutoffGenericNotice', {
          defaultValue: 'Tu suscripción estará activa hasta finalizar la fecha de corte.',
        })}
      </p>

      <label className="account-security-checkbox-row" htmlFor="close-account-understood">
        <input
          id="close-account-understood"
          type="checkbox"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
        />
        <span>
          {t('account.deleteAccountUnderstoodLabel', {
            defaultValue: 'Entiendo que esta acción es permanente y que no podré recuperar mi cuenta ni su contenido.',
          })}
        </span>
      </label>

      {error && <div className="account-security-error">{error}</div>}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          type="button"
          className="account-security-btn account-security-btn--ghost account-security-btn--pill-split"
          onClick={() => {
            // Este panel no recibe ninguna prop de navegación desde
            // MiCuentaPage.jsx (a diferencia de otros flujos, el cambio
            // entre secciones lo maneja enteramente el sidebar) -- acá
            // "Cancelar" solo deshace la selección local, sin salir del
            // panel.
            setUnderstood(false);
            setError('');
          }}
        >
          {t('account.deleteAccountCancel', { defaultValue: 'Cancelar' })}
        </button>
        <button
          type="button"
          className="account-security-btn account-security-btn--danger account-security-btn--pill-split"
          disabled={!understood}
          onClick={() => setIsConfirmOpen(true)}
        >
          {t('account.deleteAccountSubmit', { defaultValue: 'Eliminar cuenta' })}
        </button>
      </div>
    </div>
  );
}

export default CloseAccountPanel;
