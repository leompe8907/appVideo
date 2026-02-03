/**
 * Servicio para manejar conexiones con Panaccess
 * Patrón Singleton - Una sola instancia global
 */

import { createCVClient } from '../api/cv/cv';
import { retryOperation } from '../api/cv/errorClassifier';

class PanaccessService {
  constructor() {
    this.client = null;
    this.brandConfig = null;
  }

  /**
   * Inicializa el cliente con configuración de marca
   */
  async initialize(brandConfig) {
    try {
      if (!brandConfig) {
        throw new Error('brandConfig es requerido');
      }

      this.brandConfig = brandConfig;
      this.client = createCVClient(brandConfig);

      console.log('[PanaccessService] Inicializado correctamente');
    } catch (error) {
      console.error('[PanaccessService] Error en inicialización:', error);
      throw error;
    }
  }

  /**
   * Función exclusiva para login (sin retry automático por seguridad)
   */
  async callLoginApi(method, parameters = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    
    try {
      console.log("Llamando a la API (login):", method, parameters);
      
      // Para clientLogin, usar init() del cliente
      if (method === 'clientLogin' && parameters.clientId && parameters.pwd) {
        // Trim para evitar espacios que invalidan la contraseña
        const clientId = typeof parameters.clientId === 'string' ? parameters.clientId.trim() : parameters.clientId;
        const pwd = typeof parameters.pwd === 'string' ? parameters.pwd.trim() : parameters.pwd;
        await this.client.init({
          baseUrl: this.brandConfig.drm,
          apiToken: parameters.apiToken || this.brandConfig.token,
          username: clientId,
          password: pwd,
          mode: 'json',
          fetchTimeout: 30000,
        });
        
        const sessionId = this.client.sessionId;
        console.log("Respuesta de la API (login):", sessionId);
        if (!sessionId || (typeof sessionId === 'string' && sessionId.trim() === '') || (Array.isArray(sessionId) && sessionId.length === 0)) {
          throw new Error('No se recibió sesión. Verifica usuario y contraseña.');
        }
        return sessionId;
      } else {
        // Para otros métodos, usar call directamente
        const result = await this.client.call(method, parameters);
        console.log("Respuesta de la API (login):", result);
        return result;
      }
    } catch (error) {
      console.error(`Error en la llamada de login (${method}):`, error);
      throw error;
    }
  }

  /**
   * Función para todas las demás llamadas autenticadas (con retry automático)
   */
  async callAuthenticatedApi(method, parameters = {}, options = {}) {
    const { enableRetry = true, maxRetries = 3 } = options;

    if (!this.client) {
      throw new Error('Servicio no inicializado');
    }

    // Restaurar sessionId del localStorage si el cliente no está autenticado
    const sessionIdFromStorage = localStorage.getItem("sessionId");
    if (!this.client.isAuthenticated() && sessionIdFromStorage) {
      this.client.sessionId = sessionIdFromStorage;
      console.log('[PanaccessService] SessionId restaurado desde localStorage');
    }

    if (!this.client.isAuthenticated()) {
      throw new Error('No hay sesión activa. Inicia sesión primero.');
    }

    const apiCall = async () => {
      const sessionId = localStorage.getItem("sessionId");
      const udid = localStorage.getItem("udid");

      if (!sessionId) {
        const error = new Error("Falta el sessionId.");
        error.errorInfo = { type: 'VALIDATION_ERROR', canRetry: false };
        throw error;
      }

      parameters = {
        ...parameters,
        sessionId,
      };

      // Agregar udid si está disponible
      if (udid) {
        parameters.udid = udid;
      }

      console.log("Llamando a la API (autenticada):", method, parameters);
      const result = await this.client.call(method, parameters);
      console.log("Respuesta de la API (autenticada):", result);
      return result;
    };

    try {
      if (enableRetry) {
        // Usar retry automático para errores recuperables
        return await retryOperation(apiCall, { maxRetries });
      } else {
        return await apiCall();
      }
    } catch (error) {
      console.error(`Error en la llamada (${method}):`, error);
      throw error;
    }
  }

  /**
   * Obtiene el cliente CV
   */
  getClient() {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    return this.client;
  }

  /**
   * Valida si la sesión actual es válida
   */
  async validateSession() {
    if (!this.client) {
      return false;
    }
    return await this.client.validateSession();
  }

  /**
   * Cierra sesión
   */
  logout() {
    if (this.client) {
      this.client.logout();
      console.log('[PanaccessService] Sesión cerrada');
    }
  }

}

// Instancia singleton
const panaccessService = new PanaccessService();

export default panaccessService;
