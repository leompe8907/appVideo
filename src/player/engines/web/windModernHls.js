import Hls from 'hls.js';
import { createSessionHlsXhrSetup } from './sessionHlsXhr';
import { windDirectM3u8FromAny } from './windHlsManifest';
import {
  describeWindLevels,
  pickWindCompatibleLevel,
  tryNextWindLevel,
} from './windLevelSelect';

/**
 * Wind: hls.js moderno + xhrSetup (sessionId en playlists/segmentos hijos).
 */
export function createWindModernHls(videoEl, masterUrl, handlers = {}) {
  if (!videoEl || !Hls.isSupported()) {
    return Promise.reject(new Error('HLS.js moderno no disponible en este navegador'));
  }

  const hls = new Hls({
    enableWorker: false,
    enableSoftwareAES: true,
    xhrSetup: createSessionHlsXhrSetup(),
    capLevelToPlayerSize: false,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 6,
    maxBufferLength: 20,
    maxMaxBufferLength: 40,
  });

  let recoveredMedia = false;
  let retriedDirectManifest = false;
  let codecRetryCount = 0;
  let lockedLevel = -1;
  let loadedEmitted = false;
  let src = windDirectM3u8FromAny(masterUrl);

  const emitLoaded = () => {
    if (loadedEmitted) return;
    loadedEmitted = true;
    handlers.onLoaded?.();
  };

  const ensurePlay = () => {
    const p = videoEl.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => {
        if (err?.name === 'AbortError') return;
        handlers.onError?.(err);
      });
    }
  };

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    lockedLevel = pickWindCompatibleLevel(hls);
    if (import.meta.env.DEV) {
      console.log(
        '[WebEngine] wind MANIFEST_PARSED',
        describeWindLevels(hls),
        'lockedLevel',
        lockedLevel,
        'loadLevel',
        hls.loadLevel,
      );
    }
  });

  hls.on(Hls.Events.BUFFER_CODECS, (_event, data) => {
    if (import.meta.env.DEV) {
      console.log('[WebEngine] wind BUFFER_CODECS', data, 'lockedLevel', lockedLevel);
    }
  });

  hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
    if (lockedLevel >= 0 && data.level !== lockedLevel) return;
    if (import.meta.env.DEV) {
      const level = hls.levels?.[data.level];
      console.log('[WebEngine] wind LEVEL_LOADED', {
        index: data.level,
        videoCodec: level?.videoCodec,
        audioCodec: level?.audioCodec,
      });
    }
  });

  hls.on(Hls.Events.FRAG_BUFFERED, () => {
    emitLoaded();
    ensurePlay();
  });

  const canRetryCodec = () =>
    !loadedEmitted && codecRetryCount < Math.max(0, (hls.levels?.length || 1) - 1);

  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data?.fatal) return;

    if (
      data.type === Hls.ErrorTypes.NETWORK_ERROR &&
      data.details === 'manifestParsingError' &&
      !retriedDirectManifest
    ) {
      const direct = windDirectM3u8FromAny(data.url || src);
      if (direct !== src) {
        retriedDirectManifest = true;
        loadedEmitted = false;
        codecRetryCount = 0;
        src = direct;
        hls.loadSource(direct);
        return;
      }
    }

    const isCodecBufferError =
      data.type === Hls.ErrorTypes.MEDIA_ERROR &&
      (data.details === 'bufferIncompatibleCodecsError' ||
        data.details === 'bufferAddCodecError');

    if (isCodecBufferError && canRetryCodec() && tryNextWindLevel(hls, lockedLevel)) {
      codecRetryCount += 1;
      lockedLevel = hls.loadLevel;
      if (import.meta.env.DEV) {
        console.warn('[WebEngine] wind codec buffer error, retry level', lockedLevel, data.details);
      }
      return;
    }

    if (
      data.type === Hls.ErrorTypes.MEDIA_ERROR &&
      !recoveredMedia &&
      (data.details === 'fragParsingError' || data.details === 'bufferAppendError')
    ) {
      recoveredMedia = true;
      try {
        hls.recoverMediaError();
        return;
      } catch {
        // continuar
      }
    }

    handlers.onError?.(data);
  });

  hls.loadSource(src);
  hls.attachMedia(videoEl);

  return Promise.resolve({ hls, src, blobUrl: null, lockedLevel: () => lockedLevel });
}

export function destroyWindModernHls(instance) {
  if (!instance) return;
  try {
    instance.hls?.destroy?.();
  } catch {
    // noop
  }
}
