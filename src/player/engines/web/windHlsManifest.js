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
