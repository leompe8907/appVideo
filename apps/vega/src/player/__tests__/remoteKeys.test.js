import { describe, it, expect } from 'vitest';
import { channelStepOfTvEvent, digitOfTvEvent } from '../remoteKeys';

describe('digitOfTvEvent', () => {
  it('num_0…num_9 dan el dígito', () => {
    expect(digitOfTvEvent('num_0')).toBe(0);
    expect(digitOfTvEvent('num_7')).toBe(7);
  });

  it('otras teclas no son dígitos', () => {
    expect(digitOfTvEvent('num_11')).toBeNull();
    expect(digitOfTvEvent('up')).toBeNull();
    expect(digitOfTvEvent(undefined)).toBeNull();
  });
});

describe('channelStepOfTvEvent', () => {
  it('CH+ y CH− con los nombres del SDK y los de RN', () => {
    expect(channelStepOfTvEvent('channel_up')).toBe(1);
    expect(channelStepOfTvEvent('channelUp')).toBe(1);
    expect(channelStepOfTvEvent('channel_down')).toBe(-1);
    expect(channelStepOfTvEvent('channelDown')).toBe(-1);
  });

  it('otra tecla no cambia de canal', () => {
    expect(channelStepOfTvEvent('up')).toBe(0);
  });
});
