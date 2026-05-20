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
    this._drmClient = null; // { type: 'playready'|'widevine', clientId }
    this._pendingPlay = false;
  }

  tryActivateNativeAdapter() {
    try {
      const injectedAdapter = window?.__LG_PLAYER_ADAPTER__;
      if (injectedAdapter && typeof injectedAdapter.load === 'function') {
        this.nativeAdapter = {
          type: 'injected',
          api: injectedAdapter,
        };
        return true;
      }

      const hasWebOSService =
        typeof window !== 'undefined' &&
        !!window.webOS &&
        !!window.webOS.service &&
        typeof window.webOS.service.request === 'function';

      // Si estamos en webOS con Luna service disponible, activamos adapter nativo basado en <video>
      // + com.webos.service.drm (paridad conceptual con legacy).
      if (hasWebOSService) {
        this.nativeAdapter = { type: 'webos-luna' };
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  nativeLoad(url, options = {}) {
    const adapterType = this.nativeAdapter?.type;

    // Adapter inyectado (si existe) tiene prioridad
    if (adapterType === 'injected') {
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

    if (adapterType !== 'webos-luna') return false;
    if (!this.video || !url) return false;

    try {
      const drmConfig = options?.drmConfig || { type: 'none' };
      this._webosLoadSource(url, drmConfig).catch((err) => this.emitNativeError(err));
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
    const adapterType = this.nativeAdapter?.type;
    if (adapterType === 'injected') {
      const api = this.nativeAdapter?.api;
      if (!api || typeof api.play !== 'function') return false;
      api.play();
      return true;
    }

    if (adapterType !== 'webos-luna') return false;
    if (!this.video) return false;
    if (!this.video.src) {
      this._pendingPlay = true;
      return true;
    }
    this.video.play?.().catch((e) => this.emitNativeError(e));
    return true;
  }

  nativePause() {
    const adapterType = this.nativeAdapter?.type;
    if (adapterType === 'injected') {
      const api = this.nativeAdapter?.api;
      if (!api || typeof api.pause !== 'function') return false;
      api.pause();
      return true;
    }

    if (adapterType !== 'webos-luna') return false;
    if (!this.video) return false;
    this.video.pause?.();
    return true;
  }

  nativeSeek(seconds) {
    const adapterType = this.nativeAdapter?.type;
    if (adapterType === 'injected') {
      const api = this.nativeAdapter?.api;
      if (!api || typeof api.seek !== 'function') return false;
      api.seek(seconds);
      return true;
    }

    if (adapterType !== 'webos-luna') return false;
    if (!this.video) return false;
    const target = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    this.video.currentTime = target;
    return true;
  }

  nativeSetDimensions(rect) {
    const adapterType = this.nativeAdapter?.type;
    if (adapterType === 'injected') {
      const api = this.nativeAdapter?.api;
      if (!api || typeof api.setDimensions !== 'function') return false;
      api.setDimensions(rect);
      return true;
    }

    // En webOS video-tag basado en DOM: reutilizamos setDimensions del WebEngine.
    if (adapterType !== 'webos-luna') return false;
    super.setDimensions(rect);
    return true;
  }

  nativeShow() {
    const adapterType = this.nativeAdapter?.type;
    if (adapterType === 'injected') {
      const api = this.nativeAdapter?.api;
      if (!api || typeof api.show !== 'function') return false;
      api.show();
      return true;
    }

    if (adapterType !== 'webos-luna') return false;
    super.show();
    return true;
  }

  nativeHide() {
    const adapterType = this.nativeAdapter?.type;
    if (adapterType === 'injected') {
      const api = this.nativeAdapter?.api;
      if (!api || typeof api.hide !== 'function') return false;
      api.hide();
      return true;
    }

    if (adapterType !== 'webos-luna') return false;
    super.hide();
    return true;
  }

  nativeDestroy() {
    if (this.timeTicker) {
      clearInterval(this.timeTicker);
      this.timeTicker = null;
    }
    const adapterType = this.nativeAdapter?.type;
    if (adapterType === 'injected') {
      const api = this.nativeAdapter?.api;
      if (api && typeof api.destroy === 'function') {
        try {
          api.destroy();
        } catch {
          // noop
        }
      }
    }

    if (adapterType === 'webos-luna') {
      this._webosUnloadDrmClient().catch(() => {});
    }

    this.nativeVideo = null;
    this.nativeAdapter = null;
  }

  nativeOnAppHide() {}

  nativeOnAppResume() {}

  async _webosLoadSource(url, drmConfig = {}) {
    const v = this.video;
    if (!v) throw new Error('[LgEngine] video not initialized');

    const drmType = String(drmConfig?.type || 'none').toLowerCase();
    const wantsDrm = drmType !== 'none' && drmType !== '';

    if (wantsDrm) {
      await this._webosEnsureDrmClient(drmType);
      await this._webosSendDrmMessage(drmType, drmConfig);
    }

    // Re-crear sources (paridad con legacy webOS player)
    v.innerHTML = '';
    const source = document.createElement('source');
    source.setAttribute('src', url);

    const mediaOption = this._webosBuildMediaOption(drmType);
    const mime = this._webosGuessMimeType(url);
    // Nota: webOS legacy usa "type=<mime>;mediaOption=<escaped-json>".
    source.setAttribute('type', `${mime};mediaOption=${mediaOption}`);

    v.appendChild(source);
    v.load();

    if (this._pendingPlay) {
      this._pendingPlay = false;
      v.play?.().catch((e) => this.emitNativeError(e));
    }
  }

  _webosGuessMimeType(url) {
    const u = String(url || '').toLowerCase();
    if (u.includes('.mpd')) return 'application/dash+xml';
    if (u.includes('.m3u8')) return 'application/vnd.apple.mpegurl';
    if (u.includes('manifest') || u.includes('.ism')) return 'application/vnd.ms-sstr+xml';
    return 'video/mp4';
  }

  _webosBuildMediaOption(drmType) {
    const type = String(drmType || 'none').toLowerCase();
    const options = {};
    if (type === 'playready' || type === 'widevine') {
      options.option = { drm: { type, clientId: this._drmClient?.clientId || '' } };
      if (type === 'widevine') {
        options.mediaTransportType = 'WIDEVINE';
      }
    }
    try {
      return encodeURIComponent(JSON.stringify(options));
    } catch {
      return encodeURIComponent('{}');
    }
  }

  _webosRequest(method, parameters) {
    return new Promise((resolve, reject) => {
      try {
        const req = window.webOS.service.request('luna://com.webos.service.drm', {
          method,
          parameters,
          onSuccess: resolve,
          onFailure: (result) => reject(new Error(result?.errorText || `webOS DRM ${method} failed`)),
        });
        void req;
      } catch (e) {
        reject(e);
      }
    });
  }

  async _webosEnsureDrmClient(drmType) {
    const normalized = drmType === 'widevine' ? 'widevine' : 'playready';
    if (this._drmClient?.type === normalized && this._drmClient?.clientId) return;
    await this._webosUnloadDrmClient().catch(() => {});
    const appId =
      (typeof window.webOS?.fetchAppId === 'function' ? window.webOS.fetchAppId() : '') || '';
    const result = await this._webosRequest('load', { drmType: normalized, appId });
    const clientId = result?.clientId || result?.answer?.clientId || null;
    if (!clientId) throw new Error('[LgEngine] webOS DRM load did not return clientId');
    this._drmClient = { type: normalized, clientId: String(clientId) };
  }

  async _webosUnloadDrmClient() {
    const clientId = this._drmClient?.clientId;
    if (!clientId) return;
    await this._webosRequest('unload', { clientId: String(clientId) });
    this._drmClient = null;
  }

  async _webosSendDrmMessage(drmType, drmConfig = {}) {
    const normalized = drmType === 'widevine' ? 'widevine' : 'playready';
    const clientId = this._drmClient?.clientId;
    if (!clientId) throw new Error('[LgEngine] webOS DRM clientId missing');

    if (normalized === 'playready') {
      const msgType = 'application/vnd.ms-playready.initiator+xml';
      const drmSystemId = 'urn:dvb:casystemid:19219';
      const licenseServer = drmConfig?.licenseUrl || '';
      const customData = drmConfig?.customData || '';

      const msg =
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<PlayReadyInitiator xmlns="http://schemas.microsoft.com/DRM/2007/03/protocols/">' +
        '<LicenseServerUriOverride>' +
        `<LA_URL>${licenseServer}</LA_URL>` +
        '</LicenseServerUriOverride>' +
        '<SetCustomData>' +
        `<CustomData>${customData}</CustomData>` +
        '</SetCustomData>' +
        '</PlayReadyInitiator>';

      await this._webosRequest('sendDrmMessage', {
        clientId: String(clientId),
        msgType,
        msg,
        drmSystemId,
      });
      return;
    }

    // Widevine (legacy): mensaje XML de credenciales.
    const msgType = 'application/widevine+xml';
    const drmSystemId = 'urn:dvb:casystemid:19156';
    const licenseServer = drmConfig?.licenseUrl || '';
    const customData = drmConfig?.customData || '';

    const msg =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<WidevineCredentialsInfo xmlns="http://www.smarttv-alliance.org/DRM/widevine/2012/protocols/">' +
      `<DRMServerURL>${licenseServer}</DRMServerURL>` +
      `<UserData>${customData}</UserData>` +
      '</WidevineCredentialsInfo >';

    await this._webosRequest('sendDrmMessage', {
      clientId: String(clientId),
      msgType,
      msg,
      drmSystemId,
    });
  }
}

export default LgEngine;

