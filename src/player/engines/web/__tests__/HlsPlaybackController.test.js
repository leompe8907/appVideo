import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import Hls from 'hls.js';
import { HlsPlaybackController } from '../HlsPlaybackController.js';

/**
 * jsdom no implementa `MediaSource`, así que `Hls.isSupported()` da `false` y
 * el controller cae siempre a modo nativo (`_loadNative`), donde no existe
 * ninguna lógica de reintento (esa vive en `_loadWithHlsJs`/hls.js). Para
 * poder probar el backoff real hace falta un stub mínimo de `MediaSource` que
 * satisfaga el chequeo de soporte de hls.js — no necesita reproducir video de
 * verdad, solo existir con la forma correcta.
 */
class FakeMediaSource {
  static isTypeSupported() {
    return true;
  }

  constructor() {
    this.readyState = 'open';
    this.sourceBuffers = [];
  }

  addSourceBuffer() {
    const sb = {
      updating: false,
      appendBuffer() {},
      remove() {},
      addEventListener() {},
      removeEventListener() {},
    };
    this.sourceBuffers.push(sb);
    return sb;
  }

  addEventListener() {}

  removeEventListener() {}
}

beforeAll(() => {
  window.MediaSource = FakeMediaSource;
  globalThis.MediaSource = FakeMediaSource;
});

/**
 * Regresión del audit finding "sin reintento/backoff a nivel de aplicación
 * ante errores fatales de streaming": antes, cualquier NETWORK_ERROR fatal
 * que no fuera específicamente `manifestParsingError` escalaba directo a
 * `onError` sin que el motor intentara reconectar — un corte de red
 * transitorio (wifi que parpadea, fragmento que no cargó a tiempo) dejaba la
 * pantalla congelada de inmediato. Estos tests verifican el backoff agregado
 * en `_scheduleNetworkRetry`/`_handleFatalError`: reintentos via
 * `hls.startLoad()` antes de rendirse, y reseteo del presupuesto de
 * reintentos tras un fragmento bufferizado con éxito.
 */

function makeVideoEl() {
  const el = document.createElement('video');
  document.body.appendChild(el);
  return el;
}

function fatalNetworkError(details = 'fragLoadError') {
  return { type: Hls.ErrorTypes.NETWORK_ERROR, details, fatal: true };
}

