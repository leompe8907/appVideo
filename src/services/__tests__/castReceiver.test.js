import { describe, it, expect, vi } from 'vitest';

/**
 * Lógica pura del receptor de transmisiones (ver `castReceiver.js`).
 */

vi.mock('../deviceSessionService', () => ({
  DEVICE_TYPE: { WEB: 'web', LG: 'lg', SAMSUNG: 'samsung' },
  resolveDeviceType: vi.fn(() => 'web'),
  sendDeviceMessage: vi.fn(() => true),
  setCastRegistrationProvider: vi.fn(),
  setOnCastMessage: vi.fn(),
}));

import { applyCastCommand, buildCastState, resolvePlayRequest } from '../castReceiver';

const makePanaccess = (overrides = {}) => ({
  normalizePlaybackUrl: vi.fn((u) => `${u}#norm`),
  getStreamM3u8Url: vi.fn(({ streamId }) => `http://pa/stream/${streamId}`),
  getVodM3u8Url: vi.fn(({ vodId }) => `http://pa/vod/${vodId}`),
  getCatchupM3u8Url: vi.fn(({ catchupId }) => `http://pa/catchup/${catchupId}`),
  ...overrides,
});

describe('resolvePlayRequest', () => {
  it('canal en vivo: busca en el catálogo propio, normaliza la URL y pasa por el gate de canal', () => {
    const stream = { id: 7, name: 'Canal 7', url: 'http://cdn/7.m3u8' };
    const pa = makePanaccess();
    const res = resolvePlayRequest({ kind: 'service', id: 7 }, { streams: [stream], panaccess: pa });

    expect(res.gate).toBe('channel');
    expect(res.channel).toBe(stream);
    expect(res.play).toMatchObject({ type: 'service', id: 7, url: 'http://cdn/7.m3u8#norm', item: stream, autoPlay: true });
  });

  it('canal sin URL en el catálogo: la arma con su propia sesión (epgStreamId primero)', () => {
    const pa = makePanaccess();
    const res = resolvePlayRequest(
      { kind: 'service', id: 7 },
      { streams: [{ id: 7, epgStreamId: 70 }], panaccess: pa },
    );
    expect(pa.getStreamM3u8Url).toHaveBeenCalledWith({ streamId: 70 });
    expect(res.play.url).toBe('http://pa/stream/70#norm');
  });

  it('canal que este dispositivo no tiene -> unsupported_content', () => {
    const res = resolvePlayRequest({ kind: 'service', id: 99 }, { streams: [{ id: 1 }], panaccess: makePanaccess() });
    expect(res).toEqual({ error: 'unsupported_content' });
    expect(resolvePlayRequest({ kind: 'service', id: 1 }, { streams: undefined, panaccess: makePanaccess() })).toEqual({
      error: 'unsupported_content',
    });
  });

  it('vod y catchup: URL propia desde el id, item mínimo y gate de media', () => {
    const pa = makePanaccess();
    const vod = resolvePlayRequest({ kind: 'vod', id: 88, title: 'Peli' }, { streams: [], panaccess: pa });
    expect(vod.gate).toBe('media');
    expect(vod.play).toMatchObject({
      type: 'vod',
      id: 88,
      url: 'http://pa/vod/88#norm',
      item: { id: 88, vodId: 88, name: 'Peli' },
    });

    const cu = resolvePlayRequest({ kind: 'catchup', id: 5 }, { streams: [], panaccess: pa });
    expect(cu.play).toMatchObject({ type: 'catchup', url: 'http://pa/catchup/5#norm', item: { catchupId: 5 } });
  });

  it('un kind desconocido o un fallo armando la URL no rompe: devuelve error', () => {
    expect(resolvePlayRequest({ kind: 'radio', id: 1 }, { streams: [], panaccess: makePanaccess() })).toEqual({
      error: 'unsupported_content',
    });
    const broken = makePanaccess({
      getVodM3u8Url: vi.fn(() => {
        throw new Error('no inicializado');
      }),
    });
    expect(resolvePlayRequest({ kind: 'vod', id: 1 }, { streams: [], panaccess: broken })).toEqual({
      error: 'unsupported_content',
    });
    expect(resolvePlayRequest(null, { streams: [], panaccess: makePanaccess() })).toEqual({ error: 'unsupported_content' });
  });

  it('si normalizar la URL falla, usa la URL sin normalizar en vez de abortar', () => {
    const pa = makePanaccess({
      normalizePlaybackUrl: vi.fn(() => {
        throw new Error('x');
      }),
    });
    const res = resolvePlayRequest({ kind: 'vod', id: 3 }, { streams: [], panaccess: pa });
    expect(res.play.url).toBe('http://pa/vod/3');
  });
});

