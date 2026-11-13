import { describe, it, expect } from 'vitest';
import {isNetworkPlaybackError} from '../playbackErrors';

describe('isNetworkPlaybackError', () => {
  it('reconoce errores de red de Shaka y del <video>', () => {
    expect(isNetworkPlaybackError({source: 'shaka', code: 1002, category: 1})).toBe(true);
    expect(isNetworkPlaybackError({source: 'video', code: 2})).toBe(true);
    expect(isNetworkPlaybackError(new Error('Network request failed'))).toBe(true);
  });

  it('no confunde otros errores con la red', () => {
    expect(isNetworkPlaybackError({source: 'shaka', code: 4000, category: 4})).toBe(false);
    expect(isNetworkPlaybackError({source: 'video', code: 3})).toBe(false);
    expect(isNetworkPlaybackError(undefined)).toBe(false);
  });
});
