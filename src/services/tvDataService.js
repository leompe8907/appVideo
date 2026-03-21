/**
 * Servicio de datos para TV (bouquets y canales).
 * Extrae y normaliza la lógica de 10foot (AppData + cv) para uso en React.
 */

import panaccessService from './panaccessService';
import { loadEPGForChannels } from './epgService';

/**
 * Obtiene el tipo de layout a usar para un bouquet a partir de customData.
 * Si no está definido, devuelve el layout estándar de logo.
 */
function getBouquetLayoutType(rawBouquet) {
  if (!rawBouquet) {
    return 'service_layout_logo_normal';
  }

  const customData = rawBouquet.customData;
  if (!customData) {
    return 'service_layout_logo_normal';
  }

  let rawLayout = null;

  // customData puede venir como string (JSON o nombre directo) u objeto
  if (typeof customData === 'string') {
    const trimmed = customData.trim();
    // Intentar parsear JSON si parece un objeto
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        rawLayout =
          parsed.serviceLayout ||
          parsed.service_layout ||
          parsed.layout ||
          parsed.design ||
          parsed.type ||
          null;
      } catch (e) {
        // Si falla el JSON, usamos el string tal cual
        rawLayout = trimmed;
      }
    } else {
      rawLayout = trimmed;
    }
  } else if (typeof customData === 'object') {
    rawLayout =
      customData.serviceLayout ||
      customData.service_layout ||
      customData.layout ||
      customData.design ||
      customData.type ||
      null;
  }

  if (!rawLayout) {
    return 'service_layout_logo_normal';
  }

  const value = String(rawLayout).toLowerCase().trim();

  // Aceptar tanto nombres completos como abreviados sin prefijo
  if (value === 'service_layout_logo_normal' || value === 'logo_normal' || value === 'logo') {
    return 'service_layout_logo_normal';
  }
  if (
    value === 'service_layout_event_normal' ||
    value === 'event_normal' ||
    value === 'event'
  ) {
    return 'service_layout_event_normal';
  }
  if (
    value === 'service_layout_event_and_logo' ||
    value === 'event_and_logo' ||
    value === 'event+logo'
  ) {
    return 'service_layout_event_and_logo';
  }
  if (
    value === 'service_layout_event_and_logo_overlay' ||
    value === 'event_and_logo_overlay'
  ) {
    return 'service_layout_event_and_logo_overlay';
  }
  if (
    value === 'service_layout_event_line' ||
    value === 'event_line' ||
    value === 'eventline'
  ) {
    return 'service_layout_event_line';
  }
  if (
    value === 'service_layout_grid_horizontal' ||
    value === 'grid_horizontal' ||
    value === 'grid-h' ||
    value === 'grid_h'
  ) {
    return 'service_layout_grid_horizontal';
  }
  if (
    value === 'service_layout_grid_vertical' ||
    value === 'grid_vertical' ||
    value === 'grid-v' ||
    value === 'grid_v'
  ) {
    return 'service_layout_grid_vertical';
  }

  // Fallback seguro: layout estándar
  return 'service_layout_logo_normal';
}

/**
 * Normaliza la respuesta de getBouquets a un array de bouquets.
 * @param {*} response - Respuesta del API (array u objeto con lista)
 * @returns {Array} Lista de bouquets
 */
export function normalizeBouquetsResponse(response) {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    if (Array.isArray(response.bouquets)) return response.bouquets;
    if (Array.isArray(response.data)) return response.data;
    const keys = Object.keys(response).filter((k) => Array.isArray(response[k]));
    if (keys.length > 0) return response[keys[0]];
  }
  return [];
}

/**
 * Normaliza la respuesta de getAvailableStreams a un array de canales/streams.
 * Cada ítem esperado: { id, name, img, lcn, bouquetIds, epgStreamId, ... }
 */
export function normalizeStreamsResponse(response) {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    if (Array.isArray(response.services)) return response.services;
    if (Array.isArray(response.streams)) return response.streams;
    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response.answer)) return response.answer;
    const keys = Object.keys(response).filter((k) => Array.isArray(response[k]));
    if (keys.length > 0) return response[keys[0]];
  }
  return [];
}

/**
 * Asegura que el stream tenga una URL de reproducción (como en 10foot).
 * Si el backend no devolvió url/streamUrl/hlsUrl/hls, construye la URL con getStreamM3u8.
 * @param {Object} stream - Objeto canal/stream (id, epgStreamId, url, ...)
 * @returns {Object} El mismo stream, con .url definida si fue posible.
 */
function ensureStreamPlaybackUrl(stream) {
  if (!stream || typeof stream !== 'object') return stream;
  const hasUrl =
    (stream.url && typeof stream.url === 'string' && stream.url.trim() !== '') ||
    (stream.streamUrl && typeof stream.streamUrl === 'string' && stream.streamUrl.trim() !== '') ||
    (stream.hlsUrl && typeof stream.hlsUrl === 'string' && stream.hlsUrl.trim() !== '') ||
    (stream.hls && typeof stream.hls === 'string' && stream.hls.trim() !== '');
  if (hasUrl) {
    if (!stream.url && (stream.streamUrl || stream.hlsUrl || stream.hls)) {
      stream.url = stream.streamUrl || stream.hlsUrl || stream.hls;
    }
    return stream;
  }
  const streamId = stream.id ?? stream.epgStreamId;
  if (streamId == null || streamId === '') return stream;
  try {
    const url = panaccessService.getStreamM3u8Url({ streamId });
    if (url) stream.url = url;
  } catch (e) {
    if (import.meta.env?.DEV) {
      console.warn('[tvDataService] ensureStreamPlaybackUrl:', e?.message || e);
    }
  }
  return stream;
}

