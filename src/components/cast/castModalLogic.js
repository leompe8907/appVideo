/**
 * Lógica pura del selector de transmisión (sin React), para poder probarla.
 */

/** Dispositivos a los que se puede enviar: en línea y que no sean este mismo. */
export function pickSendTargets(devices) {
  if (!Array.isArray(devices)) return [];
  return devices.filter((d) => d && d.online === true && d.is_self !== true && d.can_receive !== false);
}

const ERROR_TEXTS = {
  target_offline: { key: 'cast.errors.targetOffline', fallback: 'El dispositivo está desconectado.' },
  target_not_found: { key: 'cast.errors.targetNotFound', fallback: 'El dispositivo ya no está disponible.' },
  rejected_by_target: { key: 'cast.errors.rejected', fallback: 'El dispositivo rechazó la transmisión.' },
  rate_limited: { key: 'cast.errors.rateLimited', fallback: 'Demasiados envíos, probá en un momento.' },
  unsupported_content: { key: 'cast.errors.unsupported', fallback: 'Ese dispositivo no puede reproducir este contenido.' },
  cast_timeout: { key: 'cast.errors.timeout', fallback: 'El servidor no respondió.' },
  cast_not_connected: { key: 'cast.errors.notConnected', fallback: 'Sin conexión con el servidor.' },
};

/** Código de error del protocolo -> clave de traducción y texto por defecto. */
export function castErrorKey(code) {
  return ERROR_TEXTS[code] || { key: 'cast.errors.generic', fallback: 'No se pudo transmitir.' };
}

/**
 * Contenido actual del reproductor -> contenido a enviar, o null si no es
 * transmisible (sin reproducción o sin id). El canal en vivo no lleva posición.
 */
export function buildCastContent(playerState) {
  const s = playerState || {};
  if (!s.url || s.id == null) return null;
  if (s.type !== 'service' && s.type !== 'vod' && s.type !== 'catchup') return null;
  const title = s.item?.name || s.item?.title || null;
  const content = { kind: s.type, id: s.id };
  if (title) content.title = String(title);
  if (s.type !== 'service' && Number.isFinite(s.currentTime) && s.currentTime > 0) {
    content.startPositionSeconds = s.currentTime;
  }
  return content;
}
