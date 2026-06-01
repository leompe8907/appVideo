/**
 * Flujo de login: clientLogin → getClientConfig → getStreamingLicenses → activación de licencia.
 * Incluye reactivación de sesión y de licencia (equivalente al LoginHelper del proyecto 10foot).
 */

import panaccessService from './panaccessService';
import * as userSession from '../utils/userSession';
import {
  getLicenseKey,
  getLicensePin,
  getLicenseProducts,
  getLicensesForAutoActivation,
} from '../utils/licenseProducts';

/**
 * Limpia sesión, storage de marca y caché en memoria antes de un login manual
 * (otro usuario en el mismo dispositivo). No usar en reactivación automática (splash).
 */
export function clearSessionBeforeNewLogin() {
  try {
    panaccessService.logout?.();
  } catch {
    // noop
  }
  userSession.setLoggedOut();
}

const DEFAULT_OPTIONS = {
  autoActivateLicense: false,
  activationRecursive: true,
  maxAutoActivateLicense: 5,
  failIfInUse: false,
  storeClientConfig: true,
  storeLicenses: true,
};

function getLicensesArray(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  return response.answer ?? response.licenses ?? response.list ?? response.data ?? [];
}

/**
 * Normaliza la respuesta de getStreamingLicenses conservando products para auto-selección.
 */
function normalizeLicenses(result) {
  const list = getLicensesArray(result);
  return list
    .map((item) => ({
      key: getLicenseKey(item),
      pin: getLicensePin(item),
      products: getLicenseProducts(item),
      licenseName:
        item.licenseName != null
          ? String(item.licenseName)
          : item.name != null
            ? String(item.name)
            : '',
    }))
    .filter((item) => item.key);
}

function normalizeStreamsResponse(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  return response.streams ?? response.list ?? response.answer ?? response.data ?? [];
}

async function verifyActiveLicenseHasStreams(service) {
  try {
    const response = await service.getAvailableStreams({ enableRetry: false });
    const list = normalizeStreamsResponse(response);
    return Array.isArray(list) && list.length > 0;
  } catch {
    return false;
  }
}

/**
 * Activa una licencia y confirma que devuelve streams disponibles.
 * @returns {Promise<{ key: string, pin: string }|null>}
 */
async function activateLicenseWithContentCheck(service, license, options = {}) {
  const key = getLicenseKey(license);
  const pin = getLicensePin(license);
  const { failIfInUse = false, requireContent = true } = options;

  if (!key) return null;

  try {
    await service.setStreamingLicense({ licenseKey: key, pin, failIfInUse });
    if (requireContent) {
      const hasContent = await verifyActiveLicenseHasStreams(service);
      if (!hasContent) {
        if (import.meta.env.DEV) {
          console.warn('[loginFlow] Licencia activada sin contenido disponible:', key);
        }
        return null;
      }
    }
    if (import.meta.env.DEV) {
      console.log('[loginFlow] Licencia activada con contenido:', key);
    }
    return { key, pin };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[loginFlow] Fallo activación licencia', key, e.message);
    }
    return null;
  }
}

/**
 * Login completo: autenticar → getClientConfig → getStreamingLicenses → opcionalmente activar licencia.
 * @param {Object} brandConfig - Configuración de la marca (currentBrand).
 * @param {{ username: string, password: string }} credentials
 * @param {Object} [options]
 * @param {boolean} [options.autoActivateLicense] - Si true, intenta activar la primera licencia disponible.
 * @param {string} [options.licenseKey] - Licencia a activar (prioridad sobre auto).
 * @param {string} [options.pin] - PIN de la licencia.
 * @param {boolean} [options.activationRecursive] - Si falla una licencia, intentar la siguiente.
 * @param {number} [options.maxAutoActivateLicense] - Máximo de licencias a intentar.
 * @param {boolean} [options.failIfInUse] - Pasar a setStreamingLicense.
 * @param {boolean} [options.storeClientConfig] - Guardar getClientConfig en userSession.
 * @param {boolean} [options.storeLicenses] - Guardar licencias en userSession.
 * @returns {Promise<{ success: true, clientConfig?: Object, licenses?: Array }>}
 */
