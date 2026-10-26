import { describe, it, expect, vi, beforeEach } from 'vitest';

const subtle = { importKey: vi.fn(), decrypt: vi.fn() };
vi.mock('@amazon-devices/react-native-w3cmedia/dist/headless', () => ({ WebCrypto: { subtle } }));

const wrapped = () => new Uint8Array(32).buffer;

describe('unwrapPanaccessKey', () => {
  beforeEach(() => {
    vi.resetModules();
    subtle.importKey.mockReset();
    subtle.decrypt.mockReset();
    subtle.decrypt.mockResolvedValue(new Uint8Array(16).buffer);
  });

  it('importa la key de envoltura una sola vez para todas las keys', async () => {
    subtle.importKey.mockResolvedValue('wrap-key');
    const { unwrapPanaccessKey } = await import('../keyUnwrap');
    await unwrapPanaccessKey(wrapped());
    await unwrapPanaccessKey(wrapped());
    await unwrapPanaccessKey(wrapped());
    expect(subtle.importKey).toHaveBeenCalledTimes(1);
    expect(subtle.decrypt).toHaveBeenCalledTimes(3);
    expect(subtle.decrypt.mock.calls[0][1]).toBe('wrap-key');
  });

  it('si la importación falla, la próxima key lo vuelve a intentar', async () => {
    subtle.importKey.mockRejectedValueOnce(new Error('sin crypto')).mockResolvedValue('wrap-key');
    const { unwrapPanaccessKey } = await import('../keyUnwrap');
    await expect(unwrapPanaccessKey(wrapped())).rejects.toThrow('sin crypto');
    await unwrapPanaccessKey(wrapped());
    expect(subtle.importKey).toHaveBeenCalledTimes(2);
  });

  it('si descifrar falla, la próxima key importa de nuevo la key de envoltura', async () => {
    subtle.importKey.mockResolvedValue('wrap-key');
    subtle.decrypt.mockRejectedValueOnce(new Error('key inválida'));
    const { unwrapPanaccessKey } = await import('../keyUnwrap');
    await expect(unwrapPanaccessKey(wrapped())).rejects.toThrow('key inválida');
    await unwrapPanaccessKey(wrapped());
    expect(subtle.importKey).toHaveBeenCalledTimes(2);
  });

  it('una key de 16 bytes (sin envolver) pasa tal cual', async () => {
    const { unwrapPanaccessKey } = await import('../keyUnwrap');
    const raw = new Uint8Array(16).buffer;
    expect(await unwrapPanaccessKey(raw)).toBe(raw);
    expect(subtle.importKey).not.toHaveBeenCalled();
  });
});
