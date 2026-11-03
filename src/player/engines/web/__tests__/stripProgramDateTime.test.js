import { describe, it, expect } from 'vitest';
import { stripProgramDateTime } from '../HlsPlaybackController.js';

/** Lista real de Wind (resumida): la hora de cada segmento no coincide con #EXTINF. */
const WIND_PLAYLIST = [
  '#EXTM3U',
  '#EXT-X-VERSION:3',
  '#EXT-X-TARGETDURATION:6',
  '#EXT-X-MEDIA-SEQUENCE:73504',
  '#EXT-X-PROGRAM-DATE-TIME:2026-10-14T21:37:48.088Z',
  '#EXTINF:6.006,',
  'https://cdn1.wind.do/streams/22/00073504.ts',
  '#EXT-X-PROGRAM-DATE-TIME:2026-10-14T21:37:54.346Z',
  '#EXTINF:6.006,',
  'https://cdn1.wind.do/streams/22/00073505.ts',
  '',
].join('\n');

describe('stripProgramDateTime', () => {
  it('quita solo las líneas #EXT-X-PROGRAM-DATE-TIME', () => {
    const out = stripProgramDateTime(WIND_PLAYLIST);
    expect(out).not.toContain('PROGRAM-DATE-TIME');
    expect(out).toContain('#EXT-X-MEDIA-SEQUENCE:73504');
    expect(out.match(/#EXTINF/g)).toHaveLength(2);
    expect(out).toContain('00073505.ts');
  });

  it('respeta finales de línea CRLF', () => {
    const out = stripProgramDateTime(WIND_PLAYLIST.replace(/\n/g, '\r\n'));
    expect(out).not.toContain('PROGRAM-DATE-TIME');
    expect(out).toContain('#EXTINF:6.006,\r\nhttps://cdn1.wind.do/streams/22/00073504.ts');
  });

  it('deja igual listas sin esa línea o datos que no son texto', () => {
    const plain = '#EXTM3U\n#EXTINF:2,\na.ts\n';
    expect(stripProgramDateTime(plain)).toBe(plain);
    const buf = new ArrayBuffer(4);
    expect(stripProgramDateTime(buf)).toBe(buf);
  });
});
