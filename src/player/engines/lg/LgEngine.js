import BaseTvEngine from '../tv/BaseTvEngine';

/**
 * Engine base para LG.
 *
 * Nota:
 * - En esta fase se mantiene como fallback WebEngine para no romper
 *   el flujo actual en navegador.
 * - En una fase posterior se reemplaza la lógica de `load/play/seek/...`
 *   por la API nativa LG (webOS/NetCast).
 */
export class LgEngine extends BaseTvEngine {
  constructor() {
    super({ platformName: 'lg' });
    this.nativeAdapter = null;
    this.nativeVideo = null;
    this.timeTicker = null;
  }

  tryActivateNativeAdapter(container) {
    try {
      const injectedAdapter = window?.__LG_PLAYER_ADAPTER__;
      if (injectedAdapter && typeof injectedAdapter.load === 'function') {
        this.nativeAdapter = {
          type: 'injected',
          api: injectedAdapter,
        };
        return true;
      }

      const hasWebOS = typeof window !== 'undefined' && !!window.webOS;
      const hasPalmSystem = typeof window !== 'undefined' && !!window.PalmSystem;
      const hasLegacyObjectAPI = !!container && typeof document !== 'undefined' && typeof document.createElement === 'function';
      const canUseNative = hasWebOS || hasPalmSystem || hasLegacyObjectAPI;
      if (!canUseNative) return false;

      // Sin adapter nativo real validado, por seguridad no activamos modo nativo automáticamente.
      this.nativeAdapter = {
        type: hasWebOS || hasPalmSystem ? 'webos' : 'netcast-object',
      };
      return false;
    } catch {
      return false;
    }
  }

  nativeLoad(url, options = {}) {
    const api = this.nativeAdapter?.api;
    if (!api || typeof api.load !== 'function') return false;
    try {
      this.applyLgDrmConfig(api, options?.drmConfig);
      api.load(url, options);
      return true;
    } catch (error) {
      this.emitNativeError(error);
      return false;
    }
  }

  applyLgDrmConfig(api, drmConfig = {}) {
    if (!api || !drmConfig || drmConfig.type === 'none') return;
    try {
      // Contrato para adapter inyectado LG (si existe):
      // - api.setDrmConfig({ type, licenseUrl, headers, customData, certificateUrl })
      if (typeof api.setDrmConfig === 'function') {
        api.setDrmConfig({
          type: drmConfig?.type,
          licenseUrl: drmConfig?.licenseUrl || '',
          headers: drmConfig?.headers || {},
          customData: drmConfig?.customData || '',
          certificateUrl: drmConfig?.certificateUrl || '',
        });
      }
    } catch (error) {
      this.emitNativeError(error);
    }
  }

  nativePlay() {
    const api = this.nativeAdapter?.api;
    if (!api || typeof api.play !== 'function') return false;
    api.play();
    return true;
  }

  nativePause() {
    const api = this.nativeAdapter?.api;
    if (!api || typeof api.pause !== 'function') return false;
    api.pause();
    return true;
  }

  nativeSeek(seconds) {
    const api = this.nativeAdapter?.api;
    if (!api || typeof api.seek !== 'function') return false;
    api.seek(seconds);
    return true;
  }

  nativeSetDimensions(rect) {
    const api = this.nativeAdapter?.api;
    if (!api || typeof api.setDimensions !== 'function') return false;
    api.setDimensions(rect);
    return true;
  }

  nativeShow() {
    const api = this.nativeAdapter?.api;
    if (!api || typeof api.show !== 'function') return false;
    api.show();
    return true;
  }

  nativeHide() {
    const api = this.nativeAdapter?.api;
    if (!api || typeof api.hide !== 'function') return false;
    api.hide();
    return true;
  }

  nativeDestroy() {
    if (this.timeTicker) {
      clearInterval(this.timeTicker);
      this.timeTicker = null;
    }
    const api = this.nativeAdapter?.api;
    if (api && typeof api.destroy === 'function') {
      try {
        api.destroy();
      } catch {
        // noop
      }
    }
    this.nativeVideo = null;
    this.nativeAdapter = null;
  }

  nativeOnAppHide() {}

  nativeOnAppResume() {}
}

export default LgEngine;

