/**
 * Telemetría de reproducción (canal en vivo / VOD / catchup) hacia Panaccess.
 *
 * Port del módulo `Telemetry.js` (proyecto EPG legacy, a su vez port del
 * `TelemetryRecords.java` del SDK Android de Panaccess): reporta cuándo el
 * usuario empieza y deja de ver contenido, vía `cvPushTelemetryRecords`.
 *
 * Reglas de negocio replicadas del original:
 * - Anti-zapping: solo se reporta un "inicio" si el usuario se queda viendo
 *   el contenido al menos `MIN_TIME_MS` (1 min). Si cambia/corta antes, no se
 *   reporta absolutamente nada (ni inicio ni fin) — igual que Android.
 * - Cola persistida en localStorage (sobrevive recargas/cortes de red).
 * - Envío por lotes (máx. `MAX_RECORDS_PER_CALL`), con un intervalo mínimo
 *   entre llamadas (`MIN_MS_BETWEEN_CALLS`) y reintento con backoff simple
 *   tras un error (`RETRY_AFTER_ERROR_MS`).
 */

import panaccessService from './panaccessService';

const STORAGE_KEY = 'app_telemetry_pending_v1';
const MAX_QUEUE = 500;

/** Umbral anti-zapping: por debajo de esto, no se reporta nada. */
const MIN_TIME_MS = 60 * 1000;
const MAX_RECORDS_PER_CALL = 100;
const MIN_MS_BETWEEN_CALLS = 30 * 1000;
const FIRST_FLUSH_DELAY_MS = 25 * 1000;
/** Ver nota en el original: en producción debería ser más alto (ej. 2h); se deja
 * en 10 min acá para no perder demasiada cola si la marca no ajusta esto. */
const PERIODIC_FLUSH_MS = 10 * 60 * 1000;
const RETRY_AFTER_ERROR_MS = 5 * 60 * 1000;

export const TELEMETRY_ACTION = Object.freeze({
  SWITCHED_TO_SERVICE: 5,
  SWITCHED_AWAY_FROM_SERVICE: 6,
  VOD_STARTED: 13,
  VOD_STOPPED_PREMATURELY: 14,
  VOD_FINISHED: 15,
  CATCHUP_STARTED: 16,
  CATCHUP_STOPPED_PREMATURELY: 17,
  CATCHUP_FINISHED: 18,
});

const REASON_USER_INTERACTION = 1;

function loadQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildData(type, item, id) {
  if (type === 'service') {
    const serviceId = item?.id ?? item?.lcn ?? id;
    if (serviceId == null) return null;
    return { serviceId, serviceName: item?.name ?? '' };
  }
  if (type === 'vod') {
    const vodId = item?.id ?? item?.vodId ?? id;
    if (vodId == null) return null;
    return { vodId, vodName: item?.name ?? item?.title ?? '', duration: item?.duration ?? 0 };
  }
  if (type === 'catchup') {
    const catchupId = item?.id ?? item?.catchupId ?? id;
    if (catchupId == null) return null;
    return {
      catchupGroupId: item?.catchupGroupId ?? item?.groupId ?? null,
      catchupId,
      catchupName: item?.name ?? item?.title ?? '',
      duration: item?.duration ?? 0,
    };
  }
  return null;
}

function startActionFor(type) {
  if (type === 'service') return TELEMETRY_ACTION.SWITCHED_TO_SERVICE;
  if (type === 'vod') return TELEMETRY_ACTION.VOD_STARTED;
  if (type === 'catchup') return TELEMETRY_ACTION.CATCHUP_STARTED;
  return null;
}

function stoppedOrAwayActionFor(type) {
  if (type === 'service') return TELEMETRY_ACTION.SWITCHED_AWAY_FROM_SERVICE;
  if (type === 'vod') return TELEMETRY_ACTION.VOD_STOPPED_PREMATURELY;
  if (type === 'catchup') return TELEMETRY_ACTION.CATCHUP_STOPPED_PREMATURELY;
  return null;
}

function finishedActionFor(type) {
  if (type === 'vod') return TELEMETRY_ACTION.VOD_FINISHED;
  if (type === 'catchup') return TELEMETRY_ACTION.CATCHUP_FINISHED;
  // Un canal en vivo no "termina": equivale a cambiarse de servicio.
  return stoppedOrAwayActionFor(type);
}

