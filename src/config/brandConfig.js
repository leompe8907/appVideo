import { getBrandConfig } from "./brands";
import { DEFAULT_BRAND } from "./defaultBrand";
import { getBrandAsset } from "../utils/assetLoader";
import { invalidateHomeBackgroundCache } from "../utils/config";
import { getSplashPath, getSplashVideoPath } from "../utils/splashLoader";

const isDev = import.meta.env.DEV;

/** Parámetros EPG compartidos por todos los clientes (API de guía de programación) */
export const EPG_SHARED = {
  epgApiKey: "724aa4b262071d28844ac2fa85fe7eb198d9cb819c8913f6769b2b48a56a1f61",
  epgApiToken: "OMGRUhcoXKFqnpzZEfrF",
};

/** Caché en memoria por brand para evitar trabajo repetido en la misma sesión */
let _cache = { key: null, config: null };

/**
 * Resuelve el identificador de marca activo (sin enriquecer).
 * Prioridad: URL param > localStorage > Default Brand > "bromteck"
 * @returns {{ brandId: string, from: 'url'|'storage'|'default'|'fallback' }}
 */
function resolveBrandKey() {
  const urlParams = new URLSearchParams(window.location.search);
  const brandFromUrl = urlParams.get("brand");
  if (brandFromUrl) {
    const config = getBrandConfig(brandFromUrl);
    if (config) return { brandId: brandFromUrl, from: "url" };
    if (isDev) console.warn(`[Brand] No encontrado en URL: ${brandFromUrl}`);
  }

  const brandFromStorage = localStorage.getItem("brand");
  if (brandFromStorage) {
    const config = getBrandConfig(brandFromStorage);
    if (config) return { brandId: brandFromStorage, from: "storage" };
    if (isDev) console.warn(`[Brand] Brand en localStorage inválido: ${brandFromStorage}`);
    localStorage.removeItem("brand");
  }

  if (DEFAULT_BRAND && getBrandConfig(DEFAULT_BRAND)) {
    return { brandId: DEFAULT_BRAND, from: "default" };
  }

  return { brandId: "wind", from: "fallback" };// aca se cambio el brand por defecto
}

/**
 * Obtiene la configuración activa de la marca.
 * Prioridad: URL param > localStorage > Default Brand > Primera marca.
 * Usa caché en memoria para la misma resolución de brand y evita re-enriquecer.
 */
export function getActiveBrandConfig() {
  const { brandId, from } = resolveBrandKey();
  if (_cache.key === brandId && _cache.config) {
    return _cache.config;
  }

  const config = getBrandConfig(brandId);
  if (!config) {
    if (isDev) console.warn("[Brand] Usando fallback: bromteck");
    const fallback = getBrandConfig("bromteck");
    const enriched = enrichConfigWithAssets(fallback);
    if (enriched) {
      localStorage.setItem("brand", "bromteck");
      _cache = { key: "bromteck", config: enriched };
    }
    return enriched || null;
  }

  if (from === "url") localStorage.setItem("brand", brandId);
  if (from === "default") localStorage.setItem("brand", DEFAULT_BRAND);
  if (from === "fallback") localStorage.setItem("brand", "bromteck");

  if (isDev) {
    console.log(`[Brand] Cargado desde ${from}: ${brandId}`);
  }

  const enriched = enrichConfigWithAssets(config);
  _cache = { key: brandId, config: enriched };
  return enriched;
}

/**
 * Valida que la configuración de marca tenga campos mínimos.
 * @param {Object} config
 * @returns {string[]} Claves faltantes o inválidas
 */
export function validateBrandConfig(config) {
  if (!config || typeof config !== 'object') return ['config'];
  const required = ['brand', 'appName', 'drm', 'token'];
  return required.filter(function (k) {
    const v = config[k];
    return v == null || (typeof v === 'string' && v.trim() === '');
  });
}

/**
 * Invalida la caché (útil tras changeBrand sin reload).
 */
export function invalidateBrandCache() {
  _cache = { key: null, config: null };
  invalidateHomeBackgroundCache();
}

/**
 * Enriquece la configuración con rutas de assets.
 * Exportado para reutilizar en BrandContext y evitar duplicar la construcción de assets.
 * @param {Object} config - Configuración base de la marca (de brands.js)
 * @returns {Object|null} Config con assets o null
 */
export function enrichConfigWithAssets(config) {
  if (!config) return null;

  const splashAnimado = config.ui?.splashAnimado === true || config.splashAnimado === true;
  const splashPath = getSplashPath(config.brand, splashAnimado);
  const splashVideoRaw = config.ui?.splashVideo || config.splashVideo || null;
  const splashVideoPath = splashAnimado ? getSplashVideoPath(config.brand, splashVideoRaw) : null;

  const parental = {
    // TTL por defecto para unlock global cuando hay múltiples canales con parentalControl:true
    // dentro del mismo bouquet. Se puede sobreescribir por marca en brands.js
    parentalControlMultiTtlMs: config.parental?.parentalControlMultiTtlMs ?? 40 * 60 * 1000,
    ...(config.parental || {}),
  };

  const EPG = {
    // Recordatorios EPG: segundos antes de start para mostrar popup.
    // Se puede sobreescribir por marca en brands.js (config.EPG.reminderLeadSeconds).
    reminderLeadSeconds: config.EPG?.reminderLeadSeconds ?? 60,
    // Recordatorios EPG: si false, no mostrar popup mientras el player está reproduciendo.
    reminderShowWhilePlaying: config.EPG?.reminderShowWhilePlaying === true,
    ...(config.EPG || {}),
  };

  const login = config.login || {};
  const derivedQrRegister = login.qrRegister || config.qrRegister;
  const derivedUdidLogin = login.udid || config.udidLogin;

  return {
    ...config,
    ...EPG_SHARED,
    login: {
      ...login,
      qrRegister: derivedQrRegister,
      udid: derivedUdidLogin,
    },
    // Compatibilidad: mientras migra el resto del código, mantenemos llaves top-level.
    qrRegister: derivedQrRegister,
    udidLogin: derivedUdidLogin,
    parental,
    EPG,
    assets: {
      logo: getBrandAsset(config.brand, "logo.png"),
      logoWhite: getBrandAsset(config.brand, "logo-white.png"),
      logoTop: getBrandAsset(config.brand, "logo-top.png"),
      logoBlack: getBrandAsset(config.brand, "logo_black.png"),
      background: getBrandAsset(config.brand, "background.png"),
      favicon: getBrandAsset(config.brand, "favicon.ico"),
      splash: splashPath,
      splashVideo: splashVideoPath,
      placeholder: getBrandAsset(config.brand, "placeholder_220x160.png"),
      get: (path) => getBrandAsset(config.brand, path),
    },
  };
}

/**
 * Helper para uso fuera de React. No es reactivo.
 * Dentro de componentes prefiere useBrand() del BrandContext.
 */
export function useBrandConfig() {
  return getActiveBrandConfig();
}

