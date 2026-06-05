/**
 * Detección de plataforma TV por APIs nativas expuestas en runtime.
 * Complementa User-Agent (más fiable en emuladores y firmwares con UA genérico).
 */

export function hasSamsungTvRuntime() {
  if (typeof window === 'undefined') return false;
  const hasTizen = !!window.tizen;
  const hasWebApis = !!window.webapis;
  const hasAvPlay =
    typeof window.webapis?.avplay?.open === 'function' ||
    typeof window.webapis?.avplay?.prepareAsync === 'function';
  return hasTizen || hasWebApis || hasAvPlay;
}

export function hasLgTvRuntime() {
  if (typeof window === 'undefined') return false;
  const hasWebOsService = typeof window.webOS?.service?.request === 'function';
  const hasPalm = !!window.PalmSystem;
  const hasWebOsDevice = typeof window.webOS?.deviceInfo === 'function';
  return !!window.webOS || hasPalm || hasWebOsService || hasWebOsDevice;
}

export function detectTvVendorFromApis() {
  const samsung = hasSamsungTvRuntime();
  const lg = hasLgTvRuntime();
  if (samsung && !lg) return 'samsung';
  if (lg && !samsung) return 'lg';
  if (samsung && lg) return 'ambiguous';
  return null;
}
