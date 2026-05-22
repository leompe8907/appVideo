import Hls from 'hls.js';
import { buildHlsPlaybackConfig } from './hlsPlaybackConfig';
import { isWindMiddlewareHost } from './windHlsManifest';
import { pickWindCompatibleLevel } from './windLevelSelect';
import * as userSession from '../../../utils/userSession';

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

/** Inyecta sessionId en playlists, claves AES (mekey) y segmentos del middleware. */
export function createSessionHlsXhrSetup(getSessionId) {
  const resolveSessionId =
    typeof getSessionId === 'function'
      ? getSessionId
      : () => userSession.getSessionId();

  return function sessionHlsXhrSetup(xhr, url) {
    if (!url || typeof url !== 'string') return;
    const sessionId = resolveSessionId();
    if (!sessionId) return;

    const nextUrl = withSessionId(url, sessionId);
    if (nextUrl !== url) {
      xhr.open('GET', nextUrl, true);
    }
  };
}

function middlewareNeedsSession(url) {
  const lower = url.toLowerCase();
  if (!lower.includes('index.php')) return false;
  if (lower.includes('requestmode=m3u8')) return true;
  if (lower.includes('requestmode=mekey')) return true;
  if (lower.includes('getstreamm3u8') || lower.includes('getvodm3u8') || lower.includes('getcatchupm3u8')) {
    return true;
  }
  return /(?:^|[?&])m3u8(?:=|&|$)/i.test(url);
}

function withSessionId(url, sessionId) {
  if (!middlewareNeedsSession(url)) {
    return url;
  }
  if (url.includes('sessionId=')) {
    return url.replace(/sessionId=([^&]+)/, `sessionId=${encodeURIComponent(sessionId)}`);
  }
  const glue = url.includes('?') ? '&' : '?';
  return `${url}${glue}sessionId=${encodeURIComponent(sessionId)}`;
}
