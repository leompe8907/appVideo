import { videojs } from './videojsAssign.js';
import { registerVideojsHlsSourceHandler } from './videojsHlsSourceHandler.js';

let loadPromise = null;

/**
 * Registra el source handler HLS en video.js (una sola vez).
 *
 * Antes cargaba dinámicamente `videojs-hlsjs-plugin.js`, un bundle vendorizado
 * de 2018 (Streamroot) con su propia copia interna de hls.js. Se reemplazó
 * por `videojsHlsSourceHandler.js`, propio, que usa directamente el hls.js
 * declarado en package.json (mismo que el resto de la app) — ver comentario
 * en ese archivo para el detalle completo. Se mantiene la firma async/Promise
 * para no tener que tocar a los callers (`WebEngine.init()` hace `await`).
 */
export function ensureVideojsHlsPlugin() {
  if (!loadPromise) {
    loadPromise = Promise.resolve(registerVideojsHlsSourceHandler(videojs));
  }
  return loadPromise;
}
