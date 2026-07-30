/**
 * Login contra un backend externo (independiente de PanAccess) para
 * obtener un JWT usado solo por el registro de "dispositivos vinculados"
 * (ver `deviceSessionService.js`). Hoy el único backend que implementa este
 * contrato es Wind (Django) -- ver, en su repo:
 * `docs/GUIA_INTEGRACION_APPS.md` (secciones 1 y 4) y
 * `docs/INTEGRACION_PAREO_TV_DISPOSITIVOS.md` -- pero el nombre de este
 * módulo y de la config (`login.deviceSession` en `brands.js`) es
 * deliberadamente genérico: otros brands podrían apuntar esto a un backend
 * distinto en el futuro, siempre que hable el mismo contrato
 * (`POST {base}/api/auth/login/` devolviendo `{access, refresh, user}`,
 * más `/api/auth/token/refresh/` y `/ws/device/`).
 *
 * Por qué existe una llamada de login separada de `clientLogin`: PanAccess
 * y este backend externo NO comparten sesión entre sí. PanAccess sigue
 * siendo quien entrega el sessionId para contenido/streaming (eso no
 * cambia con este archivo). Este backend entrega un JWT propio, necesario
 * solo para las funciones nuevas construidas encima (dispositivos
 * vinculados vía `deviceSessionService.js`, y en el futuro cambio de
 * contraseña / cierre de cuenta desde la propia app). Ambas llamadas usan
 * las mismas credenciales que ya tecleó/recibió el usuario -- no se le pide
 * nada dos veces.
 *
 * Activación: opt-in explícito por brand (`login.deviceSession.enabled` en
 * `brands.js`). Si el brand no lo activa (o no tiene una base configurada),
 * ninguna función de este módulo hace una llamada de red real -- el
 * comportamiento para esos brands es idéntico al de antes de este archivo.
 */

import {
  getBrandItem,
  removeBrandItem,
  resolveBrandId,
  setBrandItem,
} from '../utils/brandStorage';

const STORAGE_KEYS = {
  access: 'deviceSession.access',
  refresh: 'deviceSession.refresh',
  subscriberCode: 'deviceSession.subscriberCode',
};

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

/**
 * Resuelve la base HTTP del backend de "dispositivos vinculados" para un brand.
 * Prioridad: `login.deviceSession.baseUrl` explícita > `login.socialLogin.backendBaseUrl`
 * > `login.udid.baseUrl`. Las dos últimas ya apuntan al mismo backend en los
 * brands que lo usan hoy (ver `brands.js`) -- se reutilizan para no duplicar
 * configuración si el equipo no quiere declarar una tercera URL igual.
 */
export function resolveDeviceAuthBaseUrl(brandConfig) {
  const deviceSession = brandConfig?.login?.deviceSession;
  const explicit = typeof deviceSession?.baseUrl === 'string' ? deviceSession.baseUrl.trim() : '';
  if (explicit) return trimTrailingSlash(explicit);

  const socialBase =
    typeof brandConfig?.login?.socialLogin?.backendBaseUrl === 'string'
      ? brandConfig.login.socialLogin.backendBaseUrl.trim()
      : '';
  if (socialBase) return trimTrailingSlash(socialBase);

  const udidBase =
    typeof brandConfig?.login?.udid?.baseUrl === 'string' ? brandConfig.login.udid.baseUrl.trim() : '';
  return trimTrailingSlash(udidBase);
}

export function isDeviceSessionEnabled(brandConfig) {
  return brandConfig?.login?.deviceSession?.enabled === true && !!resolveDeviceAuthBaseUrl(brandConfig);
}

