import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SamsungEngine } from '../SamsungEngine.js';
import { PLAYER_ENGINE_EVENTS } from '../../contracts';

/**
 * Audio/subtítulos vía AVPlay (Tizen). A diferencia de WebEngine (video.js)
 * o de LG (native <video>, mismo elemento que ya lee WebEngine.getTracks()),
 * AVPlay es un pipeline completamente separado -- sin estos overrides,
 * SamsungEngine heredaba getTracks()/selectAudioTrack()/etc. de WebEngine,
 * que siempre devolvían vacío porque el <video> de video.js nunca reproduce
 * nada en modo nativo (ver comentario largo en SamsungEngine.js). Estos
 * tests fijan el comportamiento de los nuevos native*: parseo de
 * getTotalTrackInfo(), selección vía setSelectTrack(), y el manejo de
 * subtítulos (setSilentSubtitle + el cue manual de onsubtitlechange, que
 * AVPlay no dibuja solo).
 */
function trackInfo(type, index, extra) {
  return { type, index, extra_info: JSON.stringify(extra || {}) };
}

function makeEngineWithFakeAvplay(totalTrackInfo) {
  const engine = new SamsungEngine();
  const api = {
    getTotalTrackInfo: vi.fn(() => totalTrackInfo),
    setSelectTrack: vi.fn(),
    setSilentSubtitle: vi.fn(),
  };
  engine.nativeAdapter = { type: 'tizen-avplay', api };
  engine.isNativeActive = true;
  engine.capabilities = engine.detectCapabilities(api);
  return { engine, api };
}

describe('SamsungEngine - nativeGetTracks (parseo de getTotalTrackInfo)', () => {
  it('separa audio/texto, arma label desde extra_info.language, y usa el primer audio como seleccionado por defecto', () => {
    const { engine } = makeEngineWithFakeAvplay([
      trackInfo('VIDEO', 0, {}),
      trackInfo('AUDIO', 1, { language: 'spa' }),
      trackInfo('AUDIO', 2, { language: 'eng' }),
      trackInfo('TEXT', 3, { language: 'por' }),
    ]);

    const snap = engine.nativeGetTracks();

    expect(snap.audio).toEqual([
      { id: '1', label: 'SPA', lang: 'spa', index: 1 },
      { id: '2', label: 'ENG', lang: 'eng', index: 2 },
    ]);
    expect(snap.text).toEqual([{ id: '3', label: 'POR', lang: 'por', index: 3 }]);
    expect(snap.selectedAudioId).toBe('1');
    expect(snap.selectedTextId).toBeNull();
    expect(snap.textEnabled).toBe(false);
  });

  it('usa un label genérico "Audio N"/"Sub N" cuando no hay idioma en extra_info', () => {
    const { engine } = makeEngineWithFakeAvplay([
      trackInfo('AUDIO', 0, {}),
      trackInfo('TEXT', 1, {}),
    ]);

    const snap = engine.nativeGetTracks();
    expect(snap.audio[0].label).toBe('Audio 1');
    expect(snap.text[0].label).toBe('Sub 1');
  });

  it('devuelve null si la capability getTotalTrackInfo no existe (deja que BaseTvEngine caiga al fallback de WebEngine)', () => {
    const engine = new SamsungEngine();
    engine.nativeAdapter = { type: 'tizen-avplay', api: {} };
    engine.isNativeActive = true;
    engine.capabilities = engine.detectCapabilities({});
    expect(engine.nativeGetTracks()).toBeNull();
  });
});

describe('SamsungEngine - selección de audio/texto', () => {
  it('nativeSelectAudioTrack llama setSelectTrack(AUDIO, index), recuerda la selección y emite TRACKS_CHANGE', () => {
    const { engine, api } = makeEngineWithFakeAvplay([
      trackInfo('AUDIO', 5, { language: 'eng' }),
      trackInfo('AUDIO', 6, { language: 'spa' }),
    ]);
    const onTracksChange = vi.fn();
    engine.on(PLAYER_ENGINE_EVENTS.TRACKS_CHANGE, onTracksChange);

    const handled = engine.nativeSelectAudioTrack('6');

    expect(handled).toBe(true);
    expect(api.setSelectTrack).toHaveBeenCalledWith('AUDIO', 6);
    expect(onTracksChange).toHaveBeenCalledTimes(1);
    expect(onTracksChange.mock.calls[0][0].selectedAudioId).toBe('6');
  });

  it('nativeSelectTextTrack llama setSelectTrack(TEXT, index)', () => {
    const { engine, api } = makeEngineWithFakeAvplay([trackInfo('TEXT', 9, { language: 'por' })]);

    expect(engine.nativeSelectTextTrack('9')).toBe(true);
    expect(api.setSelectTrack).toHaveBeenCalledWith('TEXT', 9);
  });

  it('devuelve false ante un id no numérico, sin llamar a setSelectTrack', () => {
    const { engine, api } = makeEngineWithFakeAvplay([]);
    expect(engine.nativeSelectAudioTrack('no-es-un-numero')).toBe(false);
    expect(api.setSelectTrack).not.toHaveBeenCalled();
  });
});