describe('buildCastState', () => {
  const base = { url: 'http://x', type: 'vod', id: 1, currentTime: 12.3456, duration: 100, volume: 0.5 };

  it('mapea los estados del reproductor al protocolo', () => {
    expect(buildCastState({ ...base, isPlaying: true }).state).toBe('playing');
    expect(buildCastState({ ...base, isPlaying: false }).state).toBe('paused');
    expect(buildCastState({ ...base, isLoading: true }).state).toBe('loading');
    expect(buildCastState({ ...base, error: 'x' }).state).toBe('error');
    expect(buildCastState({ ...base, url: null }).state).toBe('idle');
  });

  it('un VOD que llegó al final está "ended"; un canal en vivo nunca', () => {
    expect(buildCastState({ ...base, currentTime: 100, isPlaying: false }).state).toBe('ended');
    expect(buildCastState({ ...base, type: 'service', currentTime: 100, isPlaying: false }).state).toBe('paused');
  });

  it('posiciones en ms enteros y volumen acotado', () => {
    const s = buildCastState({ ...base, isPlaying: true, volume: 7 });
    expect(s.position_ms).toBe(12346);
    expect(s.duration_ms).toBe(100000);
    expect(s.volume).toBe(1);
    expect(buildCastState({ ...base, currentTime: NaN, duration: undefined }).position_ms).toBe(0);
  });

  it('incluye la identidad del contenido y nunca una URL', () => {
    const s = buildCastState({ ...base, isPlaying: true }, null, { kind: 'vod', id: 1 });
    expect(s.content).toEqual({ kind: 'vod', id: 1 });
    expect(JSON.stringify(s)).not.toContain('http://x');
  });

  it('pistas con id como texto; subtítulo seleccionado solo si están activados', () => {
    const tracks = {
      audio: [{ id: 0, label: 'Español', lang: 'es' }, { id: 1, language: 'en' }, { label: 'sin id' }],
      text: [{ id: 'a', label: 'ES' }],
      selectedAudioId: 1,
      selectedTextId: 'a',
      textEnabled: false,
    };
    const s = buildCastState({ ...base, isPlaying: true }, tracks, null);
    expect(s.tracks.audio).toEqual([
      { id: '0', label: 'Español', lang: 'es' },
      { id: '1', label: 'en', lang: 'en' },
    ]);
    expect(s.tracks.selected_audio).toBe('1');
    expect(s.tracks.selected_text).toBeNull();
    expect(buildCastState({ ...base }, { ...tracks, textEnabled: true }, null).tracks.selected_text).toBe('a');
  });
});

describe('applyCastCommand', () => {
  const makePlayer = (extra = {}) => ({
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    selectAudioTrack: vi.fn(),
    selectTextTrack: vi.fn(),
    setSubtitlesEnabled: vi.fn(),
    state: { url: 'http://x', type: 'vod', id: 3, item: { id: 3 } },
    tracks: { audio: [{ id: 0 }, { id: 1 }], text: [{ id: 't1' }] },
    ...extra,
  });

  it('pause / stop', () => {
    const p = makePlayer();
    expect(applyCastCommand('pause', {}, p)).toBe(true);
    expect(applyCastCommand('stop', {}, p)).toBe(true);
    expect(p.pause).toHaveBeenCalled();
    expect(p.stop).toHaveBeenCalled();
  });

  it('play reanuda el contenido actual; sin contenido no hace nada', () => {
    const p = makePlayer();
    expect(applyCastCommand('play', {}, p)).toBe(true);
    expect(p.play).toHaveBeenCalledWith({ type: 'vod', id: 3, url: 'http://x', item: { id: 3 }, autoPlay: true });
    const empty = makePlayer({ state: {} });
    expect(applyCastCommand('play', {}, empty)).toBe(false);
    expect(empty.play).not.toHaveBeenCalled();
  });

  it('seek convierte ms a segundos y valida el argumento', () => {
    const p = makePlayer();
    expect(applyCastCommand('seek', { position_ms: 90500 }, p)).toBe(true);
    expect(p.seek).toHaveBeenCalledWith(90.5);
    expect(applyCastCommand('seek', {}, p)).toBe(false);
    expect(applyCastCommand('seek', { position_ms: 'x' }, p)).toBe(false);
  });

  it('set_volume', () => {
    const p = makePlayer();
    expect(applyCastCommand('set_volume', { volume: 0.3 }, p)).toBe(true);
    expect(p.setVolume).toHaveBeenCalledWith(0.3);
    expect(applyCastCommand('set_volume', {}, p)).toBe(false);
  });

  it('select_audio traduce el id de texto al id real del motor (que puede ser numérico)', () => {
    const p = makePlayer();
    expect(applyCastCommand('select_audio', { track_id: '1' }, p)).toBe(true);
    expect(p.selectAudioTrack).toHaveBeenCalledWith(1);
    expect(applyCastCommand('select_audio', { track_id: '99' }, p)).toBe(false);
    expect(p.selectAudioTrack).toHaveBeenCalledTimes(1);
  });

  it('select_text: id selecciona; null apaga subtítulos; id inexistente se rechaza', () => {
    const p = makePlayer();
    expect(applyCastCommand('select_text', { track_id: 't1' }, p)).toBe(true);
    expect(p.selectTextTrack).toHaveBeenCalledWith('t1');
    expect(applyCastCommand('select_text', { track_id: null }, p)).toBe(true);
    expect(p.setSubtitlesEnabled).toHaveBeenCalledWith(false);
    expect(applyCastCommand('select_text', { track_id: 'nope' }, p)).toBe(false);
  });

  it('request_state es válido y no toca el reproductor; un comando desconocido se rechaza', () => {
    const p = makePlayer();
    expect(applyCastCommand('request_state', {}, p)).toBe(true);
    expect(applyCastCommand('format_c', {}, p)).toBe(false);
    expect(p.pause).not.toHaveBeenCalled();
    expect(p.stop).not.toHaveBeenCalled();
  });

  it('tolera args ausentes', () => {
    const p = makePlayer();
    expect(applyCastCommand('pause', undefined, p)).toBe(true);
    expect(applyCastCommand('seek', undefined, p)).toBe(false);
  });
});