/**
 * `profileId` se manda SIEMPRE en 0 — confirmado contra el
 * `TelemetryRecords.java` real de Android (`sendTelemetryRecords()`): no
 * pasa este campo en ninguna llamada observada, y el proyecto EPG (que sí
 * validó esto línea a línea contra el .java) también lo fija en 0 de forma
 * fija, no ligado al sistema de sub-perfiles de la propia app (son conceptos
 * distintos). Un intento anterior de mandar acá el perfil activo de
 * `activeProfileStore` fue una hipótesis equivocada — revertida.
 */
function buildRecord(actionId, data) {
  const now = new Date();
  return {
    anonymize: false,
    date: now.toISOString().slice(0, 10),
    timestamp: now.toISOString(),
    actionId,
    actionKey: '',
    manual: true,
    reasonId: REASON_USER_INTERACTION,
    reasonKey: '',
    data: JSON.stringify(data),
    profileId: 0,
  };
}

export class TelemetryService {
  constructor() {
    this._queue = loadQueue();
    this._pending = null;
    this._confirmTimer = null;
    this._saveTimer = null;
    this._periodicTimer = null;
    this._firstFlushTimer = null;
    this._lastFlushAtMs = 0;
    this._flushing = false;
    this._started = false;
  }

  isEnabled() {
    return panaccessService.brandConfig?.player?.telemetryEnabled !== false;
  }

  /** Arranca los timers de flush periódico. Llamar una vez por sesión de app. */
  init() {
    if (this._started) return;
    this._started = true;
    this._firstFlushTimer = setTimeout(() => this._flush(), FIRST_FLUSH_DELAY_MS);
    this._periodicTimer = setInterval(() => this._flush(), PERIODIC_FLUSH_MS);

    // La app (TV o navegador) puede irse a background/cerrarse sin volver a
    // ejecutar código — intentar vaciar la cola acá, ignorando el intervalo
    // mínimo entre llamadas. Cubre tanto Smart TV (visibilitychange al
    // suspenderse) como navegador (pagehide al cerrar pestaña/navegar afuera).
    this._boundHandleHide = () => {
      if (document.visibilityState === 'hidden') this.flushOnHide();
    };
    this._boundHandlePageHide = () => this.flushOnHide();
    document.addEventListener('visibilitychange', this._boundHandleHide);
    window.addEventListener('pagehide', this._boundHandlePageHide);
  }

  destroy() {
    this._started = false;
    if (this._confirmTimer) clearTimeout(this._confirmTimer);
    if (this._saveTimer) clearTimeout(this._saveTimer);
    if (this._firstFlushTimer) clearTimeout(this._firstFlushTimer);
    if (this._periodicTimer) clearInterval(this._periodicTimer);
    this._confirmTimer = null;
    this._saveTimer = null;
    this._firstFlushTimer = null;
    this._periodicTimer = null;
    if (this._boundHandleHide) document.removeEventListener('visibilitychange', this._boundHandleHide);
    if (this._boundHandlePageHide) window.removeEventListener('pagehide', this._boundHandlePageHide);
    this._boundHandleHide = null;
    this._boundHandlePageHide = null;
  }

  /** Nuevo contenido en reproducción — cierra lo anterior (si aplica) y arranca el umbral anti-zapping. */
  recordSwitch({ type, item, id } = {}) {
    if (!this.isEnabled()) return;
    // Cambiar de contenido cierra lo que se venía mirando, como un "stop" implícito.
    this._resolvePending({ finished: false, timeIndex: 0 });

    const data = buildData(type, item, id);
    if (!data) return;

    this._pending = { type, data, startedAtMs: Date.now(), confirmed: false };
    this._confirmTimer = setTimeout(() => {
      if (!this._pending) return;
      this._pending.confirmed = true;
      this._enqueue(buildRecord(startActionFor(this._pending.type), this._pending.data));
    }, MIN_TIME_MS);
  }

  /** El usuario cortó (`finished=false`) o el contenido terminó solo (`finished=true`). */
  stopCurrent({ finished = false, timeIndex = 0 } = {}) {
    this._resolvePending({ finished, timeIndex });
  }

  _resolvePending({ finished, timeIndex }) {
    if (this._confirmTimer) {
      clearTimeout(this._confirmTimer);
      this._confirmTimer = null;
    }
    const pending = this._pending;
    this._pending = null;
    if (!pending || !pending.confirmed) return; // no llegó al umbral: no se reporta nada

    const stopAction = finished ? finishedActionFor(pending.type) : stoppedOrAwayActionFor(pending.type);
    if (stopAction == null) return;
    this._enqueue(buildRecord(stopAction, { ...pending.data, timeIndex }));
  }

