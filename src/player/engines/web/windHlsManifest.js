import * as userSession from '../../../utils/userSession';

export function isWindMiddlewareHost(url) {
  return typeof url === 'string' && /middleware\.wind\.do/i.test(url);
}

/** URL que devuelve M3U8 real en Wind (no getStreamM3u8 / function). */
export function windDirectM3u8FromAny(url) {
  if (!isWindMiddlewareHost(url)) return url;

  const streamMatch = url.match(/(?:^|[?&])streamId=([^&]+)/i);
  if (!streamMatch?.[1]) return url;

  const sessionId =
    url.match(/sessionId=([^&]+)/i)?.[1] || userSession.getSessionId();
  if (!sessionId) return url;

  const base = new URL(url).origin;
  const streamId = decodeURIComponent(streamMatch[1]);
  const direct = `${base}/index.php?requestMode=m3u8&streamId=${encodeURIComponent(streamId)}&sessionId=${encodeURIComponent(sessionId)}`;

  if (url === direct) return url;
  const lower = url.toLowerCase();
  if (lower.includes('requestmode=m3u8') && !lower.includes('requestmode=function')) {
    return url;
  }
  return direct;
}

/**
 * Reescribe el M3U8 maestro con URLs absolutas + sessionId (para blob: o HLS nativo).
 */
export async function fetchWindManifestBlobUrl(masterUrl) {
  const sessionId = userSession.getSessionId();
  if (!sessionId) return null;

  // sessionId va en la query; credentials:include rompe CORS (ACAO:* + credenciales).
  const response = await fetch(masterUrl, { credentials: 'omit', mode: 'cors' });
  if (!response.ok) return null;

  const text = await response.text();
  if (!text.includes('#EXTM3U')) return null;

  const base = new URL(masterUrl);
  const rewritten = rewriteM3u8WithSession(text, sessionId, base);

  return URL.createObjectURL(
    new Blob([rewritten], { type: 'application/vnd.apple.mpegurl' }),
  );
}

function rewriteM3u8WithSession(body, sessionId, baseUrl) {
  return body
    .split(/\r?\n/)
    .map((line) => rewriteLine(line, sessionId, baseUrl))
    .join('\n');
}

function rewriteLine(line, sessionId, baseUrl) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return line;

  let absolute;
  try {
    absolute = new URL(trimmed, baseUrl).href;
  } catch {
    return line;
  }

  return injectSessionId(absolute, sessionId);
}

function injectSessionId(url, sessionId) {
  const lower = url.toLowerCase();
  if (!lower.includes('index.php') || !lower.includes('requestmode=m3u8')) {
    return url;
  }
  if (url.includes('sessionId=')) {
    return url.replace(/sessionId=([^&]+)/, `sessionId=${encodeURIComponent(sessionId)}`);
  }
  const glue = url.includes('?') ? '&' : '?';
  return `${url}${glue}sessionId=${encodeURIComponent(sessionId)}`;
}
