import { describe, it, expect, vi } from 'vitest';
import {
  PLAYER_TIME_KEYS,
  createStableActions,
  keepIfShallowEqual,
  omitTimeFields,
  shallowEqual,
} from '../playerContextState.js';

const base = {
  type: 'service',
  id: 7,
  url: 'u',
  item: { id: 7 },
  isPlaying: true,
  currentTime: 10,
  duration: 0,
  liveSecondsLate: 1,
  liveInitialPlayerTime: 5,
  liveInitialServerMs: 123,
};

describe('playerContextState', () => {
  it('omitTimeFields quita solo los campos que cambian con cada timeupdate', () => {
    const rest = omitTimeFields(base);
    for (const k of PLAYER_TIME_KEYS) expect(k in rest).toBe(false);
    expect(rest).toMatchObject({ type: 'service', id: 7, url: 'u', isPlaying: true });
  });

  it('un tick de tiempo no cambia el estado "estable" (misma referencia)', () => {
    const first = keepIfShallowEqual(null, omitTimeFields(base));
    const afterTick = keepIfShallowEqual(first, omitTimeFields({ ...base, currentTime: 10.25, liveSecondsLate: 1.2 }));
    expect(afterTick).toBe(first);
  });

  it('un cambio real (otro canal, pausa) sí produce un estado nuevo', () => {
    const first = keepIfShallowEqual(null, omitTimeFields(base));
    expect(keepIfShallowEqual(first, omitTimeFields({ ...base, id: 8 }))).not.toBe(first);
    expect(keepIfShallowEqual(first, omitTimeFields({ ...base, isPlaying: false }))).not.toBe(first);
  });

  it('shallowEqual distingue claves distintas y valores distintos', () => {
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  });

  it('las acciones estables mantienen su identidad y llaman a la versión más reciente', () => {
    const ref = { current: { play: vi.fn(() => 'v1') } };
    const actions = createStableActions(ref, ['play', 'close']);
    const play = actions.play;

    ref.current = { play: vi.fn(() => 'v2'), close: vi.fn() };
    expect(actions.play).toBe(play);
    expect(play('x')).toBe('v2');
    expect(ref.current.play).toHaveBeenCalledWith('x');
    expect(() => actions.close()).not.toThrow();
  });

  it('una acción que todavía no existe no lanza', () => {
    const actions = createStableActions({ current: null }, ['play']);
    expect(() => actions.play()).not.toThrow();
  });
});
