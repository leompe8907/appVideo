/**
 * Cambio de contraseña, solicitud de recuperación y cierre de cuenta,
 * contra el mismo backend externo de "dispositivos vinculados" (ver
 * `deviceAuthService.js`). Paneles nativos solo en PC/web cuando
 * `login.deviceSession.enabled`; en TV se sigue usando el QR existente
 * (`brand.account.links.*` / `brand.login.forgotPassword`), sin cambios.
 *
 * IMPORTANTE -- efectos secundarios reales del backend (Wind, ver
 * wind/services/password_reset.py::sync_password_locally):
 *   - Cambiar contraseña invalida TODOS los JWT emitidos antes del cambio
 *     y revoca en bloque todos los `DeviceSession` (dispositivos
 *     vinculados) de este suscriptor. La contraseña PanAccess vieja que
 *     esta app guarda localmente (para reactivar sesión sin pedirla de
 *     nuevo, ver `userSession.js`) deja de servir de inmediato. Por eso
 *     `ChangePasswordPanel.jsx` fuerza un logout completo tras un éxito --
 *     no hay forma de "actualizar" la sesión local, hay que iniciar sesión
 *     de nuevo con la contraseña nueva.
 *   - Cerrar cuenta desaprovisiona el suscriptor en PanAccess -- es
 *     irreversible.
 *
 * reCAPTCHA: `requestPasswordReset`, `closeAccount` y (desde 2026-09-01,
 * extensión de Alto #7 -- ver docs/RECAPTCHA_LOGIN_Y_CAMBIO_PASSWORD_2026-09-01.md
 * en Back-Wind-V2) `changePassword` mandan `recaptcha_token` (reCAPTCHA v3,
 * generado por acción vía `recaptchaService.js`, con site key por marca --
 * ver `resolveRecaptchaSiteKey()`). El backend solo lo exige si tiene
 * `RECAPTCHA_SECRET_KEY` configurado (ver `wind/utils/recaptcha.py`) --
 * opt-in de los dos lados: sin site key configurada para esta marca (ni
 * fallback `VITE_RECAPTCHA_SITE_KEY`), `getRecaptchaToken()` devuelve `null`
 * y simplemente no se manda el campo; sin `RECAPTCHA_SECRET_KEY` allá, el
 * backend no lo pide.
 */
import {
  authorizedDeviceRequest,
  getDeviceSessionSubscriberCode,
  resolveDeviceAuthBaseUrl,
} from './deviceAuthService';
import { getRecaptchaToken } from './recaptchaService';

async function parseJsonResponse(res, fallbackMessage) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const err = new Error('Respuesta del servidor no es JSON válido.');
    err.status = res.status;
    throw err;
  }

  if (!res.ok) {
    // `data.errors` con forma DRF (p. ej. { newPass: ["mensaje legible"] },
    // ver ProfilePasswordSerializer/ResetPasswordConfirmSerializer en el
    // backend) -- antes esto caía siempre al JSON.stringify de más abajo,
    // mostrando algo como `{"newPass":["..."]}` en vez del mensaje real
    // (p. ej. la explicación de la política de contraseña).
    let fieldErrorMessage;
    if (data.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
      const firstField = Object.values(data.errors)[0];
      if (Array.isArray(firstField) && typeof firstField[0] === 'string') {
        fieldErrorMessage = firstField[0];
      }
    }

    const detail =
      (typeof data.detail === 'string' && data.detail) ||
      (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) ||
      (typeof data.message === 'string' && data.message) ||
      fieldErrorMessage ||
      (data.errors && JSON.stringify(data.errors)) ||
      res.statusText ||
      fallbackMessage;
    const err = new Error(detail);
    err.status = res.status;
    err.code = data.code;
    err.data = data;
    throw err;
  }

  return data;
}

/**
 * Solicita el email de recuperación de contraseña. Usuario NO autenticado
 * (se llama desde LoginPage, antes de tener ningún JWT) -- por eso usa
 * `fetch` directo, no `authorizedDeviceRequest`. Respuesta siempre
 * genérica del lado del backend (no revela si el email existe).
 */
export async function requestPasswordReset(brandConfig, email) {
  const base = resolveDeviceAuthBaseUrl(brandConfig);
  if (!base) {
    throw new Error('Falta configurar la base del backend (login.deviceSession.baseUrl).');
  }
  const recaptchaToken = await getRecaptchaToken('forgot_password', brandConfig?.brand);
  const res = await fetch(`${base}/api/auth/password/forgot/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: String(email || '').trim(),
      ...(recaptchaToken ? { recaptcha_token: recaptchaToken } : {}),
    }),
  });
  return parseJsonResponse(res, 'No se pudo solicitar la recuperación de contraseña.');
}

/**
 * Cambia la contraseña PanAccess del suscriptor autenticado. `code`
 * (subscriber_code) se resuelve del storage local -- ya lo persiste el
 * login (ver `deviceAuthService.persistDeviceSessionAuth`), el usuario
 * nunca tiene que escribirlo para esto.
 *
 * `oldPass` es obligatorio desde 2026-08-28 (ver
 * docs/GUIA_INTEGRACION_UNIFICADA.md sección 5.1, backend Wind) -- el
 * backend la verifica contra PanAccess antes de aplicar el cambio; si no
 * coincide responde 400 con `code: "old_password_incorrect"`, y tras 5
 * intentos fallidos, 429 con `code: "old_password_locked"`. `err.code`
 * (ver `parseJsonResponse` de más arriba) ya expone ese código tal cual
 * para que el caller (`ChangePasswordPanel.jsx`) pueda distinguirlo si
 * hace falta, aunque `err.message` ya trae el texto legible que manda el
 * backend.
 */
export async function changePassword(brandConfig, brand, oldPass, newPass) {
  const code = getDeviceSessionSubscriberCode(brand);
  if (!code) {
    throw new Error('No se encontró el código de suscriptor de esta sesión.');
  }
  const recaptchaToken = await getRecaptchaToken('change_password', brand);
  return authorizedDeviceRequest(brandConfig, brand, '/api/v1/profile/password/', {
    method: 'POST',
    body: JSON.stringify({
      code,
      oldPass,
      newPass,
      ...(recaptchaToken ? { recaptcha_token: recaptchaToken } : {}),
    }),
  });
}

/**
 * Cierra la cuenta del suscriptor autenticado. Irreversible.
 *
 * @param {Object} brandConfig
 * @param {string} brand
 * @param {{confirm?: string, reason?: string}} [opts] - `confirm` se manda
 *   tal cual al backend (que exige que sea igual al `code` real, y lo
 *   revalida server-side); si se omite se usa el propio `code`. La UI
 *   (`CloseAccountPanel.jsx`) es la que decide qué fricción pedirle al
 *   usuario antes de llamar a esto (no este servicio).
 */
export async function closeAccount(brandConfig, brand, { confirm, reason } = {}) {
  const code = getDeviceSessionSubscriberCode(brand);
  if (!code) {
    throw new Error('No se encontró el código de suscriptor de esta sesión.');
  }
  const recaptchaToken = await getRecaptchaToken('close_account', brand);
  return authorizedDeviceRequest(brandConfig, brand, '/api/v1/profile/account/close/', {
    method: 'POST',
    body: JSON.stringify({
      code,
      confirm: confirm ?? code,
      reason: reason || 'user_app_close',
      ...(recaptchaToken ? { recaptcha_token: recaptchaToken } : {}),
    }),
  });
}