describe('HlsPlaybackController - backoff de red', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ante un NETWORK_ERROR fatal reintenta con hls.startLoad() en vez de escalar a onError de inmediato', async () => {
    const videoEl = makeVideoEl();
    const onError = vi.fn();
    const controller = new HlsPlaybackController({ onError });

    await controller.load(videoEl, 'https://example.invalid/master.m3u8');
    const hls = controller.instance;
    expect(hls).toBeTruthy();

    const startLoadSpy = vi.spyOn(hls, 'startLoad').mockImplementation(() => {});

    vi.useFakeTimers();
    hls.trigger(Hls.Events.ERROR, fatalNetworkError());
    expect(onError).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(startLoadSpy).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();

    controller.destroy();
  });

  it('agota el presupuesto de reintentos (3) y recién ahí escala a onError', async () => {
    const videoEl = makeVideoEl();
    const onError = vi.fn();
    const controller = new HlsPlaybackController({ onError });

    await controller.load(videoEl, 'https://example.invalid/master.m3u8');
    const hls = controller.instance;
    vi.spyOn(hls, 'startLoad').mockImplementation(() => {});

    vi.useFakeTimers();

    // Intento 1 (delay 1s), 2 (delay 2s), 3 (delay 4s): reintenta.
    hls.trigger(Hls.Events.ERROR, fatalNetworkError());
    await vi.advanceTimersByTimeAsync(1000);
    hls.trigger(Hls.Events.ERROR, fatalNetworkError());
    await vi.advanceTimersByTimeAsync(2000);
    hls.trigger(Hls.Events.ERROR, fatalNetworkError());
    await vi.advanceTimersByTimeAsync(4000);
    expect(onError).not.toHaveBeenCalled();

    // 4º error fatal seguido: sin presupuesto, se rinde y notifica.
    hls.trigger(Hls.Events.ERROR, fatalNetworkError());
    expect(onError).toHaveBeenCalledTimes(1);

    controller.destroy();
  });

  it('un FRAG_BUFFERED exitoso resetea el presupuesto de reintentos para el próximo corte', async () => {
    const videoEl = makeVideoEl();
    const onError = vi.fn();
    const controller = new HlsPlaybackController({ onError });

    await controller.load(videoEl, 'https://example.invalid/master.m3u8');
    const hls = controller.instance;
    const startLoadSpy = vi.spyOn(hls, 'startLoad').mockImplementation(() => {});

    vi.useFakeTimers();

    // Agota los 3 reintentos.
    hls.trigger(Hls.Events.ERROR, fatalNetworkError());
    await vi.advanceTimersByTimeAsync(1000);
    hls.trigger(Hls.Events.ERROR, fatalNetworkError());
    await vi.advanceTimersByTimeAsync(2000);
    hls.trigger(Hls.Events.ERROR, fatalNetworkError());
    await vi.advanceTimersByTimeAsync(4000);
    expect(startLoadSpy).toHaveBeenCalledTimes(3);

    // Se recupera: un fragmento carga bien. Se invoca directamente el
    // listener propio del controller (el último registrado en la zona 'main'
    // para este evento) en vez de `hls.trigger(FRAG_BUFFERED, {})`: ese
    // evento real trae un payload profundo (`frag.stats.loading...`, etc.)
    // que consumen otros controllers internos de hls.js (StreamController y
    // similares) y con un objeto vacío tiran una excepción interna que
    // `hls.trigger` atrapa silenciosamente — abortando el resto de listeners
    // de esa emisión, incluido el nuestro, antes de que corra. Llamar
    // directamente al listener que registramos evita depender de la forma
    // exacta (y frágil ante actualizaciones de hls.js) de ese payload.
    const fragBufferedListeners = hls.listeners(Hls.Events.FRAG_BUFFERED);
    fragBufferedListeners[fragBufferedListeners.length - 1]();

    // Nuevo corte: vuelve a tener presupuesto completo (no escala a onError).
    hls.trigger(Hls.Events.ERROR, fatalNetworkError());
    await vi.advanceTimersByTimeAsync(1000);
    expect(startLoadSpy).toHaveBeenCalledTimes(4);
    expect(onError).not.toHaveBeenCalled();

    controller.destroy();
  });

  it('destroy() durante la espera del backoff cancela el reintento pendiente', async () => {
    const videoEl = makeVideoEl();
    const onError = vi.fn();
    const controller = new HlsPlaybackController({ onError });

    await controller.load(videoEl, 'https://example.invalid/master.m3u8');
    const hls = controller.instance;
    const startLoadSpy = vi.spyOn(hls, 'startLoad').mockImplementation(() => {});

    vi.useFakeTimers();
    hls.trigger(Hls.Events.ERROR, fatalNetworkError());
    controller.destroy();
    await vi.advanceTimersByTimeAsync(5000);

    expect(startLoadSpy).not.toHaveBeenCalled();
  });
});

/**
 * Regresión del bug reportado en vivo: el middleware Panaccess
 * (`requestMode=mekey`, key nueva por cada segmento vía `chunk=N`) NO
 * declara `IV=` en el `#EXT-X-KEY` del manifiesto, Y ADEMÁS manda una "key
 * AES-128" que en realidad tiene 32 bytes, no 16. Se probaron primero varias
 * hipótesis de "partir los 32 bytes a la mitad" (key+iv concatenados en
 * distintos órdenes) y NINGUNA funcionó contra el CDN real — comparando con
 * un player de referencia del mismo operador (`brand: "multiplustv"`) se
 * confirmó el esquema real: esos 32 bytes son la key AES-128 real de 16
 * bytes, cifrada con AES-128-CBC + PKCS7 usando una key/IV "wrapper" fijas
 * hardcodeadas en el cliente (un plaintext de 16 bytes con PKCS7 siempre
 * agrega un bloque completo de padding → exactamente 32 bytes). El IV del
 * segmento en sí NO se toca: se deja el default estándar de hls.js (spec
 * HLS: IV = número de secuencia del fragmento cuando el manifiesto no
 * declara `IV=`).
 */
