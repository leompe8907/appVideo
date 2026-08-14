import { WebEngine } from '../web/WebEngine';
import { PLAYER_ENGINE_EVENTS, PLAYER_ENGINE_STATES } from '../contracts';

const NATIVE_INIT_TIMEOUT_MS = 10000;

/**
 * Base para adapters TV.
 *
 * Estrategia:
 * - Intenta usar adapter nativo (si existe y está disponible).
 * - Si no está disponible, hace fallback transparente al WebEngine.
 * - Centraliza hooks de ciclo de vida (hide/resume) para paridad con legacy.
 */
export class BaseTvEngine extends WebEngine {
  constructor({ platformName }) {
    super();
    this.platformName = platformName;
    this.isNativeActive = false;
    this.currentSource = null;
    this.lastLoadOptions = null;
    this.lifecycleBound = false;
    this.boundHandleVisibilityChange = null;
    this.boundHandlePageHide = null;
    this.boundHandlePageShow = null;
  }

  async init(container) {
    await super.init(container);
    this.isNativeActive = await this.activateNativeAdapterWithTimeout();
    if (this.isNativeActive) {
      console.info(`[${this.platformName}] Native adapter active`);
    } else {
      console.info(`[${this.platformName}] Native unavailable — WebEngine fallback`);
    }
    this.bindLifecycleHooks();
  }

