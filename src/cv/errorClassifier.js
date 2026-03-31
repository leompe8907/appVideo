import i18n from '../locales/i18n';

export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  AUTH: 'AUTH_ERROR',
  API: 'API_ERROR',
  SERVER: 'SERVER_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
};

const t = (key) => (i18n && i18n.t ? i18n.t(key) : key);

/**
 * Crea un promise que se rechaza después del timeout
 */
export function createTimeoutPromise(timeout) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(`Request timeout after ${timeout}ms`);
      error.isTimeout = true;
      reject(error);
    }, timeout);
  });
}

/**
 * Clasifica el error según su tipo
 */
export function classifyError(error, response = null) {
  let errorType = ERROR_TYPES.UNKNOWN;
  let message = error.message || t('errors.unknown');
  let userMessage = t('errors.unexpected');
  let retry = false;

  const normalizedMessage = (message || '').toLowerCase();

  // Caso específico: permiso denegado por backend Panaccess
  // "You do not have the permission to execute this functionality."
  if (normalizedMessage.includes('you do not have the permission to execute this functionality')) {
    errorType = ERROR_TYPES.AUTH;
    userMessage = t('errors.auth');
    retry = false; // no sirve reintentar sin re-login
  }
  // Error de timeout
  else if (error.isTimeout || error.name === 'AbortError' || normalizedMessage.includes('timeout')) {
    errorType = ERROR_TYPES.TIMEOUT;
    userMessage = t('errors.timeout');
    retry = true;
  }
  // Error de red
  else if (!navigator.onLine || error.name === 'NetworkError' || normalizedMessage.includes('network')) {
    errorType = ERROR_TYPES.NETWORK;
    userMessage = t('errors.network');
    retry = true;
  }
  // Error de autenticación
  else if (response?.status === 401 || response?.status === 403 || normalizedMessage.includes('auth')) {
    errorType = ERROR_TYPES.AUTH;
    userMessage = t('errors.auth');
    retry = false;
  }
  // Error del API
  else if (response?.status >= 400 && response?.status < 500) {
    errorType = ERROR_TYPES.API;
    userMessage = t('errors.api');
    retry = true;
  }
  // Error del servidor
  else if (response?.status >= 500) {
    errorType = ERROR_TYPES.SERVER;
    userMessage = t('errors.server');
    retry = true;
  }
  // Si tenemos mensaje concreto del API/servidor, usarlo en lugar del genérico
  else if (message && message.length > 0) {
    userMessage = message;
  }

  return {
    type: errorType,
    message: message,
    userMessage: userMessage,
    canRetry: retry,
    statusCode: response?.status,
    originalError: error,
  };
}

/**
 * Reintentar operación con backoff exponencial
 */
export async function retryOperation(operation, options = {}) {
  const { maxRetries = 3, baseDelay = 1000 } = options;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      const errorInfo = error.errorInfo || classifyError(error);
      
      // No reintentar si el error no es recuperable
      if (!errorInfo.canRetry || attempt === maxRetries) {
        throw error;
      }

      // Esperar antes del siguiente intento (exponencial backoff)
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`[Retry] Intento ${attempt + 1}/${maxRetries} falló. Reintentando en ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
