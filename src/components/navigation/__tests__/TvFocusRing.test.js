import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

// El JSX de TvFocusRing.jsx usa el runtime clásico en vitest (el build usa el automático).
globalThis.React = React;
// jsdom no trae ResizeObserver.
globalThis.ResizeObserver = class {
  observe() {}

  unobserve() {}

  disconnect() {}
};

vi.mock('../../../contexts/DeviceContext', () => ({ useDevice: () => ({ isTV: true }) }));

const { TvFocusRing } = await import('../TvFocusRing.jsx');
const { requestTvFocusRingSync } = await import('../tvFocusRingSync.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Regresión (LG webOS): al autoocultarse el HUD del player (opacidad 0) el foco
 * sigue en uno de sus botones, y el anillo (un elemento aparte en la raíz)
 * quedaba flotando sobre el video donde estaba el botón invisible.
 */
describe('TvFocusRing con el HUD del player oculto', () => {
  let container;
  let root;
  let hud;
  let button;
  const ring = () => document.querySelector('.tv-focus-ring');
  const sync = async () => {
    await act(async () => {
      requestTvFocusRingSync();
      await new Promise((r) => setTimeout(r, 30));
    });
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(createElement(TvFocusRing)));

    hud = document.createElement('div');
    hud.className = 'player-hud player-hud--visible';
    button = document.createElement('button');
    button.getBoundingClientRect = () => ({ left: 20, top: 16, width: 80, height: 40 });
    hud.appendChild(button);
    document.body.appendChild(hud);
    button.focus();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    hud.remove();
  });

  it('muestra el anillo sobre un botón del HUD visible', async () => {
    await sync();
    expect(ring().classList.contains('tv-focus-ring--visible')).toBe(true);
  });

  it('oculta el anillo cuando el HUD pasa a oculto, aunque el foco siga en su botón', async () => {
    await sync();
    hud.className = 'player-hud player-hud--hidden';
    await sync();
    expect(document.activeElement).toBe(button);
    expect(ring().classList.contains('tv-focus-ring--visible')).toBe(false);
  });

  it('lo vuelve a mostrar cuando el HUD reaparece', async () => {
    hud.className = 'player-hud player-hud--hidden';
    await sync();
    expect(ring().classList.contains('tv-focus-ring--visible')).toBe(false);

    hud.className = 'player-hud player-hud--visible';
    await sync();
    expect(ring().classList.contains('tv-focus-ring--visible')).toBe(true);
  });
});
