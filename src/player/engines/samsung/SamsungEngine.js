import BaseTvEngine from '../tv/BaseTvEngine';

/**
 * Engine base para Samsung.
 *
 * Nota:
 * - Actualmente actúa como fallback WebEngine para preservar compatibilidad.
 * - En fase posterior se conectará con APIs nativas Tizen/SEF según modelo.
 */
export class SamsungEngine extends BaseTvEngine {
  constructor() {
    super({ platformName: 'samsung' });
    this.nativeAdapter = null;
    this.avplayListener = null;
    this.capabilities = null;
  }

  tryActivateNativeAdapter() {
    try {
      const injectedAdapter = window?.__SAMSUNG_PLAYER_ADAPTER__;
      if (injectedAdapter && typeof injectedAdapter.open === 'function') {
        this.nativeAdapter = { type: 'injected', api: injectedAdapter };
        this.capabilities = this.detectCapabilities(injectedAdapter);
        return true;
      }

      const hasTizen = typeof window !== 'undefined' && !!window.tizen;
      const hasWebApi = typeof window !== 'undefined' && !!window.webapis;
      if (!hasTizen && !hasWebApi) return false;

      const avplay = window?.webapis?.avplay;
      if (!avplay || typeof avplay.open !== 'function') {
        return false;
      }

      this.nativeAdapter = {
        type: hasTizen ? 'tizen-avplay' : 'samsung-webapi',
        api: avplay,
      };
      this.capabilities = this.detectCapabilities(avplay);
      return true;
    } catch {
      return false;
    }
  }

  nativeLoad(url, options = {}) {
    const api = this.nativeAdapter?.api;
    if (!api || typeof api.open !== 'function') return false;
    const caps = this.capabilities || this.detectCapabilities(api);
    this.capabilities = caps;

    try {
      if (caps.hasSetListener) {
        this.avplayListener = {
          onbufferingstart: () => this.emitNativeState('loading'),
          onbufferingcomplete: () => this.emitNativeState('loaded'),
          oncurrentplaytime: (ms) => {
            const currentTime = Number(ms) / 1000;
            const durationMs = typeof api.getDuration === 'function' ? Number(api.getDuration()) : 0;
            const duration = durationMs > 0 ? durationMs / 1000 : 0;
            this.emitNativeTime(currentTime, duration);
          },
          onstreamcompleted: () => this.emitNativeState('ended'),
          onerror: (err) => this.emitNativeError(err),
          onerrormsg: (_kind, msg) => this.emitNativeError(new Error(String(msg || 'Samsung AVPlay error'))),
        };
        api.setListener(this.avplayListener);
      }

      this.applySamsungMediaOptions(api, options?.mediaOption, caps);
      this.applySamsungDrmConfig(api, options?.drmConfig, caps);

      if (caps.hasStop) {
        try {
          api.stop();
        } catch {
          // noop
        }
      }
      if (caps.hasClose) {
        try {
          api.close();
        } catch {
          // noop
        }
      }

      api.open(url);
      if (caps.hasPrepareAsync) {
        api.prepareAsync(
          () => this.emitNativeState('loaded', { type: options?.type }),
          (err) => this.emitNativeError(err)
        );
      } else if (caps.hasPrepare) {
        api.prepare();
      }
      return true;
    } catch (error) {
      this.emitNativeError(error);
      return false;
    }
  }

  applySamsungMediaOptions(api, mediaOption = {}, caps = this.capabilities) {
    if (!api || !mediaOption) return;
    try {
      if (mediaOption?.isTimeshiftedLive && caps?.hasSetStreamingProperty) {
        api.setStreamingProperty('IS_LIVE', 'true');
      }
      if (mediaOption?.profile === 'low-latency' && caps?.hasSetStreamingProperty) {
        api.setStreamingProperty('ADAPTIVE_INFO', 'STARTBITRATE=HIGHEST');
      }
    } catch (error) {
      this.emitNativeError(error);
    }
  }

