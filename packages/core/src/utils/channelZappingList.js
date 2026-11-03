/**
 * Lista de canales para zapping (paridad 10foot AppData.prepareServicesAndBouquetsData).
 * Orden por LCN ascendente; canales sin número (lcn 0) al final.
 */

import { dedupeStreams } from './channelId';

export function buildZappingChannelList(streams) {
  const raw = dedupeStreams(Array.isArray(streams) ? streams : []);
  const withNumber = [];
  const withoutNumber = [];

  for (const ch of raw) {
    if (!ch) continue;
    if (Number(ch.lcn) === 0) {
      withoutNumber.push(ch);
    } else {
      withNumber.push(ch);
    }
  }

  withNumber.sort((a, b) => {
    const la = Number(a.lcn);
    const lb = Number(b.lcn);
    if (la > lb) return 1;
    if (la < lb) return -1;
    return 0;
  });

  return [...withNumber, ...withoutNumber];
}

/**
 * Índice del canal actual por id de servicio (10foot: playbackMetadata.id / getServiceTV).
 * @returns {number} índice o -1 si no está en la lista
 */
export function findZappingChannelIndex(channels, serviceId) {
  if (!Array.isArray(channels) || channels.length === 0) return -1;
  if (serviceId == null || String(serviceId).trim() === '') return -1;

  const idStr = String(serviceId);
  return channels.findIndex((ch) => ch?.id != null && String(ch.id) === idStr);
}

/**
 * Canal con ese LCN (número tecleado en el control) o, si no existe, el de LCN
 * más cercano; a igual distancia, el más bajo. 0 = canal sin número.
 * @returns {object|null}
 */
export function findChannelByLcn(channels, lcn) {
  const n = Number(lcn);
  if (!Array.isArray(channels) || !Number.isFinite(n) || n === 0) return null;
  let best = null;
  let bestLcn = 0;
  for (const ch of channels) {
    const chLcn = Number(ch?.lcn);
    if (!Number.isFinite(chLcn) || chLcn === 0) continue;
    const dist = Math.abs(chLcn - n);
    const bestDist = Math.abs(bestLcn - n);
    if (!best || dist < bestDist || (dist === bestDist && chLcn < bestLcn)) {
      best = ch;
      bestLcn = chLcn;
    }
  }
  return best;
}
