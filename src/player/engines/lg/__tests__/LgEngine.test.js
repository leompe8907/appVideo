import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LgEngine } from '../LgEngine.js';

/**
 * Regresión: en el adaptador nativo real ('webos-luna'), nativeSetDimensions/
 * nativeShow/nativeHide llamaban a super.setDimensions()/super.show()/
 * super.hide() para "caer al fallback". Como `this` sigue siendo la instancia
 * de LgEngine con isNativeActive=true, BaseTvEngine.setDimensions()/show()/
 * hide() (que es lo que ese `super` resuelve) vuelve a invocar
 * this.nativeSetDimensions()/nativeShow()/nativeHide() — recursión infinita
 * hasta RangeError. Estos tests instancian LgEngine, fuerzan el modo
 * 'webos-luna' activo, y verifican que setDimensions/show/hide no cuelgan el
 * proceso y efectivamente aplican el fallback CSS de WebEngine una sola vez.
 */
function makeEngineWithFakePlayer() {
  const engine = new LgEngine();
  const fakeEl = { style: {} };
  // Bypass de init(): se simula un adaptador nativo activo sin pasar por
  // activateNativeAdapterWithTimeout()/webOS real.
  engine.nativeAdapter = { type: 'webos-luna' };
  engine.isNativeActive = true;
  engine.player = { el: () => fakeEl };
  return { engine, fakeEl };
}

describe('LgEngine - fix recursion infinita webos-luna (setDimensions/show/hide)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('setDimensions no entra en recursion infinita y aplica el fallback CSS de WebEngine', () => {
    const { engine, fakeEl } = makeEngineWithFakePlayer();
    expect(() => engine.setDimensions({ width: 640, height: 360, left: 10, top: 20 })).not.toThrow();
    expect(fakeEl.style.width).toBe('640px');
    expect(fakeEl.style.height).toBe('360px');
    expect(fakeEl.style.left).toBe('10px');
  });

  it('show() no entra en recursion infinita y aplica el fallback CSS de WebEngine', () => {
    const { engine, fakeEl } = makeEngineWithFakePlayer();
    expect(() => engine.show()).not.toThrow();
    expect(fakeEl.style.visibility).toBe('visible');
  });

  it('hide() no entra en recursion infinita y aplica el fallback CSS de WebEngine', () => {
    const { engine, fakeEl } = makeEngineWithFakePlayer();
    expect(() => engine.hide()).not.toThrow();
    expect(fakeEl.style.visibility).toBe('hidden');
  });

  it('nativeSetDimensions/nativeShow/nativeHide devuelven false en modo webos-luna (dejan el fallback a BaseTvEngine)', () => {
    const { engine } = makeEngineWithFakePlayer();
    expect(engine.nativeSetDimensions({ width: 1 })).toBe(false);
    expect(engine.nativeShow()).toBe(false);
    expect(engine.nativeHide()).toBe(false);
  });

  it('el adaptador injected sigue funcionando igual (no afectado por el fix)', () => {
    const engine = new LgEngine();
    const api = { setDimensions: vi.fn(), show: vi.fn(), hide: vi.fn() };
    engine.nativeAdapter = { type: 'injected', api };
    engine.isNativeActive = true;

    expect(engine.nativeSetDimensions({ width: 100 })).toBe(true);
    expect(api.setDimensions).toHaveBeenCalledWith({ width: 100 });
    expect(engine.nativeShow()).toBe(true);
    expect(api.show).toHaveBeenCalled();
    expect(engine.nativeHide()).toBe(true);
    expect(api.hide).toHaveBeenCalled();
  });
});
