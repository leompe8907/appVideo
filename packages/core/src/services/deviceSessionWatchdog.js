/**
 * Watchdog de "dispositivo vinculado" (`/ws/device/`, backend Wind): asegura
 * que haya una conexión viva y la reabre si se cae, con espera creciente y
 * una parte al azar (reglas en `backendRetryPolicy.js`, las mismas que
 * Android/iOS).
 *
 * Antes vivía dentro de `src/hooks/useAppLifecycle.js` (sólo web) y
 * reconectaba al instante, repitiendo el login completo con contraseña
 * (`POST /api/auth/login/` + reCAPTCHA) en cada intento: con el backend
 * saturado, cada dispositivo entraba en un bucle de logins y conexiones que
 * lo saturaba más. Ahora:
 *   - Reconecta con el JWT guardado; `registerDeviceSession()` lo refresca si
 *     venció. Sólo si el refresh ya no existe (sesión del backend terminada)
 *     se vuelve a loguear con las credenciales guardadas.
 *   - Respeta el código del cierre: 4503 reintenta sin límite, 4004 no
 *     reintenta, 4001 espera lo que pida el servidor.
 *   - Vive en `@appvideo/core` para que también lo use Vega.
 */

import { getCredentials, getCredentialsWithFallback } from '../utils/userSession';
import {
  getDeviceSessionAccessToken,
  getDeviceSessionRefreshToken,
  isDeviceSessionEnabled,
} from './deviceAuthService';
import { isDeviceSessionActive } from './deviceSessionService';
import { maybeEstablishDeviceSession } from './loginFlow';
import { nextDeviceSocketReconnect } from './backendRetryPolicy';

let reconnectTimer = null;
let failures = 0;

/** No se pudo conectar ahora, pero la sesión del backend sigue: reintentar más tarde. */
const RETRY_LATER = 'retry_later';

/**
 * Abre `/ws/device/` si no hay una conexión viva. Nunca lanza.
 *
 * @returns {Promise<{ok: boolean, error?: string, retryAfterSeconds?: number|null}|undefined>}
 *   `undefined` si no aplica (brand sin device session, sin credenciales).
 */
export async function ensureDeviceSessionConnected(brandConfig) {
  try {
    if (!brandConfig || !isDeviceSessionEnabled(brandConfig)) return undefined;
    if (isDeviceSessionActive()) return { ok: true };

    const brand = brandConfig.brand;
    const credentials = getCredentials(brand) ?? getCredentialsWithFallback(brandConfig.token, brand);

    let result;
    const storedAccess = getDeviceSessionAccessToken(brand);
    if (storedAccess) {
      result = await maybeEstablishDeviceSession(brandConfig, credentials, { access: storedAccess });
      if (result?.error === 'auth_failed' && getDeviceSessionRefreshToken(brand)) {
        // El refresh sigue guardado: no se pudo refrescar por red o por un
        // 503, no porque la sesión haya terminado. No repetir el login.
        result = { ok: false, error: RETRY_LATER };
      }
    }
    if ((!result || result.error === 'auth_failed') && credentials) {
      result = await maybeEstablishDeviceSession(brandConfig, credentials);
    }
    if (result?.ok) failures = 0;
    return result;
  } catch {
    return undefined;
  }
}

/**
 * Programa una reconexión tras un corte (o un intento fallido). Si ya hay una
 * programada, no hace nada.
 *
 * @param {Object} brandConfig
 * @param {{error?: string, retryAfterSeconds?: number|null}} [info] lo que
 *   devolvió `registerDeviceSession()` o el callback de cierre inesperado.
 */
export function scheduleDeviceSessionReconnect(brandConfig, info = {}) {
  if (reconnectTimer) return;
  failures += 1;
  const next = nextDeviceSocketReconnect({ ...info, failures });
  if (!next.reconnect) {
    // Se deja de reintentar hasta el próximo "volver al frente" o login.
    failures = 0;
    return;
  }
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    const result = await ensureDeviceSessionConnected(brandConfig);
    if (result && !result.ok) scheduleDeviceSessionReconnect(brandConfig, result);
  }, next.delayMs);
}

/** Cancela la reconexión pendiente y reinicia el conteo (logout, desmontaje). */
export function resetDeviceSessionReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  failures = 0;
}
