import Hls, { XhrLoader } from 'hls.js';
import { buildHlsPlaybackConfig } from './hlsPlaybackConfig';
import { isWindMiddlewareHost, windDirectM3u8FromAny } from './windHlsManifest';
import { isPanaccessRotatingKeyUri } from './sessionHlsXhrSetup';
import {
  describeWindLevels,
  lockWindLevel,
  pickAdaptiveWindLevel,
  pickWindCompatibleLevel,
  tryNextWindLevel,
} from './windLevelSelect';

/** Cada cuánto se reevalúa si conviene subir/bajar de nivel (ver `_startWindAdaptive`). */
const WIND_ADAPTIVE_CHECK_INTERVAL_MS = 10000;
/** Mínimo tiempo entre dos cambios de nivel reales, aunque el check corra más seguido. */
const WIND_ADAPTIVE_MIN_SWITCH_INTERVAL_MS = 20000;

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
 * `instanceof ArrayBuffer` puede fallar aunque el valor SEA un ArrayBuffer
 * real: si viene de un realm/contexto distinto (otro iframe, un Worker, o —
 * confirmado en tests contra jsdom — el resultado de `crypto.subtle.*` que en
 * algunos entornos se construye en el realm nativo de Node en vez del realm
 * del `window`/VM actual), `instanceof` compara identidad del constructor y
 * da `false` pese a que `Object.prototype.toString` sí lo reconoce como tal.
 * Este chequeo es el estándar para "es un ArrayBuffer" sin depender de en qué
 * realm se creó.
 */
function isArrayBufferLike(value) {
  return Object.prototype.toString.call(value) === '[object ArrayBuffer]';
}

/**
 * FIX RACE CONDITION (2026-07): el enfoque anterior desenvolvía la key en el
 * handler de `Hls.Events.KEY_LOADED` con un `.then()` "fire-and-forget" que
 * pisaba `decryptdata.key` cuando la promesa resolvía. El problema: hls.js
 * dispara `KEY_LOADED` de forma SÍNCRONA y sigue con la carga/descifrado del
 * fragmento en el mismo tick (ver `StreamController._doFragLoad` en
 * hls.js/dist — no espera a los listeners del evento), así que había una
 * carrera real entre "la key ya se desenvolvió" y "hls.js ya intentó
 * descifrar con ella". Cuando se perdía la carrera, resultaba en el error
 * observado en consola: "WebCrypto and softwareDecrypt: failed to decrypt
 * data" / fragParsingError (no fatal → hls.js reintenta el mismo fragmento,
 * y en el reintento la key YA está corregida, por eso el contenido
 * "reproduce igual, pero con errores en consola"). En operadores/streams
 * donde esta carrera se pierde de forma consistente (no solo ocasional), el
 * resultado es directamente "no reproduce": se agota el único intento de
 * `recoverMediaError()` con la key todavía envuelta y el error termina fatal.
 *
 * La solución correcta es desenvolver la key en la CAPA DE RED, antes de que
 * hls.js construya `decryptdata.key` — así el evento `KEY_LOADED` nunca llega
 * a dispararse con la key equivocada. hls.js no expone un "key loader"
 * separado: tanto manifest/level como la key de un fragmento pasan por
 * `config.loader` (confirmado en el código fuente de hls.js, `KeyLoader.
 * loadKeyHTTP` usa `config.loader` directamente, no un loader propio). Por
 * eso este Loader debe delegar CUALQUIER request que no sea una key
 * ('keyInfo' in context la identifica sin ambigüedad, es el campo propio del
 * contexto de key de hls.js) a `super.load()` sin tocar nada.
 */
