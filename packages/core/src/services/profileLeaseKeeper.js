/**
 * Mantiene la reserva de la tarjeta del perfil activo (backend Wind:
 * `wind/services/profile_leases.py`; en Android, `ProfileLeaseKeeper.kt`).
 *
 * Mientras la app usa la tarjeta, late cada `heartbeatSeconds` (el backend
 * manda el intervalo, con variación al azar). Si el backend responde que la
 * tarjeta ya no es de este dispositivo (otro hizo "continuar aquí", se borró
 * el perfil, venció) o lo avisa por WebSocket (`profile_lease_lost`), deja de
 * latir y avisa al listener de `setOnLeaseLost`: la app vuelve a "¿Quién está
 * viendo?". Al salir del perfil o cerrar sesión (`stopProfileLease({ release:
 * true })`) la tarjeta queda libre al instante; si la app muere sin avisar, el
 * backend la libera sola cuando dejan de llegar latidos.
 */
import { heartbeatProfileLease, releaseProfileLease } from './externalProfilesService';
import { setOnProfileLeaseLost } from './deviceSessionService';

/** Sin red o error del servidor: se reintenta antes del intervalo normal, sin perder la reserva. */
export const RETRY_SECONDS = 60;
const DEFAULT_HEARTBEAT_SECONDS = 300;

let current = null; // { token, licenseSn, timer }
let onLeaseLost = null;

function devWarn(label, error) {
  if (import.meta.env.DEV) {
    console.warn(`[profileLeaseKeeper] ${label}:`, error?.message || error);
  }
}

/** `reason`: `taken_over`, `profile_deleted`, `expired`... (o null si no se sabe). */
export function setOnLeaseLost(fn) {
  onLeaseLost = typeof fn === 'function' ? fn : null;
}

/**
 * Qué hacer con la respuesta de un latido.
 * @returns {{next: 'beat', seconds: number} | {next: 'retry'} | {next: 'stop'} | {next: 'lost', reason: string|null}}
 */
export function interpretHeartbeat({ status, data } = {}) {
  if (status === 400) return { next: 'lost', reason: data?.code || null }; // comprobante inválido
  if (!status || status >= 300) return { next: 'retry' };
  if (data?.leases === false) return { next: 'stop' }; // el backend apagó las reservas
  if (data?.active) return { next: 'beat', seconds: data.heartbeatSeconds || DEFAULT_HEARTBEAT_SECONDS };
  return { next: 'lost', reason: data?.reason || null };
}

function schedule(lease, seconds, firstSeconds) {
  lease.timer = setTimeout(() => beat(lease, firstSeconds), seconds * 1000);
}

async function beat(lease, firstSeconds) {
  let step;
  try {
    step = interpretHeartbeat(await heartbeatProfileLease(lease.token));
  } catch (e) {
    devWarn('latido falló', e);
    step = { next: 'retry' };
  }
  if (current !== lease) return; // se salió del perfil mientras tanto
  if (step.next === 'beat') schedule(lease, step.seconds, firstSeconds);
  else if (step.next === 'retry') schedule(lease, Math.min(RETRY_SECONDS, firstSeconds), firstSeconds);
  else if (step.next === 'stop') current = null;
  else lost(lease, step.reason);
}

function lost(lease, reason) {
  if (current !== lease) return;
  clearTimeout(lease.timer);
  current = null;
  try {
    onLeaseLost?.(reason);
  } catch (e) {
    devWarn('el aviso de reserva perdida falló', e);
  }
}

/** La app consiguió `licenseSn` para el perfil: empieza a latir (reemplaza la reserva anterior). */
export function startProfileLease({ token, licenseSn, heartbeatSeconds }) {
  stopProfileLease();
  const seconds = heartbeatSeconds || DEFAULT_HEARTBEAT_SECONDS;
  current = { token, licenseSn, timer: null };
  schedule(current, seconds, seconds);
}

/** Deja de latir; con `release`, además libera la tarjeta en el backend. */
export function stopProfileLease({ release = false } = {}) {
  const lease = current;
  if (!lease) return;
  clearTimeout(lease.timer);
  current = null;
  if (release) {
    // Si no llega, el backend la libera sola cuando dejan de llegar latidos.
    releaseProfileLease(lease.token).catch((e) => devWarn('liberar la reserva falló', e));
  }
}

/** Aviso por WebSocket: solo cuenta si es la tarjeta que este dispositivo está usando. */
export function onLeaseLostByServer({ reason, licenseSn } = {}) {
  const lease = current;
  if (lease && (!licenseSn || licenseSn === lease.licenseSn)) lost(lease, reason);
}

export function hasProfileLease() {
  return current !== null;
}

setOnProfileLeaseLost(onLeaseLostByServer);
