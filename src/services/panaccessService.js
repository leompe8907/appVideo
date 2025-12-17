/**
 * Servicio para manejar conexiones con Panaccess
 * Patrón Singleton - Una sola instancia global
 */

import { CVClient } from '../api/cv/cv';
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
      this.client = new CVClient({
        baseUrl: brandConfig.drm,
        apiToken: brandConfig.token,
        mode: 'json',
        fetchTimeout: 30000,
      });

      console.log('[PanaccessService] Inicializado correctamente');
    } catch (error) {
      console.error('[PanaccessService] Error en inicialización:', error);
      throw error;
    }
  }

  /**
   * Login - Sin retry automático por seguridad
   * La contraseña NO se encripta aquí, CV.js lo hace internamente
   */
  async login(method, parameters = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    try {
      console.log("Llamando a la API (login):", method, parameters);
      const result = await CV.call(method, parameters);
      console.log("Respuesta de la API (login):", result);
      return result; // Retorna solo el resultado
    } catch (error) {
      console.error(`Error en la llamada de login (${method}):`, error);
      throw error;
    }
  }

  /**
   * Llamadas autenticadas - Con retry automático
   */
  async callAuthenticated(funcName, parameters = {}, options = {}) {
    const { enableRetry = true, maxRetries = 3 } = options;

    if (!this.client) {
      throw new Error('Servicio no inicializado');
    }

    if (!this.client.isAuthenticated()) {
      throw new Error('No hay sesión activa. Inicia sesión primero.');
    }

    const apiCall = async () => {
      console.log(`[PanaccessService] Llamando ${funcName}:`, parameters);
      const result = await this.client.call(funcName, parameters);
      console.log(`[PanaccessService] Respuesta ${funcName}:`, result);
      return result;
    };

    try {
      if (enableRetry) {
        return await retryOperation(apiCall, { maxRetries });
      } else {
        return await apiCall();
      }
    } catch (error) {
      console.error(`[PanaccessService] Error en ${funcName}:`, error);
      throw error;
    }
  }

  /**
   * Valida si la sesión actual es válida
   */
  async validateSession() {
    try {
      if (!this.client || !this.client.isAuthenticated()) {
        return false;
      }

      // Intentar una llamada simple para validar
      await this.callAuthenticated('getClientConfig', {}, { enableRetry: false });
      return true;
    } catch (error) {
      console.warn('[PanaccessService] Sesión inválida:', error);
      return false;
    }
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

  /**
   * Verifica si hay sesión activa
   */
  isAuthenticated() {
    return this.client ? this.client.isAuthenticated() : false;
  }

  /**
   * Obtiene el cliente actual
   */
  getClient() {
    return this.client;
  }
}

// Instancia singleton
const panaccessService = new PanaccessService();

export default panaccessService;

