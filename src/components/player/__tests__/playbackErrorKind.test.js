import { describe, it, expect } from 'vitest';
import { isNetworkPlaybackError } from '../playbackErrorKind';

const online = () => true;

describe('isNetworkPlaybackError', () => {
  it('sin conexión, cualquier error es de red', () => {
    expect(isNetworkPlaybackError(new Error('Samsung AVPlay error'), () => false)).toBe(true);
  });

  it('reconoce los errores de conexión de AVPlay, hls.js y fetch', () => {
    expect(isNetworkPlaybackError('PLAYER_ERROR_CONNECTION_FAILED', online)).toBe(true);
    expect(isNetworkPlaybackError({ type: 'networkError' }, online)).toBe(true);
    expect(isNetworkPlaybackError(new TypeError('Failed to fetch'), online)).toBe(true);
  });

  it('con conexión, un error de formato no es de red', () => {
    expect(isNetworkPlaybackError('PLAYER_ERROR_NOT_SUPPORTED_FILE', online)).toBe(false);
    expect(isNetworkPlaybackError(null, online)).toBe(false);
  });
});
