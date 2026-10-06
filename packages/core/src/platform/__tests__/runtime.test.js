import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getLaunchParam,
  getPlatformName,
  getUserAgent,
  isOnline,
  onAppHidden,
  setPlatformRuntime,
} from '../runtime.js';

afterEach(() => {
  setPlatformRuntime(null);
  window.history.replaceState(null, '', '/');
});

describe('runtime web', () => {
  it('lee los parámetros de la URL', () => {
    window.history.replaceState(null, '', '/?brand=intv');
    expect(getLaunchParam('brand')).toBe('intv');
    expect(getLaunchParam('nada')).toBeNull();
  });

  it('avisa al pasar a segundo plano y deja de escuchar', () => {
    const handler = vi.fn();
    const stop = onAppHidden(handler);
    window.dispatchEvent(new Event('pagehide'));
    stop();
    window.dispatchEvent(new Event('pagehide'));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('setPlatformRuntime', () => {
  it('reemplaza sólo lo que se pasa', () => {
    setPlatformRuntime({ name: 'vega', getUserAgent: () => 'Vega/1.2', getLaunchParam: () => null });
    expect(getPlatformName()).toBe('vega');
    expect(getUserAgent()).toBe('Vega/1.2');
    expect(isOnline()).toBe(true);
  });

  it('no propaga errores de la plataforma', () => {
    setPlatformRuntime({
      isOnline: () => { throw new Error('x'); },
      onAppHidden: () => { throw new Error('x'); },
    });
    expect(isOnline()).toBe(true);
    expect(typeof onAppHidden(() => {})).toBe('function');
  });
});
