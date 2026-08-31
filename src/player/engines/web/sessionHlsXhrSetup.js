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
 * URI de clave AES-128 servida por este middleware. `mekey`
 * (`index.php?requestMode=mekey&...&chunk=N...`) es la de streams en vivo —
 * una key DISTINTA por cada segmento (`chunk=` cambia por .ts). Catchup usa
 * una acción distinta, `f=getCatchupKey` (confirmado en manifiestos reales
 * del operador multiplustv, mismo CDN que `HlsPlaybackController.js`
 * documenta como referencia) — antes de agregar este caso, el catchup de ese
 * operador (y potencialmente cualquier otro que use la misma key "envuelta")
 * bajaba los segmentos bien (200 OK) pero nunca reproducía: la key llegaba
 * sin desenvolver a hls.js, que descifraba mal cada fragmento, resultando en
 * `fragParsingError` infinito (ver `PanaccessKeyUnwrapLoader` en
 * `HlsPlaybackController.js`, que depende de esta función para saber cuándo
 * aplicar el unwrap). Se agrega `getVodKey` por el mismo patrón usado para
 * las URLs de manifiesto (`getStreamM3u8`/`getVodM3u8`/`getCatchupM3u8`),
 * aunque todavía no hay un caso real confirmado que lo dispare.
 */
export function isPanaccessRotatingKeyUri(url) {
  if (typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('requestmode=mekey') ||
    lower.includes('f=getcatchupkey') ||
    lower.includes('f=getvodkey')
  );
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
