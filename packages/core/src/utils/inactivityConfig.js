/**
 * Resolución de tiempos de inactividad (paridad EPG / clientConfig).
 * Fuente principal: clientConfig.device.parameters.X_INACTIVITY_TIMEOUT_SEC
 */

export function getEffectiveClientConfig(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return raw.answer ?? raw;
}

/**
 * Segundos sin interacción antes del modal de aviso.
 * @param {object|null} clientConfig - Respuesta de getClientConfig (o userSession)
 * @param {object|null} brand - Marca activa (fallback / QA en DEV)
 * @returns {number} 0 = desactivado
 */
export function resolveInactivityTimeoutSec(clientConfig, brand) {
  const cfg = getEffectiveClientConfig(clientConfig);
  const params = cfg?.device?.parameters;

  const fromClient = Number(
    params?.X_INACTIVITY_TIMEOUT_SEC ??
      params?.x_inactivity_timeout_sec ??
      params?.INACTIVITY_TIMEOUT_SEC
  );
  if (Number.isFinite(fromClient) && fromClient > 0) return fromClient;

  // Solo en desarrollo: override de marca para QA (p. ej. 120 s)
  if (import.meta.env.DEV) {
    const testOverride = Number(brand?.player?.inactivityTestTimeoutSec);
    if (Number.isFinite(testOverride) && testOverride > 0) return testOverride;
  }

  const defaultSec = Number(brand?.player?.defaultInactivityTimeoutSec);
  if (Number.isFinite(defaultSec) && defaultSec > 0) return defaultSec;

  return 0;
}

/**
 * Segundos de countdown en el modal antes de detener + screensaver.
 * @param {object|null} clientConfig
 * @param {object|null} brand
 * @returns {number}
 */
export function resolveInactivityGraceSec(clientConfig, brand) {
  const cfg = getEffectiveClientConfig(clientConfig);
  const params = cfg?.device?.parameters;

  const fromClient = Number(
    params?.X_INACTIVITY_GRACE_SEC ??
      params?.x_inactivity_grace_sec ??
      params?.INACTIVITY_GRACE_SEC
  );
  if (Number.isFinite(fromClient) && fromClient >= 10) return fromClient;

  const v = Number(brand?.player?.inactivityGraceSec);
  return Number.isFinite(v) && v >= 10 ? v : 60;
}

/**
 * En qué fase está la inactividad mientras se reproduce: 'active' (sin aviso),
 * 'warning' ("¿Sigues ahí?" con `secondsLeft`) o 'expired' (detener y salvapantallas).
 * Función pura: el que la usa la evalúa cada segundo.
 */
export function resolveInactivityPhase({ nowMs, lastInteractionAtMs, timeoutSec, graceSec }) {
  if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) return { phase: 'active', secondsLeft: graceSec };
  const warningAtMs = lastInteractionAtMs + timeoutSec * 1000;
  if (nowMs < warningAtMs) return { phase: 'active', secondsLeft: graceSec };
  const secondsLeft = Math.max(0, Math.ceil(graceSec - (nowMs - warningAtMs) / 1000));
  return secondsLeft > 0 ? { phase: 'warning', secondsLeft } : { phase: 'expired', secondsLeft: 0 };
}

/** Cuenta regresiva del aviso, `mm:ss`. */
export function formatInactivityCountdown(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
