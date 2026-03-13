/**
 * Sesión de usuario centralizada.
 * Una sola fuente de verdad para sessionId, credenciales, udid y datos de licencia.
 */

import CryptoJS from 'crypto-js';
import getUdid from '../cv/udid';

const STORAGE_KEYS = {
  sessionId: 'sessionId',
  username: 'username',
  password: 'password',
  udid: 'udid',
  clientConfig: 'clientConfig',
  licenses: 'licenses',
  license: 'license',
  licensePin: 'licensePin',
};

export function getSecretKey() {
  return import.meta.env.VITE_SECRET_KEY || 'default-secret-key-change-me';
}

export function getSessionId() {
  return localStorage.getItem(STORAGE_KEYS.sessionId) || '';
}

export function setSessionId(sessionId) {
  if (sessionId != null && sessionId !== '') {
    localStorage.setItem(STORAGE_KEYS.sessionId, String(sessionId));
  } else {
    localStorage.removeItem(STORAGE_KEYS.sessionId);
  }
}

/**
 * Guarda sesión tras login exitoso (credenciales se encriptan).
 * @param {{ username: string, password: string, sessionId: string, udid?: string }}
 */
export function setLoggedIn({ username, password, sessionId, udid }) {
  const key = getSecretKey();
  const encUser = CryptoJS.AES.encrypt(String(username).trim(), key).toString();
  const encPass = CryptoJS.AES.encrypt(String(password).trim(), key).toString();
  localStorage.setItem(STORAGE_KEYS.username, encUser);
  localStorage.setItem(STORAGE_KEYS.password, encPass);
  setSessionId(sessionId);
  const finalUdid = udid || getUdidOrCreate();
  localStorage.setItem(STORAGE_KEYS.udid, finalUdid);
}

/**
 * Obtiene udid; si no existe, genera uno y lo guarda.
 */
export function getUdidOrCreate() {
  let udid = localStorage.getItem(STORAGE_KEYS.udid);
  if (!udid) {
    udid = getUdid();
    localStorage.setItem(STORAGE_KEYS.udid, udid);
  }
  return udid;
}

export function hasCredentials() {
  const u = localStorage.getItem(STORAGE_KEYS.username);
  const p = localStorage.getItem(STORAGE_KEYS.password);
  return !!(u && u.length > 0 && p && p.length > 0);
}

/**
 * Devuelve { username, password } desencriptados o null si no hay credenciales válidas.
 */
export function getCredentials() {
  if (!hasCredentials()) return null;
  const key = getSecretKey();
  try {
    const encUser = localStorage.getItem(STORAGE_KEYS.username);
    const encPass = localStorage.getItem(STORAGE_KEYS.password);
    const username = CryptoJS.AES.decrypt(encUser, key).toString(CryptoJS.enc.Utf8);
    const password = CryptoJS.AES.decrypt(encPass, key).toString(CryptoJS.enc.Utf8);
    if (!username || !password) return null;
    return { username, password };
  } catch {
    return null;
  }
}

/**
 * Intenta obtener credenciales con SECRET_KEY; si falla, prueba con fallbackKey (ej. brand.token).
 * Útil para migración de credenciales encriptadas con la clave antigua.
 */
export function getCredentialsWithFallback(fallbackKey) {
  const cred = getCredentials();
  if (cred) return cred;
  if (!fallbackKey || !hasCredentials()) return null;
  try {
    const encUser = localStorage.getItem(STORAGE_KEYS.username);
    const encPass = localStorage.getItem(STORAGE_KEYS.password);
    const username = CryptoJS.AES.decrypt(encUser, fallbackKey).toString(CryptoJS.enc.Utf8);
    const password = CryptoJS.AES.decrypt(encPass, fallbackKey).toString(CryptoJS.enc.Utf8);
    if (!username || !password) return null;
    return { username, password };
  } catch {
    return null;
  }
}

/**
 * Cierra sesión y limpia datos de sesión y opcionalmente licencia/config.
 * @param {{ clearLicense?: boolean, clearClientConfig?: boolean }}
 */
export function setLoggedOut(options = {}) {
  const { clearLicense = true, clearClientConfig = true } = options;
  localStorage.removeItem(STORAGE_KEYS.sessionId);
  localStorage.removeItem(STORAGE_KEYS.username);
  localStorage.removeItem(STORAGE_KEYS.password);
  localStorage.removeItem(STORAGE_KEYS.udid);
  if (clearLicense) {
    localStorage.removeItem(STORAGE_KEYS.licenses);
    localStorage.removeItem(STORAGE_KEYS.license);
    localStorage.removeItem(STORAGE_KEYS.licensePin);
  }
  if (clearClientConfig) {
    localStorage.removeItem(STORAGE_KEYS.clientConfig);
  }
}

export function isAuthenticated() {
  return !!getSessionId();
}

// --- Licencias (para reactivación) ---

export function getLicenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.licenses);
    if (raw == null || raw === '') return [];
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setLicenses(licenses) {
  if (licenses == null) {
    localStorage.removeItem(STORAGE_KEYS.licenses);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.licenses, JSON.stringify(Array.isArray(licenses) ? licenses : []));
}

export function getActiveLicense() {
  const key = localStorage.getItem(STORAGE_KEYS.license);
  const pin = localStorage.getItem(STORAGE_KEYS.licensePin);
  return key && key.length > 0 ? { licenseKey: key, pin: pin || '' } : null;
}

export function setActiveLicense({ licenseKey, pin }) {
  if (licenseKey != null && String(licenseKey).trim() !== '') {
    localStorage.setItem(STORAGE_KEYS.license, String(licenseKey).trim());
    localStorage.setItem(STORAGE_KEYS.licensePin, pin != null ? String(pin) : '');
  } else {
    localStorage.removeItem(STORAGE_KEYS.license);
    localStorage.removeItem(STORAGE_KEYS.licensePin);
  }
}

// --- Config del cliente (getClientConfig) ---

export function getClientConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.clientConfig);
    if (raw == null || raw === '') return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export function setClientConfig(config) {
  if (config == null) {
    localStorage.removeItem(STORAGE_KEYS.clientConfig);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.clientConfig, JSON.stringify(config));
}

/**
 * Config efectivo: el backend puede devolver { answer: config }; usamos config.answer ?? config.
 * @param {Object} raw
 * @returns {Object|null}
 */
function getEffectiveClientConfig(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return raw.answer ?? raw;
}

/**
 * Obtiene la URL del CDN de EPG a partir del config del cliente (getClientConfig).
 * Equivalente a User.epgCdnUrl en el proyecto EPG (setConfig → epgCdnGroupId + cdnServers).
 * @returns {string}
 */
export function getEpgCdnUrl() {
  const config = getEffectiveClientConfig(getClientConfig());
  if (!config?.cdnServers?.length || config.epgCdnGroupId == null) return '';
  const cdn = config.epgCdnGroupId;
  const server = config.cdnServers.find((s) => String(s.id) === String(cdn));
  if (!server?.urls?.length) return '';
  return typeof server.urls[0] === 'string' ? server.urls[0] : '';
}

/**
 * Obtiene el nombre del operador a partir del config del cliente (getClientConfig).
 * Equivalente a User.operatorName en el proyecto EPG (setConfig → subscriber.operator).
 * @returns {string}
 */
export function getOperatorName() {
  const config = getEffectiveClientConfig(getClientConfig());
  const op = config?.subscriber?.operator;
  return op != null && String(op).trim() !== '' ? String(op).trim() : '';
}

export { STORAGE_KEYS };
