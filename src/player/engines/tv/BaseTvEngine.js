import { WebEngine } from '../web/WebEngine';
import { PLAYER_ENGINE_EVENTS, PLAYER_ENGINE_STATES } from '../contracts';

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

  init(container) {
    super.init(container);
    this.isNativeActive = this.tryActivateNativeAdapter(container);
    // #region agent log
    fetch('http://127.0.0.1:7303/ingest/b7e0775d-94a7-44fd-88f2-84907bcf08ad',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'95a16d'},body:JSON.stringify({sessionId:'95a16d',runId:'initial',hypothesisId:'H3',location:'BaseTvEngine.js:29',message:'BaseTvEngine init native activation',data:{platformName:this.platformName,isNativeActive:this.isNativeActive},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    this.bindLifecycleHooks();
  }

  load(url, options = {}) {
    this.currentSource = url;
    this.lastLoadOptions = options;
    if (!this.isNativeActive) {
      super.load(url, options);
      return;
    }

    try {
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, {
        state: PLAYER_ENGINE_STATES.LOADING,
        type: options?.type,
      });
      const handled = this.nativeLoad(url, options);
      // #region agent log
      fetch('http://127.0.0.1:7303/ingest/b7e0775d-94a7-44fd-88f2-84907bcf08ad',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'95a16d'},body:JSON.stringify({sessionId:'95a16d',runId:'initial',hypothesisId:'H4',location:'BaseTvEngine.js:50',message:'BaseTvEngine nativeLoad handled result',data:{platformName:this.platformName,handled,type:options?.type,hasDrm:Boolean(options?.drmConfig&&options?.drmConfig?.type&&options?.drmConfig?.type!=='none')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (handled === false) {
        throw new Error(`[${this.platformName}] nativeLoad not handled`);
      }
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, {
        state: PLAYER_ENGINE_STATES.LOADED,
        type: options?.type,
      });
      if (options?.autoPlay) this.play();
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7303/ingest/b7e0775d-94a7-44fd-88f2-84907bcf08ad',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'95a16d'},body:JSON.stringify({sessionId:'95a16d',runId:'initial',hypothesisId:'H4',location:'BaseTvEngine.js:60',message:'BaseTvEngine fallback to web load',data:{platformName:this.platformName,error:String(error?.message||error)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PLAYING });
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
  // endregion
}

export default BaseTvEngine;

