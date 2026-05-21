import Hls from 'hls.js';
import * as userSession from '../../../utils/userSession';
import { pickWindCompatibleLevel } from './windLevelSelect';

function buildHlsjsConfig(getSessionId, playbackUrl = '') {
  const config = {
    xhrSetup: createSessionHlsXhrSetup(getSessionId),
  };
  if (/middleware\.wind\.do/i.test(playbackUrl)) {
    config.enableWorker = false;
    config.enableSoftwareAES = true;
    // hls.js ordena niveles por BANDWIDTH asc → 0 = 360p (avc1.4d401e), no 1080p High
    config.startLevel = 0;
    config.capLevelToPlayerSize = false;
    config.liveSyncDurationCount = 3;
    config.liveMaxLatencyDurationCount = 6;
  }
  return config;
}

/** El plugin 10foot usa `plugins.streamrootHls`, no `hlsjsConfig` en la raíz del player. */
export function buildStreamrootHlsPluginOptions(getSessionId) {
  return {
    plugins: {
      streamrootHls: {
        hlsjsConfig: buildHlsjsConfig(getSessionId),
      },
    },
  };
}

export function applyStreamrootHlsSessionConfig(player, getSessionId, playbackUrl = '') {
  if (!player) return;
  const hlsjsConfig = buildHlsjsConfig(getSessionId, playbackUrl);
  player.srOptions_ = player.srOptions_ || {};
  player.srOptions_.hlsjsConfig = hlsjsConfig;
  try {
    if (typeof player.streamrootHls === 'function') {
      player.streamrootHls({ hlsjsConfig });
    }
  } catch {
    // noop
  }
  if (/middleware\.wind\.do/i.test(playbackUrl)) {
    attachWindLevelLock(player);
  }
}

/** Tras MANIFEST_PARSED, fija 360p (substream=3) para evitar mezcla High Profile en MSE. */
export function attachWindLevelLock(player) {
  if (!player) return;

  const bind = () => {
    const hls = player?.tech?.(true)?.hlsProvider?.hls;
    if (!hls || hls.__windLevelLockBound) return false;
    hls.__windLevelLockBound = true;

    const lock = () => pickWindCompatibleLevel(hls);
    hls.on(Hls.Events.MANIFEST_PARSED, lock);
    if (hls.levels?.length) lock();
    return true;
  };

  if (bind()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (bind() || attempts > 100) clearInterval(timer);
  }, 50);
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
  // Claves AES-128 por segmento (Wind: EXT-X-KEY → requestMode=mekey&chunk=…)
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
