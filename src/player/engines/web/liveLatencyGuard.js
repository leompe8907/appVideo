/**
 * Distancia al vivo con hls.js (web / LG / Samsung con WebEngine): corrige el
 * caso "demasiado pegado al borde", que hls.js no cubre.
 *
 * hls.js ya resuelve "demasiado atrás" (`liveMaxLatencyDurationCount` vuelve
 * al punto de arranque) y puede ACELERAR para acercarse (`maxLiveSyncPlaybackRate`),
 * pero nunca frena. Cuando el stream del operador tiene huecos (MultiplusTV:
 * segmentos publicados de a dos cada ~22 s, huecos de ~67 ms), cada salto
 * sobre un hueco acerca la reproducción al borde hasta quedarse sin buffer.
 *
 * Mismas reglas que Fire TV (apps/vega/src/player/VegaHlsPlayer.js →
 * checkLiveLatency) y mismo flag de marca `player.liveBuffer`
 * (@appvideo/core/player/liveBufferConfig):
 * - Más cerca que `liveMinLatencyDurationCount` segmentos → reproduce a
 *   `liveSlowPlaybackRate` hasta volver a `liveSyncDurationCount`.
 * - Si el equipo no respeta la velocidad (se mide a los 10 s), salta atrás al
 *   punto de arranque (`hls.liveSyncPosition`) y no vuelve a intentar frenar.
 * - Con pocos segmentos en el manifiesto el mínimo baja (nunca más de
 *   segmentos − 2) para no pelear contra una ventana corta.
 */
const CHECK_INTERVAL_MS = 5000;
const RATE_PROBE_S = 10;

export class LiveLatencyGuard {
  /**
   * @param {{ hls: object, video: HTMLVideoElement, liveBuffer: object, log?: Function }} opts
   */
  constructor({ hls, video, liveBuffer, log }) {
    this.hls = hls;
    this.video = video;
    this.cfg = liveBuffer;
    this.log = log || (() => {});
    this.slow = null; // { fromCurrent, fromWall } mientras se frena
    this.rateUnsupported = false;
    this.stats = { rate: 1, distanceSegs: null, targetSegs: null, slowdowns: 0, backJumps: 0 };
    this.timer = null;
  }

  start() {
    if (this.timer != null) return;
    this.timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
  }

  stop() {
    if (this.timer != null) clearInterval(this.timer);
    this.timer = null;
    if (this.slow) this._setRate(1);
    this.slow = null;
  }

  _details() {
    const hls = this.hls;
    const level = hls?.levels?.[hls.currentLevel >= 0 ? hls.currentLevel : hls.loadLevel];
    return level?.details || hls?.latestLevelDetails || null;
  }

  _setRate(rate) {
    try {
      this.video.playbackRate = rate;
      this.stats.rate = rate;
      return Math.abs(Number(this.video.playbackRate) - rate) < 0.001;
    } catch {
      return false;
    }
  }

  _backToSync(why, dist, sync) {
    const target = this.hls?.liveSyncPosition;
    if (!Number.isFinite(target)) return;
    this.log(`${why} (a ${dist.toFixed(1)} .ts del vivo), vuelve a ${sync}`);
    this.stats.backJumps += 1;
    try {
      this.video.currentTime = target;
    } catch {
      /* noop */
    }
  }

  check() {
    const v = this.video;
    const details = this._details();
    if (!v || !details?.live || v.paused || v.seeking || v.readyState < 3) return;
    const segS = Number(details.targetduration) || 0;
    const latency = Number(this.hls?.latency);
    if (!segS || !Number.isFinite(latency)) return;

    const cfg = this.cfg;
    const sync = cfg.liveSyncDurationCount;
    const segments = details.fragments?.length;
    const min = Math.max(
      0.5,
      Math.min(cfg.liveMinLatencyDurationCount, sync - 1, Number.isFinite(segments) ? segments - 2 : Infinity),
    );
    const dist = latency / segS;
    const now = Number(v.currentTime) || 0;
    this.stats.distanceSegs = dist;
    this.stats.targetSegs = sync;

    if (this.slow) {
      if (dist >= sync) {
        this._setRate(1);
        this.slow = null;
        return;
      }
      const wall = (Date.now() - this.slow.fromWall) / 1000;
      if (wall >= RATE_PROBE_S) {
        if (now - this.slow.fromCurrent > wall * 0.99) {
          // El video avanzó a velocidad normal: el equipo ignora playbackRate.
          this.rateUnsupported = true;
          this._setRate(1);
          this.slow = null;
          this._backToSync('el equipo no cambia la velocidad', dist, sync);
        } else {
          this.slow = { fromCurrent: now, fromWall: Date.now() };
        }
      }
      return;
    }

    if (dist < min) {
      this.stats.slowdowns += 1;
      if (!this.rateUnsupported && this._setRate(cfg.liveSlowPlaybackRate)) {
        this.slow = { fromCurrent: now, fromWall: Date.now() };
        this.log(`muy cerca del vivo (a ${dist.toFixed(1)} .ts), frena a ${cfg.liveSlowPlaybackRate}×`);
      } else {
        this._backToSync('muy cerca del vivo', dist, sync);
      }
    }
  }
}
