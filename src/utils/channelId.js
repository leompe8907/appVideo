export function getChannelStableId(channel) {
  if (!channel) return '';
  // En este repo, el stream/canal normalmente usa `id` como identificador principal.
  // También puede existir `epgStreamId`. Como fallback, `lcn`.
  const id =
    channel.id ??
    channel.serviceId ??
    channel.channelId ??
    channel.epgStreamId ??
    channel.epg_stream_id ??
    channel.lcn ??
    '';
  return String(id).trim();
}

/**
 * Clave para deduplicar streams (prioriza id / epgStreamId sobre LCN).
 * @param {object|null} channel
 * @returns {string}
 */
export function getStreamDedupeKey(channel) {
  if (!channel) return '';
  const id = channel.id ?? channel.serviceId ?? channel.channelId;
  if (id != null && String(id).trim() !== '') {
    return 'id:' + String(id).trim();
  }
  const epgId = channel.epgStreamId ?? channel.epg_stream_id ?? channel.epgStreamid;
  if (epgId != null && String(epgId).trim() !== '' && String(epgId) !== '0') {
    return 'epg:' + String(epgId).trim();
  }
  const lcn = channel.lcn;
  if (lcn != null && String(lcn).trim() !== '') {
    return 'lcn:' + String(lcn).trim();
  }
  return '';
}

/**
 * Lista única de canales (p. ej. tras concatenar items de varios bouquets).
 * @param {Array} streams
 * @returns {Array}
 */
export function dedupeStreams(streams) {
  if (!Array.isArray(streams) || streams.length === 0) return [];
  const seen = new Set();
  const out = [];
  for (let i = 0; i < streams.length; i++) {
    const ch = streams[i];
    if (!ch) continue;
    const key = getStreamDedupeKey(ch);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(ch);
  }
  return out;
}

