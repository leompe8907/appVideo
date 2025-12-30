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
    this.loginParamOS = config.loginParamOS || 'HTML5';
    this.appVersion = config.appVersion || '1';
    this.branding = config.branding || 'Panaccess';
    this.lang = config.lang || 'es';
    this.epgRequest = null;
    this.automaticActivation = config.automaticActivation || false;
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

    // Intentar recuperar sesión guardada (buscar en ambas claves por compatibilidad)
    const savedSession = localStorage.getItem('sessionId');
    if (savedSession) {
      this.sessionId = savedSession;
      // Guardar en sessionId para unificar
      localStorage.setItem('sessionId', savedSession);
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
   * Agrega parámetros comunes a las llamadas del API
   */
  addCommonParams(parameters = {}) {
    const commonParams = {
      apiToken: this.apiToken,
      l: this.lang,
      ...parameters
    };

    // Agregar parámetros de dispositivo si no están presentes
    if (!parameters.udid) {
      commonParams.udid = getUdid();
    }
    if (!parameters.os) {
      commonParams.os = this.loginParamOS;
    }
    if (!parameters.appVersion) {
      commonParams.appVersion = this.appVersion;
    }
    if (!parameters.branding) {
      commonParams.branding = this.branding;
    }
    if (this.sessionId && !parameters.sessionId) {
      commonParams.sessionId = this.sessionId;
    }

    return commonParams;
  }

  /**
   * Realiza una llamada al API
   */
  async call(funcName, parameters = {}) {
    const url = `${this.baseUrl}index.php?f=${funcName}&requestMode=function`;

    // No agregar parámetros comunes en login
    if (funcName === 'clientLogin') {
      parameters.apiToken = this.apiToken;
      parameters.l = this.lang;
    } else {
      parameters = this.addCommonParams(parameters);
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

  async login() {
    try {
      const url = `${this.baseUrl}index.php?f=clientLogin&requestMode=function`;
      const parameters = {
        apiToken: this.apiToken,
        l: this.lang,
        clientId: this.username,
        pwd: this.password,
        udid: getUdid(),
        os: this.loginParamOS,
        appVersion: this.appVersion,
        branding: this.branding
      };

      const result = await this.callJson(url, parameters);
      this.sessionId = result;
      localStorage.setItem('sessionId', this.sessionId);
      return result;
    } catch (error) {
      this.sessionId = null;
      localStorage.removeItem('sessionId');
      throw new Error('Login failed: ' + error.message);
    }
  }

  /**
   * Valida si la sesión actual es válida
   */
  async validateSession() {
    try {
      // Hacer una llamada simple para validar
      await this.call('getClientConfig', {});
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica si hay sesión activa
   */
  isAuthenticated() {
    return !!this.sessionId;
  }

  /**
   * Obtiene servidores responsables
   * Nota: Este método usa una URL base diferente (cv01.panaccess.com)
   */
  async getResponsibleServers(mode, data1) {
    const url = 'https://cv01.panaccess.com/index.php';
    const parameters = {
      f: 'getResponsibleServers',
      requestMode: 'function',
      mode: mode,
      data1: data1,
      apiToken: this.apiToken,
      l: this.lang
    };

    try {
      const paramString = this.serialize(parameters);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: paramString,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.answer && result.answer.length > 0) {
        return result.answer[0];
      }
      throw new Error('No se encontraron servidores responsables');
    } catch (error) {
      console.error('[CV] Error en getResponsibleServers:', error);
      throw error;
    }
  }

  /**
   * Obtiene configuración del cliente
   */
  async getClientConfig() {
    try {
      const result = await this.call('getClientConfig', {});
      
      // Guardar configuración
      localStorage.setItem('cvClientConfig', JSON.stringify(result));
      
      // Obtener hora local del servidor si está disponible
      if (result.localTime) {
        const localTime = new Date(result.localTime);
        localStorage.setItem('serverLocalTime', localTime.toISOString());
        localStorage.setItem('serverLocalTimeStart', Date.now().toString());
      }
      
      return result;
    } catch (error) {
      console.error('[CV] Error en getClientConfig:', error);
      throw error;
    }
  }

  /**
   * Obtiene licencias de streaming
   */
  async getStreamingLicenses() {
    try {
      const parameters = {
        withPins: this.automaticActivation
      };
      const result = await this.call('getStreamingLicenses', parameters);
      localStorage.setItem('cvLicenses', JSON.stringify(result));
      return result;
    } catch (error) {
      console.error('[CV] Error en getStreamingLicenses:', error);
      throw error;
    }
  }

  /**
   * Activa una licencia de streaming
   */
  async activateStreamingLicense(license, pin, failIfInUse = false) {
    try {
      const parameters = {
        licenseKey: license,
        pin: pin,
        failIfInUse: failIfInUse
      };
      const result = await this.call('setStreamingLicense', parameters);
      
      // Guardar licencia activada
      localStorage.setItem('cvLicense', license);
      localStorage.setItem('cvLicensePin', pin);
      localStorage.setItem('cvLicenseActivated', 'true');
      
      return result;
    } catch (error) {
      console.error('[CV] Error en activateStreamingLicense:', error);
      throw error;
    }
  }

  /**
   * Obtiene paquetes de canales (bouquets)
   */
  async getBouquets() {
    try {
      const result = await this.call('getBouquets', {});
      console.log('[CV] Bouquets obtenidos:', result);
      return result;
    } catch (error) {
      console.error('[CV] Error en getBouquets:', error);
      throw error;
    }
  }

  /**
   * Obtiene streams disponibles
   */
  async getAvailableStreams() {
    try {
      const parameters = {
        ip: true
      };
      const result = await this.call('getAvailableStreams', parameters);
      console.log('[CV] Streams disponibles obtenidos:', result);
      return result;
    } catch (error) {
      console.error('[CV] Error en getAvailableStreams:', error);
      throw error;
    }
  }

  /**
   * Obtiene grupos de catchup
   */
  async getCatchupGroups() {
    try {
      const result = await this.call('getCatchupGroups', {});
      console.log('[CV] Grupos de catchup obtenidos:', result);
      return result;
    } catch (error) {
      console.error('[CV] Error en getCatchupGroups:', error);
      throw error;
    }
  }

  /**
   * Obtiene eventos de catchup para un stream
   */
  async getCatchupEvents(epgStreamId) {
    try {
      const parameters = {
        epgStreamId: epgStreamId
      };
      const result = await this.call('getCatchupEvents', parameters);
      console.log('[CV] Eventos de catchup obtenidos:', result);
      return result;
    } catch (error) {
      console.error('[CV] Error en getCatchupEvents:', error);
      throw error;
    }
  }

  /**
   * Obtiene catchups grabados (recording tasks)
   */
  async getCatchupsRecorded() {
    try {
      const result = await this.call('getRecordingTasks', {});
      console.log('[CV] Catchups grabados obtenidos:', result);
      return result;
    } catch (error) {
      console.error('[CV] Error en getCatchupsRecorded:', error);
      throw error;
    }
  }

  /**
   * Graba o elimina un catchup
   */
  async recordOrDeleteCatchup(id, deleteCatchup = false) {
    try {
      let parameters;
      let funcName;
      if (deleteCatchup) {
        funcName = 'deleteRecordingTask';
        parameters = {
          recordingTaskId: id
        };
      } else {
        funcName = 'addRecordingTask';
        parameters = {
          mode: '4',
          catchupId: id
        };
      }
      const result = await this.call(funcName, parameters);
      console.log(`[CV] ${deleteCatchup ? 'Catchup eliminado' : 'Catchup grabado'}:`, result);
      return result;
    } catch (error) {
      console.error('[CV] Error en recordOrDeleteCatchup:', error);
      throw error;
    }
  }

  /**
   * Obtiene EPG desde una URL
   */
  async getEPG(url) {
    try {
      // Cancelar request anterior si existe
      if (this.epgRequest) {
        this.epgRequest.abort();
        this.epgRequest = null;
      }

      // Crear nuevo AbortController para este request
      const controller = new AbortController();
      this.epgRequest = controller;

      return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          controller.abort();
          this.epgRequest = null;
          reject(new Error('EPG request timeout'));
        }, 60000);

        try {
          const response = await fetch(url, {
            signal: controller.signal
          });

          clearTimeout(timeout);
          this.epgRequest = null;

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const text = await response.text();
          const json = JSON.parse(text);
          resolve(json);
        } catch (error) {
          clearTimeout(timeout);
          this.epgRequest = null;
          if (error.name === 'AbortError') {
            reject(new Error('EPG request was aborted'));
          } else {
            reject(error);
          }
        }
      });
    } catch (error) {
      console.error('[CV] Error en getEPG:', error);
      throw error;
    }
  }

  /**
   * Obtiene bibliotecas VOD
   */
  async getVOD() {
    try {
      const result = await this.call('getVodLibraries', {});
      console.log('[CV] Bibliotecas VOD obtenidas:', result);
      return result;
    } catch (error) {
      console.error('[CV] Error en getVOD:', error);
      throw error;
    }
  }

  /**
   * Obtiene contenido VOD con paginación
   */
  async getVODContent(offset = 0, limit = 100) {
    try {
      const parameters = {
        offset: offset,
        limit: limit
      };
      const result = await this.call('getVodContent', parameters);
      console.log('[CV] Contenido VOD obtenido:', result);
      return result;
    } catch (error) {
      console.error('[CV] Error en getVODContent:', error);
      throw error;
    }
  }

  /**
   * Obtiene información de una serie VOD
   */
  async getVodSeriesInfo(seriesId) {
    try {
      const parameters = {
        seriesId: seriesId
      };
      const result = await this.call('getVodSeriesInfo', parameters);
      console.log('[CV] Información de serie VOD obtenida:', result);
      return result;
    } catch (error) {
      console.error('[CV] Error en getVodSeriesInfo:', error);
      throw error;
    }
  }

  /**
   * Obtiene anuncios
   */
  async getAds() {
    try {
      const result = await this.call('getAds', {});
      console.log('[CV] Anuncios obtenidos:', result);
      return result;
    } catch (error) {
      console.error('[CV] Error en getAds:', error);
      throw error;
    }
  }

  /**
   * Obtiene OSMs (On Screen Messages)
   */
  async getOsms(lastKnownId = -1) {
    try {
      const parameters = {
        lastKnownId: lastKnownId
      };
      const result = await this.call('getOsms', parameters);
      console.log('[CV] OSMs obtenidos:', result);
      return result;
    } catch (error) {
      console.error('[CV] Error en getOsms:', error);
      throw error;
    }
  }

  /**
   * Obtiene URL M3U8 para VOD
   */
  getTopLevelVodM3u8Url(vodId) {
    if (!this.sessionId) {
      throw new Error('No hay sesión activa');
    }
    return `${this.baseUrl}index.php?requestMode=function&f=getVodM3u8&plain=true&vodId=${vodId}&sessionId=${this.sessionId}&m3u8`;
  }

  /**
   * Obtiene URL M3U8 para Catchup
   */
  getTopLevelCatchupM3u8Url(catchupId) {
    if (!this.sessionId) {
      throw new Error('No hay sesión activa');
    }
    return `${this.baseUrl}index.php?requestMode=function&f=getCatchupM3u8&plain=true&catchupId=${catchupId}&sessionId=${this.sessionId}&m3u8`;
  }

  /**
   * Obtiene URL M3U8 para Stream
   */
  getTopLevelStreamM3u8Url(streamId) {
    if (!this.sessionId) {
      throw new Error('No hay sesión activa');
    }
    return `${this.baseUrl}index.php?requestMode=function&f=getStreamM3u8&plain=true&streamId=${streamId}&sessionId=${this.sessionId}&m3u8`;
  }

  /**
   * Verifica si el usuario está logueado
   */
  async loggedIn() {
    try {
      const result = await this.call('loggedIn', {});
      return result;
    } catch (error) {
      console.error('[CV] Error en loggedIn:', error);
      throw error;
    }
  }

  /**
   * Verifica credenciales de login
   */
  async verifyLoginCredentials() {
    try {
      const result = await this.call('verifyLoginCredentials', {});
      return result;
    } catch (error) {
      console.error('[CV] Error en verifyLoginCredentials:', error);
      throw error;
    }
  }

  /**
   * Cierra sesión en el servidor
   */
  async logout() {
    try {
      if (this.sessionId) {
        await this.call('logout', {});
      }
      localStorage.removeItem('sessionId');
      localStorage.removeItem('cvClientConfig');
      localStorage.removeItem('cvLicenses');
      localStorage.removeItem('cvLicense');
      localStorage.removeItem('cvLicensePin');
      localStorage.removeItem('cvLicenseActivated');
      this.sessionId = null;
      console.log('[CV] Sesión cerrada');
    } catch (error) {
      console.error('[CV] Error en logout:', error);
      // Limpiar local storage incluso si falla el logout
      localStorage.removeItem('sessionId');
      localStorage.removeItem('cvClientConfig');
      localStorage.removeItem('cvLicenses');
      localStorage.removeItem('cvLicense');
      localStorage.removeItem('cvLicensePin');
      localStorage.removeItem('cvLicenseActivated');
      this.sessionId = null;
      throw error;
    }
  }

  /**
   * Obtiene parámetros de URL
   */
  getUrlParams(url) {
    const params = {};
    const parser = document.createElement('a');
    parser.href = url;
    const query = parser.search.substring(1);
    const vars = query.split('&');
    for (let i = 0; i < vars.length; i++) {
      const pair = vars[i].split('=');
      params[pair[0]] = decodeURIComponent(pair[1]);
    }
    return params;
  }

  /**
   * Hash MD5
   */
  hashMD5(val) {
    return CryptoJS.MD5(val).toString();
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
    loginParamOS: 'HTML5',
    appVersion: brandConfig.version || '1',
    branding: brandConfig.brand || 'Panaccess',
    lang: 'es',
    automaticActivation: brandConfig.automaticActivation || false,
  });
}

export default CVClient;

