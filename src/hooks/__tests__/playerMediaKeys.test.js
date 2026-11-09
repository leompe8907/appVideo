import { describe, it, expect } from 'vitest';
import { resolvePlayerMediaKey } from '../usePlayerHudTvNavigation';
import { TV_ACTION } from '../../utils/tvRemote';

const withButtons = { showPlaybackButtons: true, isPlaying: true };
const liveWithoutButtons = { showPlaybackButtons: false, isPlaying: true };

describe('resolvePlayerMediaKey', () => {
  it('Play/Pausa alterna si el HUD muestra los botones de reproducción', () => {
    expect(resolvePlayerMediaKey(TV_ACTION.PLAY_PAUSE, withButtons)).toEqual({ type: 'togglePlay' });
  });

  it('Pausa sólo pausa si está reproduciendo y Play sólo reanuda si está pausado', () => {
    expect(resolvePlayerMediaKey(TV_ACTION.PAUSE, withButtons)).toEqual({ type: 'togglePlay' });
    expect(resolvePlayerMediaKey(TV_ACTION.PLAY, withButtons)).toEqual({ type: 'none' });

    const paused = { showPlaybackButtons: true, isPlaying: false };
    expect(resolvePlayerMediaKey(TV_ACTION.PLAY, paused)).toEqual({ type: 'togglePlay' });
    expect(resolvePlayerMediaKey(TV_ACTION.PAUSE, paused)).toEqual({ type: 'none' });
  });

  it('adelantar y retroceder mueven ±10 s', () => {
    expect(resolvePlayerMediaKey(TV_ACTION.FAST_FORWARD, withButtons)).toEqual({ type: 'seek', seconds: 10 });
    expect(resolvePlayerMediaKey(TV_ACTION.REWIND, withButtons)).toEqual({ type: 'seek', seconds: -10 });
  });

  it('sin botones de reproducción (vivo con showPlaybackButtonsOnLive=false) no hace nada', () => {
    expect(resolvePlayerMediaKey(TV_ACTION.PLAY_PAUSE, liveWithoutButtons)).toEqual({ type: 'none' });
    expect(resolvePlayerMediaKey(TV_ACTION.PAUSE, liveWithoutButtons)).toEqual({ type: 'none' });
    expect(resolvePlayerMediaKey(TV_ACTION.FAST_FORWARD, liveWithoutButtons)).toEqual({ type: 'none' });
    expect(resolvePlayerMediaKey(TV_ACTION.REWIND, liveWithoutButtons)).toEqual({ type: 'none' });
  });

  it('Stop cierra el reproductor siempre, como Atrás', () => {
    expect(resolvePlayerMediaKey(TV_ACTION.STOP, withButtons)).toEqual({ type: 'close' });
    expect(resolvePlayerMediaKey(TV_ACTION.STOP, liveWithoutButtons)).toEqual({ type: 'close' });
  });

  it('acciones que no son de media devuelven null', () => {
    expect(resolvePlayerMediaKey(TV_ACTION.ENTER, withButtons)).toBeNull();
    expect(resolvePlayerMediaKey(TV_ACTION.CHANNEL_UP, withButtons)).toBeNull();
  });
});