  async activateNativeAdapterWithTimeout() {
    let timeoutId;
    try {
      const activated = await Promise.race([
        Promise.resolve().then(() => this.tryActivateNativeAdapter()),
        new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error(`[${this.platformName}] Native adapter init timeout (${NATIVE_INIT_TIMEOUT_MS}ms)`)),
            NATIVE_INIT_TIMEOUT_MS,
          );
        }),
      ]);
      return activated === true;
    } catch (error) {
      console.warn(`[${this.platformName}] Native init failed:`, error?.message || error);
      this.emit(PLAYER_ENGINE_EVENTS.ERROR, error);
      return false;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  load(url, options = {}) {
    this.currentSource = url;
    this.lastLoadOptions = options;
    if (!this.isNativeActive || this.canHandleNatively(url) === false) {
      // `canHandleNatively` === false es una decisión deliberada de ruteo
      // (ej. contenido que el adapter nativo no puede desencriptar), no un
      // fallo — por eso NO pasa por el try/catch de abajo, que emite
      // PLAYER_ENGINE_EVENTS.ERROR y dispararía el overlay de error en el
      // HUD por una fracción de segundo antes de que WebEngine cargue bien.
      super.load(url, options);
      return;
    }

    try {
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, {
        state: PLAYER_ENGINE_STATES.LOADING,
        type: options?.type,
      });
      const handled = this.nativeLoad(url, options);
      if (handled === false) {
        throw new Error(`[${this.platformName}] nativeLoad not handled`);
      }
      const deferPlayback = this.shouldDeferNativePlayback?.() === true;
      if (!deferPlayback) {
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, {
          state: PLAYER_ENGINE_STATES.LOADED,
          type: options?.type,
        });
        if (options?.autoPlay) this.play();
      }
    } catch (error) {
      this.emit(PLAYER_ENGINE_EVENTS.ERROR, error);
      super.load(url, options);
    }
  }

  play() {
    if (!this.isNativeActive) {
      super.play();
      return;
    }
    try {
      const handled = this.nativePlay();
      if (handled === false) {
        throw new Error(`[${this.platformName}] nativePlay not handled`);
      }
      if (this.shouldSkipNativePlayingEvent?.() !== true) {
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PLAYING });
      }
    } catch (error) {
      this.emit(PLAYER_ENGINE_EVENTS.ERROR, error);
      super.play();
    }
  }

  pause() {
    if (!this.isNativeActive) {
      super.pause();
      return;
    }
    try {
      const handled = this.nativePause();
      if (handled === false) {
        throw new Error(`[${this.platformName}] nativePause not handled`);
      }
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PAUSED });
    } catch (error) {
      this.emit(PLAYER_ENGINE_EVENTS.ERROR, error);
      super.pause();
    }
  }

  seek(seconds) {
    if (!this.isNativeActive) {
      super.seek(seconds);
      return;
    }
    try {
      const target = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
      this.emit(PLAYER_ENGINE_EVENTS.SEEK_START, { target });
      const handled = this.nativeSeek(target);
      if (handled === false) {
        throw new Error(`[${this.platformName}] nativeSeek not handled`);
      }
      this.emit(PLAYER_ENGINE_EVENTS.SEEK_END, { currentTime: target });
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.SEEKED });
    } catch (error) {
      this.emit(PLAYER_ENGINE_EVENTS.ERROR, error);
      super.seek(seconds);
    }
  }

  setDimensions(rect = {}) {
    if (!this.isNativeActive) {
      super.setDimensions(rect);
      return;
    }
    try {
      const handled = this.nativeSetDimensions(rect);
      if (handled === false) {
        throw new Error(`[${this.platformName}] nativeSetDimensions not handled`);
      }
    } catch (error) {
      this.emit(PLAYER_ENGINE_EVENTS.ERROR, error);
      super.setDimensions(rect);
    }
  }

  show() {
    if (!this.isNativeActive) {
      super.show();
      return;
    }
    try {
      const handled = this.nativeShow();
      if (handled === false) throw new Error(`[${this.platformName}] nativeShow not handled`);
    } catch {
      super.show();
    }
  }

  hide() {
    if (!this.isNativeActive) {
      super.hide();
      return;
    }
    try {
      const handled = this.nativeHide();
      if (handled === false) throw new Error(`[${this.platformName}] nativeHide not handled`);
    } catch {
      super.hide();
    }
  }

  /**
   * Audio/subtítulos: mismo patrón de fallback que play()/pause()/seek() de
   * arriba, pero sin el try/catch "silencioso -> super" en caso de éxito
   * (acá "no implementado" NO es un error, es routing normal -- ej. LG con
   * adapter `injected` opaco, o Samsung sin alguna capability puntual de
   * AVPlay). `nativeGetTracks()` devuelve `null` cuando el adapter nativo no
   * tiene forma de listar tracks; en ese caso se cae al `super.getTracks()`
   * heredado de WebEngine (video.js), que en el peor caso devuelve listas
   * vacías -- inofensivo, oculta el botón de Audio/Subtítulos en el HUD en
   * vez de romper algo.
   */
  getTracks() {
    if (this.isNativeActive) {
      try {
        const native = this.nativeGetTracks();
        if (native) return native;
      } catch (error) {
        this.emitNativeError(error);
      }
    }
    return super.getTracks();
  }

  selectAudioTrack(id) {
    if (this.isNativeActive) {
      try {
        if (this.nativeSelectAudioTrack(id)) return true;
      } catch (error) {
        this.emitNativeError(error);
      }
    }
    return super.selectAudioTrack(id);
  }

  selectTextTrack(id) {
    if (this.isNativeActive) {
      try {
        if (this.nativeSelectTextTrack(id)) return true;
      } catch (error) {
        this.emitNativeError(error);
      }
    }
    return super.selectTextTrack(id);
  }

  setSubtitlesEnabled(enabled) {
    if (this.isNativeActive) {
      try {
        if (this.nativeSetSubtitlesEnabled(enabled)) return true;
      } catch (error) {
        this.emitNativeError(error);
      }
    }
    return super.setSubtitlesEnabled(enabled);
  }

  destroy() {
    this.unbindLifecycleHooks();
    if (this.isNativeActive) {
      try {
        this.nativeDestroy();
      } catch {
        // noop
      }
    }
    super.destroy();
  }

  bindLifecycleHooks() {
    if (this.lifecycleBound) return;
    this.boundHandleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.onAppHide();
      } else {
        this.onAppResume();
      }
    };
    this.boundHandlePageHide = () => this.onAppHide();
    this.boundHandlePageShow = () => this.onAppResume();

    document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
    window.addEventListener('pagehide', this.boundHandlePageHide);
    window.addEventListener('pageshow', this.boundHandlePageShow);
    this.lifecycleBound = true;
  }

  unbindLifecycleHooks() {
    if (!this.lifecycleBound) return;
    document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
    window.removeEventListener('pagehide', this.boundHandlePageHide);
    window.removeEventListener('pageshow', this.boundHandlePageShow);
    this.lifecycleBound = false;
  }

  onAppHide() {
    if (!this.isNativeActive) return;
    try {
      this.nativeOnAppHide();
    } catch {
      // noop
    }
  }

  onAppResume() {
    if (!this.isNativeActive) return;
    try {
      this.nativeOnAppResume();
    } catch {
      // noop
    }
  }

  mapNativeState(state) {
    const value = String(state || '').toLowerCase();
    if (value === 'buffering' || value === 'loading') return PLAYER_ENGINE_STATES.LOADING;
    if (value === 'ready' || value === 'loaded') return PLAYER_ENGINE_STATES.LOADED;
    if (value === 'playing' || value === 'play') return PLAYER_ENGINE_STATES.PLAYING;
    if (value === 'paused' || value === 'pause') return PLAYER_ENGINE_STATES.PAUSED;
    if (value === 'seeking') return PLAYER_ENGINE_STATES.SEEKING;
    if (value === 'seeked') return PLAYER_ENGINE_STATES.SEEKED;
    if (value === 'ended' || value === 'complete') return PLAYER_ENGINE_STATES.ENDED;
    return null;
  }

  emitNativeState(state, extra = {}) {
    const mappedState = this.mapNativeState(state);
    if (!mappedState) return;
    this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: mappedState, ...extra });
  }

  emitNativeTime(currentTime, duration) {
    this.emit(PLAYER_ENGINE_EVENTS.TIME_UPDATE, { currentTime, duration });
  }

  emitNativeDuration(duration) {
    this.emit(PLAYER_ENGINE_EVENTS.DURATION_CHANGE, { duration });
  }

  emitNativeError(error) {
    this.emit(PLAYER_ENGINE_EVENTS.ERROR, error);
  }

  // region Métodos para sobreescribir en adapters concretos
  tryActivateNativeAdapter() {
    return false;
  }

  /** Permite a un adapter declinar el manejo nativo de una URL puntual (sin que cuente como error). */
  canHandleNatively() {
    return true;
  }

  nativeLoad() {}

  nativePlay() {}

  nativePause() {}

  nativeSeek() {}

  nativeSetDimensions() {}

  nativeShow() {}

  nativeHide() {}

  nativeDestroy() {}

  nativeOnAppHide() {}

  nativeOnAppResume() {}

  /** `null` = adapter nativo no sabe listar tracks -> cae a WebEngine (ver getTracks() arriba). */
  nativeGetTracks() {
    return null;
  }

  nativeSelectAudioTrack() {
    return false;
  }

  nativeSelectTextTrack() {
    return false;
  }

  nativeSetSubtitlesEnabled() {
    return false;
  }
  // endregion
}

export default BaseTvEngine;

