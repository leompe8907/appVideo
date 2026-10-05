/**
 * Cliente del protocolo de transmisión entre dispositivos (`cast.*`).
 *
 * Contrato del backend: docs/DISENO_TECNICO_CASTEO_2026-10-05.md del repo
 * Back-Wind-V2 (sección 3). Los mensajes viajan por el mismo WebSocket de
 * "dispositivos vinculados" (`/ws/device/`) que ya abre
 * `deviceSessionService.js`: este módulo no abre conexiones propias, solo
 * arma/valida mensajes y correlaciona respuestas.
 *
 * Reglas del protocolo que este cliente respeta:
 * - Todo mensaje lleva `v: 1`; los pedidos llevan `request_id`.
 * - Posiciones/duraciones en MILISEGUNDOS enteros (el reproductor de esta app
 *   trabaja en segundos: la conversión se hace en los bordes, ver
 *   `secondsToMs`/`msToSeconds`).
 * - NUNCA se transportan URLs de reproducción ni sesiones de PanAccess: solo
 *   `{ kind, id }`. Cada dispositivo arma su propia URL con su propia sesión.
 *
 * Apagado por defecto: nada de esto hace efecto hasta que la marca activa
 * `features.castEnabled` (ver `isCastEnabled`).
 */

import {
  resolveDeviceType,
  DEVICE_TYPE,
  sendDeviceMessage,
  setCastRegistrationProvider,
  setOnCastMessage,
} from './deviceSessionService';

export const CAST_PROTOCOL_VERSION = 1;
export const CAST_REQUEST_TIMEOUT_MS = 8000;

/** Tipos de contenido que entiende el protocolo (mismos que appVideo/iOS/Android). */
export const CAST_KINDS = Object.freeze({
  SERVICE: 'service',
  VOD: 'vod',
  CATCHUP: 'catchup',
});

// Respuesta esperada para cada pedido.
const RESPONSE_TYPE_BY_REQUEST = Object.freeze({
  'cast.list_devices': 'cast.devices',
  'cast.send': 'cast.sent',
  'cast.command': 'cast.ack',
});

// Eventos sin `request_id` que se reparten a los suscriptores.
const EVENT_TYPES = new Set(['cast.incoming', 'cast.command', 'cast.state', 'cast.displaced']);

/** @type {Map<string, {resolve: Function, reject: Function, timer: any, expect: string}>} */
const pending = new Map();
/** @type {Set<(message: object) => void>} */
const listeners = new Set();

let requestCounter = 0;

