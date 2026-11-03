/**
 * Reglas de reintento contra el backend de Wind (Back-Wind-V2), las mismas que
 * usan Android e iOS (`WindDeviceSocketRules.kt` / `WindServiceUnavailable.kt`
 * en el módulo `:shared` de PanaccessApp).
 *
 * WebSocket `/ws/device/` -- desde 2026-10-13 el backend acepta la conexión y
 * después la cierra con un código de aplicación (antes cerraba antes de
 * aceptar y el navegador sólo veía un 1006):
 *   - 4503: base de datos saturada o caída. Reintentar, sin tocar la sesión.
 *   - 4004: la cuenta no tiene suscriptor. No se resuelve reintentando.
 *   - 4001 con motivo "... Retry after Ns": límite de conexiones; esperar N s.
 * Un JWT inválido sigue rechazándose en el handshake (no llega a `onopen`).
 *
 * HTTP -- 503 + `Retry-After` cuando la base de datos está saturada. Es
 * transitorio: no se cierra sesión ni se borra ningún token.
 *
 * Todas las esperas llevan hasta un 30 % al azar: sin eso, cuando el backend
 * se reinicia, todos los dispositivos reintentan en el mismo segundo y lo
 * vuelven a saturar.
 */

export const DEVICE_WS_CLOSE = Object.freeze({
  RATE_LIMITED: 4001,
  NO_SUBSCRIBER: 4004,
  SERVICE_UNAVAILABLE: 4503,
});

/** Motivos de corte que devuelve `registerDeviceSession()` según el código del cierre. */
export const DEVICE_WS_ERROR = Object.freeze({
  SERVICE_UNAVAILABLE: 'service_unavailable',
  NO_SUBSCRIBER: 'no_subscriber',
  RATE_LIMITED: 'rate_limited',
});

export const JITTER_FRACTION = 0.3;
export const MAX_BACKOFF_SECONDS = 60;
/** Fallos seguidos tras los cuales se deja de reintentar hasta volver al frente (no aplica a 4503). */
export const MAX_CONSECUTIVE_FAILURES = 8;

/** Motivo de un cierre de `/ws/device/`, o `null` si el código no es uno del backend. */
export function classifyDeviceSocketClose(code) {
  switch (code) {
    case DEVICE_WS_CLOSE.SERVICE_UNAVAILABLE:
      return DEVICE_WS_ERROR.SERVICE_UNAVAILABLE;
    case DEVICE_WS_CLOSE.NO_SUBSCRIBER:
      return DEVICE_WS_ERROR.NO_SUBSCRIBER;
    case DEVICE_WS_CLOSE.RATE_LIMITED:
      return DEVICE_WS_ERROR.RATE_LIMITED;
    default:
      return null;
  }
}

/** Los segundos de `"... Retry after 60s"` en el motivo del cierre, o `null`. */
export function retryAfterSecondsFromReason(reason) {
  const match = /retry after (\d+)\s*s/i.exec(String(reason || ''));
  return match ? Number(match[1]) : null;
}

/** 2, 4, 8, 16, 32 y después 60 s (antes de la parte al azar). */
export function backoffSeconds(failures) {
  const exponent = Math.min(Math.max(failures, 1) - 1, 5);
  return Math.min(2 << exponent, MAX_BACKOFF_SECONDS);
}

function withJitter(seconds, random) {
  const base = seconds * 1000;
  const r = Math.min(Math.max(Number(random()) || 0, 0), 1);
  return base + Math.floor(base * JITTER_FRACTION * r);
}

/**
 * Qué hacer tras perder (o no poder abrir) `/ws/device/`.
 *
 * @param {{error?: string, failures: number, retryAfterSeconds?: number|null}} info
 *   `error` es el motivo que devolvió `registerDeviceSession()`; `failures`
 *   cuenta este fallo (se vuelve a 0 con cada registro exitoso).
 * @param {() => number} [random]
 * @returns {{reconnect: boolean, delayMs: number}}
 */
export function nextDeviceSocketReconnect({ error, failures, retryAfterSeconds } = {}, random = Math.random) {
  if (error === DEVICE_WS_ERROR.NO_SUBSCRIBER) return { reconnect: false, delayMs: 0 };
  if (error === DEVICE_WS_ERROR.SERVICE_UNAVAILABLE) {
    return { reconnect: true, delayMs: withJitter(backoffSeconds(failures), random) };
  }
  if (failures > MAX_CONSECUTIVE_FAILURES) return { reconnect: false, delayMs: 0 };
  if (error === DEVICE_WS_ERROR.RATE_LIMITED && Number.isFinite(retryAfterSeconds)) {
    const seconds = Math.min(Math.max(retryAfterSeconds, 1), 10 * MAX_BACKOFF_SECONDS);
    return { reconnect: true, delayMs: withJitter(seconds, random) };
  }
  return { reconnect: true, delayMs: withJitter(backoffSeconds(failures), random) };
}

export const SERVICE_UNAVAILABLE_STATUS = 503;
/** Si el servidor pide esperar más que esto, no se reintenta con la pantalla abierta. */
export const MAX_SERVICE_UNAVAILABLE_WAIT_SECONDS = 10;
const DEFAULT_SERVICE_UNAVAILABLE_WAIT_SECONDS = 2;

/**
 * Espera antes del único reintento de un 503, o `null` si no hay que
 * reintentar. Sólo GET: un POST (cambio de contraseña, cierre de cuenta) pudo
 * haber hecho algo en PanAccess antes de que fallara la base.
 */
export function serviceUnavailableRetryDelayMs(method, retryAfterHeader, random = Math.random) {
  if (String(method || 'GET').toUpperCase() !== 'GET') return null;
  const parsed = Number.parseInt(String(retryAfterHeader ?? '').trim(), 10);
  const seconds = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_SERVICE_UNAVAILABLE_WAIT_SECONDS;
  if (seconds > MAX_SERVICE_UNAVAILABLE_WAIT_SECONDS) return null;
  return withJitter(seconds, random);
}
