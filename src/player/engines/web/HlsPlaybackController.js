import Hls from 'hls.js';
import { buildHlsPlaybackConfig } from './hlsPlaybackConfig';
import { isWindMiddlewareHost, windDirectM3u8FromAny } from './windHlsManifest';
import { isPanaccessRotatingKeyUri } from './sessionHlsXhrSetup';
import {
  describeWindLevels,
  pickWindCompatibleLevel,
  tryNextWindLevel,
} from './windLevelSelect';

const ZERO_IV = new Uint8Array(16);

function hasTsSyncPattern(bytes) {
  return bytes.length >= 377 && bytes[0] === 0x47 && bytes[188] === 0x47 && bytes[376] === 0x47;
}

function sequenceNumberIv(sn) {
  const iv = new Uint8Array(16);
  const n = sn >>> 0;
  iv[12] = (n >>> 24) & 0xff;
  iv[13] = (n >>> 16) & 0xff;
  iv[14] = (n >>> 8) & 0xff;
  iv[15] = n & 0xff;
  return iv;
}

/**
 * Diagnóstico definitivo (una sola vez por carga, solo DEV): reproduce el
 * descifrado AES-128-CBC de forma independiente (WebCrypto directo) contra
 * TODAS las variantes plausibles, en vez de pedirle al usuario que corra un
 * script aparte. Confirmado en vivo (log previo): la "key" que sirve este
 * middleware (`requestMode=mekey`) para un AES-128 (que debería ser de 16
 * bytes) llega con 32 bytes — por eso se prueban también las dos formas de
 * partir esos 32 bytes en key(16)+iv(16), además de los casos de 16 bytes
 * puros con IV=0/IV=sn por si algún stream sí trae el tamaño correcto.
 */
