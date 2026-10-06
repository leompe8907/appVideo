/**
 * Reproductor HLS de Vega: VideoPlayer de w3cmedia + Shaka 4.8.5 parcheado
 * por Amazon, con lo que necesita Panaccess (igual que el motor web):
 *  - `sessionId` en manifiestos y keys del middleware;
 *  - unwrap de las keys AES-128 de 32 bytes (`mekey`, catchup, VOD);
 *  - `play()` recién con metadatos (en vivo con listas cortas no llega `canplay`).
 *
 * Una instancia por reproducción: `load()` y después `destroy()`.
 */
import {VideoPlayer} from '@amazon-devices/react-native-w3cmedia';
import {ShakaPlayer} from '../w3cmedia/shakaplayer/ShakaPlayer';
import {middlewareNeedsSession, withSessionId} from '@appvideo/core/player/panaccessPlayback';
import * as userSession from '@appvideo/core/utils/userSession';
import {isPanaccessRotatingKeyUri, unwrapPanaccessKey} from './keyUnwrap';
import {devLog} from '../devLog';

const KEY_REQUEST_TYPE = 6; // shaka.net.NetworkingEngine.RequestType.KEY
const SHAKA_SETTINGS = {secure: false, abrEnabled: true, abrMaxWidth: 1920, abrMaxHeight: 1080};

export class VegaHlsPlayer {
  /**
   * @param {{ onState?: (state: 'loading'|'playing'|'buffering'|'error', detail?: any) => void }} [callbacks]
   */
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.video = null;
    this.shaka = null;
    this.surfaceHandle = null;
    this.captionHandle = null;
    this.destroyed = false;
    this.keyRequests = 0;
  }

  setSurfaceHandle(handle) {
    this.surfaceHandle = handle;
    this.video?.setSurfaceHandle(handle);
  }

  clearSurfaceHandle(handle) {
    this.video?.clearSurfaceHandle(handle);
    if (this.surfaceHandle === handle) this.surfaceHandle = null;
  }

  setCaptionViewHandle(handle) {
    this.captionHandle = handle;
    this.video?.setCaptionViewHandle(handle);
  }

  emit(state, detail) {
    if (this.destroyed) return;
    this.lastState = state;
    this.callbacks.onState?.(state, detail);
  }

  async load(url) {
    this.emit('loading');
    const video = new VideoPlayer();
    this.video = video;
    await video.initialize();
    if (this.destroyed) {
      await video.deinitialize();
      return;
    }
    video.autoplay = false;
    const play = () => video.play();
    video.addEventListener('loadedmetadata', play);
    video.addEventListener('canplay', play);
    video.addEventListener('playing', () => this.emit('playing'));
    // Tras un `waiting` no siempre llega otro `playing`: si el tiempo avanza, está reproduciendo.
    let lastTime = -1;
    video.addEventListener('timeupdate', () => {
      const t = video.currentTime;
      if (this.lastState !== 'playing' && this.lastState !== 'error' && lastTime >= 0 && t > lastTime) this.emit('playing');
      lastTime = t;
    });
    video.addEventListener('waiting', () => this.emit('buffering'));
    video.addEventListener('error', () =>
      this.emit('error', {source: 'video', code: video.error?.code, message: video.error?.message}),
    );
    if (this.surfaceHandle) video.setSurfaceHandle(this.surfaceHandle);
    if (this.captionHandle) video.setCaptionViewHandle(this.captionHandle);

    const sessionId = userSession.getSessionId();
    const shaka = new ShakaPlayer(video, SHAKA_SETTINGS);
    this.shaka = shaka;
    shaka.load({uri: withSessionId(url, sessionId), secure: 'false', drm_scheme: '', drm_license_uri: ''}, true);

    const net = shaka.player.getNetworkingEngine();
    net.registerRequestFilter((_type, request) => {
      const current = userSession.getSessionId();
      if (!current) return;
      request.uris = request.uris.map((u) => (middlewareNeedsSession(u) ? withSessionId(u, current) : u));
    });
    net.registerResponseFilter(async (type, response) => {
      if (type !== KEY_REQUEST_TYPE) return;
      this.keyRequests += 1;
      if (isPanaccessRotatingKeyUri(response.uri)) {
        response.data = await unwrapPanaccessKey(response.data);
      }
    });
    shaka.player.addEventListener('error', (e) => {
      const d = e?.detail || {};
      devLog('Shaka error', d.code, d.category, d.severity);
      // Severidad 2 = crítica: la reproducción no sigue sola.
      if (d.severity === 2) this.emit('error', {source: 'shaka', code: d.code, category: d.category});
    });
    video.play();
  }

  async destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    const {shaka, video} = this;
    this.shaka = null;
    this.video = null;
    try {
      shaka?.unload();
    } catch (e) {
      devLog('unload', e);
    }
    try {
      if (this.surfaceHandle) video?.clearSurfaceHandle(this.surfaceHandle);
      await video?.deinitialize();
    } catch (e) {
      devLog('deinitialize', e);
    }
  }
}
