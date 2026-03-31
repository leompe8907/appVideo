/**
 * Detección de URLs HLS (incl. Panaccess: ...&m3u8 sin extensión .m3u8).
 */
export function isHlsUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8')) return true;
  if (lower.includes('application/vnd.apple.mpegurl')) return true;
  // Panaccess y backends similares: parámetro m3u8
  if (/(?:^|[?&])m3u8(?:=|&|$)/i.test(url)) return true;
  if (lower.includes('format=m3u8') || lower.includes('type=m3u8')) return true;
  return false;
}
