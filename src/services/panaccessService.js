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
   * Login - Sin retry automático por seguridad
   * La contraseña NO se encripta aquí, CV.js lo hace internamente
   */
  async login(method, parameters = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    
    try {
      console.log("Llamando a la API (login):", method, parameters);
      
      // Para clientLogin, usar init() del cliente
      if (method === 'clientLogin' && parameters.clientId && parameters.pwd) {
        // El apiToken ya está en la configuración del cliente
        // Solo necesitamos username y password
        await this.client.init(parameters.clientId, parameters.pwd);
        
        // El sessionId ya está guardado en el cliente después de init()
        const sessionId = this.client.sessionId;
        console.log("Respuesta de la API (login):", sessionId);
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
  async logout() {
    if (this.client) {
      try {
        await this.client.logout();
        console.log('[PanaccessService] Sesión cerrada');
      } catch (error) {
        console.error('[PanaccessService] Error al cerrar sesión:', error);
        // Limpiar cliente localmente aunque falle el logout remoto
        this.client.sessionId = null;
        localStorage.removeItem('sessionId');
      }
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

  /**
   * Métodos helper para funciones comunes del API
   */
  
  async getClientConfig() {
    if (!this.client) {
      throw new Error('Servicio no inicializado');
    }
    return await this.client.getClientConfig();
  }

  async getStreamingLicenses() {
    if (!this.client) {
      throw new Error('Servicio no inicializado');
    }
    if (!this.client.isAuthenticated()) {
      throw new Error('No hay sesión activa. Inicia sesión primero.');
    }
    return await this.client.getStreamingLicenses();
  }

  async activateStreamingLicense(license, pin, failIfInUse = false) {
    if (!this.client) {
      throw new Error('Servicio no inicializado');
    }
    if (!this.client.isAuthenticated()) {
      throw new Error('No hay sesión activa. Inicia sesión primero.');
    }
    return await this.client.activateStreamingLicense(license, pin, failIfInUse);
  }

  async getBouquets() {
    if (!this.client) {
      throw new Error('Servicio no inicializado');
    }
    if (!this.client.isAuthenticated()) {
      throw new Error('No hay sesión activa. Inicia sesión primero.');
    }
    return await this.client.getBouquets();
  }

  async getAvailableStreams() {
    if (!this.client) {
      throw new Error('Servicio no inicializado');
    }
    if (!this.client.isAuthenticated()) {
      throw new Error('No hay sesión activa. Inicia sesión primero.');
    }
    return await this.client.getAvailableStreams();
  }

  async getCatchupGroups() {
    if (!this.client) {
      throw new Error('Servicio no inicializado');
    }
    if (!this.client.isAuthenticated()) {
      throw new Error('No hay sesión activa. Inicia sesión primero.');
    }
    return await this.client.getCatchupGroups();
  }

  async getCatchupEvents(epgStreamId) {
    if (!this.client) {
      throw new Error('Servicio no inicializado');
    }
    if (!this.client.isAuthenticated()) {
      throw new Error('No hay sesión activa. Inicia sesión primero.');
    }
    return await this.client.getCatchupEvents(epgStreamId);
  }

  async getVOD() {
    if (!this.client) {
      throw new Error('Servicio no inicializado');
    }
    if (!this.client.isAuthenticated()) {
      throw new Error('No hay sesión activa. Inicia sesión primero.');
    }
    return await this.client.getVOD();
  }

  async getVODContent(offset = 0, limit = 100) {
    if (!this.client) {
      throw new Error('Servicio no inicializado');
    }
    if (!this.client.isAuthenticated()) {
      throw new Error('No hay sesión activa. Inicia sesión primero.');
    }
    return await this.client.getVODContent(offset, limit);
  }
}

// Instancia singleton
const panaccessService = new PanaccessService();

export default panaccessService;

