import { describe, it, expect, vi, afterEach } from 'vitest';
import { exitAppBestEffort } from '../backLongPress.js';

describe('exitAppBestEffort', () => {
  afterEach(() => {
    delete window.webOS;
    delete window.tizen;
    vi.restoreAllMocks();
  });

  it('en webOS usa webOS.platformBack() (popup de salida o launcher)', () => {
    const platformBack = vi.fn();
    window.webOS = { platformBack };
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    expect(exitAppBestEffort()).toBe(true);
    expect(platformBack).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('en Tizen usa application.exit()', () => {
    const exit = vi.fn();
    window.tizen = { application: { getCurrentApplication: () => ({ exit }) } };
    expect(exitAppBestEffort()).toBe(true);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('sin SDK de plataforma cae a window.close()', () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    expect(exitAppBestEffort()).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('si platformBack lanza, cae a window.close()', () => {
    window.webOS = { platformBack: () => { throw new Error('boom'); } };
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    expect(exitAppBestEffort()).toBe(true);
    expect(close).toHaveBeenCalled();
  });
});
