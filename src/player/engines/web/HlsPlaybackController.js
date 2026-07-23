import Hls from 'hls.js';
import { buildHlsPlaybackConfig } from './hlsPlaybackConfig';
import { isWindMiddlewareHost, windDirectM3u8FromAny } from './windHlsManifest';
import { isPanaccessRotatingKeyUri } from './sessionHlsXhrSetup';
import {
  describeWindLevels,
  pickWindCompatibleLevel,
  tryNextWindLevel,
} from './windLevelSelect';

/**
 * Chequea sync bytes TS (0x47 cada 188 bytes) en varios paquetes seguidos en
 * vez de solo 3 puntos fijos: con la key correcta, aunque el IV estuviera
 * mal, en CBC solo se corrompe el primer bloque (16 bytes) — el resto se
 * encadena contra el ciphertext, no contra el IV — así que exigir que casi
 * todos los paquetes muestreados den 0x47 es mucho más robusto contra falsos
 * positivos que mirar solo 3 puntos fijos.
 */
function hasTsSyncPattern(bytes) {
  const PACKET_SIZE = 188;
  const packetCount = Math.floor(bytes.length / PACKET_SIZE);
  if (packetCount < 4) return false;
  const sampleCount = Math.min(packetCount, 16);
  let mismatches = 0;
  for (let i = 0; i < sampleCount; i++) {
    if (bytes[i * PACKET_SIZE] !== 0x47) mismatches += 1;
  }
  return mismatches <= 1;
}

/**
 * FIX REAL (confirmado contra un player de referencia del MISMO operador —
 * `brand: "multiplustv"`, que coincide con el CDN `multiplustvhncdn.ddns.net`
 * de este bug — que reproduce este middleware correctamente): los 32 bytes
 * que manda `requestMode=mekey` NO son key+IV concatenados ni una key AES-256
 * suelta. Son la key AES-128 real de 16 bytes, cifrada con AES-128-CBC usando
 * una key/IV "wrapper" fijas hardcodeadas en el cliente, con padding PKCS7 —
 * un plaintext de 16 bytes con PKCS7 siempre agrega un bloque completo de
 * padding, dando exactamente 32 bytes de vuelta. Por eso ninguna de las
 * variantes de "partir los 32 bytes a la mitad" funcionaba: hay que
 * DESCIFRAR esos 32 bytes (no partirlos) para obtener la key real.
 *
 * El IV del segmento en sí NO se toca: se deja el default estándar de hls.js
 * (spec HLS: cuando el manifiesto no declara `IV=`, usa el número de
 * secuencia del fragmento) — en el player de referencia tampoco hay ninguna
 * lógica de IV custom, solo este "unwrap" de la key.
 */
const PANACCESS_KEY_WRAP_KEY = new Uint8Array([
  0xb2, 0xc2, 0x3a, 0x00, 0xff, 0xfe, 0x86, 0x90, 0x17, 0x87, 0x05, 0xae, 0x19, 0xed, 0x08, 0xb8,
]);
const PANACCESS_KEY_WRAP_IV = new Uint8Array([
  0x91, 0x0f, 0x03, 0xa9, 0x67, 0x6d, 0x2b, 0xf4, 0xe8, 0x22, 0x43, 0x37, 0xe7, 0x1a, 0x87, 0xd3,
]);

async function unwrapPanaccessKey(rawKeyBytes) {
  if (!(rawKeyBytes instanceof Uint8Array) || rawKeyBytes.length <= 16) {
    return rawKeyBytes;
  }
  const wrapKey = await crypto.subtle.importKey('raw', PANACCESS_KEY_WRAP_KEY, { name: 'AES-CBC' }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: PANACCESS_KEY_WRAP_IV }, wrapKey, rawKeyBytes);
  return new Uint8Array(plain);
}

/**
 * Diagnóstico solo-DEV (una vez por carga): confirma en consola que, para
 * ESTE stream/operador puntual, desenvolver la key con el wrapper de arriba
 * más el IV por defecto de hls.js efectivamente da un TS válido. Si algún día
 * aparece un operador con un wrapper distinto, este log lo va a mostrar
 * (`pareceTS: false`) para saber que hace falta un wrapper nuevo, en vez de
 * fallar en silencio.
 */
