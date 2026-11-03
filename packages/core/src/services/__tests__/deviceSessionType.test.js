import { describe, it, expect, afterEach } from 'vitest';
import { setPlatformRuntime } from '../../platform/runtime';
import { DEVICE_TYPE, resolveDeviceModel, resolveDeviceType } from '../deviceSessionService';

/**
 * Fire TV: antes caía a `web` y en "Dispositivos vinculados" aparecía como
 * "PC / Web". Ahora el runtime "vega" se reporta como `amazon` (valor del
 * enum del backend).
 */
describe('resolveDeviceType', () => {
  afterEach(() => setPlatformRuntime({}));

  it('Fire TV (runtime vega) → amazon', () => {
    setPlatformRuntime({ name: 'vega', getUserAgent: () => 'appVideo Vega (Fire TV)' });
    expect(resolveDeviceType()).toBe(DEVICE_TYPE.AMAZON);
    expect(DEVICE_TYPE.AMAZON).toBe('amazon');
    expect(resolveDeviceModel(DEVICE_TYPE.AMAZON)).toBe('Amazon Fire TV (Vega)');
  });

  it('navegador sin señal de TV → web', () => {
    setPlatformRuntime({ getUserAgent: () => 'Mozilla/5.0 (Macintosh) Chrome/120' });
    expect(resolveDeviceType()).toBe(DEVICE_TYPE.WEB);
  });

  it('LG / Samsung por user agent', () => {
    setPlatformRuntime({ getUserAgent: () => 'Mozilla/5.0 (Web0S; Linux/SmartTV) webOS' });
    expect(resolveDeviceType()).toBe(DEVICE_TYPE.LG);
    setPlatformRuntime({ getUserAgent: () => 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0)' });
    expect(resolveDeviceType()).toBe(DEVICE_TYPE.SAMSUNG);
  });
});
