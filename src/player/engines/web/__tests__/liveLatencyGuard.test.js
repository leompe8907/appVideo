import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveLatencyGuard } from '../liveLatencyGuard.js';
import { DEFAULT_LIVE_BUFFER } from '@appvideo/core/player/liveBufferConfig';

/** hls + video falsos: el test fija la latencia y si el equipo respeta playbackRate. */
function setup({ latency, segS = 6, fragments = 10, honorsRate = true }) {
  const hls = {
    currentLevel: 0,
    levels: [{ details: { live: true, targetduration: segS, fragments: new Array(fragments) } }],
    latency,
    liveSyncPosition: 100,
  };
  let rate = 1;
  const video = {
    paused: false,
    seeking: false,
    readyState: 4,
    currentTime: 50,
    get playbackRate() {
      return rate;
    },
    set playbackRate(v) {
      if (honorsRate) rate = v;
    },
  };
  const guard = new LiveLatencyGuard({ hls, video, liveBuffer: { ...DEFAULT_LIVE_BUFFER } });
  return { hls, video, guard };
}

describe('LiveLatencyGuard', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a distancia normal no toca nada', () => {
    const { video, guard } = setup({ latency: 18 }); // 3 .ts de 6 s
    guard.check();
    expect(video.playbackRate).toBe(1);
    expect(guard.stats.distanceSegs).toBe(3);
  });

  it('muy cerca del vivo: frena y vuelve a 1× al recuperar la distancia', () => {
    const { hls, video, guard } = setup({ latency: 6 }); // 1 .ts
    guard.check();
    expect(video.playbackRate).toBe(DEFAULT_LIVE_BUFFER.liveSlowPlaybackRate);
    expect(guard.stats.slowdowns).toBe(1);
    hls.latency = 18;
    guard.check();
    expect(video.playbackRate).toBe(1);
  });

  it('si el equipo no respeta la velocidad, salta atrás al punto de arranque', () => {
    const { video, guard } = setup({ latency: 6, honorsRate: false });
    guard.check();
    expect(guard.stats.backJumps).toBe(1);
    expect(video.currentTime).toBe(100);
  });

  it('si la velocidad "se acepta" pero el video no se frena, deja de intentar', () => {
    const { video, guard } = setup({ latency: 6 });
    guard.check();
    vi.advanceTimersByTime(11000);
    video.currentTime += 11; // avanzó a velocidad normal
    guard.check();
    expect(guard.rateUnsupported).toBe(true);
    expect(video.playbackRate).toBe(1);
    expect(video.currentTime).toBe(100);
  });

  it('en pausa o VOD no hace nada', () => {
    const { hls, video, guard } = setup({ latency: 6 });
    video.paused = true;
    guard.check();
    expect(video.playbackRate).toBe(1);
    video.paused = false;
    hls.levels[0].details.live = false;
    guard.check();
    expect(video.playbackRate).toBe(1);
  });
});
