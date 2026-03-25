import { WebEngine } from './web/WebEngine';
import { LgEngine } from './lg/LgEngine';
import { SamsungEngine } from './samsung/SamsungEngine';
import { ENGINE_PLATFORM, resolveEnginePlatform } from './resolveEnginePlatform';
import { getActiveBrandConfig } from '../../config/brandConfig';

/**
 * Fábrica de engines de reproducción.
 * Por ahora solo hay WebEngine (HTML5 video).
 * En el futuro se pueden añadir TizenEngine / WebOSEngine según la plataforma.
 */
export function createEngine(deviceInfo) {
  const brandConfig = getActiveBrandConfig();
  // #region agent log
  fetch('http://127.0.0.1:7303/ingest/b7e0775d-94a7-44fd-88f2-84907bcf08ad',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'95a16d'},body:JSON.stringify({sessionId:'95a16d',runId:'initial',hypothesisId:'H2',location:'createEngine.js:14',message:'createEngine brand player config',data:{brand:brandConfig?.brand,nativeAdaptersEnabled:brandConfig?.player?.nativeAdaptersEnabled,enginePolicy:brandConfig?.player?.enginePolicy},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const platform = resolveEnginePlatform({
    ...deviceInfo,
    nativeAdaptersEnabled: brandConfig?.player?.nativeAdaptersEnabled === true,
    brandPlayerPolicy: brandConfig?.player?.enginePolicy || 'auto',
  });
  // #region agent log
  fetch('http://127.0.0.1:7303/ingest/b7e0775d-94a7-44fd-88f2-84907bcf08ad',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'95a16d'},body:JSON.stringify({sessionId:'95a16d',runId:'initial',hypothesisId:'H2',location:'createEngine.js:22',message:'createEngine resolved platform',data:{platform},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (platform === ENGINE_PLATFORM.LG) return new LgEngine();
  if (platform === ENGINE_PLATFORM.SAMSUNG) return new SamsungEngine();
  return new WebEngine();
}

