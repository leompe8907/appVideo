import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAdActivateHandler } from '../adActivate.js';

const handlerFor = () =>
  createAdActivateHandler({ epgStreams: [], play: vi.fn(), navigate: vi.fn(), panaccessService: {} });

describe('createAdActivateHandler - actionUrl', () => {
  afterEach(() => vi.restoreAllMocks());

  it('abre solo URLs http(s)', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    handlerFor()({ actionUrl: 'https://tienda.example.com/promo' });
    handlerFor()({ actionUrl: 'http://tienda.example.com/promo' });
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledWith('https://tienda.example.com/promo', '_blank', 'noopener,noreferrer');
  });

  it('ignora esquemas peligrosos (javascript:, data:, file:) que el backend no debería mandar', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    for (const actionUrl of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>1</script>', 'file:///etc/passwd', '//evil.example.com']) {
      handlerFor()({ actionUrl });
    }
    expect(open).not.toHaveBeenCalled();
  });

  it('el fallback de window.open tampoco navega a un esquema inseguro', () => {
    vi.spyOn(window, 'open').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const before = window.location.href;
    handlerFor()({ actionUrl: 'javascript:alert(1)' });
    expect(window.location.href).toBe(before);
  });
});
