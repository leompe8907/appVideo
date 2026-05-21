/**
 * Servicio para manejar conexiones con Panaccess
 * Patrón Singleton - Una sola instancia global
 */

import { createCVClient } from '../cv/cv';
import { retryOperation } from '../cv/errorClassifier';
import i18n from '../locales/i18n';
import * as userSession from '../utils/userSession';
import logger from '../utils/logger';

class PanaccessService {
  constructor() {
    this.client = null;
    this.brandConfig = null;
  }

  /**
   * Limpia cliente y config (p. ej. al cambiar de marca en la misma sesión).
   */
  reset() {
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

      const prevBrand = this.brandConfig?.brand;
      const nextBrand = brandConfig?.brand;
      if (prevBrand && nextBrand && prevBrand !== nextBrand) {
        this.reset();
      }

      this.brandConfig = brandConfig;
      this.client = createCVClient(brandConfig);
      this.client.lang = (i18n?.language || 'es').split('-')[0].toUpperCase();

      logger.log('[PanaccessService] Inicializado correctamente');
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
      logger.debugApi("Login", method, parameters);

      // Para clientLogin, usar init() del cliente
      if (method === 'clientLogin' && parameters.clientId && parameters.pwd) {
        const clientId = typeof parameters.clientId === 'string' ? parameters.clientId.trim() : parameters.clientId;
        const pwd = typeof parameters.pwd === 'string' ? parameters.pwd.trim() : parameters.pwd;
        const hashPassword = this.brandConfig.hashPasswordBeforeLogin !== false;
        const lang = (i18n?.language || 'es').split('-')[0].toUpperCase();
        await this.client.init({
          baseUrl: this.brandConfig.drm,
          apiToken: parameters.apiToken || this.brandConfig.token,
          username: clientId,
          password: pwd,
          hashPassword,
          os: this.brandConfig?.os || 'HTML5',
          appVersion: this.brandConfig?.appVersion || this.brandConfig?.version || '1',
          branding: this.brandConfig?.branding || 'Panaccess',
          lang,
          mode: 'json',
          fetchTimeout: 30000,
        });

        const sessionId = this.client.sessionId;
        logger.debugApi("Login Result", method, sessionId);
        if (!sessionId || (typeof sessionId === 'string' && sessionId.trim() === '') || (Array.isArray(sessionId) && sessionId.length === 0)) {
          throw new Error('No se recibió sesión. Verifica usuario y contraseña.');
        }
        return sessionId;
      } else {
        // Para otros métodos, usar call directamente
        const result = await this.client.call(method, parameters);
        logger.debugApi("Login Result", method, result);
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

    const sessionIdFromStorage = userSession.getSessionId();
    if (!this.client.isAuthenticated() && sessionIdFromStorage) {
      this.client.sessionId = sessionIdFromStorage;
      logger.log('[PanaccessService] SessionId restaurado desde storage de marca');
    }

    if (!this.client.isAuthenticated()) {
      throw new Error('No hay sesión activa. Inicia sesión primero.');
    }

    const apiCall = async () => {
      const sessionId = userSession.getSessionId();
      const udid = userSession.getUdidOrCreate();

      if (!sessionId) {
        const error = new Error("Falta el sessionId.");
        error.errorInfo = { type: 'VALIDATION_ERROR', canRetry: false };
        throw error;
      }

      // Metadatos comunes requeridos por algunos backends Panaccess
      const os = this.brandConfig?.os || 'HTML5';
      const appVersion = this.brandConfig?.appVersion || this.brandConfig?.version || '1';
      const branding = this.brandConfig?.branding || this.brandConfig?.appName || 'Panaccess';
      const apiToken = this.brandConfig?.token;
      const lang = (i18n?.language || 'es').split('-')[0].toUpperCase();

      parameters = {
        ...parameters,
        sessionId,
        os,
        appVersion,
        branding,
        l: lang,
      };

      // Token de API como en el cliente clásico (necesario para algunos métodos)
      if (apiToken) {
        parameters.apiToken = apiToken;
      }

      // Agregar udid si está disponible
      if (udid) {
        parameters.udid = udid;
      }

      logger.debugApi("Authenticated", method, parameters);
      const result = await this.client.call(method, parameters);
      logger.debugApi("Authenticated Result", method, result);
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
    const sessionIdFromStorage = userSession.getSessionId();
    if (sessionIdFromStorage) {
      this.client.sessionId = sessionIdFromStorage;
      this.client.os = this.brandConfig?.os || this.client.os || 'HTML5';
      this.client.appVersion = this.brandConfig?.appVersion || this.brandConfig?.version || this.client.appVersion || '1';
      this.client.branding = this.brandConfig?.branding || this.client.branding || 'Panaccess';
      this.client.lang = (i18n?.language || 'es').split('-')[0].toUpperCase();
    }
    return await this.client.validateSession();
  }

  /**
   * Cierra sesión
   */
  logout() {
    if (this.client) {
      this.client.logout();
      logger.log('[PanaccessService] Sesión cerrada');
    }
  }

  /**
   * Añade un video/episodio/temporada a la lista de seguimiento (watchlist).
   * sessionId lo gestiona callAuthenticatedApi (desde localStorage).
   * @param {Object} options - Opciones y parámetros del método.
   * @param {number} options.typeId - Tipo: 2=Movie, 3=Series, 4=Season, 5=Episode, 6=Stream, 7=Service, 8=Catchup, 9=App, 0=Generic.
   * @param {number} options.contentId - ID del contenido a añadir.
   * @param {string} [options.customData] - Datos adicionales (opcional). Máx. 10000 caracteres.
   * @param {number} [options.genericTypeId] - Subtipo para typeId Generic (opcional).
   * @param {string} [options.genericName] - Nombre para typeId Generic (opcional). Máx. 200 caracteres.
   * @param {string} [options.genericDescription] - Descripción para typeId Generic (opcional). Máx. 10000 caracteres.
   * @param {boolean} [options.enableRetry] - Ver callAuthenticatedApi.
   * @returns {Promise<number>} ID de la entrada creada en la watchlist.
   */
  async addToWatchlist(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const {
      typeId,
      contentId,
      customData,
      genericTypeId,
      genericName,
      genericDescription,
      ...apiOptions
    } = options;
    const params = { typeId, contentId };
    if (customData !== undefined && customData !== null) params.customData = customData;
    if (genericTypeId !== undefined && genericTypeId !== null) params.genericTypeId = genericTypeId;
    if (genericName !== undefined && genericName !== null) params.genericName = genericName;
    if (genericDescription !== undefined && genericDescription !== null) params.genericDescription = genericDescription;
    try {
      const result = await this.callAuthenticatedApi('cvAddToWatchlist', params, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al agregar el contenido a la lista de seguimiento.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Obtiene la configuración del cliente.
   * sessionId y udid los gestiona callAuthenticatedApi (desde localStorage).
   * @param {Object} options - Opciones de la llamada (ej. { enableRetry: false }).
   * @returns {Promise<Object>}
   */
  async getClientConfig(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    try {
      const result = await this.callAuthenticatedApi('getClientConfig', {}, options);
      return result;
    } catch (error) {
      const customError = new Error('Error al obtener la configuración del cliente.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Obtiene las licencias de streaming.
   * sessionId y udid los gestiona callAuthenticatedApi (desde localStorage).
   * @param {Object} options - Opciones de la llamada.
   * @param {boolean} [options.withPins=true] - Incluir pins en la respuesta.
   * @param {boolean} [options.enableRetry] - Ver callAuthenticatedApi.
   * @returns {Promise<Object>} Licencias devueltas por getStreamingLicenses.
   */
  async getStreamingLicenses(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { withPins = true, ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('getStreamingLicenses', {
        withPins
      }, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al obtener las licencias.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Establece una licencia de streaming.
   * sessionId y udid los gestiona callAuthenticatedApi (desde localStorage).
   * @param {Object} options - Opciones y parámetros del método.
   * @param {string} options.licenseKey - Clave de la licencia (requerido).
   * @param {string} options.pin - PIN (requerido).
   * @param {boolean} [options.failIfInUse=false] - Fallar si la licencia está en uso.
   * @param {boolean} [options.enableRetry] - Ver callAuthenticatedApi.
   * @returns {Promise<*>}
   */
  async setStreamingLicense(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { licenseKey, pin, failIfInUse = false, ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('setStreamingLicense', {
        licenseKey,
        pin,
        failIfInUse,
      }, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al establecer la licencia de streaming.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Crea un nuevo perfil.
   * sessionId y udid los gestiona callAuthenticatedApi (desde localStorage).
   * Lógica OTT: pasar license + pin (de una tarjeta disponible) para asignar esa licencia al perfil.
   * Alternativa: pasar assignNewLicense: true para que el backend asigne una licencia.
   * @param {Object} options - Opciones y parámetros del método.
   * @param {string} options.name - Nombre del perfil (requerido).
   * @param {number} options.imageId - ID de imagen (requerido).
   * @param {boolean} [options.assignNewLicense=false] - Asignar nueva licencia por backend (si no se pasa license).
   * @param {string} [options.license] - Clave de licencia (key de tarjeta); si se pasa, se usa con pin.
   * @param {string} [options.pin] - PIN de la tarjeta (requerido si se pasa license).
   * @param {boolean} [options.enableRetry] - Ver callAuthenticatedApi.
   * @returns {Promise<*>}
   */
  async createProfile(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { name, imageId, assignNewLicense = false, license, pin, ...apiOptions } = options;
    const hasLicense = license != null && String(license).trim() !== '';
    const params = { name, imageId };
    if (hasLicense) {
      params.license = String(license).trim();
      params.pin = pin != null ? String(pin) : '';
    } else {
      params.assignNewLicense = assignNewLicense;
    }
    try {
      const result = await this.callAuthenticatedApi('createProfile', params, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al crear el perfil.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Activar el perfil seleccionado.
   * sessionId y udid los gestiona callAuthenticatedApi (desde localStorage).
   * @param {Object} options - Opciones y parámetros del método.
   * @param {string} options.profileId - ID del perfil (requerido).
   * @param {boolean} options.activate - Activar el perfil (requerido).
   * @param {string} options.deviceName - Nombre del dispositivo (requerido).
   * @param {boolean} options.failIfInUse - Fallar si el perfil está en uso (requerido).
   * @param {string} options.pin - PIN (requerido).
   * @param {boolean} [options.enableRetry] - Ver callAuthenticatedApi.
   * @returns {Promise<*>}
   */
  async setActiveProfile(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { profileId, activate, deviceName, failIfInUse, pin, ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('setActiveProfile', {
        profileId,
        activate,
        deviceName,
        failIfInUse,
        pin,
      }, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al activar el perfil.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
  * Eliminar un perfil.
  * @param {Object} options - Opciones y parámetros del método.
  * @param {string} options.profileId - ID del perfil (requerido).
  * @returns {Promise<*>}
  */
  async deleteProfile(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { profileId, ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('deleteProfile', { profileId }, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al eliminar el perfil.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Cambiar el pin del perfil.
   * sessionId y udid los gestiona callAuthenticatedApi (desde localStorage).
   * @param {Object} options - Opciones de la llamada.
   * @param {number} [options.profileId] - ID del perfil.
   * @param {number} [options.pin] - PIN del perfil.
   * @returns {Promise<Object>} PIN cambiado.
   */
  async changeProfilePin(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { profileId, pin, ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('changeProfilePin', { profileId, pin }, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al cambiar el pin del perfil.');
      customError.cause = error;
      throw customError;
    }
  }

  /** 
   * Obtener lista de publicidad.
   * @param {Object} options - Opciones de la llamada.
   * @returns {Promise<Object>} Lista de publicidad.
   * 
  */
  async getAds(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('getAds', {}, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al obtener la lista de publicidad.');
      customError.cause = error;
      throw customError;
    }
  }

  /** 
   * Obtener los streams disponibles.
   * @param {Object} options - Opciones de la llamada.
   * @returns {Promise<Object>} Streams disponibles.
   */
  async getAvailableStreams(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('getAvailableStreams', { ip: true }, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al obtener los streams disponibles.');
      customError.cause = error;
      throw customError;
    }
  }

  /** 
   * Obtener la lista de bouquets disponibles.
   * @param {Object} options - Opciones de la llamada.
   * @returns {Promise<Object>} Lista de bouquets disponibles.
  */
  async getBouquets(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('getBouquets', {}, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al obtener la lista de bouquets disponibles.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Obtener lista de los eventos de catchups.
   * @param {Object} options - Opciones de la llamada.
   * @param {number} options.epgStreamId - ID del stream de EPG.
   * @returns {Promise<Object>} Lista de eventos de catchups.
   */
  async getCatchupEvents(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { epgStreamId, ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('getCatchupEvents', { epgStreamId }, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al obtener la lista de eventos de catchups.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Obtener servidores responsables (discovery). Puede no requerir sesión según backend.
   * @param {Object} options - mode, data1, enableRetry...
   * @returns {Promise<*>}
   */
  async getResponsibleServers(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { mode, data1, ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('getResponsibleServers', { mode, data1 }, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al obtener servidores responsables.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Obtener grupos de catchup.
   * @param {Object} options - Opciones de la llamada.
   * @returns {Promise<Object>}
   */
  async getCatchupGroups(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    try {
      const result = await this.callAuthenticatedApi('getCatchupGroups', {}, options);
      return result;
    } catch (error) {
      const customError = new Error('Error al obtener grupos de catchup.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Obtener tareas de grabación / catchups grabados.
   * @param {Object} options - Opciones de la llamada.
   * @returns {Promise<Object>}
   */
  async getRecordingTasks(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    try {
      const result = await this.callAuthenticatedApi('getRecordingTasks', {}, options);
      return result;
    } catch (error) {
      const customError = new Error('Error al obtener tareas de grabación.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Obtener bibliotecas VOD.
   * @param {Object} options - Opciones de la llamada.
   * @returns {Promise<Object>}
   */
  async getVodLibraries(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    try {
      const result = await this.callAuthenticatedApi('getVodLibraries', {}, options);
      return result;
    } catch (error) {
      const customError = new Error('Error al obtener bibliotecas VOD.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Obtener contenido VOD con paginación.
   * @param {Object} options - offset (default 0), limit (default 100), enableRetry...
   * @returns {Promise<Object>}
   */
  async getVodContent(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { offset = 0, limit = 100, ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('getVodContent', { offset, limit }, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al obtener contenido VOD.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Obtener información de una serie VOD.
   * @param {Object} options - options.seriesId (requerido), enableRetry...
   * @returns {Promise<Object>}
   */
  async getVodSeriesInfo(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { seriesId, ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('getVodSeriesInfo', { seriesId }, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al obtener información de la serie VOD.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Obtener OSMs (mensajes del sistema).
   * @param {Object} options - lastKnownId (default -1), enableRetry...
   * @returns {Promise<Object>}
   */
  async getOsms(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { lastKnownId = -1, ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('getOsms', { lastKnownId }, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al obtener OSMs.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Devuelve la URL M3u8 para reproducir un VOD.
   * @param {Object} options - options.vodId (requerido).
   * @returns {string} URL del stream.
   */
  getVodM3u8Url(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { vodId } = options;
    const sessionId = userSession.getSessionId() || this.client.sessionId || '';
    const base = (this.client.baseUrl || '').replace(/\/?$/, '');
    return `${base}/index.php?requestMode=function&f=getVodM3u8&plain=true&vodId=${vodId}&sessionId=${sessionId}&m3u8`;
  }

  /**
   * Devuelve la URL M3u8 para reproducir un catchup.
   * @param {Object} options - options.catchupId (requerido).
   * @returns {string} URL del stream.
   */
  getCatchupM3u8Url(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { catchupId } = options;
    const sessionId = userSession.getSessionId() || this.client.sessionId || '';
    const base = (this.client.baseUrl || '').replace(/\/?$/, '');
    return `${base}/index.php?requestMode=function&f=getCatchupM3u8&plain=true&catchupId=${catchupId}&sessionId=${sessionId}&m3u8`;
  }

  /**
   * Devuelve la URL M3u8 para reproducir un stream en vivo.
   * @param {Object} options - options.streamId (requerido).
   * @returns {string} URL del stream.
   */
  getStreamM3u8Url(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { streamId } = options;
    const sessionId = userSession.getSessionId() || this.client.sessionId || '';
    const base = (this.client.baseUrl || '').replace(/\/?$/, '');
    return `${base}/index.php?requestMode=function&f=getStreamM3u8&plain=true&streamId=${streamId}&sessionId=${sessionId}&m3u8`;
  }

  isWindMiddlewareHost(url) {
    return typeof url === 'string' && /middleware\.wind\.do/i.test(url);
  }

  /** Wind en navegador: m3u8 directo (requestMode=function del EPG → manifestParsingError en hls.js). */
  getDirectM3u8StreamUrl(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { streamId } = options;
    const sessionId = userSession.getSessionId() || this.client.sessionId || '';
    const base = (this.client.baseUrl || '').replace(/\/?$/, '');
    return `${base}/index.php?requestMode=m3u8&streamId=${encodeURIComponent(streamId)}&sessionId=${encodeURIComponent(sessionId)}`;
  }

  /**
   * Normaliza una URL de playback para asegurar que el sessionId sea el actual.
   * Paridad con legacy: `home.js:updateUrlSessionIfNeeded`.
   *
   * - Si la URL ya trae `sessionId=...`, lo reemplaza por el actual.
   * - Si NO trae sessionId, solo lo agrega para URLs tipo Panaccess `index.php?...&m3u8`
   *   (para no romper CDNs/URLs .m3u8 "reales" que no requieren sesión).
   *
   * @param {string} url
   * @returns {string}
   */
  normalizePlaybackUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (!this.client) return url;

    const currentSessionId = userSession.getSessionId() || this.client.sessionId || '';
    if (!currentSessionId) return url;

    let normalized = url;
    if (normalized.includes('sessionId=')) {
      normalized = normalized.replace(
        /sessionId=([^&]+)/,
        `sessionId=${encodeURIComponent(currentSessionId)}`,
      );
    }

    // Wind: getStreamM3u8 (function) no devuelve M3U8 en HTML5 (no EXTM3U).
    // El manifiesto válido es requestMode=m3u8&streamId&sessionId (descarga .ts).
    if (this.isWindMiddlewareHost(normalized)) {
      const windStream = normalized.match(/(?:^|[?&])streamId=([^&]+)/i);
      if (windStream?.[1]) {
        try {
          return this.getDirectM3u8StreamUrl({
            streamId: decodeURIComponent(windStream[1]),
          });
        } catch {
          // continuar
        }
      }
    }

    const lower = normalized.toLowerCase();
    const looksLikePanaccessFunction =
      lower.includes('index.php') &&
      lower.includes('requestmode=function') &&
      /(?:^|[?&])m3u8(?:=|&|$)/i.test(normalized);
    const looksLikeMiddlewareM3u8 =
      lower.includes('index.php') && lower.includes('requestmode=m3u8');

    if (looksLikeMiddlewareM3u8 && !normalized.includes('sessionId=')) {
      const streamMatch = normalized.match(/(?:^|[?&])streamId=([^&]+)/i);
      if (streamMatch?.[1]) {
        try {
          return this.getStreamM3u8Url({ streamId: streamMatch[1] });
        } catch {
          // fallback: inyectar sessionId abajo
        }
      }
    }

    if (!looksLikePanaccessFunction && !looksLikeMiddlewareM3u8) return normalized;
    if (normalized.includes('sessionId=')) return normalized;

    const [basePart, hashPart] = normalized.split('#');
    const glue = basePart.includes('?') ? '&' : '?';
    const withSession = `${basePart}${glue}sessionId=${encodeURIComponent(currentSessionId)}`;
    return hashPart != null ? `${withSession}#${hashPart}` : withSession;
  }

  /**
   * Añadir tarea de grabación (catchup).
   * @param {Object} options - mode (ej. "4"), catchupId, enableRetry...
   * @returns {Promise<*>}
   */
  async addRecordingTask(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { mode, catchupId, ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('addRecordingTask', { mode, catchupId }, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al añadir tarea de grabación.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Eliminar tarea de grabación.
   * @param {Object} options - recordingTaskId (requerido), enableRetry...
   * @returns {Promise<*>}
   */
  async deleteRecordingTask(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { recordingTaskId, ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('deleteRecordingTask', { recordingTaskId }, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al eliminar tarea de grabación.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Verificar si la sesión está logueada (loggedIn).
   * @param {Object} options - Opciones de la llamada.
   * @returns {Promise<*>}
   */
  async loggedIn(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    try {
      const result = await this.callAuthenticatedApi('loggedIn', {}, options);
      return result;
    } catch (error) {
      const customError = new Error('Error al verificar sesión.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Verificar credenciales de login.
   * @param {Object} options - Opciones de la llamada.
   * @returns {Promise<*>}
   */
  async verifyLoginCredentials(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    try {
      const result = await this.callAuthenticatedApi('verifyLoginCredentials', {}, options);
      return result;
    } catch (error) {
      const customError = new Error('Error al verificar credenciales.');
      customError.cause = error;
      throw customError;
    }
  }

  /**
   * Obtener entradas de la watchlist.
   * @param {Object} options - Parámetros opcionales (filtros según API), enableRetry...
   * @returns {Promise<Object>}
   */
  async getWatchlistEntries(options = {}) {
    if (!this.client) {
      throw new Error('Servicio no inicializado. Llama a initialize() primero.');
    }
    const { ...apiOptions } = options;
    try {
      const result = await this.callAuthenticatedApi('getWatchlistEntries', {}, apiOptions);
      return result;
    } catch (error) {
      const customError = new Error('Error al obtener la watchlist.');
      customError.cause = error;
      throw customError;
    }
  }








}

const panaccessService = new PanaccessService();
export default panaccessService;