function newRequestId() {
  requestCounter += 1;
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${requestCounter}-${rand}`;
}

export function isCastEnabled(brandConfig) {
  return brandConfig?.features?.castEnabled === true;
}

export function secondsToMs(seconds) {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : 0;
}

export function msToSeconds(ms) {
  const n = Number(ms);
  return Number.isFinite(n) && n > 0 ? n / 1000 : 0;
}

/**
 * Campos que se suman al `register_device` para declararse como receptor.
 * El nombre es lo que verá el usuario al elegir destino.
 */
export function buildRegistrationFields(brandConfig) {
  const type = resolveDeviceType();
  const isTv = type === DEVICE_TYPE.LG || type === DEVICE_TYPE.SAMSUNG;
  const brandLabel = String(brandConfig?.name || brandConfig?.brand || 'App').trim();
  const kindLabel = isTv ? 'TV' : 'Navegador';
  return {
    device_name: `${brandLabel} ${kindLabel}`.slice(0, 100),
    can_receive: true,
    capabilities: {
      kinds: [CAST_KINDS.SERVICE, CAST_KINDS.VOD, CAST_KINDS.CATCHUP],
      audio_select: true,
      text_select: true,
      // El volumen solo es controlable en remoto si la marca expone controles
      // de volumen propios (en TV lo maneja el control remoto del aparato).
      volume: brandConfig?.features?.playerVolumeControls === true,
    },
  };
}

/** Router de mensajes `cast.*` entrantes (lo llama `deviceSessionService`). */
export function handleCastMessage(message) {
  if (!message || typeof message !== 'object') return;
  const { type, request_id: requestId } = message;

  if (type === 'cast.error') {
    const entry = requestId ? pending.get(requestId) : null;
    if (entry) {
      clearTimeout(entry.timer);
      pending.delete(requestId);
      const err = new Error(message.detail || message.code || 'cast_error');
      err.code = message.code || 'cast_error';
      entry.reject(err);
    }
    // Un error sin pedido asociado no tiene a quién avisarle.
    return;
  }

  if (requestId && pending.has(requestId)) {
    const entry = pending.get(requestId);
    if (entry.expect === type) {
      clearTimeout(entry.timer);
      pending.delete(requestId);
      entry.resolve(message);
      return;
    }
  }

  if (EVENT_TYPES.has(type)) {
    listeners.forEach((fn) => {
      try {
        fn(message);
      } catch {
        // noop -- un suscriptor roto no debe afectar a los demás
      }
    });
  }
}

/**
 * Suscribe a los eventos `cast.incoming`, `cast.command`, `cast.state` y
 * `cast.displaced`. Devuelve la función para desuscribirse.
 */
export function subscribeCast(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Conecta este módulo con el socket de dispositivo. Idempotente; devuelve la
 * función de limpieza. No hace nada si la marca no activó `castEnabled`.
 */
export function initCast(brandConfig) {
  if (!isCastEnabled(brandConfig)) return () => {};
  setCastRegistrationProvider(() => buildRegistrationFields(brandConfig));
  setOnCastMessage(handleCastMessage);
  return () => {
    setCastRegistrationProvider(null);
    setOnCastMessage(null);
    rejectAllPending(new Error('cast_stopped'));
  };
}

function rejectAllPending(error) {
  pending.forEach((entry) => {
    clearTimeout(entry.timer);
    entry.reject(error);
  });
  pending.clear();
}

function request(type, payload, timeoutMs = CAST_REQUEST_TIMEOUT_MS) {
  const expect = RESPONSE_TYPE_BY_REQUEST[type];
  return new Promise((resolve, reject) => {
    const requestId = newRequestId();
    const timer = setTimeout(() => {
      pending.delete(requestId);
      const err = new Error('cast_timeout');
      err.code = 'cast_timeout';
      reject(err);
    }, timeoutMs);
    pending.set(requestId, { resolve, reject, timer, expect });

    const sent = sendDeviceMessage({
      v: CAST_PROTOCOL_VERSION,
      type,
      request_id: requestId,
      ...payload,
    });
    if (!sent) {
      clearTimeout(timer);
      pending.delete(requestId);
      const err = new Error('cast_not_connected');
      err.code = 'cast_not_connected';
      reject(err);
    }
  });
}

/** Dispositivos de la cuenta que pueden recibir una transmisión. */
export async function listDevices() {
  const res = await request('cast.list_devices', {});
  return Array.isArray(res.devices) ? res.devices : [];
}

/**
 * Envía un contenido a otro dispositivo de la cuenta.
 * @param {{ targetDeviceId: number, content: {kind: string, id: number, title?: string, startPositionSeconds?: number} }} args
 * @returns {Promise<{session_id: string}>}
 */
export async function sendContent({ targetDeviceId, content }) {
  return request('cast.send', {
    target_device_id: targetDeviceId,
    mode: 'transfer',
    content: {
      kind: content.kind,
      id: content.id,
      title: content.title ?? undefined,
      start_position_ms: secondsToMs(content.startPositionSeconds),
    },
  });
}

/** Comando a la transmisión activa: play, pause, stop, seek, set_volume, select_audio, select_text. */
export async function sendCommand({ sessionId, command, args }) {
  return request('cast.command', { session_id: sessionId, command, args: args ?? {} });
}

/** El receptor reporta su estado (sin respuesta; si no hay socket, se descarta). */
export function reportState(sessionId, state) {
  return sendDeviceMessage({ v: CAST_PROTOCOL_VERSION, type: 'cast.state', session_id: sessionId, ...state });
}

/** Solo para tests. */
export function __resetCastForTests() {
  rejectAllPending(new Error('reset'));
  listeners.clear();
  requestCounter = 0;
}
