/**
 * Servicio de EPG (guía de programación).
 * Migrado desde el proyecto EPG: getEPGURL, getEPG, carga por canales (getEPGByBouquet).
 */

import CryptoJS from 'crypto-js';
import { getEpgCdnUrl, getOperatorName } from '../utils/userSession';
import { normalizeEpgInWorker } from '../workers/epgWorkerClient';

const DEFAULT_EPG_HOURS_LIMIT = 12;
const DEFAULT_EPG_DAYS_OFFSET = 2;

/**
 * Construye la URL de descarga de EPG para un canal (epgStreamId).
 * Equivalente a AppData.getEPGURL en el proyecto EPG.
 * @param {string|number} streamId - epgStreamId del canal.
 * @param {Object} options - epgApiKey, epgApiToken, epgCdnUrl, operatorName, epgDaysOffset.
 * @returns {string} URL o '' si faltan datos.
 */
export function getEPGURL(streamId, options = {}) {
  const epgCdnUrl = options.epgCdnUrl ?? getEpgCdnUrl();
  const operatorName = options.operatorName ?? getOperatorName();
  const epgApiKey = options.epgApiKey ?? '';
  const epgApiToken = options.epgApiToken ?? '';
  const epgDaysOffset = options.epgDaysOffset ?? DEFAULT_EPG_DAYS_OFFSET;

  if (!epgCdnUrl || !operatorName || !epgApiKey) return '';
  const streamIdStr = String(streamId ?? '').trim();
  if (!streamIdStr) return '';

  const accessToken = CryptoJS.SHA256(
    epgApiKey + operatorName + epgApiKey + streamIdStr + epgApiKey
  ).toString();

  const base = epgCdnUrl.replace(/\?.*$/, '').replace(/\/+$/, '');
  return (
    `${base}/?pid=guest.home.login&requestMode=download&d=epg` +
    `&apiToken=${encodeURIComponent(epgApiToken)}` +
    `&accessToken=${accessToken}` +
    `&operator=${encodeURIComponent(operatorName)}` +
    `&epgStreamId=${streamIdStr}` +
    `&pastDays=${epgDaysOffset}` +
    `&unzipped=true`
  );
}

/**
 * Parsea la respuesta de la API EPG (puede ser JSON puro o JSONP).
 * @param {string} text
 * @returns {Array}
 */
