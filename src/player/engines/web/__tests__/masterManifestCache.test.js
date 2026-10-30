import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  clearMasterCache,
  isMasterPlaylist,
  evictMaster,
  getCachedMaster,
  masterKey,
  prefetchMaster,
  storeMaster,
} from '../masterManifestCache.js';

const MASTER = 'https://mw.example.com/index.php?requestMode=m3u8&streamId=5&sessionId=abc';
const BODY = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nindex.php?requestMode=m3u8&substream=1&file=list1.m3u8\n';

describe('masterManifestCache', () => {
  beforeEach(() => clearMasterCache());
  afterEach(() => vi.restoreAllMocks());

  it('solo cachea el master de un canal (requestMode=m3u8 sin substream ni file)', () => {
    expect(masterKey(MASTER)).toBeTruthy();
    expect(masterKey(`${MASTER}&substream=1&file=list1.m3u8`)).toBeNull();
    expect(masterKey('https://mw.example.com/index.php?requestMode=function&f=getStreamM3u8&streamId=5')).toBeNull();
    expect(masterKey('https://mw.example.com/index.php?requestMode=mekey&streamId=5&chunk=1')).toBeNull();
    expect(masterKey('no es una url')).toBeNull();
  });

  it('la clave no depende de la sesión: otra sesión del mismo canal usa el mismo master', () => {
    expect(masterKey(MASTER)).toBe(masterKey(MASTER.replace('sessionId=abc', 'sessionId=xyz')));
    expect(masterKey(MASTER)).not.toBe(masterKey(MASTER.replace('streamId=5', 'streamId=6')));
  });

  it('devuelve lo guardado y lo descarta pasado el TTL', () => {
    storeMaster(MASTER, BODY, 1000);
    expect(getCachedMaster(MASTER, 1000 + 60_000)).toBe(BODY);
    expect(getCachedMaster(MASTER, 1000 + 121_000)).toBeNull();
    // Vencida: se borra, no queda ocupando memoria.
    expect(getCachedMaster(MASTER, 1000 + 1)).toBeNull();
  });

  it('solo guarda masters: ni una playlist de media (ventana en vivo) ni una respuesta de error', () => {
    const media = '#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\nseg1.ts\n';
    expect(isMasterPlaylist(BODY)).toBe(true);
    expect(isMasterPlaylist(media)).toBe(false);
    expect(isMasterPlaylist('{"error":"stream not allowed"}')).toBe(false);
    expect(isMasterPlaylist('')).toBe(false);
    expect(isMasterPlaylist(new ArrayBuffer(8))).toBe(false);

    storeMaster(MASTER, media);
    storeMaster(MASTER, '<html>login</html>');
    expect(getCachedMaster(MASTER)).toBeNull();
  });

  it('evictMaster borra la entrada del canal', () => {
    storeMaster(MASTER, BODY);
    evictMaster(MASTER);
    expect(getCachedMaster(MASTER)).toBeNull();
  });

  it('prefetchMaster descarga con la sesión actual y guarda el texto', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(BODY) });
    vi.stubGlobal('fetch', fetchMock);

    await prefetchMaster(MASTER, 'SESSION2');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('sessionId=SESSION2');
    expect(getCachedMaster(MASTER)).toBe(BODY);
    vi.unstubAllGlobals();
  });

  it('prefetchMaster no repite la descarga si ya está en caché ni guarda respuestas con error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve('boom') });
    vi.stubGlobal('fetch', fetchMock);

    await prefetchMaster(MASTER, 'S');
    expect(getCachedMaster(MASTER)).toBeNull();

    storeMaster(MASTER, BODY);
    await prefetchMaster(MASTER, 'S');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('prefetchMaster no lanza si la red falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(prefetchMaster(MASTER, 'S')).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });
});
