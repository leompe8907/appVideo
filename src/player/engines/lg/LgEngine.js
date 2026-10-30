import BaseTvEngine from '../tv/BaseTvEngine';
import { middlewareNeedsSession } from '../web/sessionHlsXhrSetup';

const DRM_UNLOAD_TIMEOUT_MS = 5000;

/**
 * Engine LG webOS con Luna DRM + fallback WebEngine.
 */
export class LgEngine extends BaseTvEngine {
  constructor() {
    super({ platformName: 'lg' });
    this.nativeAdapter = null;
    this.nativeVideo = null;
    this.timeTicker = null;
    this._drmClient = null;
    this._pendingPlay = false;
    this._drmTransitionPromise = Promise.resolve();
  }

  canHandleNatively(url) {
    // Ver comentario en nativeLoad(): este middleware puede requerir
    // desenvolver una key AES-128 rotativa que solo WebEngine sabe manejar.
    return !middlewareNeedsSession(url);
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

      if (hasWebOSService) {
        this.nativeAdapter = { type: 'webos-luna' };
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  _enqueueNativeTask(task) {
    const run = this._drmTransitionPromise.then(task, task);
    this._drmTransitionPromise = run.catch(() => {});
    return run;
  }

  _releaseVideoPipeline() {
    const v = this.video;
    if (!v) return;
    try {
      v.pause();
      v.removeAttribute('src');
      v.innerHTML = '';
      v.load();
    } catch {
      // noop
    }
  }

  nativeLoad(url, options = {}) {
    const adapterType = this.nativeAdapter?.type;

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

    const drmConfig = options?.drmConfig || { type: 'none' };
    this._enqueueNativeTask(() => this._webosLoadSource(url, drmConfig)).catch((err) =>
      this.emitNativeError(err),
    );
    return true;
  }

  applyLgDrmConfig(api, drmConfig = {}) {
    if (!api || !drmConfig || drmConfig.type === 'none') return;
    try {
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
      try {
        api.play();
        return true;
      } catch (error) {
        this.emitNativeError(error);
        throw error;
      }
    }

    if (adapterType !== 'webos-luna') return false;
    if (!this.video) return false;
    if (!this.video.src && !this.video.querySelector('source')) {
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
      try {
        api.pause();
        return true;
      } catch (error) {
        this.emitNativeError(error);
        throw error;
      }
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
      try {
        api.seek(seconds);
        return true;
      } catch (error) {
        this.emitNativeError(error);
        throw error;
      }
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

    if (adapterType !== 'webos-luna') return false;
    // No hay API nativa de webOS Luna para reposicionar el <video>: se deja que
    // BaseTvEngine caiga a su fallback CSS (super.setDimensions) UNA sola vez.
    // Antes esto llamaba a super.setDimensions(rect) directamente desde acá,
    // pero `this` sigue siendo la instancia con isNativeActive=true, así que
    // BaseTvEngine.setDimensions() volvía a invocar this.nativeSetDimensions()
    // -> recursión infinita (RangeError: Maximum call stack size exceeded).
    // Mismo patrón que SamsungEngine.nativeHide(): devolver false.
    return false;
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
    // Ver comentario en nativeSetDimensions: evita la recursión infinita con
    // BaseTvEngine.show(). Sin API nativa de show/hide en webOS Luna, se deja
    // caer al fallback CSS del propio BaseTvEngine.
    return false;
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
    // Ver comentario en nativeSetDimensions: evita la recursión infinita con
    // BaseTvEngine.hide().
    return false;
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
      this._releaseVideoPipeline();
      this._enqueueNativeTask(() => this._webosUnloadDrmClientWithTimeout()).catch(() => {
        this._drmClient = null;
      });
    }

    this.nativeVideo = null;
    this.nativeAdapter = null;
    this._pendingPlay = false;
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

    v.innerHTML = '';
    const source = document.createElement('source');
    source.setAttribute('src', url);

    const mediaOption = this._webosBuildMediaOption(drmType);
    const mime = this._webosGuessMimeType(url);
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

  async _webosUnloadDrmClientWithTimeout() {
    const clientId = this._drmClient?.clientId;
    if (!clientId) return;

    let timeoutId;
    try {
      await Promise.race([
        this._webosRequest('unload', { clientId: String(clientId) }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error(`[LgEngine] DRM unload timeout (${DRM_UNLOAD_TIMEOUT_MS}ms)`)),
            DRM_UNLOAD_TIMEOUT_MS,
          );
        }),
      ]);
    } catch (error) {
      console.warn('[LgEngine] DRM unload failed:', error?.message || error);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      this._drmClient = null;
    }
  }

  async _webosEnsureDrmClient(drmType) {
    const normalized = drmType === 'widevine' ? 'widevine' : 'playready';
    if (this._drmClient?.type === normalized && this._drmClient?.clientId) return;
    await this._webosUnloadDrmClientWithTimeout();
    const appId =
      (typeof window.webOS?.fetchAppId === 'function' ? window.webOS.fetchAppId() : '') || '';
    const result = await this._webosRequest('load', { drmType: normalized, appId });
    const clientId = result?.clientId || result?.answer?.clientId || null;
    if (!clientId) throw new Error('[LgEngine] webOS DRM load did not return clientId');
    this._drmClient = { type: normalized, clientId: String(clientId) };
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
