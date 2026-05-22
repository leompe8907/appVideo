import { WebEngine } from './web/WebEngine';
import { ENGINE_PLATFORM, resolveEnginePlatform } from './resolveEnginePlatform';

/**
 * Fábrica de engines de reproducción.
 * PC/web: WebEngine (Video.js 6.6 + plugin hls.js de 10foot).
 * TV: LgEngine / SamsungEngine (import dinámico; no se empaquetan en web).
 *
 * @param {Object} deviceInfo
 * @param {{ nativeAdaptersEnabled?: boolean, brandPlayerPolicy?: string }} [playerPolicy]
 */
export async function createEngine(deviceInfo, playerPolicy = {}) {
  const platform = resolveEnginePlatform({
    ...deviceInfo,
    nativeAdaptersEnabled: playerPolicy.nativeAdaptersEnabled === true,
    brandPlayerPolicy: playerPolicy.brandPlayerPolicy || 'auto',
  });

  if (platform === ENGINE_PLATFORM.LG) {
    const { LgEngine } = await import('./lg/LgEngine.js');
    return new LgEngine();
  }
  if (platform === ENGINE_PLATFORM.SAMSUNG) {
    const { SamsungEngine } = await import('./samsung/SamsungEngine.js');
    return new SamsungEngine();
  }
  return new WebEngine();
}
