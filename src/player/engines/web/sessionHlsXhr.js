import Hls from 'hls.js';
import { buildHlsPlaybackConfig } from './hlsPlaybackConfig';
import { isWindMiddlewareHost } from './windHlsManifest';
import { pickWindCompatibleLevel } from './windLevelSelect';

export { createSessionHlsXhrSetup } from './sessionHlsXhrSetup';

/** El plugin 10foot usa `plugins.streamrootHls`. */
export function buildStreamrootHlsPluginOptions(getSessionId) {
  return {
    plugins: {
      streamrootHls: {
        hlsjsConfig: buildHlsPlaybackConfig('', getSessionId),
      },
    },
  };
}

export function applyStreamrootHlsSessionConfig(player, getSessionId, playbackUrl = '') {
  if (!player) return;
  const hlsjsConfig = buildHlsPlaybackConfig(playbackUrl, getSessionId);
  player.srOptions_ = player.srOptions_ || {};
  player.srOptions_.hlsjsConfig = hlsjsConfig;
  try {
    if (typeof player.streamrootHls === 'function') {
      player.streamrootHls({ hlsjsConfig });
    }
  } catch {
    // noop
  }
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