export class PanaccessKeyUnwrapLoader extends XhrLoader {
  load(context, config, callbacks) {
    const isKeyRequest = 'keyInfo' in context && isPanaccessRotatingKeyUri(context.url || '');
    if (!isKeyRequest) {
      super.load(context, config, callbacks);
      return;
    }

    const originalOnSuccess = callbacks.onSuccess;
    const interceptedCallbacks = {
      ...callbacks,
      onSuccess: (response, stats, ctx, networkDetails) => {
        const raw = response?.data;
        if (!isArrayBufferLike(raw) || raw.byteLength <= 16) {
          originalOnSuccess(response, stats, ctx, networkDetails);
          return;
        }
        unwrapPanaccessKey(new Uint8Array(raw))
          .then((realKey) => {
            originalOnSuccess({ ...response, data: realKey.buffer }, stats, ctx, networkDetails);
          })
          .catch((err) => {
            // Este catch ya no es un "fire and forget" silencioso: si el
            // unwrap falla acá, la key JAMÁS le llega a hls.js (a diferencia
            // del bug anterior, donde la key corrupta se filtraba igual).
            // Se loguea SIEMPRE (no solo DEV) porque para el usuario esto es
            // indistinguible de "no reproduce", y sin este log en producción
            // no hay forma de saber si un operador nuevo usa un wrapper de
            // key distinto al reverse-engineered (ver comentario en
            // PANACCESS_KEY_WRAP_KEY más arriba).
            console.error(
              '[HlsPlayback] no se pudo desenvolver la key de contenido — el operador podría usar un wrapper distinto al conocido',
              { url: context.url, keyBytes: raw.byteLength, err },
            );
            originalOnSuccess(response, stats, ctx, networkDetails);
          });
      },
    };

    super.load(context, config, interceptedCallbacks);
  }
}

/**
 * Detalles de hls.js que indican que un segmento SÍ se descargó (200 OK, se
 * ve bajar en Network) pero no llegó a convertirse en video reproducible
 * (demux/append). hls.js los reporta como no-fatal y simplemente pasa al
 * próximo fragmento — en un canal en vivo, cada fragmento nuevo es "virgen"
 * para el contador de reintentos interno de hls.js (nunca es el MISMO
 * fragmento fallando dos veces), así que su propio umbral de "esto ya es
 * fatal" nunca se dispara. Resultado observado en producción: segmentos
 * bajando en bucle indefinido, consola sin ningún error (los no-fatales solo
 * se logean en DEV), pantalla de carga sin salir nunca.
 */
const STUCK_MEDIA_ERROR_DETAILS = new Set(['fragParsingError', 'bufferAppendError']);
const STUCK_MEDIA_ERROR_LIMIT = 6;

