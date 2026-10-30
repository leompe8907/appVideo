import { describe, it, expect, beforeEach } from 'vitest';
import {
  usableImageUrl,
  markImageFailed,
  hasImageFailed,
  resetFailedImages,
} from '../remoteImage.js';

describe('remoteImage', () => {
  beforeEach(() => resetFailedImages());

  it('descarta URLs vacías, sin host, sin ruta o sin id', () => {
    expect(usableImageUrl('')).toBeNull();
    expect(usableImageUrl('   ')).toBeNull();
    expect(usableImageUrl(null)).toBeNull();
    expect(usableImageUrl('http://')).toBeNull();
    expect(usableImageUrl('http://host')).toBeNull();
    expect(usableImageUrl('http://host/')).toBeNull();
    expect(usableImageUrl('http://host//')).toBeNull();
    expect(usableImageUrl('http://host/images/')).toBeNull();
  });

  it('acepta URLs absolutas válidas, data: y blob:', () => {
    expect(usableImageUrl(' https://cdn.x/img/1.png ')).toBe('https://cdn.x/img/1.png');
    expect(usableImageUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
    expect(usableImageUrl('blob:https://x/1')).toBe('blob:https://x/1');
  });

  it('rutas relativas solo con allowRelative', () => {
    expect(usableImageUrl('/cdn/public/images/1.png')).toBeNull();
    expect(usableImageUrl('/cdn/public/images/1.png', { allowRelative: true })).toBe('/cdn/public/images/1.png');
    expect(usableImageUrl('//host/1.png', { allowRelative: true })).toBeNull();
    expect(usableImageUrl('img.png', { allowRelative: true })).toBeNull();
  });

  it('no vuelve a pedir una URL que ya falló', () => {
    const url = 'https://cdn.x/img/404.png';
    markImageFailed(url);
    expect(hasImageFailed(url)).toBe(true);
    expect(usableImageUrl(url)).toBeNull();
    markImageFailed({ uri: 'https://cdn.x/img/2.png' });
    expect(usableImageUrl('https://cdn.x/img/2.png')).toBeNull();
  });
});
