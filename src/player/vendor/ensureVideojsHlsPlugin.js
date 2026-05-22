let loadPromise = null;

/** Carga el plugin HLS después de video.js/Hls (evita TDZ en el bundle de producción). */
export function ensureVideojsHlsPlugin() {
  if (!loadPromise) {
    loadPromise = import('./videojs-hlsjs-plugin.js');
  }
  return loadPromise;
}
