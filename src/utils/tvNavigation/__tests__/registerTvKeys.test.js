import { describe, it, expect } from 'vitest';
import { registerTvKeys, TIZEN_KEYS_TO_REGISTER } from '../registerTvKeys';

function fakeTizen({ supported = TIZEN_KEYS_TO_REGISTER, failOn = [] } = {}) {
  const registered = [];
  return {
    registered,
    tizen: {
      tvinputdevice: {
        getSupportedKeys: () => supported.map((name, i) => ({ name, code: 1000 + i })),
        registerKey: (name) => {
          if (failOn.includes(name)) throw new Error(`InvalidValuesError: ${name}`);
          registered.push(name);
        },
      },
    },
  };
}

describe('registerTvKeys', () => {
  it('en Samsung registra CH±, media, números y colores', () => {
    const { tizen, registered } = fakeTizen();

    registerTvKeys({ tizen });

    expect(registered).toEqual(expect.arrayContaining([
      'ChannelUp', 'ChannelDown',
      'MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'MediaFastForward', 'MediaRewind',
      '0', '5', '9',
      'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
    ]));
  });

  it('si una tecla falla al registrarse, registra el resto igual', () => {
    const { tizen, registered } = fakeTizen({ failOn: ['MediaPlayPause'] });

    const result = registerTvKeys({ tizen });

    expect(registered).not.toContain('MediaPlayPause');
    expect(registered).toContain('MediaStop');
    expect(registered).toContain('ChannelDown');
    expect(result).toEqual(registered);
  });

  it('sólo registra las teclas que el modelo soporta', () => {
    const { tizen, registered } = fakeTizen({ supported: ['ChannelUp', 'ChannelDown', 'MediaPlay'] });

    registerTvKeys({ tizen });

    expect(registered).toEqual(['ChannelUp', 'ChannelDown', 'MediaPlay']);
  });

  it('si getSupportedKeys no existe o falla, intenta todas', () => {
    const { tizen, registered } = fakeTizen();
    tizen.tvinputdevice.getSupportedKeys = () => { throw new Error('NotSupported'); };

    registerTvKeys({ tizen });

    expect(registered).toEqual(TIZEN_KEYS_TO_REGISTER);
  });

  it('fuera de Samsung (navegador, LG) no hace nada', () => {
    expect(registerTvKeys({})).toEqual([]);
    expect(registerTvKeys({ tizen: {} })).toEqual([]);
    expect(registerTvKeys(undefined)).toEqual([]);
  });
});