describe('SamsungEngine - nativeSetSubtitlesEnabled', () => {
  it('activar sin selección previa elige el primer track de texto y llama setSilentSubtitle(false)', () => {
    const { engine, api } = makeEngineWithFakeAvplay([trackInfo('TEXT', 4, { language: 'spa' })]);

    const handled = engine.nativeSetSubtitlesEnabled(true);

    expect(handled).toBe(true);
    expect(api.setSelectTrack).toHaveBeenCalledWith('TEXT', 4);
    expect(api.setSilentSubtitle).toHaveBeenCalledWith(false);
    expect(engine.nativeGetTracks().textEnabled).toBe(true);
  });

  it('activar sin ningún track de texto disponible no llama a setSilentSubtitle y devuelve false', () => {
    const { engine, api } = makeEngineWithFakeAvplay([trackInfo('AUDIO', 0, {})]);
    expect(engine.nativeSetSubtitlesEnabled(true)).toBe(false);
    expect(api.setSilentSubtitle).not.toHaveBeenCalled();
  });

  it('desactivar llama setSilentSubtitle(true) y limpia el cue en pantalla', () => {
    const { engine, api } = makeEngineWithFakeAvplay([trackInfo('TEXT', 4, {})]);
    engine.nativeSetSubtitlesEnabled(true);

    const onCue = vi.fn();
    engine.on(PLAYER_ENGINE_EVENTS.SUBTITLE_CUE, onCue);
    const handled = engine.nativeSetSubtitlesEnabled(false);

    expect(handled).toBe(true);
    expect(api.setSilentSubtitle).toHaveBeenLastCalledWith(true);
    expect(onCue).toHaveBeenCalledWith({ text: '' });
  });
});

describe('SamsungEngine - cue de subtítulo (onsubtitlechange)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emite el texto y lo limpia solo después de `duration` ms', () => {
    const engine = new SamsungEngine();
    const onCue = vi.fn();
    engine.on(PLAYER_ENGINE_EVENTS.SUBTITLE_CUE, onCue);

    engine._emitSubtitleCue(2000, 'Hola mundo');
    expect(onCue).toHaveBeenNthCalledWith(1, { text: 'Hola mundo' });

    vi.advanceTimersByTime(1999);
    expect(onCue).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(onCue).toHaveBeenNthCalledWith(2, { text: '' });
  });

  it('acota una duration absurda al tope defensivo en vez de dejar el texto pegado', () => {
    const engine = new SamsungEngine();
    const onCue = vi.fn();
    engine.on(PLAYER_ENGINE_EVENTS.SUBTITLE_CUE, onCue);

    engine._emitSubtitleCue(999999, 'texto largo');
    vi.advanceTimersByTime(15000);
    expect(onCue).toHaveBeenNthCalledWith(2, { text: '' });
  });

  it('un cue nuevo cancela el timer de auto-clear del anterior', () => {
    const engine = new SamsungEngine();
    const onCue = vi.fn();
    engine.on(PLAYER_ENGINE_EVENTS.SUBTITLE_CUE, onCue);

    engine._emitSubtitleCue(5000, 'primero');
    engine._emitSubtitleCue(5000, 'segundo');
    vi.advanceTimersByTime(5000);

    // Solo dos calls con texto ('primero', 'segundo') + un clear -- nunca un
    // clear extra del timer del primer cue, que debía haberse cancelado.
    expect(onCue.mock.calls).toEqual([
      [{ text: 'primero' }],
      [{ text: 'segundo' }],
      [{ text: '' }],
    ]);
  });
});

describe('BaseTvEngine - delegación de tracks a través de SamsungEngine', () => {
  it('getTracks() usa nativeGetTracks() cuando el nativo está activo y tiene datos', () => {
    const { engine } = makeEngineWithFakeAvplay([trackInfo('AUDIO', 0, { language: 'eng' })]);
    const snap = engine.getTracks();
    expect(snap.audio).toHaveLength(1);
  });

  it('getTracks() cae al fallback de WebEngine (vacío) si el nativo no puede listar tracks', () => {
    const engine = new SamsungEngine();
    engine.nativeAdapter = { type: 'tizen-avplay', api: {} };
    engine.isNativeActive = true;
    engine.capabilities = engine.detectCapabilities({});
    // Sin player.audioTracks/textTracks inicializado (no se llamó a init()),
    // el fallback de WebEngine debe devolver listas vacías, nunca tirar.
    expect(() => engine.getTracks()).not.toThrow();
    const snap = engine.getTracks();
    expect(snap.audio).toEqual([]);
    expect(snap.text).toEqual([]);
  });
});
