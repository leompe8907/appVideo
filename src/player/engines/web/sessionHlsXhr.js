import Hls from 'hls.js';
import { isWindMiddlewareHost } from './windHlsManifest';
import { pickWindCompatibleLevel } from './windLevelSelect';

export { createSessionHlsXhrSetup } from './sessionHlsXhrSetup';

/**
 * Antes fijaba `player.srOptions_`/intentaba `player.streamrootHls(...)` —
 * ganchos del plugin vendorizado (Streamroot) ya removido (ver
 * `videojsHlsSourceHandler.js`). Ese motor arma su propio `hlsjsConfig` por
 * carga vía `buildHlsPlaybackConfig(src)`, así que ya no hace falta empujarlo
 * acá. Se mantiene la función (y el enganche Wind) para no tocar los
 * call-sites en `WebEngine.js`.
 */
export function applyStreamrootHlsSessionConfig(player, getSessionId, playbackUrl = '') {
  if (!player) return;
  void getSessionId;
  if (isWindMiddlewareHost(playbackUrl)) {
    attachWindLevelLock(player);
  }
}

/** Fija 360p en Wind tras MANIFEST_PARSED (sin polling). */
export function attachWindLevelLock(player) {
  if (!player) return;

  const bind = () => {
    const hls = player?.tech?.(true)?.hlsProvider?.hls;
    if (!hls || hls.__windLevelLockBound) return Boolean(hls);
    hls.__windLevelLockBound = true;
    const lock = () => pickWindCompatibleLevel(hls);
    hls.on(Hls.Events.MANIFEST_PARSED, lock);
    if (hls.levels?.length) lock();
    return true;
  };

  if (bind()) return;
  player.one('loadstart', () => bind());
  player.one('loadedmetadata', () => bind());
}
