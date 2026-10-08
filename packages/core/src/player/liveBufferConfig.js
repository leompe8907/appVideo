/**
 * Buffer de reproducción en vivo (flag de marca `player.liveBuffer`).
 *
 * Mismos nombres y valores que la configuración de hls.js de la web
 * (`src/player/engines/web/hlsPlaybackConfig.js`), que sigue siendo el
 * comportamiento por defecto. La web los aplica tal cual a hls.js y el Fire
 * TV los traduce a Shaka (apps/vega/src/player/VegaHlsPlayer.js).
 *
 * - liveSyncDurationCount: cuántos segmentos detrás del borde en vivo arranca.
 * - liveMaxLatencyDurationCount: si se atrasa más que esto, vuelve al punto anterior.
 * - liveMinLatencyDurationCount: si queda más cerca del borde que esto (p. ej.
 *   por los saltos sobre huecos del stream), reproduce un poco más lento
 *   (liveSlowPlaybackRate) hasta recuperar liveSyncDurationCount. Sólo Fire TV:
 *   hls.js en la web no tiene equivalente y lo ignora.
 * - maxBufferLength / maxMaxBufferLength: segundos de video a descargar por delante.
 * - backBufferLength: segundos ya vistos que se guardan.
 */
export const DEFAULT_LIVE_BUFFER = Object.freeze({
  liveSyncDurationCount: 3,
  liveMaxLatencyDurationCount: 6,
  liveMinLatencyDurationCount: 2,
  liveSlowPlaybackRate: 0.95,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  backBufferLength: 30,
});

/** Lo que la web usaba para el middleware de Wind antes de existir el flag. */
export const WIND_HOST_LIVE_BUFFER = Object.freeze({
  maxBufferLength: 20,
  maxMaxBufferLength: 40,
});

const positive = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined);

/**
 * Valores efectivos: los de la marca (`brand.player.liveBuffer`) sobre los
 * por defecto. Si la marca no los define y el stream es del middleware de
 * Wind, se usa WIND_HOST_LIVE_BUFFER (como hacía la web).
 */
export function resolveLiveBuffer(brand, { windHost = false } = {}) {
  const fromBrand = brand?.player?.liveBuffer;
  const base = { ...DEFAULT_LIVE_BUFFER, ...(fromBrand ? {} : windHost ? WIND_HOST_LIVE_BUFFER : {}) };
  if (!fromBrand || typeof fromBrand !== 'object') return base;
  const out = { ...base };
  for (const key of Object.keys(DEFAULT_LIVE_BUFFER)) {
    const v = positive(fromBrand[key]);
    if (v !== undefined) out[key] = v;
  }
  if (out.liveSlowPlaybackRate >= 1 || out.liveSlowPlaybackRate < 0.5) {
    out.liveSlowPlaybackRate = DEFAULT_LIVE_BUFFER.liveSlowPlaybackRate;
  }
  if (out.liveMinLatencyDurationCount >= out.liveSyncDurationCount) {
    out.liveMinLatencyDurationCount = Math.max(1, out.liveSyncDurationCount - 1);
  }
  if (out.liveMaxLatencyDurationCount <= out.liveSyncDurationCount) {
    out.liveMaxLatencyDurationCount = out.liveSyncDurationCount + 1;
  }
  if (out.maxMaxBufferLength < out.maxBufferLength) out.maxMaxBufferLength = out.maxBufferLength;
  return out;
}
