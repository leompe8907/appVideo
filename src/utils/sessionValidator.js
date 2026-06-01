import * as userSession from './userSession';
import { checkSessionAndReactivateIfNeeded } from '../services/loginFlow';
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

    const ok = await checkSessionAndReactivateIfNeeded(brandConfig, {
      failIfInUse: true,
    });

    if (!ok) {
      logger.warn('[SessionValidator] Sesión inválida o reactivación fallida.');
      userSession.setLoggedOut();
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
