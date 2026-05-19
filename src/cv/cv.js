import CryptoJS from "crypto-js";
import getUdid from "./udid";
import { createTimeoutPromise, classifyError } from "./errorClassifier";
import * as userSession from "../utils/userSession";

export let CV = {
  baseUrl: "",
  mode: "json",
  jsonpTimeout: 5000,
  fetchTimeout: 30000, // 30 segundos de timeout para fetch
  sessionId: null,
  apiToken: "",
  username: "",
  password: "",

  async init(options) {
    this.baseUrl = options.baseUrl || this.baseUrl;
    this.mode = ["json", "jsonp"].includes(options.mode) ? options.mode : "json";
    this.jsonpTimeout = options.jsonpTimeout || this.jsonpTimeout;
    this.fetchTimeout = options.fetchTimeout || this.fetchTimeout;

    this.username = options.username;
    this.password = options.password;
    this.apiToken = options.apiToken || this.apiToken;

    // Algunos backends (ej. intv) esperan contraseña en claro y hashean en servidor
    const hashPassword = options.hashPassword !== false;
    if (hashPassword) {
      const salt = "_panaccess";
      if (!/^[0-9a-f]{32}$/.test(this.password)) {
        this.password = CryptoJS.MD5(this.password + salt).toString();
      }
    }

    // Perform login
    try {
      await this.login(this.apiToken, this.username, this.password);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  },

  async call(funcName, parameters = {}) {
    const url = `${this.baseUrl}?f=${funcName}&requestMode=function`;

    if (this.sessionId && funcName !== "login") {
      parameters.sessionId = this.sessionId;
    }

    if (this.mode === "jsonp") {
      return this.callJsonp(url, parameters);
    } else {
      return this.callJson(url, parameters);
    }
  },

  async callJson(url, parameters) {
    const paramString = this.serialize(parameters);
    
    try {
      // Crear promise con timeout
      const fetchPromise = fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: paramString,
      });

      // Race entre fetch y timeout
      const response = await Promise.race([
        fetchPromise,
        createTimeoutPromise(this.fetchTimeout)
      ]);

      if (!response.ok) {
        const errorInfo = classifyError(new Error(`HTTP error! Status: ${response.status}`), response);
        const error = new Error(errorInfo.message);
        error.errorInfo = errorInfo;
        throw error;
      }

      const result = await response.json();
      if (!result.success) {
        const apiMessage = result.errorMessage || "Unknown error";
        const error = new Error(apiMessage);
        const errorInfo = classifyError(error);
        errorInfo.userMessage = apiMessage;
        error.errorInfo = errorInfo;
        throw error;
      }

      return result.answer;
    } catch (error) {
      // Si ya tiene errorInfo (ya fue clasificado), simplemente relanzarlo
      if (error.errorInfo) {
        throw error;
      }
      
      // Si no, clasificarlo ahora
      const errorInfo = classifyError(error);
      const classifiedError = new Error(errorInfo.message);
      classifiedError.errorInfo = errorInfo;
      classifiedError.originalError = error;
      throw classifiedError;
    }
  },

  callJsonp(url, parameters) {
    return new Promise((resolve, reject) => {
      const callbackName = `CVJSONP${Date.now()}`;
      const timeout = setTimeout(() => {
        delete window[callbackName];
        reject(new Error("Request timed out"));
      }, this.jsonpTimeout);

      window[callbackName] = (result) => {
        clearTimeout(timeout);
        delete window[callbackName];

        if (result.success) {
          resolve(result.answer);
        } else {
          reject(new Error(result.errorMessage || "Unknown error"));
        }
      };

      parameters.jsonp = `window.${callbackName}`;
      const paramString = this.serialize(parameters);
      const script = document.createElement("script");
      script.src = `${url}&${paramString}`;
      document.head.appendChild(script);
      document.head.removeChild(script);
    });
  },

  serialize(obj) {
    return Object.entries(obj)
      .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
      .join("&");
  },

  async login(apiToken, username, password) {
    try {
      const result = await this.call("clientLogin", {
        apiToken,
        clientId: username,
        pwd: password,
        udid: getUdid(),
      });
      // Normalizar: la API puede devolver string o array con un elemento
      let sessionId = result;
      if (Array.isArray(result)) {
        sessionId = result.length === 1 && typeof result[0] === "string" ? result[0] : null;
      }
      if (!sessionId || (typeof sessionId === "string" && sessionId.trim() === "")) {
        throw new Error("No se recibió sesión. Verifica usuario y contraseña.");
      }
      this.sessionId = sessionId;
      userSession.setSessionId(this.sessionId);
      return this.sessionId;
    } catch (error) {
      throw new Error("Login failed: " + error.message);
    }
  },

  logout() {
    userSession.setSessionId(null);
    this.sessionId = null;
  },

  /**
   * Valida si la sesión actual es válida
   */
  async validateSession() {
    try {
      // Hacer una llamada simple para validar
      await this.call("getCategories", {});
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Verifica si hay sesión activa
   */
  isAuthenticated() {
    return !!this.sessionId;
  },
};

/**
 * Factory: Crea instancia CV desde brandConfig
 * Inicializa el objeto CV con la configuración de la marca
 */
export function createCVClient(brandConfig) {
  if (!brandConfig) {
    throw new Error("brandConfig es requerido");
  }

  // Crear una nueva instancia del objeto CV
  const cvInstance = Object.create(CV);
  
  // Inicializar con la configuración del brand
  cvInstance.baseUrl = brandConfig.drm || "";
  cvInstance.apiToken = brandConfig.token || "";
  cvInstance.mode = "json";
  cvInstance.jsonpTimeout = 5000;
  cvInstance.fetchTimeout = 30000;
  cvInstance.sessionId = null;

  return cvInstance;
}

export default CV;
