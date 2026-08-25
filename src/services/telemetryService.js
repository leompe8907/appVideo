/**
 * Telemetría de reproducción (canal en vivo / VOD / catchup) hacia Panaccess.
 *
 * Port de `TelemetryRecords.java` (SDK Android de Panaccess, provisto por el
 * cliente como referencia autoritativa) — valores de actionId/reasonId,
 * umbrales anti-zapping y forma exacta de los campos `data` confirmados
 * línea por línea contra ese archivo, no contra el WSDL ni contra el
 * `Telemetry.js` del proyecto EPG legacy (que en algunos puntos había
 * inventado campos que Android no manda — ver notas puntuales abajo).
 *
 * Reglas de negocio:
 * - Anti-zapping: al empezar a reproducir, arranca un timer de confirmación
 *   (`minTimeFor(type)` — 5 min para canal/stream, 1 min para VOD/catchup,
 *   igual que Android). Si el usuario cambia/corta ANTES de ese tiempo, no
 *   se reporta absolutamente nada (ni inicio ni fin).
 * - Si se confirma (pasó el tiempo mínimo) mientras el usuario sigue viendo
 *   lo mismo, se envía el registro de INICIO ya mismo — no se espera a que
 *   el usuario cambie de contenido para mandarlo.
 * - El registro de FIN (switched away / stopped prematurely / finished) se
 *   envía recién cuando el usuario efectivamente cambia de contenido, corta,
 *   o el contenido termina solo.
 * - Cola persistida en localStorage (sobrevive recargas/cortes de red).
 * - Envío por lotes (máx. `MAX_RECORDS_PER_CALL`), con un intervalo mínimo
 *   entre llamadas (`MIN_MS_BETWEEN_CALLS`) y reintento con backoff simple
 *   tras un error (`RETRY_AFTER_ERROR_MS`).
 *
 * NOTA (2026-08-24): este archivo había sido pisado por completo en el
 * commit "feat: add Most Watched channels rail powered by telemetry service"
 * con un módulo sin relación (ranking de "canales más vistos"), reusando el
 * mismo nombre de archivo. Eso rompía `PlayerContext.jsx` en cada carga de
 * la app (`telemetryService.init is not a function`). El módulo de "más
 * vistos" ahora vive separado en `mostWatchedChannelsService.js`.
 */

import panaccessService from './panaccessService';

const STORAGE_KEY = 'app_telemetry_pending_v1';
const MAX_QUEUE = 500;

/**
 * Umbrales anti-zapping — decisión final del producto (distinta de Android,
 * que usa 5 min para canal/stream y 1 min para VOD/catchup): acá se
 * unificaron los tres tipos en 30s.
 */
export const MIN_TIME_STREAM_MS = 30 * 1000;
export const MIN_TIME_VOD_OR_CATCHUP_MS = 30 * 1000;

const MAX_RECORDS_PER_CALL = 100;
/** Android: DELAY_TIME_TO_SEND_TELEMETRY_REPORT (30s entre envíos de archivo/lote). */
const MIN_MS_BETWEEN_CALLS = 30 * 1000;
/** Android: TIME_TO_SEND_FIRST_TELEMETRY_REPORT. */
const FIRST_FLUSH_DELAY_MS = 25 * 1000;
/** Decisión final del producto (Android real usa 2h): flush periódico cada 30 min. */
const PERIODIC_FLUSH_MS = 30 * 60 * 1000;
/** Igual que Android: DELAY_TIME_TO_SEND_TELEMETRY_REPORT_AFTER_ERROR (1 hora). */
export const RETRY_AFTER_ERROR_MS = 60 * 60 * 1000;

/**
 * Valores exactos de `TelemetryRecords.java`. 5/6 (SWITCHED_TO/AWAY_FROM_SERVICE)
 * son específicamente para servicio Multicast/DVB (sintonía de tuner de
 * broadcast tradicional, con netId/tsId) — esta app SIEMPRE sirve el
 * contenido en vivo por HLS/HTTP vía CDN (OTT, confirmado también por el
 * nombre del método `getAvailableStreams` de la propia API de Panaccess),
 * así que el par correcto es 7/8 (SWITCHED_TO/AWAY_FROM_STREAM).
 */
