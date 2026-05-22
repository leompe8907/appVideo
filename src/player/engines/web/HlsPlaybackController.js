import Hls from 'hls.js';
import { buildHlsPlaybackConfig } from './hlsPlaybackConfig';
import { isWindMiddlewareHost, windDirectM3u8FromAny } from './windHlsManifest';
import {
  describeWindLevels,
  pickWindCompatibleLevel,
  tryNextWindLevel,
} from './windLevelSelect';

function toPlaybackError(data) {
  if (!data) return new Error('Error HLS');
  const codecMsg =
    data.details === 'codecUnsupported' ||
    data.details === 'bufferIncompatibleCodecsError' ||
    data.details === 'bufferAddCodecError'
      ? 'Audio/vídeo no compatible con el navegador (H.264 + AAC requerido en web)'
      : null;
  return new Error(codecMsg || data.details || data.type || 'Error HLS');
}

/**
 * Capa HLS única (hls.js npm): carga, niveles Wind, AES, destrucción garantizada.
 */
export class HlsPlaybackController {
  constructor(handlers = {}) {
    this._handlers = handlers;
    this._hls = null;
    this._videoEl = null;
    this._nativeMode = false;
    this._loadGeneration = 0;
    this._loadedEmitted = false;
    this._lockedLevel = -1;
    this._codecRetryCount = 0;
    this._retriedDirectManifest = false;
    this._recoveredMedia = false;
    this._currentSrc = '';
  }

  get instance() {
    return this._hls;
  }

  isActive() {
    return Boolean(this._hls || this._nativeMode);
  }

  destroy() {
    this._loadGeneration += 1;
    this._loadedEmitted = false;
    this._lockedLevel = -1;
    this._codecRetryCount = 0;
    this._retriedDirectManifest = false;
    this._recoveredMedia = false;
    this._currentSrc = '';

    if (this._hls) {
      try {
        this._hls.destroy();
      } catch {
        // noop
      }
      this._hls = null;
    }

    const video = this._videoEl;
    if (video) {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {
        // noop
      }
    }

    this._nativeMode = false;
    this._videoEl = null;
  }

  load(videoEl, masterUrl, { autoPlay = false } = {}) {
    if (!videoEl || !masterUrl) {
      return Promise.reject(new Error('HLS: falta video o URL'));
    }

    this.destroy();
    this._videoEl = videoEl;
    const generation = this._loadGeneration;
    const src = windDirectM3u8FromAny(masterUrl);
    this._currentSrc = src;

    if (Hls.isSupported()) {
      return this._loadWithHlsJs(videoEl, src, { autoPlay, generation });
    }

    return this._loadNative(videoEl, src, { autoPlay, generation });
  }

  _loadNative(videoEl, src, { autoPlay, generation }) {
    this._nativeMode = true;
    videoEl.src = src;

    const onReady = () => {
      if (generation !== this._loadGeneration) return;
      this._emitLoaded();
      if (autoPlay) this._ensurePlay(videoEl);
    };

    videoEl.addEventListener('loadedmetadata', onReady, { once: true });
    videoEl.addEventListener(
      'error',
      () => {
        if (generation !== this._loadGeneration) return;
        const err = videoEl.error;
        this._handlers.onError?.(err || new Error('Error HLS nativo'));
      },
      { once: true },
    );

    return Promise.resolve({ mode: 'native' });
  }

  _loadWithHlsJs(videoEl, src, { autoPlay, generation }) {
    const hls = new Hls(buildHlsPlaybackConfig(src));
    this._hls = hls;

    const wind = isWindMiddlewareHost(src);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (generation !== this._loadGeneration) return;
      if (wind) {
        this._lockedLevel = pickWindCompatibleLevel(hls);
        if (import.meta.env.DEV) {
          console.log(
            '[HlsPlayback]',
            'MANIFEST_PARSED',
            describeWindLevels(hls),
            'lockedLevel',
            this._lockedLevel,
          );
        }
      }
    });

    hls.on(Hls.Events.FRAG_BUFFERED, () => {
      if (generation !== this._loadGeneration) return;
      this._emitLoaded();
      if (autoPlay) this._ensurePlay(videoEl);
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (generation !== this._loadGeneration || !data?.fatal) return;
      this._handleFatalError(hls, src, data, generation);
    });

    hls.loadSource(src);
    hls.attachMedia(videoEl);

    return Promise.resolve({ mode: 'hls.js', hls });
  }

  _handleFatalError(hls, src, data, generation) {
    if (
      data.type === Hls.ErrorTypes.NETWORK_ERROR &&
      data.details === 'manifestParsingError' &&
      !this._retriedDirectManifest
    ) {
      const direct = windDirectM3u8FromAny(data.url || src);
      if (direct !== src) {
        this._retriedDirectManifest = true;
        this._loadedEmitted = false;
        this._codecRetryCount = 0;
        this._currentSrc = direct;
        hls.loadSource(direct);
        return;
      }
    }

    const isCodecBufferError =
      data.type === Hls.ErrorTypes.MEDIA_ERROR &&
      (data.details === 'bufferIncompatibleCodecsError' ||
        data.details === 'bufferAddCodecError');

    const canRetryCodec =
      !this._loadedEmitted &&
      this._codecRetryCount < Math.max(0, (hls.levels?.length || 1) - 1);

    if (isCodecBufferError && canRetryCodec && tryNextWindLevel(hls, this._lockedLevel)) {
      this._codecRetryCount += 1;
      this._lockedLevel = hls.loadLevel;
      if (import.meta.env.DEV) {
        console.warn('[HlsPlayback] codec retry level', this._lockedLevel, data.details);
      }
      return;
    }

    if (
      data.type === Hls.ErrorTypes.MEDIA_ERROR &&
      !this._recoveredMedia &&
      (data.details === 'fragParsingError' || data.details === 'bufferAppendError')
    ) {
      this._recoveredMedia = true;
      try {
        hls.recoverMediaError();
        return;
      } catch {
        // continuar
      }
    }

    if (generation === this._loadGeneration) {
      this._handlers.onError?.(toPlaybackError(data));
    }
  }

  _emitLoaded() {
    if (this._loadedEmitted) return;
    this._loadedEmitted = true;
    this._handlers.onLoaded?.();
  }

  _ensurePlay(videoEl) {
    const p = videoEl.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => {
        if (err?.name === 'AbortError') return;
        this._handlers.onError?.(err);
      });
    }
  }
}
