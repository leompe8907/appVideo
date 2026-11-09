import { withSessionId } from '@appvideo/core/player/panaccessPlayback';

/**
 * Caché en memoria del master playlist de cada canal en vivo del middleware
 * Panaccess (`index.php?requestMode=m3u8&streamId=N`). El master solo lista
 * los niveles y casi no cambia, pero hls.js lo pedía en cada cambio de canal y
 * el nivel (que sí cambia cada 10 s) no puede esperar a que llegue: son 0.2-0.6 s
 * de arranque. Se llena al cargar un canal y con `prefetchMaster` para los
 * canales vecinos (CH+/CH-).
 *
 * shortcut: el master fija prio/cdnId por TTL_MS; si el operador rota de CDN con
 * más frecuencia, bajar el TTL. Un error fatal de carga borra la entrada.
 */
const TTL_MS = 120_000;
const entries = new Map();

/** Clave del canal si `url` es un master (sin substream ni file); null si no se puede cachear. */
export function masterKey(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const q = parsed.searchParams;
  if (q.get('requestMode') !== 'm3u8' || !q.get('streamId') || q.has('substream') || q.has('file')) return null;
  return `${parsed.origin}|${q.get('streamId')}`;
}

export function getCachedMaster(url, now = Date.now()) {
  const key = masterKey(url);
  const hit = key && entries.get(key);
  if (!hit) return null;
  if (now - hit.at > TTL_MS) {
    entries.delete(key);
    return null;
  }
  return hit.data;
}

/**
 * Solo un master de verdad se puede reutilizar: una playlist de media (ventana
 * de segmentos que caduca en segundos) o una respuesta de error con 200 dejarían
 * al canal roto hasta que venza el TTL.
 */
export function isMasterPlaylist(text) {
  return (
    typeof text === 'string' &&
    text.startsWith('#EXTM3U') &&
    text.includes('#EXT-X-STREAM-INF') &&
    !text.includes('#EXTINF')
  );
}

export function storeMaster(url, data, now = Date.now()) {
  const key = masterKey(url);
  if (key && isMasterPlaylist(data)) entries.set(key, { data, at: now });
}

export function evictMaster(url) {
  const key = masterKey(url);
  if (key) entries.delete(key);
}

export function clearMasterCache() {
  entries.clear();
}

/** Descarga el master de un canal en segundo plano; nunca lanza (es solo una optimización). */
export async function prefetchMaster(url, sessionId) {
  if (!masterKey(url) || getCachedMaster(url)) return;
  try {
    const res = await fetch(sessionId ? withSessionId(url, sessionId) : url);
    if (res.ok) storeMaster(url, await res.text());
  } catch {
    // sin red o CORS: el canal se cargará normal al zapear
  }
}