export const TELEMETRY_ACTION = Object.freeze({
  SWITCHED_TO_STREAM: 7,
  SWITCHED_AWAY_FROM_STREAM: 8,
  VOD_STARTED: 13,
  VOD_STOPPED_PREMATURELY: 14,
  VOD_FINISHED: 15,
  CATCHUP_STARTED: 16,
  CATCHUP_STOPPED_PREMATURELY: 17,
  CATCHUP_FINISHED: 18,
});

/**
 * Android manda SIEMPRE `USER_INTERACTION_REASON` (1) en toda llamada
 * observada, incluso para *_FINISHED — `VOD_ENDED_REASON`(3)/`CATCHUP_ENDED_REASON`(4)
 * existen como constantes pero ninguna función real las usa.
 */
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

function minTimeFor(type) {
  return type === 'service' ? MIN_TIME_STREAM_MS : MIN_TIME_VOD_OR_CATCHUP_MS;
}

function startActionFor(type) {
  if (type === 'service') return TELEMETRY_ACTION.SWITCHED_TO_STREAM;
  if (type === 'vod') return TELEMETRY_ACTION.VOD_STARTED;
  if (type === 'catchup') return TELEMETRY_ACTION.CATCHUP_STARTED;
  return null;
}

function stoppedOrAwayActionFor(type) {
  if (type === 'service') return TELEMETRY_ACTION.SWITCHED_AWAY_FROM_STREAM;
  if (type === 'vod') return TELEMETRY_ACTION.VOD_STOPPED_PREMATURELY;
  if (type === 'catchup') return TELEMETRY_ACTION.CATCHUP_STOPPED_PREMATURELY;
  return null;
}

function finishedActionFor(type) {
  if (type === 'vod') return TELEMETRY_ACTION.VOD_FINISHED;
  if (type === 'catchup') return TELEMETRY_ACTION.CATCHUP_FINISHED;
  // Un canal en vivo no "termina": equivale a cambiarse de stream.
  return stoppedOrAwayActionFor(type);
}

/**
 * Datos del registro de INICIO — shape exacto de
 * `storeSwitchedToStreamAction` / `storeVodStartedAction` / `storeCatchupStartedAction`,
 * más un par `serviceId`/`serviceName` agregado a pedido explícito en TODAS
 * las acciones (canal/VOD/catchup) — no existe en Android, es una adición
 * nuestra para no tener que fijarse en qué campo mirar según el `actionId`
 * al parsear/analizar la telemetría después. Siempre es un espejo del
 * id/nombre específico del tipo (streamId/vodId/catchupId), nunca un dato
 * nuevo — no reemplaza a esos campos, que siguen mandándose igual.
 * Notar la asimetría real de Android en catchup: el inicio SÍ lleva
 * catchupGroupId/catchupGroupName (el fin no).
 */
function buildStartData(type, item, id) {
  if (type === 'service') {
    const streamId = item?.id ?? item?.lcn ?? id;
    if (streamId == null) return null;
    const streamName = item?.name ?? '';
    return { streamId, streamName, serviceId: streamId, serviceName: streamName };
  }
  if (type === 'vod') {
    const vodId = item?.id ?? item?.vodId ?? id;
    if (vodId == null) return null;
    const vodName = item?.name ?? item?.title ?? '';
    // timeIndex acá es la posición de REANUDACIÓN (0 si arranca de cero) —
    // esta app no tiene hoy un concepto de "seguir viendo desde..." para VOD.
    return { vodId, vodName, timeIndex: 0, serviceId: vodId, serviceName: vodName };
  }
  if (type === 'catchup') {
    const catchupId = item?.id ?? item?.catchupId ?? id;
    if (catchupId == null) return null;
    const catchupName = item?.name ?? item?.title ?? '';
    return {
      catchupGroupId: item?.catchupGroupId ?? item?.groupId ?? null,
      catchupGroupName: item?.catchupGroupName ?? item?.groupName ?? '',
      catchupId,
      catchupName,
      serviceId: catchupId,
      serviceName: catchupName,
    };
  }
  return null;
}

/**
 * Datos del registro de FIN — shape exacto de
 * `storeSwitchedAwayFromStreamOrServiceAction` / `storeVodStoppedPrematurelyAction`
 * / `storeVodFinishedAction` / `storeCatchupStoppedPrematurelyAction` / `storeCatchupFinishedAction`,
 * más el mismo par `serviceId`/`serviceName` agregado en el inicio (ver comentario ahí).
 * - service: mismos campos que el inicio (streamId/streamName) + `duration`
 *   real calculada (única acción cuyo registro de fin SÍ suma un `duration`
 *   en Android, ver `storeSwitchedAwayFromStreamOrServiceAction`).
 * - vod: vodId/vodName/timeIndex (posición donde cortó/terminó) — SIN duration.
 * - catchup: catchupId/catchupName/timeIndex — SIN catchupGroupId/catchupGroupName
 *   ni duration (asimetría real respecto del inicio, confirmada en el .java).
 */
