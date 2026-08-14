import * as userSession from './userSession';
import { checkSessionAndReactivateIfNeeded, clearSessionBeforeNewLogin } from '../services/loginFlow';
import logger from './logger';

const VALIDATION_INTERVAL_MS = 5 * 60 * 1000;
let validationIntervalId = null;
let lastValidationTimestamp = 0;
let isValidationInProgress = false;
let onSessionInvalid = null;

/**
 * Registra callback al detectar sesión inválida (p. ej. redirigir a splash).
 * @param {(() => void)|null} fn
 */
export function setOnSessionInvalid(fn) {
  onSessionInvalid = typeof fn === 'function' ? fn : null;
}

function notifySessionInvalid() {
  try {
    onSessionInvalid?.();
  } catch (err) {
    logger.error('[SessionValidator] Error en onSessionInvalid:', err);
  }
}

async function validateSession(brandConfig) {
  if (isValidationInProgress) {
    return false;
  }
  isValidationInProgress = true;

  try {
    if (!userSession.isAuthenticated()) {
      logger.log('[SessionValidator] No hay sessionId.');
      isValidationInProgress = false;
      return false;
    }

    if (!brandConfig?.token) {
      logger.warn('[SessionValidator] Sin brand config, no se puede validar.');
      isValidationInProgress = false;
      return false;
    }

    const { ok, reason } = await checkSessionAndReactivateIfNeeded(brandConfig, {
      failIfInUse: true,
    });

    if (!ok) {
      if (reason === 'network') {
        // Fallo de red/timeout (incluso después de reintentar) -- NO forzar
        // logout. El usuario sigue logueado desde su perspectiva; forzarlo a
        // loguearse de nuevo por un problema de conectividad transitorio
        // (típicamente justo al volver de background, el momento de peor
        // conexión) era el bug real: además de la mala experiencia, ese
        // logout no pasaba por `clearSessionBeforeNewLogin()`, así que
        // también perdía el `device_token` y duplicaba el dispositivo en el
        // próximo login. Se deja la sesión local intacta y se reintentará
        // en el próximo ciclo del validador.
        logger.warn('[SessionValidator] No se pudo verificar la sesión (red/timeout) -- se mantiene la sesión local, se reintentará después.');
        isValidationInProgress = false;
        return true;
      }

      logger.warn('[SessionValidator] Sesión inválida o reactivación fallida.');
      // `clearSessionBeforeNewLogin()` en vez de `userSession.setLoggedOut()`
      // directo -- esta última borra TODO el storage de la marca sin
      // excepciones, incluido el `device_token` de "dispositivos vinculados"
      // (ver `clearBrandStorage`), y el próximo login manual quedaba sin
      // nada que reenviar en `register_device`, creando un `DeviceSession`
      // duplicado. `clearSessionBeforeNewLogin()` es la función que ya
      // preserva y restaura ese token alrededor del mismo borrado.
      clearSessionBeforeNewLogin();
      isValidationInProgress = false;
      notifySessionInvalid();
      return false;
    }

    lastValidationTimestamp = Date.now();
    isValidationInProgress = false;
    return true;
  } catch (err) {
    logger.error('[SessionValidator] Error durante la validación de sesión:', err);
    isValidationInProgress = false;
    return false;
  }
}

/**
 * Valida sesión si pasó el intervalo mínimo (throttle global).
 * @param {object} brandConfig
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
export async function validateSessionIfDue(brandConfig, options = {}) {
  const force = options.force === true;
  if (!force && Date.now() - lastValidationTimestamp < VALIDATION_INTERVAL_MS) {
    return true;
  }
  return validateSession(brandConfig);
}

export function startSessionValidator(brandConfig) {
  if (validationIntervalId) {
    logger.log('[SessionValidator] Validator ya corriendo.');
    return;
  }

  logger.log('[SessionValidator] Iniciando validador de sesión.');

  if (Date.now() - lastValidationTimestamp > 5000) {
    validateSession(brandConfig);
  }

  validationIntervalId = window.setInterval(() => {
    if (Date.now() - lastValidationTimestamp > VALIDATION_INTERVAL_MS) {
      validateSession(brandConfig);
    }
  }, VALIDATION_INTERVAL_MS);
}

export function stopSessionValidator() {
  if (validationIntervalId) {
    logger.log('[SessionValidator] Deteniendo validador de sesión.');
    window.clearInterval(validationIntervalId);
    validationIntervalId = null;
  }
}

export function forceSessionValidation(brandConfig) {
  logger.log('[SessionValidator] Forzando validación de sesión.');
  lastValidationTimestamp = 0;
  return validateSession(brandConfig);
}
