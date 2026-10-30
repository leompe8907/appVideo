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

/** Igual que `levelsByBandwidthAsc` pero solo con variantes web-compatibles (H.264+AAC). */
function compatibleLevelsByBandwidthAsc(hls) {
  const levels = hls?.levels || [];
  return levelsByBandwidthAsc(hls).filter(({ index }) => isWebCompatibleCodec(levels[index]));
}

/** Ancho de banda necesario, como múltiplo del bitrate del siguiente nivel, antes de subir un escalón. */
const ADAPTIVE_UP_FACTOR = 1.8;

/**
 * Sube o baja UN escalón de calidad (nunca salta directo al mejor nivel)
 * dentro del subconjunto de variantes web-compatibles, según el ancho de
 * banda estimado por hls.js (`hls.bandwidthEstimate`).
 *
 * Reemplaza al lock fijo de un solo nivel para toda la sesión: `lockWindLevel`
 * seguía usándose para fijar el punto de partida (la variante más liviana
 * compatible, ver `pickWindCompatibleLevel`) y para el fallback ante error de
 * codec, pero una vez reproduciendo, la calidad nunca subía aunque el ancho de
 * banda lo permitiera. El riesgo original (mezclar SourceBuffers de codecs
 * distintos -- 1080p/720p con codecs incompatibles rompía varios WebKit
 * viejos de Smart TV) sigue evitado acá porque este stepper SOLO se mueve
 * entre variantes de `compatibleLevelsByBandwidthAsc` (mismo codec H.264+AAC
 * en toda la escalera) -- jamás hacia una variante de codec distinto.
 *
 * Histéresis asimétrica a propósito: bajar de nivel es barato (evita
 * rebuffering) así que basta con que el ancho de banda ya no alcance para el
 * nivel actual; subir de nivel es caro en hardware de TV débil (decodificar
 * más bitrate/resolución) así que exige mucho más margen sostenido
 * (`ADAPTIVE_UP_FACTOR`) antes de arriesgarse -- sin esto, una conexión que
 * fluctúa justo en el punto medio entre dos niveles oscilaría sin parar.
 *
 * @returns {number} índice de nivel a usar (igual al actual si no cambia)
 */
export function pickAdaptiveWindLevel(hls, currentIndex, bandwidthBps) {
  const compatible = compatibleLevelsByBandwidthAsc(hls);
  if (compatible.length < 2 || !Number.isFinite(bandwidthBps) || bandwidthBps <= 0) {
    return currentIndex;
  }

  const pos = compatible.findIndex((e) => e.index === currentIndex);
  if (pos < 0) return currentIndex;

  const current = compatible[pos];
  const next = compatible[pos + 1];
  const prev = compatible[pos - 1];

  if (next && bandwidthBps >= next.bw * ADAPTIVE_UP_FACTOR) {
    return next.index;
  }
  if (prev && current.bw > 0 && bandwidthBps < current.bw) {
    return prev.index;
  }
  return currentIndex;
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
