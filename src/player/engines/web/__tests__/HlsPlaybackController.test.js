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
 * (`requestMode=mekey`, key AES-128 nueva por cada segmento vía `chunk=N`)
 * NO declara `IV=` en el `#EXT-X-KEY` del manifiesto. hls.js, siguiendo el
 * spec HLS al pie de la letra, usa como IV por defecto el número de
 * secuencia del fragmento — pero este middleware en particular cifra con IV
 * fijo en cero. Con el IV "correcto por spec" pero incorrecto para este
 * middleware, CADA fragmento fallaba con `fragParsingError` (confirmado con
 * logs reales: se descarga y desencripta, pero el demux TS nunca es válido).
 * `HlsPlaybackController` ahora fuerza IV=0 específicamente para URIs de key
 * que matchean este patrón (`isPanaccessRotatingKeyUri`).
 */
describe('HlsPlaybackController - IV fijo para middleware Panaccess (key rotativa por chunk)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function keyLoadedData(sn, keyUri) {
    return {
      frag: {
        sn,
        decryptdata: { uri: keyUri, iv: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) },
      },
    };
  }

  it('fuerza IV=0 cuando la key viene de una URI requestMode=mekey', async () => {
    const videoEl = makeVideoEl();
    const controller = new HlsPlaybackController({ onError: () => {} });
    await controller.load(videoEl, 'https://mw.cabledelancer.com/index.php?requestMode=m3u8&streamId=29');
    const hls = controller.instance;

    const data = keyLoadedData(
      1246338,
      'https://mw.cabledelancer.com/index.php?requestMode=mekey&streamId=29&substream=1&chunk=1246338',
    );
    hls.trigger(Hls.Events.KEY_LOADED, data);

    expect(Array.from(data.frag.decryptdata.iv)).toEqual(new Array(16).fill(0));

    controller.destroy();
  });

  it('no toca el IV de keys que no matchean el patrón mekey (otros middlewares)', async () => {
    const videoEl = makeVideoEl();
    const controller = new HlsPlaybackController({ onError: () => {} });
    await controller.load(videoEl, 'https://example.invalid/master.m3u8');
    const hls = controller.instance;

    const originalIv = new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9]);
    const data = {
      frag: { sn: 5, decryptdata: { uri: 'https://example.invalid/key/5.key', iv: originalIv } },
    };
    hls.trigger(Hls.Events.KEY_LOADED, data);

    expect(data.frag.decryptdata.iv).toBe(originalIv);

    controller.destroy();
  });
});
