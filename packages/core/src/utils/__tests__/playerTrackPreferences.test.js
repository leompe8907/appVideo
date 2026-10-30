import { describe, it, expect, beforeEach } from 'vitest';
import {
  applySavedTrackPreferences,
  findTrackByPreference,
  getPlaybackChannelKey,
  persistAudioPreference,
  persistSubtitlePreference,
} from '../playerTrackPreferences';

const BRAND = 'testbrand';
const channel = (epgStreamId) => ({ type: 'service', id: 5, item: { epgStreamId } });

function fakeEngine() {
  const calls = [];
  return {
    calls,
    selectAudioTrack: (id) => calls.push(['audio', id]) > 0,
    setSubtitlesEnabled: (on) => calls.push(['subs', on]) > 0,
    selectTextTrack: (id) => calls.push(['text', id]) > 0,
  };
}

describe('playerTrackPreferences', () => {
  beforeEach(() => localStorage.clear());

  it('la clave del canal es el epgStreamId (o el id si no hay); fuera del vivo, null', () => {
    expect(getPlaybackChannelKey(channel(77))).toBe(77);
    expect(getPlaybackChannelKey({ type: 'service', id: 5, item: {} })).toBe(5);
    expect(getPlaybackChannelKey({ type: 'vod', id: 5 })).toBeNull();
  });

  it('busca la pista por label, luego id y luego idioma', () => {
    const tracks = [{ id: 'a1', label: 'Español', lang: 'spa' }, { id: 'a2', label: 'English', lang: 'eng' }];
    expect(findTrackByPreference(tracks, 'English')?.id).toBe('a2');
    expect(findTrackByPreference(tracks, 'a1')?.id).toBe('a1');
    expect(findTrackByPreference(tracks, 'eng')?.id).toBe('a2');
    expect(findTrackByPreference(tracks, 'nada')).toBeNull();
  });

  it('recuerda audio y subtítulos por canal y los vuelve a aplicar', () => {
    const playback = channel(77);
    const audio = [{ id: 'a1', label: 'Español' }, { id: 'a2', label: 'English' }];
    const text = [{ id: 't1', label: 'Español CC' }];
    persistAudioPreference(BRAND, playback, audio[1]);
    persistSubtitlePreference(BRAND, playback, { enabled: true, track: text[0] });

    const engine = fakeEngine();
    const applied = applySavedTrackPreferences(engine, BRAND, playback, {
      audio,
      text,
      selectedAudioId: 'a1',
      selectedTextId: null,
      textEnabled: false,
    });

    expect(applied).toBe(true);
    expect(engine.calls).toEqual([['audio', 'a2'], ['subs', true], ['text', 't1']]);
  });

  it('otro canal no hereda la elección', () => {
    persistAudioPreference(BRAND, channel(77), { id: 'a2', label: 'English' });
    const engine = fakeEngine();
    applySavedTrackPreferences(engine, BRAND, channel(88), {
      audio: [{ id: 'a1', label: 'Español', lang: 'xx' }, { id: 'a2', label: 'English', lang: 'yy' }],
      text: [],
      selectedAudioId: 'a1',
    });
    expect(engine.calls).toEqual([]);
  });
});
