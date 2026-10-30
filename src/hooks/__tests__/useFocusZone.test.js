import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { focusManager } from '../../navigation/FocusManager';
import { useFocusZone } from '../useFocusZone';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Ref estable fuera del render (equivale a un useRef del componente real).
const containerRef = { current: null };

function Zone({ active, onBack }) {
  useFocusZone({ zoneId: 'test-zone', active, containerRef, onBack });
  return createElement('div', { ref: containerRef });
}

/**
 * Regresión (LG webOS): el overlay de error del player registraba su zona con
 * `close` del PlayerContext como dependencia, y `close` es una función nueva en
 * cada render. Cada re-render hacía pop + push, y el pop devolvía el foco
 * (rAF) al botón del HUD que estaba enfocado antes: el foco salía del overlay.
 */
describe('useFocusZone', () => {
  let container;
  let root;

  beforeEach(() => {
    focusManager.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('un onBack nuevo en cada render no saca y vuelve a meter la zona', () => {
    const popSpy = vi.spyOn(focusManager, 'pop');
    act(() => root.render(createElement(Zone, { active: true, onBack: () => {} })));
    act(() => root.render(createElement(Zone, { active: true, onBack: () => {} })));
    expect(popSpy).not.toHaveBeenCalled();
    expect(focusManager.getActiveZoneId()).toBe('test-zone');
    popSpy.mockRestore();
  });

  it('BACK llama al onBack más reciente', () => {
    const first = vi.fn();
    const latest = vi.fn();
    act(() => root.render(createElement(Zone, { active: true, onBack: first })));
    act(() => root.render(createElement(Zone, { active: true, onBack: latest })));
    focusManager.getActiveZone().onBack();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('registra la zona solo mientras está activa', () => {
    act(() => root.render(createElement(Zone, { active: false, onBack: () => {} })));
    expect(focusManager.getActiveZone()).toBeNull();
    act(() => root.render(createElement(Zone, { active: true, onBack: () => {} })));
    expect(focusManager.getActiveZone()?.containerEl).toBeInstanceOf(HTMLElement);
    act(() => root.render(createElement(Zone, { active: false, onBack: () => {} })));
    expect(focusManager.getActiveZone()).toBeNull();
  });
});
