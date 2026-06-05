/**
 * Sesión de usuario centralizada por marca.
 * Credenciales, sessionId, udid y licencias viven en `{brand}.{key}`.
 */

import CryptoJS from 'crypto-js';
import getUdid from '../cv/udid';
import {
  clearBrandStorage,
  clearLegacyGlobalSessionKeys,
  getBrandItem,
  removeBrandItem,
  resolveBrandId,
  setBrandItem,
} from './brandStorage';
import { resetBrandStoresOnLogout } from './brandLogout';

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

function brandId(override) {
  return resolveBrandId(override);
}

export function getSecretKey() {
  return import.meta.env.VITE_SECRET_KEY;
}

function encryptStorageValue(value) {
  const key = getSecretKey();
  return CryptoJS.AES.encrypt(String(value), key).toString();
}

function decryptStorageValue(encrypted) {
  if (!encrypted) return '';
  const key = getSecretKey();
  try {
    const plain = CryptoJS.AES.decrypt(encrypted, key).toString(CryptoJS.enc.Utf8);
    return plain || '';
  } catch {
    return '';
  }
}

/**
 * Lee sessionId cifrado. Compatible con valores legacy en texto plano (migración automática).
 */
export function getSessionId(brand) {
  const raw = getBrandItem(brandId(brand), STORAGE_KEYS.sessionId) || '';
  if (!raw) return '';

  const decrypted = decryptStorageValue(raw);
  if (decrypted) return decrypted;

  // Legacy: sessionId guardado sin cifrar antes de Etapa 0
  return raw;
}

export function setSessionId(sessionId, brand) {
  const id = brandId(brand);
  if (sessionId != null && sessionId !== '') {
    setBrandItem(id, STORAGE_KEYS.sessionId, encryptStorageValue(sessionId));
  } else {
    removeBrandItem(id, STORAGE_KEYS.sessionId);
  }
}

/**
 * Guarda sesión tras login exitoso (credenciales se encriptan).
 * @param {{ username: string, password: string, sessionId: string, udid?: string, brandId?: string }}
 */
export function setLoggedIn({ username, password, sessionId, udid, brandId: brand }) {
  const id = brandId(brand);
  const key = getSecretKey();
  const encUser = CryptoJS.AES.encrypt(String(username).trim(), key).toString();
  const encPass = CryptoJS.AES.encrypt(String(password).trim(), key).toString();
  setBrandItem(id, STORAGE_KEYS.username, encUser);
  setBrandItem(id, STORAGE_KEYS.password, encPass);
  setSessionId(sessionId, id);
  const finalUdid = udid || getUdidOrCreate(id);
  setBrandItem(id, STORAGE_KEYS.udid, finalUdid);
}

/**
 * Obtiene udid de la marca; si no existe, genera uno y lo guarda.
 */
export function getUdidOrCreate(brand) {
  const id = brandId(brand);
  let udid = getBrandItem(id, STORAGE_KEYS.udid);
  if (!udid) {
    udid = getUdid(id);
    setBrandItem(id, STORAGE_KEYS.udid, udid);
  }
  return udid;
}

export function hasCredentials(brand) {
  const id = brandId(brand);
  const u = getBrandItem(id, STORAGE_KEYS.username);
  const p = getBrandItem(id, STORAGE_KEYS.password);
  return !!(u && u.length > 0 && p && p.length > 0);
}

/**
 * Devuelve { username, password } desencriptados o null si no hay credenciales válidas.
 */
export function getCredentials(brand) {
  if (!hasCredentials(brand)) return null;
  const id = brandId(brand);
  const key = getSecretKey();
  try {
    const encUser = getBrandItem(id, STORAGE_KEYS.username);
    const encPass = getBrandItem(id, STORAGE_KEYS.password);
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
 */
export function getCredentialsWithFallback(fallbackKey, brand) {
  const cred = getCredentials(brand);
  if (cred) return cred;
  if (!fallbackKey || !hasCredentials(brand)) return null;
  const id = brandId(brand);
  try {
    const encUser = getBrandItem(id, STORAGE_KEYS.username);
    const encPass = getBrandItem(id, STORAGE_KEYS.password);
    const username = CryptoJS.AES.decrypt(encUser, fallbackKey).toString(CryptoJS.enc.Utf8);
    const password = CryptoJS.AES.decrypt(encPass, fallbackKey).toString(CryptoJS.enc.Utf8);
    if (!username || !password) return null;
    return { username, password };
  } catch {
    return null;
  }
}

/**
 * Cierra sesión: borra todo el storage de la marca activa (credenciales, prefs, parental, etc.).
 * @param {{ brandId?: string }} options
 */
export function setLoggedOut(options = {}) {
  const id = brandId(options.brandId);
  clearBrandStorage(id);
  clearLegacyGlobalSessionKeys();
  resetBrandStoresOnLogout();
}

export function isAuthenticated(brand) {
  return !!getSessionId(brand);
}

// --- Licencias (para reactivación) ---

export function getLicenses(brand) {
  try {
    const raw = getBrandItem(brandId(brand), STORAGE_KEYS.licenses);
    if (raw == null || raw === '') return [];
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setLicenses(licenses, brand) {
  const id = brandId(brand);
  if (licenses == null) {
    removeBrandItem(id, STORAGE_KEYS.licenses);
    return;
  }
  setBrandItem(id, STORAGE_KEYS.licenses, JSON.stringify(Array.isArray(licenses) ? licenses : []));
}

export function getActiveLicense(brand) {
  const id = brandId(brand);
  const key = getBrandItem(id, STORAGE_KEYS.license);
  const pin = getBrandItem(id, STORAGE_KEYS.licensePin);
  return key && key.length > 0 ? { licenseKey: key, pin: pin || '' } : null;
}

export function setActiveLicense({ licenseKey, pin }, brand) {
  const id = brandId(brand);
  if (licenseKey != null && String(licenseKey).trim() !== '') {
    setBrandItem(id, STORAGE_KEYS.license, String(licenseKey).trim());
    setBrandItem(id, STORAGE_KEYS.licensePin, pin != null ? String(pin) : '');
  } else {
    removeBrandItem(id, STORAGE_KEYS.license);
    removeBrandItem(id, STORAGE_KEYS.licensePin);
  }
}

// --- Config del cliente (getClientConfig) ---

export function getClientConfig(brand) {
  try {
    const raw = getBrandItem(brandId(brand), STORAGE_KEYS.clientConfig);
    if (raw == null || raw === '') return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export function setClientConfig(config, brand) {
  const id = brandId(brand);
  if (config == null) {
    removeBrandItem(id, STORAGE_KEYS.clientConfig);
    return;
  }
  setBrandItem(id, STORAGE_KEYS.clientConfig, JSON.stringify(config));
}

function getEffectiveClientConfig(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return raw.answer ?? raw;
}

export function getEpgCdnUrl(brand) {
  const config = getEffectiveClientConfig(getClientConfig(brand));
  if (!config?.cdnServers?.length || config.epgCdnGroupId == null) return '';
  const cdn = config.epgCdnGroupId;
  const server = config.cdnServers.find((s) => String(s.id) === String(cdn));
  if (!server?.urls?.length) return '';
  return typeof server.urls[0] === 'string' ? server.urls[0] : '';
}

export function getOperatorName(brand) {
  const config = getEffectiveClientConfig(getClientConfig(brand));
  const op = config?.subscriber?.operator;
  return op != null && String(op).trim() !== '' ? String(op).trim() : '';
}

export { STORAGE_KEYS };
