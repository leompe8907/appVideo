/**
 * Cliente para API de Panaccess
 * Integrado con sistema multi-cliente
 */

import CryptoJS from 'crypto-js';
import getUdid from './udid';
import { createTimeoutPromise, classifyError } from './errorClassifier';

export class CVClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || '';
    this.mode = ['json', 'jsonp'].includes(config.mode) ? config.mode : 'json';
    this.jsonpTimeout = config.jsonpTimeout || 5000;
    this.fetchTimeout = config.fetchTimeout || 30000;
    this.sessionId = null;
    this.apiToken = config.apiToken || '';
    this.username = '';
    this.password = '';
  }

  /**
   * Inicializa el cliente con credenciales y hace login automático
   */
  async init(username, password, apiToken = null) {
    this.username = username;
    this.apiToken = apiToken || this.apiToken;

    // Hash password si no está hasheado
    const salt = '_panaccess';
    if (!/^[0-9a-f]{32}$/.test(password)) {
      this.password = CryptoJS.MD5(password + salt).toString();
    } else {
      this.password = password;
    }

    // Intentar recuperar sesión guardada
    const savedSession = localStorage.getItem('cvSessionId');
    if (savedSession) {
      this.sessionId = savedSession;
      console.log('[CV] Sesión recuperada del storage');
      
      // Validar sesión
      try {
        await this.validateSession();
        console.log('[CV] Sesión válida');
        return true;
      } catch (error) {
        console.warn('[CV] Sesión inválida, creando nueva');
        this.sessionId = null;
      }
    }

    // Hacer login
    try {
      await this.login();
      console.log('[CV] Login exitoso');
      return true;
    } catch (error) {
      console.error('[CV] Login falló:', error);
      throw error;
    }
  }

  /**
   * Realiza una llamada al API
   */
  async call(funcName, parameters = {}) {
    const url = `${this.baseUrl}?f=${funcName}&requestMode=function`;

    // Agregar sessionId si existe (excepto en login)
    if (this.sessionId && funcName !== 'clientLogin') {
      parameters.sessionId = this.sessionId;
    }

    if (this.mode === 'jsonp') {
      return this.callJsonp(url, parameters);
    } else {
      return this.callJson(url, parameters);
    }
  }

  /**
   * Llamada JSON via fetch
   */
  async callJson(url, parameters) {
    const paramString = this.serialize(parameters);

    try {
      const fetchPromise = fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: paramString,
      });

      // Race entre fetch y timeout
      const response = await Promise.race([
        fetchPromise,
        createTimeoutPromise(this.fetchTimeout),
      ]);

      if (!response.ok) {
        const errorInfo = classifyError(
          new Error(`HTTP error! Status: ${response.status}`),
          response
        );
        const error = new Error(errorInfo.message);
        error.errorInfo = errorInfo;
        throw error;
      }

      const result = await response.json();
      
      if (!result.success) {
        const error = new Error(result.errorMessage || 'Unknown error');
        error.errorInfo = classifyError(error);
        throw error;
      }

      return result.answer;
    } catch (error) {
      // Si ya tiene errorInfo, relanzarlo
      if (error.errorInfo) {
        throw error;
      }

      // Clasificarlo
      const errorInfo = classifyError(error);
      const classifiedError = new Error(errorInfo.message);
      classifiedError.errorInfo = errorInfo;
      classifiedError.originalError = error;
      throw classifiedError;
    }
  }

  /**
   * Llamada JSONP (para CORS issues)
   */
  callJsonp(url, parameters) {
    return new Promise((resolve, reject) => {
      const callbackName = `CVJSONP${Date.now()}`;
      const timeout = setTimeout(() => {
        delete window[callbackName];
        reject(new Error('Request timed out'));
      }, this.jsonpTimeout);

      window[callbackName] = (result) => {
        clearTimeout(timeout);
        delete window[callbackName];

        if (result.success) {
          resolve(result.answer);
        } else {
          reject(new Error(result.errorMessage || 'Unknown error'));
        }
      };

      parameters.jsonp = `window.${callbackName}`;
      const paramString = this.serialize(parameters);
      const script = document.createElement('script');
      script.src = `${url}&${paramString}`;
      document.head.appendChild(script);
      document.head.removeChild(script);
    });
  }

  /**
   * Serializa objeto a URL params
   */
  serialize(obj) {
    return Object.entries(obj)
      .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
      .join('&');
  }

  /**
   * Login al sistema
   */
  async login() {
    try {
      const result = await this.call('clientLogin', {
        apiToken: this.apiToken,
        username: this.username,
        password: this.password,
        udid: getUdid(),
      });

      this.sessionId = result;
      localStorage.setItem('cvSessionId', this.sessionId);
      return result;
    } catch (error) {
      throw new Error('Login failed: ' + error.message);
    }
  }

  /**
   * Valida si la sesión actual es válida
   */
  async validateSession() {
    try {
      // Hacer una llamada simple para validar
      await this.call('getCategories', {});
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cierra sesión
   */
  logout() {
    localStorage.removeItem('cvSessionId');
    this.sessionId = null;
    console.log('[CV] Sesión cerrada');
  }

  /**
   * Verifica si hay sesión activa
   */
  isAuthenticated() {
    return !!this.sessionId;
  }
}

/**
 * Factory: Crea cliente CV desde brandConfig
 */
export function createCVClient(brandConfig) {
  if (!brandConfig) {
    throw new Error('brandConfig es requerido');
  }

  return new CVClient({
    baseUrl: brandConfig.drm,
    apiToken: brandConfig.token,
    mode: 'json',
    fetchTimeout: 30000,
  });
}

export default CVClient;

