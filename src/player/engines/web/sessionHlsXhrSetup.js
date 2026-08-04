import * as userSession from '../../../utils/userSession';

export function middlewareNeedsSession(url) {
  const lower = url.toLowerCase();
  if (!lower.includes('index.php')) return false;
  if (lower.includes('requestmode=m3u8')) return true;
  if (lower.includes('requestmode=mekey')) return true;
  if (lower.includes('getstreamm3u8') || lower.includes('getvodm3u8') || lower.includes('getcatchupm3u8')) {
    return true;
  }
  return /(?:^|[?&])m3u8(?:=|&|$)/i.test(url);
}

/**
 * URI de clave AES-128 servida por este middleware (`index.php?requestMode=
 * mekey&...&chunk=N...`) — una key DISTINTA por cada segmento (`chunk=`
 * cambia por .ts). Se usa para detectar cuándo aplicar el workaround de IV
 * fijo en `HlsPlaybackController` (ver ahí el porqué).
 */
export function isPanaccessRotatingKeyUri(url) {
  return typeof url === 'string' && /requestmode=mekey/i.test(url);
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