/**
 * Filtra bouquets marcados como principales (isMain) y ordena por prioridad.
 * Útil con datos ya cargados (p. ej. preload) sin volver a llamar al API.
 */
export function filterMainBouquets(bouquets) {
  if (!Array.isArray(bouquets)) return [];

  const mainBouquets = bouquets.filter((b) => {
    const raw = b.isMain ?? b.ismain ?? b.main;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') {
      const v = raw.toLowerCase();
      return v === 'true' || v === '1' || v === 'yes';
    }
    return false;
  });

  mainBouquets.sort((a, b) => {
    const pa = Number(a.priority ?? a.Priority ?? 0);
    const pb = Number(b.priority ?? b.Priority ?? 0);
    return pa - pb;
  });

  return mainBouquets;
}

/**
 * Obtiene y normaliza los bouquets "principales" (isMain) ordenados por prioridad.
 * Equivalente a parte de la lógica de AppData.getDataForServicesTV en 10foot.
 */
export async function getMainBouquets(options = {}) {
  const { enableRetry = false, ...apiOptions } = options;

  const response = await panaccessService.getBouquets({ enableRetry, ...apiOptions });
  const list = normalizeBouquetsResponse(response);

  return filterMainBouquets(list);
}

/**
 * Obtiene y normaliza los canales/streams para un bouquet dado.
 * @param {Object} bouquet - Bouquet seleccionado (con bouquetId o id).
 * @returns {Promise<Array>} Lista de canales ordenados por LCN.
 */
export async function getChannelsForBouquet(bouquet, options = {}) {
  if (!bouquet) return [];

  const { enableRetry = false, ...apiOptions } = options;

  const response = await panaccessService.getAvailableStreams({ enableRetry, ...apiOptions });
  const list = normalizeStreamsResponse(response);

  const bouquetId = String(bouquet.bouquetId ?? bouquet.id ?? '');

  const filtered = list.filter((service) => {
    const ids = service.bouquetIds || service.bouquets;
    if (Array.isArray(ids)) {
      return ids.map(String).includes(bouquetId);
    }
    return false;
  });

  filtered.sort((a, b) => Number(a.lcn ?? 0) - Number(b.lcn ?? 0));

  filtered.forEach(ensureStreamPlaybackUrl);
  return filtered;
}

/**
 * Obtiene bouquets con sus canales asociados (items), similar a AppData.prepareServicesAndBouquetsData.
 * No crea el bouquet "Todos los canales" ni favoritos; se centra en la relación bouquet-items.
 * @returns {Promise<Array<{ bouquetId: string, items: Array }>>}
 */
export async function getBouquetsWithChannels(options = {}) {
  const { enableRetry = false, ...apiOptions } = options;

  const [bouquetResp, streamsResp] = await Promise.all([
    panaccessService.getBouquets({ enableRetry, ...apiOptions }),
    panaccessService.getAvailableStreams({ enableRetry, ...apiOptions }),
  ]);

  const bouquets = normalizeBouquetsResponse(bouquetResp);
  const streams = normalizeStreamsResponse(streamsResp);

  streams.forEach(ensureStreamPlaybackUrl);

  const byBouquetId = {};

  streams.forEach((service) => {
    const ids = service.bouquetIds || service.bouquets || [];
    if (!Array.isArray(ids)) return;

    ids.map(String).forEach((id) => {
      if (!byBouquetId[id]) byBouquetId[id] = [];
      byBouquetId[id].push(service);
    });
  });

  Object.values(byBouquetId).forEach((arr) => {
    arr.sort((a, b) => Number(a.lcn ?? 0) - Number(b.lcn ?? 0));
  });

  return bouquets
    .map((b) => {
      const bouquetId = String(b.bouquetId ?? b.id ?? '');
      const items = byBouquetId[bouquetId] || [];
      const layoutType = getBouquetLayoutType(b);
      return { ...b, bouquetId, items, layoutType };
    })
    .filter((b) => b.items.length > 0);
}

/**
 * Carga EPG para una lista de streams (canales) usando la config de marca.
 * Migrado del proyecto EPG (getEPGByBouquet). Asigna channel.epgItems a cada canal.
 * @param {Array} streams - Lista de canales (con epgStreamId).
 * @param {Object} brandConfig - Config de marca (epgApiKey/epgApiToken en brandConfig; epg: { daysOffset, rowsOnInit, hoursLimit } en marca).
 * @param {Object} options - maxChannels, onProgress(index, total).
 * @returns {Promise<Array>} La misma lista con epgItems asignados.
 */
export async function loadEPGForStreams(streams, brandConfig, options = {}) {
  if (!Array.isArray(streams) || streams.length === 0 || !brandConfig) return streams;
  const epg = brandConfig.epg ?? {};
  const maxChannels = options.maxChannels ?? epg.rowsOnInit ?? 7;
  await loadEPGForChannels(streams, {
    epgApiKey: brandConfig.epgApiKey ?? '',
    epgApiToken: brandConfig.epgApiToken ?? '',
    epgDaysOffset: epg.daysOffset ?? 2,
    epgHoursLimit: epg.hoursLimit ?? 12,
    maxChannels,
    onProgress: options.onProgress ?? (() => {}),
  });
  return streams;
}