  _enqueue(record) {
    this._queue.push(record);
    if (this._queue.length > MAX_QUEUE) {
      this._queue = this._queue.slice(this._queue.length - MAX_QUEUE);
    }
    this._saveQueueDebounced();
    this._flush();
  }

  _saveQueueDebounced() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._queue));
      } catch {
        // noop
      }
    }, 500);
  }

  /** Fuerza el envío ignorando el intervalo mínimo — pensado para app en background/hide en TV. */
  flushOnHide() {
    this._flush({ force: true });
  }

  async _flush({ force = false } = {}) {
    if (!this.isEnabled()) return;
    if (this._flushing) return;
    if (this._queue.length === 0) return;

    const now = Date.now();
    if (!force && now - this._lastFlushAtMs < MIN_MS_BETWEEN_CALLS) return;

    this._flushing = true;
    this._lastFlushAtMs = now;
    const batch = this._queue.slice(0, MAX_RECORDS_PER_CALL);
    // Log SIEMPRE (no solo DEV): si el backend devuelve "Unhandeld error"
    // genérico, esto es lo único que permite comparar el payload exacto
    // enviado contra lo que espera el WSDL — la consola a veces colapsa
    // objetos/strings largos, por eso el detalle de record[0] va aparte.
    console.log('[telemetryService] enviando', batch.length, 'registro(s)', batch);
    if (batch[0]) {
      console.log(
        '[telemetryService] record[0] campos => actionId=' + batch[0].actionId +
          ' actionKey=' + JSON.stringify(batch[0].actionKey) +
          ' reasonId=' + batch[0].reasonId +
          ' reasonKey=' + JSON.stringify(batch[0].reasonKey) +
          ' profileId=' + JSON.stringify(batch[0].profileId),
      );
    }
    try {
      const result = await panaccessService.pushTelemetryRecords(batch);
      console.log('[telemetryService] envío OK', result);
      this._queue = this._queue.slice(batch.length);
      this._saveQueueDebounced();
    } catch (err) {
      console.warn('[telemetryService] flush falló, reintenta en', RETRY_AFTER_ERROR_MS, 'ms', err);
      setTimeout(() => this._flush({ force: true }), RETRY_AFTER_ERROR_MS);
    } finally {
      this._flushing = false;
    }
  }

  // --- Debug (paridad con el original: Telemetry.debugStatus/debugClearQueue) ---
  debugStatus() {
    return { queueLength: this._queue.length, pending: this._pending, enabled: this.isEnabled() };
  }

  debugClearQueue() {
    this._queue = [];
    this._saveQueueDebounced();
  }

  /**
   * SOLO PARA BISECCIÓN MANUAL DESDE LA CONSOLA. Manda records directo a
   * `panaccessService.pushTelemetryRecords`, sin pasar por la cola — para
   * probar variantes del payload a mano contra el backend real y acotar qué
   * campo hace que devuelva el "Unhandeld error" genérico. Ej.:
   *   telemetryService.debugPush([{ actionId: 5, reasonId: 1 }])   // mínimo
   *   telemetryService.debugPush(telemetryService.debugSampleRecord())  // "normal" completo
   *   telemetryService.debugPush(telemetryService.debugSampleRecord().map(r => ({ ...r, actionKey: null })))
   */
  async debugPush(records) {
    console.log('[telemetryService] debugPush ->', records);
    try {
      const result = await panaccessService.pushTelemetryRecords(records);
      console.log('[telemetryService] debugPush SUCCESS', result);
      return result;
    } catch (err) {
      console.log('[telemetryService] debugPush ERROR', err);
      throw err;
    }
  }

  /** Registro "normal" de ejemplo, mismo shape que arma buildRecord(). */
  debugSampleRecord() {
    return [buildRecord(TELEMETRY_ACTION.SWITCHED_TO_SERVICE, { test: true })];
  }
}

const telemetryService = new TelemetryService();

// Acceso desde la consola del navegador/TV para bisectar el payload contra
// el backend real (ej. `telemetryService.debugPush(telemetryService.debugSampleRecord())`),
// igual que el `Telemetry` global del proyecto EPG legacy.
if (typeof window !== 'undefined') {
  window.telemetryService = telemetryService;
}

export default telemetryService;
