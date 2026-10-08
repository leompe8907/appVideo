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
import {TextDecoder} from '@amazon-devices/react-native-w3cmedia/dist/headless';
import {ShakaPlayer} from '../w3cmedia/shakaplayer/ShakaPlayer';
import {middlewareNeedsSession, withSessionId} from '@appvideo/core/player/panaccessPlayback';
import {resolveLiveBuffer} from '@appvideo/core/player/liveBufferConfig';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import * as userSession from '@appvideo/core/utils/userSession';
import {isPanaccessRotatingKeyUri, unwrapPanaccessKey} from './keyUnwrap';
import {devLog} from '../devLog';

const KEY_REQUEST_TYPE = 6; // shaka.net.NetworkingEngine.RequestType.KEY
// Si el equipo no respeta playbackRate (Fire TV Stick 4K Select: no), no se
// vuelve a intentar frenar en esta sesión: se salta atrás directamente.
let playbackRateUnsupported = false;
const SHAKA_SETTINGS = {secure: false, abrEnabled: true, abrMaxWidth: 1920, abrMaxHeight: 1080};

/** Ajustes de Shaka desde el flag de marca `player.liveBuffer` (como hls.js en la web). */
function shakaSettingsFor(live) {
  return {
    ...SHAKA_SETTINGS,
    bufferingGoal: live.maxBufferLength,
    bufferBehind: live.backBufferLength,
    // Shaka arranca a liveSyncDurationCount segmentos del borde (como hls.js).
    // Probado: arrancar más cerca y mover el cabezal hacia atrás deja la zona
    // sin descargar y el video vuelve a cargar (47 % del tiempo en Warner Hd).
    liveSegmentsDelay: live.liveSyncDurationCount,
  };
}

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
    // Diagnóstico (panel de estadísticas del reproductor).
    this.net = {manifests: 0, segments: 0, keys: 0, bytes: 0, last: {}, recent: {}, counts: {}, errors: []};
    this.loadStartedAt = 0;
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
    this.loadStartedAt = Date.now();
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
    const live = resolveLiveBuffer(getActiveBrandConfig(), {windHost: /middleware\.wind\.do/i.test(url)});
    this.liveBuffer = live;
    const shaka = new ShakaPlayer(video, shakaSettingsFor(live));
    this.shaka = shaka;
    shaka.load({uri: withSessionId(url, sessionId), secure: 'false', drm_scheme: '', drm_license_uri: ''}, true);

    const net = shaka.player.getNetworkingEngine();
    net.registerRequestFilter((_type, request) => {
      const current = userSession.getSessionId();
      if (!current) return;
      request.uris = request.uris.map((u) => (middlewareNeedsSession(u) ? withSessionId(u, current) : u));
    });
    net.registerResponseFilter(async (type, response, context) => {
      this.recordResponse(type, response, context);
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
      this.net.errors = [{at: Date.now(), code: d.code, category: d.category, severity: d.severity}, ...this.net.errors].slice(0, 5);
      // Severidad 2 = crítica: la reproducción no sigue sola.
      if (d.severity === 2) this.emit('error', {source: 'shaka', code: d.code, category: d.category});
    });
    this.startLiveLatencyWatch();
    video.play();
  }

  /**
   * Distancia al borde en vivo (flag de marca `player.liveBuffer`), en
   * segmentos. Shaka arranca a liveSyncDurationCount del borde; después:
   * - más cerca que liveMinLatencyDurationCount (los saltos sobre huecos del
   *   stream lo van adelantando) → frena a liveSlowPlaybackRate o, si el equipo
   *   no cambia la velocidad (Fire TV Stick: no), vuelve al punto de arranque;
   * - más lejos que liveMaxLatencyDurationCount → vuelve al punto de arranque.
   * Con manifiestos cortos el mínimo se achica (nunca deja menos de 1 segmento
   * detrás del inicio de la ventana).
   */
  startLiveLatencyWatch() {
    if (this.latencyTimer) clearInterval(this.latencyTimer);
    this.slow = null; // {fromCurrent, fromWall} mientras va lento
    this.latencyTimer = setInterval(() => this.checkLiveLatency(), 5000);
  }

  setRate(rate) {
    try {
      this.video.playbackRate = rate;
      return Math.abs(Number(this.video.playbackRate) - rate) < 0.001;
    } catch (e) {
      devLog('player: playbackRate no soportado', e?.message);
      return false;
    }
  }

  checkLiveLatency() {
    const p = this.shaka?.player;
    const v = this.video;
    if (this.destroyed || !p || !v || p.isLive?.() !== true || this.lastState !== 'playing') return;
    const segS = this.net.segmentDurationS;
    const range = p.seekRange?.();
    if (!segS || !range || !Number.isFinite(range.end)) return;
    const cfg = this.liveBuffer;
    const now = Number(v.currentTime) || 0;
    const n = this.net;
    const segments = this.playlistSegments();
    const sync = cfg.liveSyncDurationCount;
    const min = Math.max(0.5, Math.min(cfg.liveMinLatencyDurationCount, sync - 1, Number.isFinite(segments) ? segments - 2 : Infinity));
    const dist = (range.end - now) / segS + sync;
    n.distanceSegs = dist;
    n.targetSegs = sync;
    const backToSync = (why) => {
      devLog(`player: ${why} (a ${dist.toFixed(1)} .ts del vivo), vuelve a ${sync}`);
      v.currentTime = range.end;
    };

    if (dist > cfg.liveMaxLatencyDurationCount) {
      n.liveResyncs = (n.liveResyncs || 0) + 1;
      if (this.slow) this.setRate(1);
      this.slow = null;
      n.rate = 1;
      backToSync('demasiado atrás del vivo');
      return;
    }

    if (this.slow) {
      if (dist >= sync) {
        this.setRate(1);
        this.slow = null;
        n.rate = 1;
        return;
      }
      // ¿Respeta la velocidad? A los 10 s el video tuvo que avanzar menos que el reloj.
      const wall = (Date.now() - this.slow.fromWall) / 1000;
      if (wall >= 10) {
        if (now - this.slow.fromCurrent > wall * 0.99) {
          playbackRateUnsupported = true;
          this.setRate(1);
          this.slow = null;
          n.rate = 1;
          n.liveBackJumps = (n.liveBackJumps || 0) + 1;
          backToSync('el equipo no cambia la velocidad');
        } else {
          this.slow = {fromCurrent: now, fromWall: Date.now()};
        }
      }
      return;
    }

    if (dist < min) {
      n.liveSlowdowns = (n.liveSlowdowns || 0) + 1;
      if (!playbackRateUnsupported && this.setRate(cfg.liveSlowPlaybackRate)) {
        this.slow = {fromCurrent: now, fromWall: Date.now()};
        n.rate = cfg.liveSlowPlaybackRate;
      } else {
        n.liveBackJumps = (n.liveBackJumps || 0) + 1;
        backToSync('muy cerca del vivo');
      }
    }
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

  /**
   * Registra cada respuesta de red (tipos de Shaka: 0 manifiesto, 1 segmento,
   * 6 key). Los segmentos se separan por pista (`context.stream.type`): hay
   * streams con audio y video en .ts distintos, y el de audio es mucho más chico.
   */
  recordResponse(type, response, context) {
    const bytes = response?.data?.byteLength || 0;
    const ms = Number(response?.timeMs) || 0;
    const n = this.net;
    if (type === 0) {
      n.manifests += 1;
      this.recordPlaylist(response);
    }
    else if (type === 6) n.keys += 1;
    else if (type === 1) {
      const kind = context?.stream?.type || 'video';
      n.segments += 1;
      n.bytes += bytes;
      n.counts[kind] = (n.counts[kind] || 0) + 1;
      const uri = String(response?.uri || '');
      const name = uri.split('?')[0].split('/').pop() || uri;
      const entry = {name, bytes, ms, kbps: ms > 0 ? Math.round((bytes * 8) / ms) : 0, at: Date.now()};
      const seg = context?.segment;
      if (kind === 'video' && seg && Number.isFinite(seg.endTime - seg.startTime)) {
        n.segmentDurationS = seg.endTime - seg.startTime;
      }
      n.last = {...n.last, [kind]: entry};
      n.recent = {...n.recent, [kind]: [entry, ...(n.recent[kind] || [])].slice(0, 5)};
    }
  }

  /**
   * Lista de medios (.m3u8 con #EXTINF) tal como la manda el servidor:
   * cuántos segmentos trae y su duración objetivo. Es lo que decide cuánto
   * margen hay para ubicarse detrás del vivo.
   */
  recordPlaylist(response) {
    try {
      const data = response?.data;
      if (!data || data.byteLength > 512 * 1024) return;
      const text = new TextDecoder('utf-8').decode(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
      if (!text.includes('#EXTINF')) return; // lista maestra
      const segments = (text.match(/#EXTINF/g) || []).length;
      const target = Number((text.match(/#EXT-X-TARGETDURATION:\s*([\d.]+)/) || [])[1]) || null;
      const kind = /audio/i.test(String(response?.uri || '')) ? 'audio' : 'video';
      this.net.playlist = {...this.net.playlist, [kind]: {segments, target, endList: text.includes('#EXT-X-ENDLIST'), at: Date.now()}};
    } catch (e) {
      devLog('playlist: no se pudo leer', e?.message);
    }
  }

  /** Segmentos que trae la lista de medios en vivo (la del servidor; si no, el índice de Shaka). */
  playlistSegments() {
    const fromServer = this.net.playlist?.video?.segments ?? this.net.playlist?.audio?.segments;
    if (Number.isFinite(fromServer)) return fromServer;
    try {
      const p = this.shaka?.player;
      const active = (p?.getVariantTracks() || []).find((t) => t.active);
      const variant = (p?.getManifest?.()?.variants || []).find((x) => x.id === active?.id);
      const n = variant?.video?.segmentIndex?.getNumReferences?.();
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }

  /** Datos para el panel de estadísticas (null si no hay reproductor). */
  getDiagnostics() {
    const p = this.shaka?.player;
    const v = this.video;
    if (!p || !v) return null;
    try {
      const st = p.getStats() || {};
      const tracks = p.getVariantTracks() || [];
      const active = tracks.find((t) => t.active) || null;
      const now = Number(v.currentTime) || 0;
      const buffered = p.getBufferedInfo?.() || {};
      const total = (buffered.total || []).find((r) => now >= r.start - 0.5 && now <= r.end + 0.5);
      const range = p.seekRange?.() || {};
      const live = p.isLive?.() === true;
      const heap = global.HermesInternal?.getInstrumentedStats?.() || {};
      return {
        state: this.lastState,
        live,
        uptimeS: this.loadStartedAt ? Math.round((Date.now() - this.loadStartedAt) / 1000) : 0,
        profile: active
          ? {
              width: active.width,
              height: active.height,
              kbps: Math.round((active.bandwidth || 0) / 1000),
              fps: active.frameRate || null,
              codecs: active.codecs || [active.videoCodec, active.audioCodec].filter(Boolean).join(', '),
              audioLang: active.language || '',
            }
          : null,
        // Una variante por idioma de audio: se agrupan por resolución+bitrate.
        profiles: Object.values(
          tracks.reduce((acc, t) => {
            const kbps = Math.round((t.bandwidth || 0) / 1000);
            const key = `${t.height}-${kbps}`;
            acc[key] = {height: t.height, kbps, active: Boolean(acc[key]?.active || t.active)};
            return acc;
          }, {}),
        ).sort((a, b) => a.kbps - b.kbps),
        audioLangs: [...new Set(tracks.map((t) => t.language).filter(Boolean))],
        estimatedKbps: Math.round((st.estimatedBandwidth || 0) / 1000),
        streamKbps: Math.round((st.streamBandwidth || 0) / 1000),
        switches: (st.switchHistory || []).length,
        bufferAheadS: total ? Math.max(0, total.end - now) : 0,
        // Distancia aproximada al borde en vivo: lo que queda hasta el punto de
        // arranque más los segmentos de retraso configurados.
        latencyS:
          live && Number.isFinite(range.end)
            ? Math.max(0, range.end - now) + (this.liveBuffer?.liveSyncDurationCount || 0) * (this.net.segmentDurationS || 0)
            : null,
        segmentDurationS: this.net.segmentDurationS || null,
        playlistSegments: this.playlistSegments(),
        playlist: this.net.playlist || null,
        rateUnsupported: playbackRateUnsupported,
        liveBuffer: this.liveBuffer || null,
        stalls: st.stallsDetected || 0,
        gaps: st.gapsJumped || 0,
        bufferingS: st.bufferingTime || 0,
        dropped: st.droppedFrames || 0,
        decoded: st.decodedFrames || 0,
        textLang: (p.getTextTracks?.() || []).find((t) => t.active && p.isTextTrackVisible())?.language || '',
        net: {...this.net},
        jsHeapMb: heap.js_heapSize ? Math.round(heap.js_heapSize / 1048576) : null,
      };
    } catch (e) {
      return {error: e?.message || String(e)};
    }
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
    if (this.latencyTimer) clearInterval(this.latencyTimer);
    const {shaka, video} = this;
    this.shaka = null;
    this.video = null;
    try {
      await shaka?.unload();
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
