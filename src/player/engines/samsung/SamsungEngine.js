import BaseTvEngine from '../tv/BaseTvEngine';
import { PLAYER_ENGINE_EVENTS, PLAYER_ENGINE_STATES } from '../contracts';
import { isHlsUrl } from '../web/hlsSupport';
import { windDirectM3u8FromAny } from '../web/windHlsManifest';
import { middlewareNeedsSession } from '../web/sessionHlsXhrSetup';

/**
 * Tope defensivo para el auto-clear de un cue de subtítulo (ver
 * `onsubtitlechange` en nativeLoad()): si el firmware manda una `duration`
 * absurda (0, negativa, o un valor gigante por un bug de esa versión de
 * Tizen), el texto no debe quedar pegado en pantalla para siempre.
 */
const SUBTITLE_CUE_MAX_DURATION_MS = 15000;

/** AVPlay solo permite play() en READY o PAUSED (reanudar). */
const AVPLAY_PLAY_STATES = new Set(['READY', 'PAUSED']);

/**
 * AVPlay identifica el contenedor por la extensión de la URL. Los manifiestos
 * de Wind/Panaccess no tienen extensión (`index.php?requestMode=m3u8&...`),
 * lo que hace que `prepareAsync()` falle de entrada con
 * `PLAYER_ERROR_NOT_SUPPORTED_FILE` (TypeMismatchError) — confirmado en
 * hardware Samsung real, antes de llegar siquiera a pedir el manifiesto.
 * El workaround documentado por la comunidad de Tizen/AVPlay es agregar un
 * fragmento `#.m3u8` al final: no viaja en la request HTTP real (los
 * fragmentos son solo del lado cliente), pero le da a AVPlay la pista de
 * formato que necesita para reconocer el stream como HLS.
 */
function toAvPlayCompatibleUrl(url) {
  const direct = windDirectM3u8FromAny(url);
  if (!isHlsUrl(direct) || direct.toLowerCase().includes('.m3u8')) return direct;
  return `${direct}#.m3u8`;
}

/**
 * Engine Samsung Tizen (AVPlay) con fallback WebEngine.
 */
export class SamsungEngine extends BaseTvEngine {
  constructor() {
    super({ platformName: 'samsung' });
    this.nativeAdapter = null;
    this.avplayListener = null;
    this.capabilities = null;
    this._isPreparing = false;
    this._pendingAutoPlay = false;
    this._nativePlayDeferred = false;
    // Audio/subtítulos (AVPlay): a diferencia de video.js, no hay un evento
    // "tracks disponibles" -- se piden a demanda con getTotalTrackInfo(). Se
    // recuerda acá la selección actual porque AVPlay no expone "cuál está
    // seleccionada ahora" en ningún campo de getTotalTrackInfo().
    this._selectedAudioIndex = null;
    this._selectedTextIndex = null;
    this._textEnabled = false;
    this._subtitleCueTimer = null;
  }

  canHandleNatively(url) {
    // Ver comentario en nativeLoad(): este middleware puede requerir
    // desenvolver una key AES-128 rotativa que solo WebEngine sabe manejar.
    return !middlewareNeedsSession(url);
  }

  shouldSkipNativePlayingEvent() {
    return this._nativePlayDeferred === true;
  }

  shouldDeferNativePlayback() {
    return !!this.capabilities?.hasPrepareAsync;
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

  getAvplayState(api) {
    const target = api || this.nativeAdapter?.api;
    if (!target || typeof target.getState !== 'function') return null;
    try {
      return target.getState();
    } catch {
      return null;
    }
  }

  canAvPlay(api) {
    const state = this.getAvplayState(api);
    if (state == null) return true;
    const normalized = String(state).toUpperCase();
    if (normalized === 'PLAYING') return true;
    return AVPLAY_PLAY_STATES.has(normalized);
  }

  clearAvplayListener(api) {
    if (!api || !this.capabilities?.hasSetListener) return;
    try {
      api.setListener({});
    } catch {
      try {
        api.setListener(null);
      } catch {
        // noop
      }
    }
    this.avplayListener = null;
  }

  safeStopAndClose(api, caps = this.capabilities) {
    if (!api) return;
    const state = String(this.getAvplayState(api) || '').toUpperCase();
    if (!state || state === 'NONE') return;

    if (caps?.hasStop && (state === 'PLAYING' || state === 'PAUSED' || state === 'READY')) {
      try {
        api.stop();
      } catch {
        // noop
      }
    }
    if (caps?.hasClose && state !== 'NONE') {
      try {
        api.close();
      } catch {
        // noop
      }
    }
  }

  applyDefaultDisplayRect(api, caps = this.capabilities) {
    if (!api || !caps?.hasSetDisplayRect) return;
    try {
      const width = Number(window?.innerWidth) || 1920;
      const height = Number(window?.innerHeight) || 1080;
      api.setDisplayRect(0, 0, width, height);
    } catch (error) {
      this.emitNativeError(error);
    }
  }

  onPrepareReady(options = {}) {
    this._isPreparing = false;
    this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, {
      state: PLAYER_ENGINE_STATES.LOADED,
      type: options?.type,
    });
    if (this._pendingAutoPlay) {
      this._pendingAutoPlay = false;
      this.startNativePlayback();
    }
  }