describe('HlsPlaybackController - key Panaccess envuelta (requestMode=mekey)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const MEKEY_URI =
    'https://mw.cabledelancer.com/index.php?requestMode=mekey&streamId=29&substream=1&chunk=1246338';

  const WRAP_KEY = new Uint8Array([
    0xb2, 0xc2, 0x3a, 0x00, 0xff, 0xfe, 0x86, 0x90, 0x17, 0x87, 0x05, 0xae, 0x19, 0xed, 0x08, 0xb8,
  ]);
  const WRAP_IV = new Uint8Array([
    0x91, 0x0f, 0x03, 0xa9, 0x67, 0x6d, 0x2b, 0xf4, 0xe8, 0x22, 0x43, 0x37, 0xe7, 0x1a, 0x87, 0xd3,
  ]);

  async function wrapKey(realKey16) {
    const cryptoKey = await crypto.subtle.importKey('raw', WRAP_KEY, { name: 'AES-CBC' }, false, ['encrypt']);
    const wrapped = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: WRAP_IV }, cryptoKey, realKey16);
    return new Uint8Array(wrapped);
  }

  it('desenvuelve una key de 32 bytes (KEY_LOADED) y deja pisada decryptdata.key con la key real de 16 bytes, sin tocar el IV', async () => {
    const videoEl = makeVideoEl();
    const controller = new HlsPlaybackController({ onError: () => {} });
    await controller.load(videoEl, 'https://mw.cabledelancer.com/index.php?requestMode=m3u8&streamId=29');
    const hls = controller.instance;

    const realKey = crypto.getRandomValues(new Uint8Array(16));
    const wrapped32 = await wrapKey(realKey);
    const originalIv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const data = {
      frag: { sn: 1246338, decryptdata: { uri: MEKEY_URI, key: wrapped32, iv: originalIv } },
    };

    hls.trigger(Hls.Events.KEY_LOADED, data);
    // El unwrap usa WebCrypto (async): esperar a que resuelva.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(Array.from(data.frag.decryptdata.key)).toEqual(Array.from(realKey));
    // El IV es responsabilidad del propio hls.js (default de spec): no se toca acá.
    expect(data.frag.decryptdata.iv).toBe(originalIv);

    controller.destroy();
  });

  it('no toca una key que ya viene de 16 bytes (no hace falta desenvolver)', async () => {
    const videoEl = makeVideoEl();
    const controller = new HlsPlaybackController({ onError: () => {} });
    await controller.load(videoEl, 'https://mw.cabledelancer.com/index.php?requestMode=m3u8&streamId=29');
    const hls = controller.instance;

    const key16 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const data = {
      frag: { sn: 1246338, decryptdata: { uri: MEKEY_URI, key: key16, iv: new Uint8Array(16) } },
    };
    hls.trigger(Hls.Events.KEY_LOADED, data);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(data.frag.decryptdata.key).toBe(key16);

    controller.destroy();
  });

  it('no toca keys que no matchean el patrón mekey (otros middlewares)', async () => {
    const videoEl = makeVideoEl();
    const controller = new HlsPlaybackController({ onError: () => {} });
    await controller.load(videoEl, 'https://example.invalid/master.m3u8');
    const hls = controller.instance;

    const originalIv = new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9]);
    const originalKey = crypto.getRandomValues(new Uint8Array(32));
    const data = {
      frag: { sn: 5, decryptdata: { uri: 'https://example.invalid/key/5.key', key: originalKey, iv: originalIv } },
    };
    hls.trigger(Hls.Events.KEY_LOADED, data);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(data.frag.decryptdata.iv).toBe(originalIv);
    expect(data.frag.decryptdata.key).toBe(originalKey);

    controller.destroy();
  });
});
