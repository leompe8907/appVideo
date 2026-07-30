import { getBrandConfig } from "./brands";
import { DEFAULT_BRAND } from "./defaultBrand";
import { getBrandAsset } from "../utils/assetLoader";
import { invalidateHomeBackgroundCache } from "../utils/config";
import { getSplashPath, getSplashPosterPath, getSplashVideoPath } from "../utils/splashLoader";

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
 * Prioridad: URL param > localStorage > Default Brand > fallback interno
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
    const fallbackBrand = DEFAULT_BRAND || "wind";
    if (isDev) console.warn(`[Brand] Usando fallback: ${fallbackBrand}`);
    const fallback = getBrandConfig(fallbackBrand);
    const enriched = enrichConfigWithAssets(fallback);
    if (enriched) {
      localStorage.setItem("brand", fallbackBrand);
      _cache = { key: fallbackBrand, config: enriched };
    }
    return enriched || null;
  }

  if (from === "url") localStorage.setItem("brand", brandId);
  if (from === "default") localStorage.setItem("brand", DEFAULT_BRAND);
  if (from === "fallback") localStorage.setItem("brand", brandId);

  if (isDev) {
    console.log(`[Brand] Cargado desde ${from}: ${brandId}`);
  }

  const enriched = enrichConfigWithAssets(config);
  _cache = { key: brandId, config: enriched };
  return enriched;
}

/**
 * ¿La marca activa tiene habilitada la sección de Control Parental
 * (`brand.account.sections.parentalControl`)? Default `true` si la marca no
 * define `sections` (retro-compatible con marcas configuradas antes de este
 * flag). Única función para esta pregunta en toda la app: la consultan tanto
 * componentes React (pasando el `currentBrand` de `useBrand()`) como stores
 * fuera de React (pasando `getActiveBrandConfig()`), para que el gate sea
 * consistente en todos los puntos donde aparece la funcionalidad: la página
 * de configuración (`ParentalSettingsPage.jsx`), el botón en Mi Cuenta, el
 * candado del reproductor (`PlayerHud.jsx`), el ícono de bloqueo en las
 * tarjetas de canal, y el gate de PIN antes de reproducir
 * (`parentalStore.js` / `parentalGateStore.js`).
 * @param {Object} brandConfig
 * @returns {boolean}
 */
export function isParentalControlEnabledForBrand(brandConfig) {
  return (brandConfig?.account?.sections?.parentalControl ?? true) !== false;
}

/**
 * Resuelve el modo del shell Home ("sidebar" | "topbar") para la marca activa,
 * de forma independiente por plataforma (`brand.layout.shell.pc` / `.tv`).
 * Default "sidebar" en ambas si la marca no define `layout` (retro-compatible
 * con las marcas configuradas antes de este flag). Única función para esta
 * pregunta en toda la app: la consulta `HomePage.jsx` para decidir si monta
 * `<Sidebar>` o `<Topbar>`.
 * @param {Object} brandConfig
 * @param {boolean} isTV
 * @returns {'sidebar'|'topbar'}
 */
export function resolveShellMode(brandConfig, isTV) {
  const mode = isTV ? brandConfig?.layout?.shell?.tv : brandConfig?.layout?.shell?.pc;
  return mode === 'topbar' ? 'topbar' : 'sidebar';
}

/**
 * Resuelve qué contenido ("logo" | "nav" | "account" | "none") va en cada
 * zona del Topbar (`brand.layout.topbar.areas.{left,center,right}`), siguiendo
 * el mismo patrón que `header.areas`. Defaults: logo/nav/account tal como se
 * ve en el mock de referencia (Wind).
 * @param {Object} brandConfig
 * @returns {{left: string, center: string, right: string}}
 */
export function resolveTopbarAreas(brandConfig) {
  const areas = brandConfig?.layout?.topbar?.areas || {};
  return {
    left: areas.left?.content || 'logo',
    center: areas.center?.content || 'nav',
    right: areas.right?.content || 'account',
  };
}

/**
 * ¿Debe montarse `InicioHeader` (cabecera de contenido con logo/hora/info de
 * canal) para esta sección de Home? Lee `brand.homeShell.header.[sectionKey]`
 * (boolean, decide en qué páginas de Home aparece — igual para PC y TV; en la
 * práctica hoy todas las marcas lo dejan igual en las 4 páginas). Si la marca
 * no define nada, cae al fallback histórico: activo en
 * inicio/serviciosTvRadio/vod/catchup.
 *
 * El "en qué plataforma" es una pregunta distinta — la resuelve
 * `resolveHeaderActivado()` — para no mezclar "en qué página" con "en qué
 * plataforma" en el mismo flag.
 * @param {Object} brandConfig
 * @param {'inicio'|'serviciosTvRadio'|'vod'|'catchup'|null} sectionKey
 * @returns {boolean}
 */
export function resolveHomeShellHeaderEnabled(brandConfig, sectionKey) {
  if (!sectionKey) return false;
  const fallback =
    sectionKey === 'inicio' ||
    sectionKey === 'serviciosTvRadio' ||
    sectionKey === 'vod' ||
    sectionKey === 'catchup';

  const raw = brandConfig?.homeShell?.header?.[sectionKey];
  return raw == null ? fallback : Boolean(raw);
}

/**
 * ¿Está activo el módulo `InicioHeader` (fila logo/hora) en esta plataforma?
 * Lee `brand.header.activado.{pc,tv}`, colocado junto a `brand.header.areas`
 * (lo que gobierna) en vez de en `homeShell` (que solo decide en qué
 * páginas). Pensado para marcas con Topbar en PC: ahí ya no hace falta esta
 * cabecera (el Topbar ya muestra logo/nav/cuenta), pero en TV sigue haciendo
 * falta porque el Sidebar no la reemplaza. Default `true` en ambas si la
 * marca no define `activado` (retro-compatible).
 * Se combina con `resolveHomeShellHeaderEnabled()`: el header se monta solo
 * si la página lo tiene Y la plataforma lo tiene.
 * @param {Object} brandConfig
 * @param {boolean} isTV
 * @returns {boolean}
 */
export function resolveHeaderActivado(brandConfig, isTV) {
  const activado = brandConfig?.header?.activado;
  if (activado == null) return true;
  const perPlatform = isTV ? activado.tv : activado.pc;
  return perPlatform ?? true;
}

/**
 * ¿Está activa la subcabecera (panel "Ahora/Siguiente" del canal enfocado,
 * solo en Inicio) en esta plataforma? Lee `brand.header.subheader.activado`,
 * independiente de `resolveHeaderActivado()`: permite apagar solo el panel
 * de info de canal sin apagar la fila logo/hora, o viceversa. Se combina con
 * `brand.header.subheader.enabled` (interruptor general ya existente) — el
 * panel se muestra solo si ambos lo permiten. Default `true` en ambas si la
 * marca no define `activado`.
 * @param {Object} brandConfig
 * @param {boolean} isTV
 * @returns {boolean}
 */
export function resolveSubheaderActivado(brandConfig, isTV) {
  const activado = brandConfig?.header?.subheader?.activado;
  if (activado == null) return true;
  const perPlatform = isTV ? activado.tv : activado.pc;
  return perPlatform ?? true;
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
      splashPoster: getSplashPosterPath(config.brand),
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

