import {
  detectTvVendorFromApis,
  hasLgTvRuntime,
  hasSamsungTvRuntime,
} from '../../utils/tvPlatformApis.js';

export const ENGINE_PLATFORM = Object.freeze({
  WEB: 'web',
  LG: 'lg',
  SAMSUNG: 'samsung',
});

export const ENGINE_POLICY = Object.freeze({
  AUTO: 'auto',
  FORCE_WEB: 'force-web',
  FORCE_LG: 'force-lg',
  FORCE_SAMSUNG: 'force-samsung',
});

function readForcedEngineFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = String(params.get('engine') || '').toLowerCase();
    if (value === ENGINE_PLATFORM.WEB || value === ENGINE_PLATFORM.LG || value === ENGINE_PLATFORM.SAMSUNG) {
      localStorage.setItem('player.engine', value);
      return value;
    }
  } catch {
    // noop
  }
  return null;
}

function readForcedEngineFromStorage() {
  try {
    const value = String(localStorage.getItem('player.engine') || '').toLowerCase();
    if (value === ENGINE_PLATFORM.WEB || value === ENGINE_PLATFORM.LG || value === ENGINE_PLATFORM.SAMSUNG) {
      return value;
    }
  } catch {
    // noop
  }
  return null;
}

function readDebugNativeAdaptersOverride() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = String(params.get('nativeAdapters') || '').toLowerCase();
    if (fromUrl === '1' || fromUrl === 'true') {
      localStorage.setItem('player.nativeAdaptersEnabled', 'true');
      return true;
    }
    if (fromUrl === '0' || fromUrl === 'false') {
      localStorage.setItem('player.nativeAdaptersEnabled', 'false');
      return false;
    }
    const fromStorage = String(localStorage.getItem('player.nativeAdaptersEnabled') || '').toLowerCase();
    if (fromStorage === 'true') return true;
    if (fromStorage === 'false') return false;
  } catch {
    // noop
  }
  return null;
}

function detectLgFromUserAgent(ua) {
  return ua.includes('webos') || ua.includes('netcast') || (ua.includes('lg') && ua.includes('tv'));
}

function detectSamsungFromUserAgent(ua) {
  return ua.includes('tizen') || (ua.includes('samsung') && ua.includes('tv'));
}

function logEngineResolution(meta) {
  try {
    const payload = JSON.stringify(meta);
    if (import.meta.env.DEV) {
      console.log('[EnginePlatform]', meta);
    } else {
      console.info('[EnginePlatform]', payload);
    }
  } catch {
    // noop
  }
}

/**
 * Resuelve la plataforma del motor de reproducción.
 * Prioridad: override URL/storage → política de marca → APIs nativas → User-Agent.
 *
 * @param {Object} deviceInfo
 * @returns {string} ENGINE_PLATFORM.*
 */
export function resolveEnginePlatform(deviceInfo) {
  const result = resolveEnginePlatformDetailed(deviceInfo);
  return result.platform;
}

/**
 * Igual que resolveEnginePlatform pero expone el criterio de decisión (debug/TV).
 */
export function resolveEnginePlatformDetailed(deviceInfo) {
  const forced = readForcedEngineFromUrl() || readForcedEngineFromStorage();
  if (forced) {
    const meta = { platform: forced, reason: 'forced', source: 'url-or-storage' };
    logEngineResolution(meta);
    return meta;
  }

  const brandEnginePolicy = String(deviceInfo?.brandPlayerPolicy || ENGINE_POLICY.AUTO).toLowerCase();
  if (brandEnginePolicy === ENGINE_POLICY.FORCE_WEB) {
    const meta = { platform: ENGINE_PLATFORM.WEB, reason: 'brand-policy', source: 'force-web' };
    logEngineResolution(meta);
    return meta;
  }
  if (brandEnginePolicy === ENGINE_POLICY.FORCE_LG) {
    const meta = { platform: ENGINE_PLATFORM.LG, reason: 'brand-policy', source: 'force-lg' };
    logEngineResolution(meta);
    return meta;
  }
  if (brandEnginePolicy === ENGINE_POLICY.FORCE_SAMSUNG) {
    const meta = { platform: ENGINE_PLATFORM.SAMSUNG, reason: 'brand-policy', source: 'force-samsung' };
    logEngineResolution(meta);
    return meta;
  }

  const ua = String(deviceInfo?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).toLowerCase();
  const isTV = !!deviceInfo?.isTV;
  const debugNativeAdaptersOverride = readDebugNativeAdaptersOverride();
  const nativeAdaptersEnabled =
    debugNativeAdaptersOverride == null
      ? deviceInfo?.nativeAdaptersEnabled === true
      : debugNativeAdaptersOverride;

  if (!nativeAdaptersEnabled || !isTV) {
    const meta = {
      platform: ENGINE_PLATFORM.WEB,
      reason: !nativeAdaptersEnabled ? 'native-adapters-disabled' : 'not-tv',
      source: 'fallback-web',
      isTV,
      nativeAdaptersEnabled,
    };
    logEngineResolution(meta);
    return meta;
  }

  const apiVendor = detectTvVendorFromApis();
  const apiSamsung = hasSamsungTvRuntime();
  const apiLg = hasLgTvRuntime();
  const uaSamsung = detectSamsungFromUserAgent(ua);
  const uaLg = detectLgFromUserAgent(ua);

  // APIs nativas tienen prioridad sobre UA (emuladores / firmware con UA genérico)
  const looksLikeSamsung = apiSamsung || apiVendor === 'samsung' || uaSamsung;
  const looksLikeLG = apiLg || apiVendor === 'lg' || uaLg;

  if (looksLikeLG && !looksLikeSamsung) {
    const meta = {
      platform: ENGINE_PLATFORM.LG,
      reason: 'auto',
      source: apiLg || apiVendor === 'lg' ? 'api' : 'user-agent',
      apiSamsung,
      apiLg,
      uaSamsung,
      uaLg,
    };
    logEngineResolution(meta);
    return meta;
  }

  if (looksLikeSamsung && !looksLikeLG) {
    const meta = {
      platform: ENGINE_PLATFORM.SAMSUNG,
      reason: 'auto',
      source: apiSamsung || apiVendor === 'samsung' ? 'api' : 'user-agent',
      apiSamsung,
      apiLg,
      uaSamsung,
      uaLg,
    };
    logEngineResolution(meta);
    return meta;
  }

  if (looksLikeLG && looksLikeSamsung) {
    const meta = {
      platform: ENGINE_PLATFORM.WEB,
      reason: 'ambiguous-tv-signals',
      source: 'api+ua-conflict',
      apiVendor,
      apiSamsung,
      apiLg,
      uaSamsung,
      uaLg,
    };
    logEngineResolution(meta);
    return meta;
  }

  const meta = {
    platform: ENGINE_PLATFORM.WEB,
    reason: 'no-tv-vendor-detected',
    source: 'fallback-web',
    apiSamsung,
    apiLg,
    uaSamsung,
    uaLg,
  };
  logEngineResolution(meta);
  return meta;
}