function parseEPGResponse(text) {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const jsonpMatch = trimmed.match(/^\w+\s*\(\s*(\[\s*\{[\s\S]*\}\s*\])\s*\)\s*;?\s*$/);
    if (jsonpMatch) {
      try {
        const arr = JSON.parse(jsonpMatch[1]);
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}

/**
 * Diferencia en horas entre dos fechas (utc).
 * @param {import('moment').Moment} start
 * @param {import('moment').Moment} today
 * @param {string} unit
 * @returns {number}
 */
function getTimeDifference(start, today, unit = 'hours') {
  if (!start || !today) return Infinity;
  const a = start.valueOf();
  const b = today.valueOf();
  const diff = Math.abs(a - b);
  if (unit === 'hours') return diff / (1000 * 60 * 60);
  if (unit === 'days') return diff / (1000 * 60 * 60 * 24);
  return diff;
}

/**
 * Obtiene la fecha/hora "hoy" en UTC (sin dependencia de moment en el servicio; se usan Date).
 * @returns {{ valueOf: () => number, isBetween: (a, b) => boolean }}
 */
function getTodayDate() {
  const d = new Date();
  const valueOf = () => d.getTime();
  const isBetween = (start, end) => {
    const t = d.getTime();
    const s = start && typeof start.valueOf === 'function' ? start.valueOf() : (start?.valueOf?.() ?? 0);
    const e = end && typeof end.valueOf === 'function' ? end.valueOf() : (end?.valueOf?.() ?? 0);
    return t >= s && t <= e;
  };
  return { valueOf, isBetween };
}

/**
 * Convierte fecha del evento (string o timestamp) a objeto con valueOf para comparaciones.
 * @param {string|number} start
 * @returns {{ valueOf: () => number } | null}
 */
function toMomentLike(start) {
  if (start == null) return null;
  const t = typeof start === 'number' ? start : new Date(start).getTime();
  if (Number.isNaN(t)) return null;
  return { valueOf: () => t };
}

/**
 * Descarga la EPG desde la URL (fetch). Soporta CORS; si el servidor solo devuelve JSONP,
 * parseEPGResponse intenta extraer el JSON del wrapper.
 * @param {string} url
 * @returns {Promise<Array>} Lista de eventos EPG.
 */
export async function fetchEPG(url) {
  if (!url || typeof url !== 'string') return [];
  try {
    const res = await fetch(url, { method: 'GET', mode: 'cors' });
    const text = await res.text();
    return parseEPGResponse(text);
  } catch (e) {
    if (import.meta.env?.DEV) {
      console.warn('[epgService] fetchEPG error:', e?.message ?? e);
    }
    return [];
  }
}

/**
 * Filtra eventos EPG por ventana de horas (epgHoursLimit) y añade startDate/endDate.
 * @param {Array} data - Eventos crudos (start, end, ...).
 * @param {number} epgHoursLimit
 * @returns {Array}
 */
function filterAndEnrichEvents(data, epgHoursLimit) {
  const todayDate = getTodayDate();
  const eventsFiltered = [];

  (data || []).forEach((event) => {
    const startDate = toMomentLike(event.start);
    const endDate = toMomentLike(event.end);
    if (!startDate || !endDate) return;
    const hoursDiff = getTimeDifference(startDate, todayDate, 'hours');
    if (hoursDiff <= epgHoursLimit) {
      eventsFiltered.push({
        ...event,
        startDate,
        endDate,
      });
    }
  });

  return eventsFiltered;
}

/**
 * Carga EPG para una lista de canales (streams) de forma secuencial, como getEPGByBouquet.
 * Mutación: asigna channel.epgItems a cada canal.
 * @param {Array} channels - Lista de canales (cada uno con id, epgStreamId, ...).
 * @param {Object} options - epgApiKey, epgApiToken, epgDaysOffset, epgHoursLimit, maxChannels, onProgress(channelIndex, total).
 * @returns {Promise<Array>} La misma lista de canales con epgItems asignados.
 */
export async function loadEPGForChannels(channels, options = {}) {
  const list = Array.isArray(channels) ? [...channels] : [];
  const epgApiKey = options.epgApiKey ?? '';
  const epgApiToken = options.epgApiToken ?? '';
  const epgDaysOffset = options.epgDaysOffset ?? DEFAULT_EPG_DAYS_OFFSET;
  const epgHoursLimit = options.epgHoursLimit ?? DEFAULT_EPG_HOURS_LIMIT;
  const maxChannels = options.maxChannels ?? list.length;
  const onProgress = options.onProgress ?? (() => {});

  const epgCdnUrl = options.epgCdnUrl ?? getEpgCdnUrl();
  const operatorName = options.operatorName ?? getOperatorName();

  if (!epgCdnUrl || !operatorName) {
    if (import.meta.env?.DEV) {
      console.warn('[epgService] loadEPGForChannels: sin epgCdnUrl u operatorName (getClientConfig)');
    }
    list.forEach((ch) => {
      if (!ch.epgItems) ch.epgItems = [];
    });
    return list;
  }

  const toProcess = Math.min(maxChannels, list.length);
  const opts = {
    epgApiKey,
    epgApiToken,
    epgCdnUrl,
    operatorName,
    epgDaysOffset,
  };

  for (let index = 0; index < toProcess; index++) {
    const channel = list[index];
    if (!channel) continue;
    if (channel.epgItems != null && channel.epgItems.length > 0) continue;

    const epgStreamId = channel.epgStreamId ?? channel.epgStreamid;
    if (epgStreamId === 0 || epgStreamId === null || epgStreamId === '0' || epgStreamId === undefined || epgStreamId === '') {
      channel.epgItems = [];
      onProgress(index + 1, toProcess);
      continue;
    }

    const url = getEPGURL(epgStreamId, opts);
    if (!url) {
      channel.epgItems = [];
      onProgress(index + 1, toProcess);
      continue;
    }

    const data = await fetchEPG(url);
    // Optimización TV: normalización en Worker si está disponible.
    const nowMs = Date.now();
    const fromWorker = await normalizeEpgInWorker(data, { epgHoursLimit, nowMs }).catch(() => null);
    channel.epgItems = fromWorker || filterAndEnrichEvents(data, epgHoursLimit);
    onProgress(index + 1, toProcess);
  }

  for (let i = toProcess; i < list.length; i++) {
    if (list[i] && list[i].epgItems == null) list[i].epgItems = [];
  }

  return list;
}

export default {
  getEPGURL,
  fetchEPG,
  loadEPGForChannels,
};
