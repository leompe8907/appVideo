const KINDS = {stream_id: 'stream', catchup_id: 'catchup', vod_id: 'vod'};

/**
 * Destino de un banner según `genericData` (`stream_id=N`, `catchup_id=N`,
 * `vod_id=N`, como adActivate.js de la web). `actionUrl` no aplica en TV.
 * @returns {{kind: 'stream'|'catchup'|'vod', id: number} | null}
 */
export function parseAdTarget(ad) {
  const generic = ad?.genericData != null ? String(ad.genericData) : '';
  const [key, raw] = generic.split('=');
  const kind = KINDS[key];
  const id = parseInt(raw, 10);
  return kind && !Number.isNaN(id) ? {kind, id} : null;
}