function buildStopData(pending, timeIndex) {
  const { type, startData, startedAtMs } = pending;
  if (type === 'service') {
    const watchedSeconds = Math.round((Date.now() - startedAtMs) / 1000);
    return { ...startData, duration: watchedSeconds }; // startData ya trae serviceId/serviceName
  }
  if (type === 'vod') {
    return {
      vodId: startData.vodId,
      vodName: startData.vodName,
      timeIndex: timeIndex ?? 0,
      serviceId: startData.vodId,
      serviceName: startData.vodName,
    };
  }
  if (type === 'catchup') {
    return {
      catchupId: startData.catchupId,
      catchupName: startData.catchupName,
      timeIndex: timeIndex ?? 0,
      serviceId: startData.catchupId,
      serviceName: startData.catchupName,
    };
  }
  return null;
}

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
    // profileId SIEMPRE 0 — Android no lo pasa en ninguna llamada observada
    // (no está ligado al sistema de sub-perfiles de esta app, son conceptos
    // distintos).
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
    // Cambiar de contenido cierra lo que se venía mirando, como un "stop"
    // implícito (sin timeIndex — no aplica a un cambio directo de canal).
    this._resolvePending({ finished: false });

    const startData = buildStartData(type, item, id);
    if (!startData) return;

    this._pending = { type, startData, startedAtMs: Date.now(), confirmed: false };
    this._confirmTimer = setTimeout(() => {
      if (!this._pending) return;
      this._pending.confirmed = true;
      this._enqueue(buildRecord(startActionFor(this._pending.type), this._pending.startData));
    }, minTimeFor(type));
  }

  /**
   * El usuario cortó (`finished=false`) o el contenido terminó solo (`finished=true`).
   * `timeIndex` es la posición de reproducción en VOD/catchup (ej. "se quedó
   * en el minuto 30") — no aplica a canal en vivo.
   */
  stopCurrent({ finished = false, timeIndex } = {}) {
    this._resolvePending({ finished, timeIndex });
  }

  _resolvePending({ finished, timeIndex } = {}) {
    if (this._confirmTimer) {
      clearTimeout(this._confirmTimer);
      this._confirmTimer = null;
    }
    const pending = this._pending;
    this._pending = null;
    if (!pending || !pending.confirmed) return; // no llegó al umbral: no se reporta nada

    const stopAction = finished ? finishedActionFor(pending.type) : stoppedOrAwayActionFor(pending.type);
    if (stopAction == null) return;

    const stopData = buildStopData(pending, timeIndex);
    if (!stopData) return;

    this._enqueue(buildRecord(stopAction, stopData));
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
    // Log SIEMPRE (no solo DEV): si el backend devuelve un error genérico,
    // esto es lo único que permite comparar el payload exacto enviado — la
    // consola a veces colapsa objetos/strings largos, por eso el detalle de
    // record[0] va aparte.
    console.log('[telemetryService] enviando', batch.length, 'registro(s)', batch);
    if (batch[0]) {
      console.log(
        '[telemetryService] record[0] campos => actionId=' + batch[0].actionId +
          ' actionKey=' + JSON.stringify(batch[0].actionKey) +
          ' reasonId=' + batch[0].reasonId +
          ' reasonKey=' + JSON.stringify(batch[0].reasonKey) +
          ' profileId=' + JSON.stringify(batch[0].profileId) +
          ' data=' + batch[0].data,
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
   * probar variantes del payload a mano contra el backend real. Ej.:
   *   telemetryService.debugPush([{ actionId: 7, reasonId: 1 }])   // mínimo
   *   telemetryService.debugPush(telemetryService.debugSampleRecord())  // "normal" completo
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
    return [buildRecord(TELEMETRY_ACTION.SWITCHED_TO_STREAM, { test: true })];
  }
}

const telemetryService = new TelemetryService();

// Acceso desde la consola del navegador/TV para bisectar el payload contra
// el backend real (ej. `telemetryService.debugPush(telemetryService.debugSampleRecord())`).
if (typeof window !== 'undefined') {
  window.telemetryService = telemetryService;
}

export default telemetryService;
