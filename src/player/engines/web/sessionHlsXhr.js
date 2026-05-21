import * as userSession from '../../../utils/userSession';

function buildHlsjsConfig(getSessionId, playbackUrl = '') {
  const config = {
    xhrSetup: createSessionHlsXhrSetup(getSessionId),
  };
  if (/middleware\.wind\.do/i.test(playbackUrl)) {
    config.enableWorker = false;
    config.enableSoftwareAES = true;
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
