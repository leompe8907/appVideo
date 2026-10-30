const IS_DEV = import.meta.env.DEV === true;

/**
 * Logger centralizado que respeta el entorno.
 * En producción, silencia logs informativos y solo permite errores.
 * Previene la fuga de credenciales en logs de dispositivos.
 */
export const logger = {
  log: (...args) => {
    if (IS_DEV) {
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (IS_DEV) {
      console.warn(...args);
    }
  },
  error: (...args) => {
    // Los errores siempre se loguean para facilitar el soporte técnico remoto
    console.error(...args);
  },
  info: (...args) => {
    if (IS_DEV) {
      console.info(...args);
    }
  },
  // Método especial para debug de red que oculta campos sensibles
  debugApi: (type, method, parameters) => {
    if (!IS_DEV) return;
    
    // Clonar para no modificar el objeto original
    const sanitizedParams = parameters ? { ...parameters } : {};
    
    // Campos sensibles a ocultar
    const sensitiveFields = ['pwd', 'password', 'sessionId', 'apiToken', 'token', 'pin', 'customData'];
    sensitiveFields.forEach(field => {
      if (sanitizedParams[field]) {
        sanitizedParams[field] = '***HIDDEN***';
      }
    });

    console.log(`[API ${type}] ${method}:`, sanitizedParams);
  }
};

export default logger;
