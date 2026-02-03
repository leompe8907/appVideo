export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  AUTH: 'AUTH_ERROR',
  API: 'API_ERROR',
  SERVER: 'SERVER_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
};

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
  let message = error.message || 'Error desconocido';
  let userMessage = 'Ocurrió un error inesperado';
  let retry = false;

  // Error de timeout
  if (error.isTimeout || error.name === 'AbortError' || message.includes('timeout')) {
    errorType = ERROR_TYPES.TIMEOUT;
    userMessage = 'La conexión tardó demasiado. Intenta de nuevo.';
    retry = true;
  }
  // Error de red
  else if (!navigator.onLine || error.name === 'NetworkError' || message.includes('network')) {
    errorType = ERROR_TYPES.NETWORK;
    userMessage = 'Sin conexión a internet. Verifica tu red.';
    retry = true;
  }
  // Error de autenticación
  else if (response?.status === 401 || response?.status === 403 || message.includes('auth')) {
    errorType = ERROR_TYPES.AUTH;
    userMessage = 'Credenciales inválidas. Verifica tu usuario y contraseña.';
    retry = false;
  }
  // Error del API
  else if (response?.status >= 400 && response?.status < 500) {
    errorType = ERROR_TYPES.API;
    userMessage = 'Error en la solicitud. Intenta de nuevo.';
    retry = true;
  }
  // Error del servidor
  else if (response?.status >= 500) {
    errorType = ERROR_TYPES.SERVER;
    userMessage = 'Error del servidor. Intenta más tarde.';
    retry = true;
  }
  // Si tenemos mensaje concreto del API/servidor, usarlo en lugar del genérico
  else if (message && message.length > 0 && message !== 'Error desconocido' && userMessage === 'Ocurrió un error inesperado') {
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