async function diagnoseCbcDecryption(frag, payloadBuffer, originalKeyBytes) {
  const rawKey = originalKeyBytes || frag?.decryptdata?.key;
  if (!rawKey || !(rawKey instanceof Uint8Array)) {
    console.log('[HlsPlayback][diag] sn', frag?.sn, 'sin key todavía');
    return;
  }

  const rawBytes = new Uint8Array(payloadBuffer);
  const rawLooksLikeTs = hasTsSyncPattern(rawBytes);
  const seqIv = sequenceNumberIv(frag.sn);

  const candidates = [];
  if (rawKey.length === 16) {
    candidates.push({ label: 'key(16 bytes tal cual), IV=0', key: rawKey, iv: new Uint8Array(16) });
    candidates.push({ label: 'key(16 bytes tal cual), IV=sn', key: rawKey, iv: seqIv });
  }
  if (rawKey.length === 32) {
    candidates.push({ label: 'key=primeros16, IV=últimos16', key: rawKey.slice(0, 16), iv: rawKey.slice(16, 32) });
    candidates.push({ label: 'key=últimos16, IV=primeros16', key: rawKey.slice(16, 32), iv: rawKey.slice(0, 16) });
    candidates.push({ label: 'key=32 bytes como AES-256, IV=0', key: rawKey, iv: new Uint8Array(16) });
    candidates.push({ label: 'key=32 bytes como AES-256, IV=sn', key: rawKey, iv: seqIv });
  }

  const results = [];
  for (const c of candidates) {
    try {
      const cryptoKey = await crypto.subtle.importKey('raw', c.key, { name: 'AES-CBC' }, false, ['decrypt']);
      const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: c.iv }, cryptoKey, payloadBuffer);
      const bytes = new Uint8Array(plain);
      results.push({
        variante: c.label,
        descifroOk: true,
        pareceTS: hasTsSyncPattern(bytes),
        primeros4Bytes: Array.from(bytes.slice(0, 4)),
      });
    } catch (err) {
      results.push({ variante: c.label, descifroOk: false, error: err?.message });
    }
  }

  console.log(
    '[HlsPlayback][DIAGNOSTICO DEFINITIVO decrypt] sn',
    frag.sn,
    'key original length',
    rawKey.length,
    '— ¿payload SIN descifrar ya parece TS válido?',
    rawLooksLikeTs,
    '— resultados:',
    results,
  );
}

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
    this._networkRetryCount = 0;
    this._networkRetryTimer = null;
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
    this._networkRetryCount = 0;
    if (this._networkRetryTimer != null) {
      clearTimeout(this._networkRetryTimer);
      this._networkRetryTimer = null;
    }

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
      // Un fragmento bufferizado con éxito confirma que la conexión se
      // recuperó (o nunca se cortó) — se resetea el presupuesto de
      // reintentos de red para que un corte transitorio POSTERIOR (ej. 20
      // minutos después) tenga sus propios intentos disponibles, en vez de
      // ir agotando un contador que nunca se limpia durante toda la sesión.
      this._networkRetryCount = 0;
      this._emitLoaded();
      if (autoPlay) this._ensurePlay(videoEl);
    });

    hls.on(Hls.Events.KEY_LOADED, (_event, data) => {
      if (generation !== this._loadGeneration) return;
      const frag = data?.frag;
      const decryptdata = frag?.decryptdata;
      const keyUri = decryptdata?.uri || '';
      // Este middleware (Panaccess: `requestMode=mekey`) rota la key AES-128
      // en CADA segmento (una key nueva por `chunk=`), sin declarar `IV=` en
      // el `#EXT-X-KEY` del manifiesto. Por spec HLS, sin IV explícito hls.js
      // usa el número de secuencia del fragmento como IV (comportamiento
      // correcto y estándar) — pero este middleware en particular cifra con
      // IV fijo en cero (no rota el IV junto con la key), así que ese default
      // "correcto" produce bytes descifrados inválidos y el segmento
      // NUNCA parsea como TS (`fragParsingError` en el 100% de los
      // fragmentos, confirmado en vivo: el fragmento se descarga y
      // desencripta bien, pero el demux siempre falla). Forzamos IV=0 solo
      // para este patrón de URL de key, sin tocar el resto de middlewares.
      if (decryptdata && isPanaccessRotatingKeyUri(keyUri)) {
        decryptdata.iv = ZERO_IV;
        if (import.meta.env.DEV) {
          console.log('[HlsPlayback] IV forzado a 0 (key rotativa por chunk, sin IV en manifiesto)', frag?.sn);
        }
      }
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (generation !== this._loadGeneration) return;
      if (import.meta.env.DEV) {
        // Errores NO fatales (hls.js se recupera solo, ej. un solo segmento
        // que no cargó, un stall de buffer breve) antes no dejaban ningún
        // rastro en consola — si algo se traba "en silencio" (sin llegar a
        // marcarse fatal) esto es lo que lo va a mostrar.
        console[data?.fatal ? 'error' : 'warn'](
          '[HlsPlayback] error',
          data?.fatal ? '(fatal)' : '(no fatal)',
          data?.type,
          data?.details,
          data,
        );
      }
      if (!data?.fatal) return;
      this._handleFatalError(hls, src, data, generation);
    });

    if (import.meta.env.DEV) {
      // Visibilidad de progreso real de buffering: si el video se queda
      // "cargando" sin ningún FRAG_BUFFERED ni error, esto muestra hasta
      // dónde llegó (¿se adjuntó el media? ¿se parseó el manifiesto? ¿se
      // cargó algún fragmento?) para acotar rápido en qué paso se frena.
      hls.on(Hls.Events.MEDIA_ATTACHED, () => console.log('[HlsPlayback] MEDIA_ATTACHED'));
      hls.on(Hls.Events.MANIFEST_LOADED, () => console.log('[HlsPlayback] MANIFEST_LOADED'));
      hls.on(Hls.Events.LEVEL_LOADED, (_e, d) =>
        console.log('[HlsPlayback] LEVEL_LOADED', { live: d?.details?.live, fragCount: d?.details?.fragments?.length }),
      );
      hls.on(Hls.Events.FRAG_LOADING, (_e, d) => console.log('[HlsPlayback] FRAG_LOADING', d?.frag?.url));
      hls.on(Hls.Events.FRAG_LOADED, (_e, d) => console.log('[HlsPlayback] FRAG_LOADED', d?.frag?.sn));

      // Diagnóstico de una sola vez: reproduce el descifrado AES-128-CBC de
      // forma independiente (WebCrypto directo) para el primer fragmento
      // cifrado de este middleware, probando IV=0 e IV=sn a la vez. Ver
      // `diagnoseCbcDecryption` arriba para el detalle de qué prueba y por
      // qué (evita pedirle al usuario que corra un script aparte).
      let diagDone = false;
      hls.on(Hls.Events.FRAG_LOADED, (_e, d) => {
        if (diagDone) return;
        const keyUri = d?.frag?.decryptdata?.uri || '';
        if (!d?.payload || !isPanaccessRotatingKeyUri(keyUri)) return;
        diagDone = true;
        diagnoseCbcDecryption(d.frag, d.payload).catch((err) =>
          console.error('[HlsPlayback][diag] fallo corriendo diagnóstico', err),
        );
      });
      hls.on(Hls.Events.FRAG_PARSING_METADATA, () => console.log('[HlsPlayback] FRAG_PARSING_METADATA'));
      hls.on(Hls.Events.BUFFER_APPENDING, (_e, d) => console.log('[HlsPlayback] BUFFER_APPENDING', d?.type));
      hls.on(Hls.Events.BUFFER_APPENDED, (_e, d) => console.log('[HlsPlayback] BUFFER_APPENDED', d?.type));
    }

    hls.loadSource(src);
    hls.attachMedia(videoEl);

    return Promise.resolve({ mode: 'hls.js', hls });
  }

  /**
   * Backoff de reconexión ante errores de RED fatales (manifiesto/fragmento/
   * key que no cargó, timeouts, etc.) — el caso de "corte de red transitorio"
   * que antes dejaba la pantalla congelada sin ningún intento de recuperación
   * a nivel de motor. Sigue el patrón recomendado por hls.js: en un
   * NETWORK_ERROR fatal, reintentar con `hls.startLoad()` en vez de tirar la
   * toalla enseguida. Backoff simple (1s/2s/4s) acotado a 3 intentos por
   * "racha" de errores; el contador se resetea en cada fragmento bufferizado
   * con éxito (ver `FRAG_BUFFERED` arriba).
   * @returns {boolean} true si se agendó un reintento (el error fatal se considera "manejado" por ahora)
   */
  _scheduleNetworkRetry(hls, generation) {
    const RETRY_DELAYS_MS = [1000, 2000, 4000];
    if (this._networkRetryCount >= RETRY_DELAYS_MS.length) return false;

    const delay = RETRY_DELAYS_MS[this._networkRetryCount];
    this._networkRetryCount += 1;

    if (import.meta.env.DEV) {
      console.warn(
        '[HlsPlayback] network error fatal, reintentando en',
        delay,
        `ms (intento ${this._networkRetryCount}/${RETRY_DELAYS_MS.length})`,
      );
    }

    this._networkRetryTimer = window.setTimeout(() => {
      this._networkRetryTimer = null;
      // Si mientras esperábamos se destruyó el controller o se cargó otra
      // fuente (zapping), este intento ya no aplica.
      if (generation !== this._loadGeneration || this._hls !== hls) return;
      try {
        hls.startLoad();
      } catch {
        // Si el propio restart lanza, no hay mucho más que hacer acá: si la
        // red sigue caída, hls.js va a emitir otro ERROR fatal y este mismo
        // método decidirá si queda presupuesto para un intento más.
      }
    }, delay);

    return true;
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

    if (data.type === Hls.ErrorTypes.NETWORK_ERROR && this._scheduleNetworkRetry(hls, generation)) {
      return;
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