async function diagnoseKeyUnwrap(frag, payloadBuffer) {
  const rawKey = frag?.decryptdata?.key;
  if (!(rawKey instanceof Uint8Array) || rawKey.length <= 16) {
    console.log('[HlsPlayback][diag] sn', frag?.sn, 'key ya es de 16 bytes o menos, nada que desenvolver');
    return;
  }
  try {
    const realKey = await unwrapPanaccessKey(rawKey);
    const cryptoKey = await crypto.subtle.importKey('raw', realKey, { name: 'AES-CBC' }, false, ['decrypt']);
    const iv = frag?.decryptdata?.iv;
    const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, payloadBuffer);
    const pareceTS = hasTsSyncPattern(new Uint8Array(plain));
    console.log(
      '[HlsPlayback][diag unwrap] sn',
      frag.sn,
      'key original',
      rawKey.length,
      'bytes → desenvuelta',
      realKey.length,
      'bytes — ¿TS válido tras desencriptar con IV por defecto de hls.js?',
      pareceTS,
    );
  } catch (err) {
    console.error('[HlsPlayback][diag unwrap] sn', frag?.sn, 'fallo desenvolviendo/descifrando', err);
  }
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
      // el `#EXT-X-KEY` del manifiesto — eso lo deja hls.js manejar con su
      // default estándar (IV = número de secuencia del fragmento), sin tocar
      // nada acá. Lo que SÍ hay que arreglar es la key: este middleware no
      // manda los 16 bytes de la key AES-128 en texto plano, la manda
      // ENVUELTA (cifrada con AES-128-CBC + PKCS7 usando una key/IV wrapper
      // fijas) — ver `unwrapPanaccessKey` para el detalle completo.
      if (!decryptdata || !isPanaccessRotatingKeyUri(keyUri)) return;
      if (!(decryptdata.key instanceof Uint8Array) || decryptdata.key.length <= 16) return;

      const wrappedKey = decryptdata.key;
      if (import.meta.env.DEV) {
        // El diagnóstico de FRAG_LOADED corre después de esto y necesita la
        // key ENVUELTA original (la de acá abajo la vamos a pisar) para
        // poder probar el unwrap de forma independiente contra el payload real.
        decryptdata._diagWrappedKey = wrappedKey;
      }
      unwrapPanaccessKey(wrappedKey)
        .then((realKey) => {
          decryptdata.key = realKey;
          if (import.meta.env.DEV) {
            console.log('[HlsPlayback] key Panaccess desenvuelta', wrappedKey.length, '→', realKey.length, 'bytes', frag?.sn);
          }
        })
        .catch((err) => {
          if (import.meta.env.DEV) {
            console.error('[HlsPlayback] fallo desenvolviendo key Panaccess', frag?.sn, err);
          }
        });
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

      // Diagnóstico de una sola vez: confirma de forma independiente
      // (WebCrypto directo, contra el payload cifrado real del primer
      // fragmento de este middleware) que el unwrap de key + IV por defecto
      // de hls.js da un TS válido. Ver `diagnoseKeyUnwrap` arriba.
      let diagDone = false;
      hls.on(Hls.Events.FRAG_LOADED, (_e, d) => {
        if (diagDone) return;
        const decryptdata = d?.frag?.decryptdata;
        const keyUri = decryptdata?.uri || '';
        if (!d?.payload || !isPanaccessRotatingKeyUri(keyUri)) return;
        diagDone = true;
        // Usar la key ENVUELTA original si ya fue pisada por el unwrap de
        // producción (ver KEY_LOADED arriba); si no llegó a pisarse todavía,
        // decryptdata.key sigue siendo la envuelta.
        const fragForDiag = decryptdata._diagWrappedKey
          ? { ...d.frag, decryptdata: { ...decryptdata, key: decryptdata._diagWrappedKey } }
          : d.frag;
        diagnoseKeyUnwrap(fragForDiag, d.payload).catch((err) =>
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
