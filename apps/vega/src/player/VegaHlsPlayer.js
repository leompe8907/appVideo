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
   * @param {{
   *   onState?: (state: 'loading'|'playing'|'buffering'|'error', detail?: any) => void,
   *   onTracks?: (tracks: ReturnType<VegaHlsPlayer['getTracks']>) => void,
   * }} [callbacks]
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
    // Como en la web, los subtítulos arrancan apagados hasta que se elijan.
    let textDefaultApplied = false;
    const emitTracks = () => {
      if (this.destroyed) return;
      if (!textDefaultApplied && (shaka.player.getTextTracks() || []).length > 0) {
        textDefaultApplied = true;
        shaka.player.setTextTrackVisibility(false);
      }
      this.callbacks.onTracks?.(this.getTracks());
    };
    for (const ev of ['trackschanged', 'variantchanged', 'textchanged', 'texttrackvisibility']) {
      shaka.player.addEventListener(ev, emitTracks);
    }
    shaka.player.addEventListener('error', (e) => {
      const d = e?.detail || {};
      devLog('Shaka error', d.code, d.category, d.severity);
      // Severidad 2 = crítica: la reproducción no sigue sola.
      if (d.severity === 2) this.emit('error', {source: 'shaka', code: d.code, category: d.category});
    });
    video.play();
  }

  /**
   * Pistas como el motor web (`getTracks`): audio por idioma y subtítulos.
   * @returns {{audio: Array<{id,label,lang}>, text: Array<{id,label,lang}>, selectedAudioId, selectedTextId, textEnabled}}
   */
  getTracks() {
    const p = this.shaka?.player;
    const empty = {audio: [], text: [], selectedAudioId: null, selectedTextId: null, textEnabled: false};
    if (!p) return empty;
    try {
      const variants = p.getVariantTracks() || [];
      const audio = [];
      let selectedAudioId = null;
      for (const v of variants) {
        // "und" = idioma sin definir en el manifiesto: se muestra como "Audio N".
        const lang = v.language && v.language !== 'und' ? v.language : '';
        const id = v.language || 'und';
        if (!audio.some((a) => a.id === id)) audio.push({id, label: v.label || lang || `Audio ${audio.length + 1}`, lang});
        if (v.active) selectedAudioId = id;
      }
      const textEnabled = p.isTextTrackVisible();
      let selectedTextId = null;
      const text = (p.getTextTracks() || []).map((tr, i) => {
        const id = String(tr.id ?? i);
        if (tr.active && textEnabled) selectedTextId = id;
        return {id, label: tr.label || tr.language || `Sub ${i + 1}`, lang: tr.language || ''};
      });
      return {audio, text, selectedAudioId, selectedTextId, textEnabled: textEnabled && selectedTextId != null};
    } catch (e) {
      devLog('tracks: error', e?.message);
      return empty;
    }
  }

  selectAudioTrack(id) {
    const p = this.shaka?.player;
    if (!p) return;
    p.selectAudioLanguage(id === 'und' ? '' : id);
    this.callbacks.onTracks?.(this.getTracks());
  }

  /** `id` null apaga los subtítulos. */
  selectTextTrack(id) {
    const p = this.shaka?.player;
    if (!p) return;
    if (id == null) {
      p.setTextTrackVisibility(false);
    } else {
      const track = (p.getTextTracks() || []).find((tr, i) => String(tr.id ?? i) === String(id));
      if (track) p.selectTextTrack(track);
      p.setTextTrackVisibility(true);
    }
    this.callbacks.onTracks?.(this.getTracks());
  }

  /** Controles para VOD/catchup. */
  play() {
    this.video?.play();
  }

  pause() {
    this.video?.pause();
  }

  get paused() {
    return this.video ? this.video.paused : true;
  }

  get currentTime() {
    return this.video ? Number(this.video.currentTime) || 0 : 0;
  }

  get duration() {
    const d = this.video ? Number(this.video.duration) : 0;
    return Number.isFinite(d) ? d : 0;
  }

  seekTo(seconds) {
    if (!this.video) return;
    const max = this.duration || seconds;
    this.video.currentTime = Math.max(0, Math.min(seconds, max - 1));
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
