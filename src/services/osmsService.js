import panaccessService from './panaccessService';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Normaliza y filtra OSMs (últimos 30 días).
 * @param {Array} raw
 * @param {Object} options
 * @param {number} [options.days=30]
 */
export function normalizeOsms(raw, options = {}) {
  const days = Number(options.days ?? 30);
  const windowMs = Number.isFinite(days) && days > 0 ? days * 24 * 60 * 60 * 1000 : THIRTY_DAYS_MS;
  const cutoff = Date.now() - windowMs;

  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((osm) => {
      if (!osm || typeof osm !== 'object') return null;
      const id = osm.id ?? osm.osmId ?? osm.messageId ?? null;
      const message = osm.message ?? osm.text ?? '';
      const time = toDate(osm.time ?? osm.date ?? osm.createdAt ?? null);
      return {
        id,
        licenseKey: osm.licenseKey ?? osm.license ?? null,
        time,
        message: typeof message === 'string' ? message : String(message ?? ''),
      };
    })
    .filter((osm) => {
      if (!osm) return false;
      if (osm.id == null || osm.id === '') return false;
      if (!osm.time) return false; // paridad con EPG: si no hay fecha, no mostrar
      if (!Number.isFinite(osm.time.getTime())) return false;
      return osm.time.getTime() >= cutoff;
    })
    .sort((a, b) => (b.time?.getTime?.() ?? 0) - (a.time?.getTime?.() ?? 0));
}

export function getNewestOsmTime(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const newest = items.reduce((acc, cur) => {
    const t = cur?.time?.getTime?.();
    if (!Number.isFinite(t)) return acc;
    if (!acc) return cur;
    const at = acc.time.getTime();
    return t > at ? cur : acc;
  }, null);
  return newest?.time ?? null;
}

/**
 * Fetch de OSMs desde Panaccess (getOsms).
 * @param {Object} options
 * @param {number} [options.lastKnownId=-1]
 * @param {number} [options.days=30]
 * @param {boolean} [options.enableRetry=true]
 * @returns {Promise<Array<{id:any, licenseKey:any, time:Date, message:string}>>}
 */
export async function fetchOsms(options = {}) {
  const { lastKnownId = -1, days = 30, enableRetry = true } = options;
  const resp = await panaccessService.getOsms({ lastKnownId, enableRetry });
  const list = Array.isArray(resp) ? resp : resp?.answer ?? resp?.items ?? resp?.osms ?? [];
  return normalizeOsms(list, { days });
}

export default {
  fetchOsms,
  normalizeOsms,
  getNewestOsmTime,
};

