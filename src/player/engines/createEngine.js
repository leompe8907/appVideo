import { WebEngine } from './web/WebEngine';
import { LgEngine } from './lg/LgEngine';
import { SamsungEngine } from './samsung/SamsungEngine';
import { ENGINE_PLATFORM, resolveEnginePlatform } from './resolveEnginePlatform';
import { getActiveBrandConfig } from '../../config/brandConfig';

/**
 * Fábrica de engines de reproducción.
 * PC/web: WebEngine (Video.js 6.6 + plugin hls.js de 10foot).
 * TV: LgEngine / SamsungEngine cuando nativeAdapters está activo.
 */
export function createEngine(deviceInfo) {
  const brandConfig = getActiveBrandConfig();
  const platform = resolveEnginePlatform({
    ...deviceInfo,
    nativeAdaptersEnabled: brandConfig?.player?.nativeAdaptersEnabled === true,
    brandPlayerPolicy: brandConfig?.player?.enginePolicy || 'auto',
  });
  if (platform === ENGINE_PLATFORM.LG) return new LgEngine();
  if (platform === ENGINE_PLATFORM.SAMSUNG) return new SamsungEngine();
  return new WebEngine();
}