  applySamsungDrmConfig(api, drmConfig = {}, caps = this.capabilities) {
    if (!api || !drmConfig || drmConfig.type === 'none') return;
    try {
      const type = String(drmConfig?.type || '').toUpperCase();
      const licenseUrl = drmConfig?.licenseUrl || '';
      const headers = drmConfig?.headers || {};
      const customData = drmConfig?.customData || '';

      // APIs antiguas/variantes de Samsung:
      if (caps?.hasSetDrm) {
        if (type === 'PLAYREADY') {
          api.setDrm('PLAYREADY', 'SetProperties', JSON.stringify({ LicenseServer: licenseUrl, HttpHeader: headers }));
        } else if (type === 'WIDEVINE') {
          api.setDrm('WIDEVINE_CDM', 'SetProperties', JSON.stringify({ LicenseServer: licenseUrl, HttpHeader: headers }));
        }
      }

      // APIs más nuevas AVPlay:
      if (caps?.hasSetDrmProperty) {
        const drmType = type === 'PLAYREADY' ? 'PLAYREADY' : 'WIDEVINE_CDM';
        const payload = {
          LicenseServer: licenseUrl,
          HttpHeader: headers,
          CustomData: customData,
        };
        api.setDrmProperty(drmType, JSON.stringify(payload));
      }

      // Fallback opcional por streaming property:
      if (licenseUrl && caps?.hasSetStreamingProperty) {
        api.setStreamingProperty('LICENSE_SERVER', String(licenseUrl));
      }
    } catch (error) {
      this.emitNativeError(error);
    }
  }

  nativePlay() {
    const api = this.nativeAdapter?.api;
    if (!api || !this.capabilities?.hasPlay) return false;
    api.play();
    return true;
  }

  nativePause() {
    const api = this.nativeAdapter?.api;
    if (!api || !this.capabilities?.hasPause) return false;
    api.pause();
    return true;
  }

  nativeSeek(seconds) {
    const api = this.nativeAdapter?.api;
    if (!api) return false;
    const ms = Math.max(0, Math.floor(Number(seconds || 0) * 1000));
    if (this.capabilities?.hasSeekTo) {
      api.seekTo(ms);
      return true;
    }
    return false;
  }

  nativeSetDimensions(rect) {
    const api = this.nativeAdapter?.api;
    if (!api) return false;
    const left = Number.isFinite(rect?.left) ? rect.left : 0;
    const top = Number.isFinite(rect?.top) ? rect.top : 0;
    const width = Number.isFinite(rect?.width) ? rect.width : window.innerWidth;
    const height = Number.isFinite(rect?.height) ? rect.height : window.innerHeight;
    if (this.capabilities?.hasSetDisplayRect) {
      api.setDisplayRect(left, top, width, height);
      return true;
    }
    return false;
  }

  nativeShow() {
    const api = this.nativeAdapter?.api;
    if (!api) return false;
    if (this.capabilities?.hasSetDisplayMethod) {
      api.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN');
      return true;
    }
    return false;
  }

  nativeHide() {
    // No todas las APIs Samsung exponen hide directo.
    return false;
  }

  nativeDestroy() {
    const api = this.nativeAdapter?.api;
    if (api && this.capabilities?.hasStop) {
      try {
        api.stop();
      } catch {
        // noop
      }
    }
    if (api && this.capabilities?.hasClose) {
      try {
        api.close();
      } catch {
        // noop
      }
    }
    this.avplayListener = null;
    this.capabilities = null;
    this.nativeAdapter = null;
  }

  detectCapabilities(api) {
    return {
      hasSetListener: typeof api?.setListener === 'function',
      hasPrepareAsync: typeof api?.prepareAsync === 'function',
      hasPrepare: typeof api?.prepare === 'function',
      hasPlay: typeof api?.play === 'function',
      hasPause: typeof api?.pause === 'function',
      hasSeekTo: typeof api?.seekTo === 'function',
      hasSetDisplayRect: typeof api?.setDisplayRect === 'function',
      hasSetDisplayMethod: typeof api?.setDisplayMethod === 'function',
      hasSetStreamingProperty: typeof api?.setStreamingProperty === 'function',
      hasSetDrm: typeof api?.setDrm === 'function',
      hasSetDrmProperty: typeof api?.setDrmProperty === 'function',
      hasStop: typeof api?.stop === 'function',
      hasClose: typeof api?.close === 'function',
    };
  }

  nativeOnAppHide() {}

  nativeOnAppResume() {}
}

export default SamsungEngine;