function toPlaybackError(data) {
  if (!data) return new Error('Error HLS');
  const codecMsg =
    data.details === 'codecUnsupported' ||
    data.details === 'bufferIncompatibleCodecsError' ||
    data.details === 'bufferAddCodecError'
      ? 'Audio/vídeo no compatible con el navegador (H.264 + AAC requerido en web)'
      : null;
  const authMsg =
    data.type === Hls.ErrorTypes.NETWORK_ERROR && data.response?.code === 401
      ? 'Sesión de streaming inválida (401) — la licencia expiró o pasó a otro dispositivo'
      : null;
  return new Error(authMsg || codecMsg || data.details || data.type || 'Error HLS');
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
    this._nonFatalMediaErrorCount = 0;
    this._adaptiveTimer = null;
    this._lastAdaptiveSwitchAt = 0;
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
    this._nonFatalMediaErrorCount = 0;
    if (this._networkRetryTimer != null) {
      clearTimeout(this._networkRetryTimer);
      this._networkRetryTimer = null;
    }
    if (this._adaptiveTimer != null) {
      clearInterval(this._adaptiveTimer);
      this._adaptiveTimer = null;
    }
    this._lastAdaptiveSwitchAt = 0;

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
    const hlsConfig = buildHlsPlaybackConfig(src);
    // Ver PanaccessKeyUnwrapLoader arriba: desenvuelve la key AES-128 rotativa
    // de este middleware en la capa de red, antes de que hls.js la use —
    // reemplaza al viejo unwrap en KEY_LOADED (con condición de carrera real).
    hlsConfig.loader = PanaccessKeyUnwrapLoader;
    const hls = new Hls(hlsConfig);
    this._hls = hls;

    const wind = isWindMiddlewareHost(src);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (generation !== this._loadGeneration) return;
      if (wind) {
        this._lockedLevel = pickWindCompatibleLevel(hls);
        this._startWindAdaptive(hls, generation);
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
      this._nonFatalMediaErrorCount = 0;
      this._emitLoaded();
      if (autoPlay) this._ensurePlay(videoEl);
    });

    // NOTA: el unwrap de la key AES-128 rotativa de este middleware (`mekey`)
    // ya NO se hace acá en KEY_LOADED (ver PanaccessKeyUnwrapLoader arriba,
    // que la resuelve a nivel de red antes de que hls.js la reciba). Para
    // cuando este evento se dispara, `decryptdata.key` ya viene desenvuelta.

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
      if (!data?.fatal) {
        if (data?.type === Hls.ErrorTypes.MEDIA_ERROR && STUCK_MEDIA_ERROR_DETAILS.has(data.details)) {
          this._nonFatalMediaErrorCount += 1;
          if (this._nonFatalMediaErrorCount >= STUCK_MEDIA_ERROR_LIMIT) {
            this._nonFatalMediaErrorCount = 0;
            // Se logea SIEMPRE (no solo DEV): es la única señal visible de
            // este atasco en producción, donde hls.js nunca marca el error
            // como fatal por sí solo. Se trata como fatal a partir de acá,
            // reusando la misma cadena de recuperación (recoverMediaError()
            // una vez, y si no alcanza, escalar a onError -> reactivación de
            // licencia/sesión en PlayerContext).
            console.error(
              '[HlsPlayback] atascado: fragmentos bajan (200 OK) pero no bufferizan —',
              STUCK_MEDIA_ERROR_LIMIT,
              'fallos de demux/append seguidos sin ningún FRAG_BUFFERED. Tratando como fatal.',
              data,
            );
            this._handleFatalError(hls, src, { ...data, fatal: true }, generation);
          }
        }
        return;
      }
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
      hls.on(Hls.Events.FRAG_PARSING_METADATA, () => console.log('[HlsPlayback] FRAG_PARSING_METADATA'));
      hls.on(Hls.Events.BUFFER_APPENDING, (_e, d) => console.log('[HlsPlayback] BUFFER_APPENDING', d?.type));
      hls.on(Hls.Events.BUFFER_APPENDED, (_e, d) => console.log('[HlsPlayback] BUFFER_APPENDED', d?.type));
    }

    hls.loadSource(src);
    hls.attachMedia(videoEl);

    return Promise.resolve({ mode: 'hls.js', hls });
  }

  /**
   * ABR acotado para Wind: en vez de dejar el nivel fijo elegido en
   * `MANIFEST_PARSED` para toda la sesión, reevalúa cada
   * `WIND_ADAPTIVE_CHECK_INTERVAL_MS` si el ancho de banda estimado por
   * hls.js (`hls.bandwidthEstimate`, se sigue actualizando aunque el nivel
   * esté fijado a mano) alcanza para subir un escalón, o ya no alcanza para
   * el actual y hay que bajar uno -- ver `pickAdaptiveWindLevel` para el por
   * qué de la histéresis y por qué es seguro (nunca sale del subconjunto de
   * codec compatible). Solo empieza a mover el nivel después del primer
   * fragmento bufferizado (`_loadedEmitted`): el estimador de hls.js arranca
   * con un valor semilla poco confiable antes de eso.
   */
  _startWindAdaptive(hls, generation) {
    if (this._adaptiveTimer != null) {
      clearInterval(this._adaptiveTimer);
    }
    this._lastAdaptiveSwitchAt = Date.now();
    this._adaptiveTimer = setInterval(() => {
      if (generation !== this._loadGeneration || this._hls !== hls) {
        clearInterval(this._adaptiveTimer);
        this._adaptiveTimer = null;
        return;
      }
      if (!this._loadedEmitted) return;
      if (Date.now() - this._lastAdaptiveSwitchAt < WIND_ADAPTIVE_MIN_SWITCH_INTERVAL_MS) return;

      const next = pickAdaptiveWindLevel(hls, this._lockedLevel, hls.bandwidthEstimate);
      if (next !== this._lockedLevel) {
        lockWindLevel(hls, next);
        this._lockedLevel = next;
        this._lastAdaptiveSwitchAt = Date.now();
        if (import.meta.env.DEV) {
          console.log(
            '[HlsPlayback] adaptive level ->',
            next,
            'bandwidthEstimate',
            Math.round(hls.bandwidthEstimate || 0),
          );
        }
      }
    }, WIND_ADAPTIVE_CHECK_INTERVAL_MS);
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

    // 401 en un manifiesto/nivel/fragmento/key de este middleware significa
    // que la sesión/licencia dejó de ser válida (expiró, o se la llevó otro
    // dispositivo) — no un corte de red transitorio. Reintentar la MISMA URL
    // con la MISMA sesión revocada nunca va a funcionar: solo suma varios
    // segundos de pantalla congelada antes de llegar al recovery real
    // (`tryRecoverAfterError` en PlayerContext, que reactiva la licencia y
    // recarga). Por eso este caso se excluye del backoff de red y cae directo
    // al `onError` de más abajo.
    const isAuthError = data.type === Hls.ErrorTypes.NETWORK_ERROR && data.response?.code === 401;

    if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !isAuthError && this._scheduleNetworkRetry(hls, generation)) {
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
