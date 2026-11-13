import { isOnline } from '@appvideo/core/platform/runtime';

// AVPlay (Tizen) reporta errores como string/nombre (PLAYER_ERROR_CONNECTION_FAILED);
// hls.js como `networkError`; los navegadores como "Failed to fetch"/"NetworkError".
const NETWORK_ERROR_PATTERN = /CONNECTION_FAILED|NETWORK|networkError|Failed to fetch|ERR_INTERNET/i;

/**
 * ¿El error de reproducción se debe a la red? La certificación de Samsung exige
 * que el aviso mencione la red cuando se corta la conexión durante la reproducción.
 * @param {unknown} error
 * @param {() => boolean} [online]
 */
export function isNetworkPlaybackError(error, online = isOnline) {
  if (!online()) return true;
  if (!error) return false;
  const parts = typeof error === 'string' ? [error] : [error.name, error.message, error.type, error.code];
  return parts.some((p) => p != null && NETWORK_ERROR_PATTERN.test(String(p)));
}
