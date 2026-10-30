/**
 * Fusiona epgItems del preload en la lista de canales recibida (por id / epgStreamId).
 * Mantener puro (sin dependencias React) para usarlo en store/query/workers.
 */
export function mergeEpgIntoChannels(channels, streamsWithEpg) {
  if (!Array.isArray(channels) || !Array.isArray(streamsWithEpg) || streamsWithEpg.length === 0) {
    return channels;
  }
  const byId = new Map();
  const byEpgId = new Map();
  streamsWithEpg.forEach((s) => {
    if (s?.id != null) byId.set(String(s.id), s);
    if (s?.epgStreamId != null) byEpgId.set(String(s.epgStreamId), s);
  });
  return channels.map((ch) => {
    const id = ch?.id != null ? String(ch.id) : null;
    const epgId = ch?.epgStreamId != null ? String(ch.epgStreamId) : null;
    const fromPreload = (id && byId.get(id)) || (epgId && byEpgId.get(epgId));
    if (!fromPreload || !Array.isArray(fromPreload.epgItems)) return ch;
    return { ...ch, epgItems: fromPreload.epgItems };
  });
}

export default mergeEpgIntoChannels;