  startNativePlayback() {
    const api = this.nativeAdapter?.api;
    if (!api || !this.capabilities?.hasPlay) return;

    const state = String(this.getAvplayState(api) || '').toUpperCase();
    if (state === 'PLAYING') {
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PLAYING });
      return;
    }

    if (!this.canAvPlay(api)) {
      this._pendingAutoPlay = true;
      this._nativePlayDeferred = true;
      return;
    }

    this._nativePlayDeferred = false;

    try {
      api.play();
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PLAYING });
    } catch (error) {
      this.emitNativeError(error);
      throw error;
    }
  }

  nativeLoad(url, options = {}) {
    const api = this.nativeAdapter?.api;
    if (!api || typeof api.open !== 'function') return false;
    const caps = this.capabilities || this.detectCapabilities(api);
    this.capabilities = caps;

    this._isPreparing = false;
    this._pendingAutoPlay = options?.autoPlay === true;
    // Contenido nuevo: la selección de audio/subtítulo del contenido anterior
    // no tiene ningún significado acá (índices de un track table distinto).
    this._selectedAudioIndex = null;
    this._selectedTextIndex = null;
    this._textEnabled = false;
    this._clearSubtitleCueTimer();

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
          // NO verificado contra hardware real (a diferencia de otros
          // comentarios de este archivo) -- firma y comportamiento según la
          // documentación pública de Tizen AVPlay: a diferencia de un <video>
          // HTML5 o video.js, AVPlay no dibuja el subtítulo por sí solo para
          // la mayoría de los formatos embebidos en HLS -- el texto de cada
          // cue llega por acá y la app tiene que mostrarlo/ocultarlo a mano
          // (ver `_emitSubtitleCue`, PlayerContext.jsx `subtitleCueText` y el
          // overlay en HomePage.jsx). Solo tiene efecto visible si antes se
          // llamó `setSelectTrack('TEXT', idx)` + `setSilentSubtitle(false)`
          // (ver nativeSetSubtitlesEnabled/nativeSelectTextTrack abajo).
          onsubtitlechange: (duration, text) => this._emitSubtitleCue(duration, text),
        };
        api.setListener(this.avplayListener);
      }

      this.safeStopAndClose(api, caps);

      this.applySamsungMediaOptions(api, options?.mediaOption, caps);
      this.applySamsungDrmConfig(api, options?.drmConfig, caps);

      api.open(toAvPlayCompatibleUrl(url));
      this.applyDefaultDisplayRect(api, caps);

      if (caps.hasPrepareAsync) {
        this._isPreparing = true;
        api.prepareAsync(
          () => this.onPrepareReady(options),
          (err) => {
            this._isPreparing = false;
            this._pendingAutoPlay = false;
            this.emitNativeError(err);
          },
        );
      } else if (caps.hasPrepare) {
        api.prepare();
        this.onPrepareReady(options);
      } else if (this._pendingAutoPlay) {
        this._pendingAutoPlay = false;
        this.startNativePlayback();
      }

      return true;
    } catch (error) {
      this._isPreparing = false;
      this._pendingAutoPlay = false;
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

      if (caps?.hasSetDrm) {
        if (type === 'PLAYREADY') {
          api.setDrm('PLAYREADY', 'SetProperties', JSON.stringify({ LicenseServer: licenseUrl, HttpHeader: headers }));
        } else if (type === 'WIDEVINE') {
          api.setDrm('WIDEVINE_CDM', 'SetProperties', JSON.stringify({ LicenseServer: licenseUrl, HttpHeader: headers }));
        }
      }

      if (caps?.hasSetDrmProperty) {
        const drmType = type === 'PLAYREADY' ? 'PLAYREADY' : 'WIDEVINE_CDM';
        const payload = {
          LicenseServer: licenseUrl,
          HttpHeader: headers,
          CustomData: customData,
        };
        api.setDrmProperty(drmType, JSON.stringify(payload));
      }

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

    if (this._isPreparing) {
      this._pendingAutoPlay = true;
      this._nativePlayDeferred = true;
      return true;
    }

    const state = String(this.getAvplayState(api) || '').toUpperCase();
    if (state === 'IDLE') {
      this._pendingAutoPlay = true;
      this._nativePlayDeferred = true;
      return true;
    }

    this._nativePlayDeferred = false;

    if (state === 'PLAYING') return true;

    if (!this.canAvPlay(api)) {
      const err = new Error(`[Samsung] AVPlay play() rejected — state: ${state || 'unknown'}`);
      this.emitNativeError(err);
      throw err;
    }

    try {
      api.play();
      return true;
    } catch (error) {
      this.emitNativeError(error);
      throw error;
    }
  }

  nativePause() {
    const api = this.nativeAdapter?.api;
    if (!api || !this.capabilities?.hasPause) return false;
    try {
      api.pause();
      return true;
    } catch (error) {
      this.emitNativeError(error);
      throw error;
    }
  }

  nativeSeek(seconds) {
    const api = this.nativeAdapter?.api;
    if (!api) return false;
    const ms = Math.max(0, Math.floor(Number(seconds || 0) * 1000));
    if (!this.capabilities?.hasSeekTo) return false;

    const state = String(this.getAvplayState(api) || '').toUpperCase();
    if (state !== 'PLAYING' && state !== 'PAUSED' && state !== 'READY') {
      return false;
    }

    try {
      api.seekTo(ms);
      return true;
    } catch (error) {
      this.emitNativeError(error);
      throw error;
    }
  }

  nativeSetDimensions(rect) {
    const api = this.nativeAdapter?.api;
    if (!api) return false;
    const left = Number.isFinite(rect?.left) ? rect.left : 0;
    const top = Number.isFinite(rect?.top) ? rect.top : 0;
    const width = Number.isFinite(rect?.width) ? rect.width : window.innerWidth;
    const height = Number.isFinite(rect?.height) ? rect.height : window.innerHeight;
    if (!this.capabilities?.hasSetDisplayRect) return false;
    try {
      api.setDisplayRect(left, top, width, height);
      return true;
    } catch (error) {
      this.emitNativeError(error);
      throw error;
    }
  }

  nativeShow() {
    const api = this.nativeAdapter?.api;
    if (!api || !this.capabilities?.hasSetDisplayMethod) return false;
    try {
      api.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN');
      return true;
    } catch (error) {
      this.emitNativeError(error);
      throw error;
    }
  }

  nativeHide() {
    return false;
  }

  nativeDestroy() {
    const api = this.nativeAdapter?.api;
    this._isPreparing = false;
    this._pendingAutoPlay = false;
    this._nativePlayDeferred = false;
    this._selectedAudioIndex = null;
    this._selectedTextIndex = null;
    this._textEnabled = false;
    this._clearSubtitleCueTimer();
    this.clearAvplayListener(api);
    this.safeStopAndClose(api, this.capabilities);
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
      hasGetState: typeof api?.getState === 'function',
      hasGetTotalTrackInfo: typeof api?.getTotalTrackInfo === 'function',
      hasSetSelectTrack: typeof api?.setSelectTrack === 'function',
      hasSetSilentSubtitle: typeof api?.setSilentSubtitle === 'function',
    };
  }

  nativeOnAppHide() {}

  nativeOnAppResume() {}

  /**
   * Parsea `extra_info` (DOMString JSON) de un AVPlayTrackInfo. Distintas
   * versiones de firmware Tizen usan claves algo distintas para el idioma
   * (`language` / `track_lang` / `lang`) -- se prueban todas.
   */
  _parseTrackExtraInfo(track) {
    try {
      const raw = track?.extra_info;
      if (!raw) return {};
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return {};
    }
  }

  _avplayTrackLabel(track, extra, idx, kind) {
    const lang = extra?.language || extra?.track_lang || extra?.lang || track?.language || '';
    if (lang) return String(lang).toUpperCase();
    return kind === 'AUDIO' ? `Audio ${idx + 1}` : `Sub ${idx + 1}`;
  }

  /**
   * Ver comentario largo en `onsubtitlechange` (nativeLoad()) sobre por qué
   * hace falta esto -- AVPlay no dibuja el subtítulo, solo avisa el texto.
   * NO verificado contra hardware real.
   */
  nativeGetTracks() {
    const api = this.nativeAdapter?.api;
    if (!api || !this.capabilities?.hasGetTotalTrackInfo) return null;

    let all;
    try {
      all = api.getTotalTrackInfo();
    } catch (error) {
      this.emitNativeError(error);
      return null;
    }
    if (!Array.isArray(all)) return null;

    const audio = [];
    const text = [];
    let audioIdx = 0;
    let textIdx = 0;

    all.forEach((track) => {
      const type = String(track?.type || '').toUpperCase();
      const extra = this._parseTrackExtraInfo(track);
      const index = Number.isFinite(track?.index) ? track.index : null;
      if (index == null) return;

      if (type === 'AUDIO') {
        audio.push({
          id: String(index),
          label: this._avplayTrackLabel(track, extra, audioIdx, 'AUDIO'),
          lang: String(extra?.language || extra?.track_lang || extra?.lang || ''),
          index,
        });
        audioIdx += 1;
      } else if (type === 'TEXT') {
        text.push({
          id: String(index),
          label: this._avplayTrackLabel(track, extra, textIdx, 'TEXT'),
          lang: String(extra?.language || extra?.track_lang || extra?.lang || ''),
          index,
        });
        textIdx += 1;
      }
    });

    // AVPlay no reporta "cuál está activa": si el usuario todavía no eligió
    // nada explícitamente, se asume la primera de audio (es la que decodifica
    // por defecto casi cualquier firmware) y ningún subtítulo (apagado por
    // defecto, igual que en WebEngine).
    const selectedAudioId =
      this._selectedAudioIndex != null ? String(this._selectedAudioIndex) : (audio[0]?.id ?? null);
    const selectedTextId = this._selectedTextIndex != null ? String(this._selectedTextIndex) : null;

    return {
      audio,
      text,
      selectedAudioId,
      selectedTextId,
      textEnabled: this._textEnabled === true,
    };
  }

  _emitSamsungTracksChange() {
    const snap = this.nativeGetTracks();
    if (snap) this.emit(PLAYER_ENGINE_EVENTS.TRACKS_CHANGE, snap);
  }

  nativeSelectAudioTrack(id) {
    const api = this.nativeAdapter?.api;
    if (!api || !this.capabilities?.hasSetSelectTrack) return false;
    const index = Number(id);
    if (!Number.isFinite(index)) return false;

    try {
      api.setSelectTrack('AUDIO', index);
    } catch (error) {
      this.emitNativeError(error);
      return false;
    }
    this._selectedAudioIndex = index;
    this._emitSamsungTracksChange();
    return true;
  }

  nativeSelectTextTrack(id) {
    const api = this.nativeAdapter?.api;
    if (!api || !this.capabilities?.hasSetSelectTrack) return false;
    const index = Number(id);
    if (!Number.isFinite(index)) return false;

    try {
      api.setSelectTrack('TEXT', index);
    } catch (error) {
      this.emitNativeError(error);
      return false;
    }
    this._selectedTextIndex = index;
    // Seleccionar un track de texto no lo muestra por sí solo -- ver
    // nativeSetSubtitlesEnabled(). El llamador (PlayerContext.selectTextTrack)
    // ya llama primero a setSubtitlesEnabled(true), así que esto es un
    // refuerzo defensivo, no la única vía.
    if (this._textEnabled && this.capabilities?.hasSetSilentSubtitle) {
      try {
        api.setSilentSubtitle(false);
      } catch (error) {
        this.emitNativeError(error);
      }
    }
    this._emitSamsungTracksChange();
    return true;
  }

  nativeSetSubtitlesEnabled(enabled) {
    const api = this.nativeAdapter?.api;
    if (!api || !this.capabilities?.hasSetSilentSubtitle) return false;
    const want = enabled === true;

    // Activar sin haber elegido nunca un track: elegir el primero disponible
    // (mismo comportamiento que WebEngine.setSubtitlesEnabled con video.js).
    if (want && this._selectedTextIndex == null) {
      const snap = this.nativeGetTracks();
      const first = snap?.text?.[0];
      if (!first) return false; // sin subtítulos disponibles, nada que activar
      if (this.capabilities?.hasSetSelectTrack) {
        try {
          api.setSelectTrack('TEXT', first.index);
        } catch (error) {
          this.emitNativeError(error);
        }
      }
      this._selectedTextIndex = first.index;
    }

    try {
      // setSilentSubtitle(true) = silenciar el callback onsubtitlechange
      // (subtítulo "apagado" sin perder la pista seleccionada).
      api.setSilentSubtitle(!want);
    } catch (error) {
      this.emitNativeError(error);
      return false;
    }

    this._textEnabled = want;
    if (!want) this._emitSubtitleCue(0, '');
    this._emitSamsungTracksChange();
    return true;
  }

  _clearSubtitleCueTimer() {
    if (this._subtitleCueTimer != null) {
      clearTimeout(this._subtitleCueTimer);
      this._subtitleCueTimer = null;
    }
  }

  _emitSubtitleCue(durationMs, text) {
    this._clearSubtitleCueTimer();
    this.emit(PLAYER_ENGINE_EVENTS.SUBTITLE_CUE, { text: text ? String(text) : '' });

    const ms = Number(durationMs);
    if (!text || !Number.isFinite(ms) || ms <= 0) return;
    const clampedMs = Math.min(ms, SUBTITLE_CUE_MAX_DURATION_MS);
    this._subtitleCueTimer = setTimeout(() => {
      this._subtitleCueTimer = null;
      this.emit(PLAYER_ENGINE_EVENTS.SUBTITLE_CUE, { text: '' });
    }, clampedMs);
  }
}

export default SamsungEngine;
