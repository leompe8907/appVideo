import { describe, it, expect } from 'vitest';
import { computeSlots, computeLiveProgressStyle } from '../epgSlots.js';

function ev(startDate, endDate, title) {
  return { startDate, endDate, title };
}

describe('computeSlots', () => {
  const t0 = Date.parse('2026-07-22T10:00:00Z');
  const hour = 3600_000;

  it('sin eventos devuelve todo null / isLive false', () => {
    expect(computeSlots([], { nowMs: t0 })).toEqual({
      before: null,
      now: null,
      next: null,
      later: null,
      isLive: false,
    });
  });

  it('identifica el evento en vivo y sus vecinos (antes/siguiente/más tarde)', () => {
    const items = [
      ev(t0 - hour, t0, 'antes'),
      ev(t0, t0 + hour, 'ahora'),
      ev(t0 + hour, t0 + 2 * hour, 'siguiente'),
      ev(t0 + 2 * hour, t0 + 3 * hour, 'mas tarde'),
    ];

    const slots = computeSlots(items, { nowMs: t0 + hour / 2, epgPastEnabled: true });

    expect(slots.now.title).toBe('ahora');
    expect(slots.before.title).toBe('antes');
    expect(slots.next.title).toBe('siguiente');
    expect(slots.later.title).toBe('mas tarde');
    expect(slots.isLive).toBe(true);
  });

  it('epgPastEnabled=false nunca devuelve "before" aunque exista', () => {
    const items = [ev(t0 - hour, t0, 'antes'), ev(t0, t0 + hour, 'ahora')];
    const slots = computeSlots(items, { nowMs: t0 + 1, epgPastEnabled: false });
    expect(slots.before).toBeNull();
  });

  it('sin evento live usa el primer evento futuro como "now" (isLive=false)', () => {
    const items = [ev(t0 + hour, t0 + 2 * hour, 'futuro')];
    const slots = computeSlots(items, { nowMs: t0 });
    expect(slots.now.title).toBe('futuro');
    expect(slots.isLive).toBe(false);
  });
});

describe('computeLiveProgressStyle', () => {
  it('devuelve null si falta start/end o la duración no es positiva', () => {
    expect(computeLiveProgressStyle(null, 1000)).toBeNull();
    expect(computeLiveProgressStyle(1000, null)).toBeNull();
    expect(computeLiveProgressStyle(2000, 1000)).toBeNull();
  });

  it('calcula % transcurrido y ms restantes a mitad de evento', () => {
    const start = 1_000_000;
    const end = start + 10_000;
    const now = start + 4_000;
    const result = computeLiveProgressStyle(start, end, now);
    expect(result.elapsedPercent).toBeCloseTo(40, 5);
    expect(result.remainingMs).toBe(6_000);
  });

  it('recorta (clamp) tiempos fuera de rango a 0% / 100%', () => {
    const start = 1_000_000;
    const end = start + 10_000;
    expect(computeLiveProgressStyle(start, end, start - 5_000).elapsedPercent).toBe(0);
    expect(computeLiveProgressStyle(start, end, end + 5_000).elapsedPercent).toBe(100);
  });
});
