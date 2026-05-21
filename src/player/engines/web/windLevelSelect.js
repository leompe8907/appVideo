/**
 * Wind master: índice 0 = 360p (substream=3), sin CODECS en el master.
 */

function levelUrl(level) {
  const u = level?.url;
  if (Array.isArray(u)) return String(u[0] || '');
  return String(u || '');
}

function levelBitrate(level) {
  if (level?.bitrate > 0) return level.bitrate;
  const raw = level?.attrs?.BANDWIDTH ?? level?.attributes?.BANDWIDTH;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function levelsByBandwidthAsc(hls) {
  return (hls?.levels || [])
    .map((level, index) => ({ index, bw: levelBitrate(level) }))
    .sort((a, b) => a.bw - b.bw);
}

function isWebCompatibleCodec(level) {
  const vc = level?.videoCodec || '';
  const ac = level?.audioCodec || '';
  if (vc && !vc.startsWith('avc1')) return false;
  if (ac && !ac.startsWith('mp4a')) return false;
  return true;
}

/** Fija una sola calidad (evita cargar 1080/720 y mezclar SourceBuffers). */
export function lockWindLevel(hls, levelIndex) {
  if (levelIndex == null || levelIndex < 0 || !hls) return;
  hls.loadLevel = levelIndex;
  hls.nextLevel = levelIndex;
  hls.autoLevelCapping = levelIndex;
}

/**
 * Elige la variante más baja compatible (H.264 + AAC).
 * @returns {number} índice de nivel elegido
 */
export function pickWindCompatibleLevel(hls) {
  const levels = hls?.levels;
  if (!levels?.length) {
    lockWindLevel(hls, 0);
    return 0;
  }

  let best = levelsByBandwidthAsc(hls)[0]?.index ?? 0;

  for (const { index } of levelsByBandwidthAsc(hls)) {
    if (isWebCompatibleCodec(levels[index])) {
      best = index;
      break;
    }
  }

  lockWindLevel(hls, best);
  return best;
}

export function describeWindLevels(hls) {
  return (hls?.levels || []).map((l, i) => ({
    index: i,
    bitrate: levelBitrate(l),
    videoCodec: l.videoCodec,
    audioCodec: l.audioCodec,
    url: levelUrl(l),
  }));
}

/** Solo antes del primer play: subir calidad si la baja falló. */
export function tryNextWindLevel(hls, lockedLevel) {
  const sorted = levelsByBandwidthAsc(hls);
  if (sorted.length < 2) return false;

  const pos = sorted.findIndex((e) => e.index === lockedLevel);
  if (pos < 0 || pos >= sorted.length - 1) return false;

  const next = sorted[pos + 1].index;
  lockWindLevel(hls, next);
  return true;
}
