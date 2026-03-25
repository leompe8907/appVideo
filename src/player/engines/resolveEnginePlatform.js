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

export function resolveEnginePlatform(deviceInfo) {
  const forced = readForcedEngineFromUrl() || readForcedEngineFromStorage();
  if (forced) return forced;

  const brandEnginePolicy = String(deviceInfo?.brandPlayerPolicy || ENGINE_POLICY.AUTO).toLowerCase();
  if (brandEnginePolicy === ENGINE_POLICY.FORCE_WEB) return ENGINE_PLATFORM.WEB;
  if (brandEnginePolicy === ENGINE_POLICY.FORCE_LG) return ENGINE_PLATFORM.LG;
  if (brandEnginePolicy === ENGINE_POLICY.FORCE_SAMSUNG) return ENGINE_PLATFORM.SAMSUNG;

  const ua = String(deviceInfo?.userAgent || '').toLowerCase();
  const isTV = !!deviceInfo?.isTV;
  const debugNativeAdaptersOverride = readDebugNativeAdaptersOverride();
  const nativeAdaptersEnabled =
    debugNativeAdaptersOverride == null
      ? deviceInfo?.nativeAdaptersEnabled === true
      : debugNativeAdaptersOverride;
  const looksLikeLG = ua.includes('webos') || ua.includes('netcast') || (ua.includes('lg') && ua.includes('tv'));
  const looksLikeSamsung = ua.includes('tizen') || (ua.includes('samsung') && ua.includes('tv'));

  if (nativeAdaptersEnabled && isTV && looksLikeLG) return ENGINE_PLATFORM.LG;
  if (nativeAdaptersEnabled && isTV && looksLikeSamsung) return ENGINE_PLATFORM.SAMSUNG;
  return ENGINE_PLATFORM.WEB;
}

