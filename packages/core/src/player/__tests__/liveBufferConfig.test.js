import { describe, it, expect } from 'vitest';
import { DEFAULT_LIVE_BUFFER, resolveLiveBuffer } from '../liveBufferConfig.js';

describe('resolveLiveBuffer', () => {
  it('sin flag usa los valores de la web', () => {
    expect(resolveLiveBuffer({})).toEqual(DEFAULT_LIVE_BUFFER);
  });

  it('sin flag y host de Wind usa 20/40 como antes', () => {
    const out = resolveLiveBuffer(null, { windHost: true });
    expect(out.maxBufferLength).toBe(20);
    expect(out.maxMaxBufferLength).toBe(40);
    expect(out.liveSyncDurationCount).toBe(3);
  });

  it('el flag de la marca gana e ignora valores inválidos', () => {
    const out = resolveLiveBuffer(
      { player: { liveBuffer: { liveSyncDurationCount: 4, maxBufferLength: 'x', backBufferLength: 10 } } },
      { windHost: true },
    );
    expect(out.liveSyncDurationCount).toBe(4);
    expect(out.maxBufferLength).toBe(30);
    expect(out.backBufferLength).toBe(10);
  });

  it('corrige combinaciones imposibles', () => {
    const out = resolveLiveBuffer({ player: { liveBuffer: { liveSyncDurationCount: 6, liveMaxLatencyDurationCount: 3, maxBufferLength: 90 } } });
    expect(out.liveMaxLatencyDurationCount).toBe(7);
    expect(out.maxMaxBufferLength).toBe(90);
  });

  it('el mínimo queda por debajo del punto de arranque y el ritmo lento entre 0.5 y 1', () => {
    const out = resolveLiveBuffer({ player: { liveBuffer: { liveSyncDurationCount: 3, liveMinLatencyDurationCount: 5, liveSlowPlaybackRate: 1.2 } } });
    expect(out.liveMinLatencyDurationCount).toBe(2);
    expect(out.liveSlowPlaybackRate).toBe(0.95);
    expect(resolveLiveBuffer({ player: { liveBuffer: { liveSlowPlaybackRate: 0.9 } } }).liveSlowPlaybackRate).toBe(0.9);
  });
});