async function parseJsonResponse(res, fallbackMessage) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const err = new Error('Respuesta del backend no es JSON válido.');
    err.status = res.status;
    throw err;
  }

  if (!res.ok) {
    const detail =
      (typeof data.detail === 'string' && data.detail) ||
      (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) ||
      (typeof data.message === 'string' && data.message) ||
      res.statusText ||
      fallbackMessage;
    const err = new Error(detail);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

/**
 * Login manual contra `POST {base}/api/auth/login/`.
 *
 * El campo `username` es deliberadamente libre del lado del backend Wind:
 * acepta email/username de Django o login1/login2/email de PanAccess -- por
 * eso sirve mandar exactamente las mismas credenciales que ya se usan para
 * `clientLogin` (login1/password, o el email+password de un registro
 * manual/social), sin transformarlas.
 *
 * @param {Object} brandConfig - currentBrand.
 * @param {{username: string, password: string}} credentials
 * @returns {Promise<{access: string, refresh: string, user: Object}>}
 */
export async function loginManualForDeviceSession(brandConfig, { username, password } = {}) {
  const base = resolveDeviceAuthBaseUrl(brandConfig);
  if (!base) {
    throw new Error('Falta configurar la base del backend (login.deviceSession.baseUrl).');
  }
  const res = await fetch(`${base}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: String(username || '').trim(),
      password: String(password || ''),
    }),
  });
  return parseJsonResponse(res, 'Error autenticando con el backend.');
}

/**
 * Refresca el access token con el refresh guardado.
 *
 * No lanza nunca: devuelve `''` si no hay refresh guardado, o si el backend
 * lo rechaza (refresh expirado, o invalidado por un cambio de contraseña /
 * cierre de cuenta -- ver `PasswordAwareJWTAuthentication` en el backend
 * Wind). El caller debe tratar `''` como "hay que volver a loguearse contra
 * este backend" (no afecta la sesión de PanAccess, que es independiente).
 */
export async function refreshDeviceSessionAccessToken(brandConfig, brand) {
  const base = resolveDeviceAuthBaseUrl(brandConfig);
  const refresh = getDeviceSessionRefreshToken(brand);
  if (!base || !refresh) return '';

  try {
    const res = await fetch(`${base}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    const data = await parseJsonResponse(res, 'No se pudo refrescar la sesión con el backend.');
    if (data?.access) {
      const id = resolveBrandId(brand);
      setBrandItem(id, STORAGE_KEYS.access, data.access);
      // El backend tiene ROTATE_REFRESH_TOKENS+BLACKLIST_AFTER_ROTATION
      // activados (ver panaccess_wind_integration/settings.py): cada refresh
      // devuelve un refresh token NUEVO y el usado queda invalidado de
      // inmediato -- confirmado que el body de /api/auth/token/refresh/ sí
      // incluye "refresh" (dj_rest_auth.jwt_auth.RefreshViewWithCookieSupport
      // solo lo quita si JWT_AUTH_HTTPONLY=True, y aquí está en False). Si no
      // se guarda este valor rotado, el próximo refresh reutiliza el token
      // viejo ya invalidado y falla con "Given token not valid for any token
      // type" -- eso pasaba a partir del segundo refresh de cada sesión.
      if (data.refresh) {
        setBrandItem(id, STORAGE_KEYS.refresh, data.refresh);
      }
      return data.access;
    }
  } catch {
    // Refresh inválido/expirado -- se limpia para no reintentar en loop en
    // cada arranque; el próximo login (manual o social) vuelve a crear uno.
    clearDeviceSessionAuth(brand);
  }
  return '';
}

/**
 * Persiste `{access, refresh, user}` en el storage namespaced por brand
 * (mismo esquema que `userSession.js`). Se limpia automáticamente al hacer
 * logout porque `setLoggedOut()` borra todo `{brand}.*` (ver `brandStorage.js`).
 */
export function persistDeviceSessionAuth({ access, refresh, user } = {}, brand) {
  const id = resolveBrandId(brand);
  if (access) setBrandItem(id, STORAGE_KEYS.access, access);
  if (refresh) setBrandItem(id, STORAGE_KEYS.refresh, refresh);
  if (user?.subscriber_code) setBrandItem(id, STORAGE_KEYS.subscriberCode, user.subscriber_code);
}

/**
 * Fetch autenticado con el JWT de device-session, con un reintento
 * automático (una sola vez) si el backend responde 401: intenta refrescar
 * el access token con el refresh guardado (`refreshDeviceSessionAccessToken`,
 * antes código muerto -- este es su primer caller real) y repite la misma
 * llamada antes de rendirse. Usado por los endpoints autenticados de
 * "dispositivos vinculados" y "cuenta" (perfil, cierre) -- ver
 * `linkedDevicesService.js` y `accountSecurityService.js`.
 *
 * @param {Object} brandConfig
 * @param {string} brand
 * @param {string} path - p.ej. '/wind/devices/' (se concatena a la base resuelta).
 * @param {RequestInit} [init]
 * @returns {Promise<any>} el body ya parseado como JSON.
 */
export async function authorizedDeviceRequest(brandConfig, brand, path, init = {}) {
  const base = resolveDeviceAuthBaseUrl(brandConfig);
  if (!base) {
    throw new Error('Falta configurar la base del backend (login.deviceSession.baseUrl).');
  }

  let accessToken = getDeviceSessionAccessToken(brand);
  if (!accessToken) {
    throw new Error('No hay sesión de dispositivo activa (vuelve a iniciar sesión).');
  }

  const doFetch = (token) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

  let res = await doFetch(accessToken);
  if (res.status === 401) {
    const refreshed = await refreshDeviceSessionAccessToken(brandConfig, brand);
    if (refreshed) {
      accessToken = refreshed;
      res = await doFetch(accessToken);
    }
  }

  return parseJsonResponse(res, 'Error comunicándose con el backend.');
}

export function getDeviceSessionAccessToken(brand) {
  return getBrandItem(resolveBrandId(brand), STORAGE_KEYS.access) || '';
}

export function getDeviceSessionRefreshToken(brand) {
  return getBrandItem(resolveBrandId(brand), STORAGE_KEYS.refresh) || '';
}

export function getDeviceSessionSubscriberCode(brand) {
  return getBrandItem(resolveBrandId(brand), STORAGE_KEYS.subscriberCode) || '';
}

export function hasDeviceSessionAuth(brand) {
  return !!getDeviceSessionAccessToken(brand);
}

export function clearDeviceSessionAuth(brand) {
  const id = resolveBrandId(brand);
  removeBrandItem(id, STORAGE_KEYS.access);
  removeBrandItem(id, STORAGE_KEYS.refresh);
  removeBrandItem(id, STORAGE_KEYS.subscriberCode);
}