export async function loginAndActivateLicense(brandConfig, credentials, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (!brandConfig || !credentials?.username || !credentials?.password) {
    throw new Error('brandConfig y credenciales (username, password) son requeridos.');
  }

  if (!panaccessService.client) {
    await panaccessService.initialize(brandConfig);
  }

  const udid = userSession.getUdidOrCreate();
  const sessionId = await panaccessService.callLoginApi('clientLogin', {
    apiToken: brandConfig.token,
    clientId: credentials.username.trim(),
    pwd: credentials.password.trim(),
    udid,
  });

  if (!sessionId || (typeof sessionId === 'string' && sessionId.trim() === '')) {
    throw new Error('No se recibió sesión. Verifica usuario y contraseña.');
  }

  userSession.setLoggedIn({
    username: credentials.username,
    password: credentials.password,
    sessionId: Array.isArray(sessionId) ? sessionId[0] : sessionId,
    udid,
  });

  // Evita "licencia vieja" en storage si la activación falla (ej. license in use).
  // Esto es clave para rutas automáticas (splash/login) que dependen de si hay licencia activa.
  const shouldAttemptActivation = Boolean(
    opts.autoActivateLicense || (opts.licenseKey != null && String(opts.licenseKey).trim() !== ''),
  );
  if (shouldAttemptActivation) {
    userSession.setActiveLicense({ licenseKey: '', pin: '' });
  }

  let clientConfig = null;
  let licenses = [];

  try {
    clientConfig = await panaccessService.getClientConfig({ enableRetry: false });
    if (opts.storeClientConfig && clientConfig) {
      userSession.setClientConfig(clientConfig);
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[loginFlow] getClientConfig falló:', e.message);
    }
  }

  try {
    const rawLicenses = await panaccessService.getStreamingLicenses({
      withPins: true,
      enableRetry: false,
    });
    licenses = normalizeLicenses(rawLicenses);
    if (opts.storeLicenses && licenses.length > 0) {
      userSession.setLicenses(licenses);
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[loginFlow] getStreamingLicenses falló:', e.message);
    }
  }

  const licenseKey = opts.licenseKey != null ? String(opts.licenseKey).trim() : '';
  const pin = opts.pin != null ? String(opts.pin) : '';
  let activated = null;

  if (licenseKey && licenses.length > 0) {
    activated = await activateLicenseWithContentCheck(
      panaccessService,
      { key: licenseKey, pin },
      { failIfInUse: opts.failIfInUse, requireContent: true },
    );
  }

  if (!activated && opts.autoActivateLicense && licenses.length > 0) {
    const excludeKey = licenseKey || '';
    const candidates = getLicensesForAutoActivation(licenses).filter(
      (license) => getLicenseKey(license) !== excludeKey,
    );
    activated = await autoActivateLicense(panaccessService, candidates, {
      activationRecursive: opts.activationRecursive,
      maxAutoActivateLicense: opts.maxAutoActivateLicense,
      failIfInUse: opts.failIfInUse,
    });
  }

  if (activated) {
    userSession.setActiveLicense({ licenseKey: activated.key, pin: activated.pin });
  }

  return { success: true, clientConfig, licenses };
}

/**
 * Intenta activar licencias en orden (priorizando las que tienen products) hasta que una tenga contenido.
 * @returns {Promise<{ key, pin }|null>} La licencia activada o null.
 */
async function autoActivateLicense(service, licenses, options) {
  const { activationRecursive, maxAutoActivateLicense, failIfInUse } = options;
  const candidates = getLicensesForAutoActivation(licenses);
  const max = Math.min(candidates.length, maxAutoActivateLicense);

  for (let i = 0; i < max; i++) {
    const item = candidates[i];
    const activated = await activateLicenseWithContentCheck(service, item, {
      failIfInUse,
      requireContent: true,
    });
    if (activated) return activated;
    if (!activationRecursive) return null;
  }
  return null;
}

/**
 * Reactiva sesión usando credenciales guardadas (re-login + getClientConfig + opcional licencia).
 * @param {Object} brandConfig - currentBrand.
 * @param {Object} [options] - Mismas opciones que loginAndActivateLicense (autoActivateLicense, etc.).
 * @returns {Promise<boolean>} true si todo ok, false si no hay credenciales o falla.
 */
export async function reactivateSession(brandConfig, options = {}) {
  const credentials =
    userSession.getCredentials() ??
    userSession.getCredentialsWithFallback(brandConfig?.token);
  if (!credentials) {
    if (import.meta.env.DEV) console.warn('[loginFlow] reactivateSession: no hay credenciales');
    return false;
  }

  const active = userSession.getActiveLicense();
  const opts = {
    autoActivateLicense: true,
    activationRecursive: true,
    failIfInUse: false,
    storeClientConfig: true,
    storeLicenses: true,
    ...options,
  };
  if (active?.licenseKey) {
    opts.licenseKey = active.licenseKey;
    opts.pin = active.pin ?? '';
  }

  try {
    await loginAndActivateLicense(brandConfig, credentials, opts);
    if (import.meta.env.DEV) console.log('[loginFlow] reactivateSession: ok');
    return true;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[loginFlow] reactivateSession falló:', e.message);
    }
    return false;
  }
}

/**
 * Reactiva solo la licencia (sesión ya válida) y verifica que haya streams disponibles.
 * @param {Object} brandConfig - currentBrand.
 * @param {boolean} [failIfInUse=false]
 * @returns {Promise<boolean>}
 */
export async function reactivateLicense(brandConfig, failIfInUse = false) {
  const active = userSession.getActiveLicense();
  if (!active?.licenseKey) return true;

  if (!panaccessService.client) {
    await panaccessService.initialize(brandConfig);
  }

  const activated = await activateLicenseWithContentCheck(
    panaccessService,
    { key: active.licenseKey, pin: active.pin ?? '' },
    { failIfInUse, requireContent: true },
  );
  return activated != null;
}

/**
 * Comprueba sesión y reactiva licencia o sesión (equivalente a LoginHelper.checkSessionAndReactivateIfNeeded).
 * @param {Object} brandConfig - currentBrand.
 * @param {{ failIfInUse?: boolean }} [options] - Si la sesión es válida, pasa a reactivateLicense; si no, re-login + licencia guardada.
 * @returns {Promise<boolean>} true si la sesión/licencia quedan operativas, false si hay que ir a login.
 */
export async function checkSessionAndReactivateIfNeeded(brandConfig, options = {}) {
  const { failIfInUse = false, ...reactivateOptions } = options;
  if (!brandConfig) return false;

  if (!panaccessService.client) {
    await panaccessService.initialize(brandConfig);
  }

  const sessionId = userSession.getSessionId();
  if (!sessionId) return false;

  try {
    const valid = await panaccessService.loggedIn({ enableRetry: false }).then(Boolean).catch(() => false);
    if (valid) {
      return reactivateLicense(brandConfig, failIfInUse);
    }
  } catch {
    // seguir a reactivar sesión completa
  }

  return reactivateSession(brandConfig, reactivateOptions);
}
