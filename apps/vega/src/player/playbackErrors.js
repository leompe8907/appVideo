// Shaka: categoría 1 = NETWORK. <video>: MediaError.code 2 = MEDIA_ERR_NETWORK.
const SHAKA_CATEGORY_NETWORK = 1;
const MEDIA_ERR_NETWORK = 2;

/**
 * ¿El error del reproductor se debe a la red? Las tiendas de TV exigen que el aviso
 * mencione la conexión cuando se corta durante la reproducción.
 * @param {{source?: string, code?: number, category?: number, message?: string}|Error|null|undefined} detail
 */
export function isNetworkPlaybackError(detail) {
  if (!detail) return false;
  if (detail.category === SHAKA_CATEGORY_NETWORK) return true;
  if (detail.source === 'video' && detail.code === MEDIA_ERR_NETWORK) return true;
  return /network|connection|failed to fetch/i.test(String(detail.message || ''));
}
