/**
 * "Canales más vistos" (riel de Inicio) -- consume el ranking global que
 * calcula el backend Wind (ver `telemetry` app en Back-Wind-V2,
 * `telemetry/services/top_channels.py` + endpoint
 * `GET {base}/api/v1/telemetry/top-channels/`).
 *
 * Reutiliza el mismo JWT y la misma base que `deviceSessionService.js` /
 * `deviceAuthService.js` (login.deviceSession) -- no es una sesión nueva.
 * Se activa por brand con `login.telemetry.enabled` en `brands.js`; si el
 * brand no lo activa, o no tiene sesión de dispositivo, o la llamada falla
 * por cualquier motivo, este módulo nunca lanza: siempre devuelve `null`/`[]`
 * y el riel simplemente no se muestra (ver `MostWatchedRail.jsx`).
 */

import {
  getDeviceSessionAccessToken,
  hasDeviceSessionAuth,
  refreshDeviceSessionAccessToken,
  resolveDeviceAuthBaseUrl,
} from './deviceAuthService';
import { getChannelStableId } from '../utils/channelId';

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

/**
 * Base HTTP para telemetría. Prioridad: `login.telemetry.baseUrl` explícita
 * > la misma base resuelta para device-session (`deviceSession.baseUrl` >
 * `socialLogin.backendBaseUrl` > `udid.baseUrl`). En la práctica, hoy es
 * siempre la misma base que device-session -- el override explícito es solo
 * para el día en que algún brand quiera separar ambos backends.
 */
export function resolveTelemetryBaseUrl(brandConfig) {
  const explicit =
    typeof brandConfig?.login?.telemetry?.baseUrl === 'string'
      ? brandConfig.login.telemetry.baseUrl.trim()
      : '';
  if (explicit) return trimTrailingSlash(explicit);
  return resolveDeviceAuthBaseUrl(brandConfig);
}

/**
 * `true` solo si el brand activó explícitamente `login.telemetry.enabled` Y
 * hay una base resuelta. No depende de si el usuario ya tiene sesión de
 * dispositivo -- eso se resuelve al momento de pedir el ranking.
 */
export function isTelemetryEnabled(brandConfig) {
  return brandConfig?.login?.telemetry?.enabled === true && !!resolveTelemetryBaseUrl(brandConfig);
}

/**
 * `GET {base}/api/v1/telemetry/top-channels/` con el JWT de device-session.
 * Reintenta una vez si el access token expiró (401), igual que
 * `authorizedDeviceRequest` en `deviceAuthService.js`.
 *
 * Nunca lanza: devuelve `null` si telemetry no está habilitado, si no hay
 * sesión de dispositivo activa, o si la llamada falla por cualquier razón
 * (red, 401 persistente, JSON inválido, etc). El caller trata `null` como
 * "no hay riel que mostrar", no como un error a reportar al usuario.
 *
 * @param {Object} brandConfig - currentBrand.
 * @param {string} brand
 * @returns {Promise<{window_days: number, channels: Array<{rank:number, channel_id:number, name:string|null, total_duration_seconds:number, total_views:number}>} | null>}
 */
export async function getTopChannelsGlobal(brandConfig, brand) {
  if (!isTelemetryEnabled(brandConfig)) return null;
  if (!hasDeviceSessionAuth(brand)) return null;

  const base = resolveTelemetryBaseUrl(brandConfig);
  if (!base) return null;

  const doFetch = (token) =>
    fetch(`${base}/api/v1/telemetry/top-channels/`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  try {
    let accessToken = getDeviceSessionAccessToken(brand);
    if (!accessToken) return null;

    let res = await doFetch(accessToken);
    if (res.status === 401) {
      const refreshed = await refreshDeviceSessionAccessToken(brandConfig, brand);
      if (!refreshed) return null;
      accessToken = refreshed;
      res = await doFetch(accessToken);
    }

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.channels)) return null;
    return data;
  } catch {
    // Red caída, JSON inválido, etc -- fallar en silencio (ver doc de arriba).
    return null;
  }
}

/**
 * Cruza el ranking (`channel_id` de PanAccess) contra el lineup ya cargado
 * en el preload (`epg.streams`) para armar las tarjetas del riel, en el
 * mismo orden del ranking. Canales del ranking que ya no están en el lineup
 * (removidos, bouquet distinto, etc) se descartan en vez de romper el riel.
 *
 * @param {{channels: Array<{rank:number, channel_id:number}>} | null} topChannelsResponse
 * @param {Array} streams - `epg.streams` del preload.
 * @returns {Array} canales (mismo shape que los items de `streams`), en orden de ranking.
 */
export function buildMostWatchedItems(topChannelsResponse, streams) {
  const ranking = topChannelsResponse?.channels;
  if (!Array.isArray(ranking) || ranking.length === 0) return [];
  if (!Array.isArray(streams) || streams.length === 0) return [];

  const byId = new Map();
  for (const stream of streams) {
    const id = getChannelStableId(stream);
    if (id && !byId.has(id)) byId.set(id, stream);
  }

  const items = [];
  for (const entry of ranking) {
    if (entry?.channel_id == null) continue;
    const stream = byId.get(String(entry.channel_id));
    if (stream) items.push(stream);
  }
  return items;
}

export default {
  isTelemetryEnabled,
  resolveTelemetryBaseUrl,
  getTopChannelsGlobal,
  buildMostWatchedItems,
};
