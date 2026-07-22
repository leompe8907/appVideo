import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { navigationRouter } from '../NavigationRouter';
import { focusManager } from '../FocusManager';
import { TV_ACTION } from '../../utils/tvRemote';

function dispatchKey(keyCode, key) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'keyCode', { get: () => keyCode });
  window.dispatchEvent(event);
  return event;
}

describe('NavigationRouter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    focusManager.clear();
    navigationRouter.unregister('global');
    navigationRouter.start();
  });

  afterEach(() => {
    navigationRouter.unregister('global');
    navigationRouter.stop();
  });

  it('despacha CHANNEL_UP/CHANNEL_DOWN a los handlers de zona (antes se ignoraban por completo)', () => {
    const calls = [];
    navigationRouter.register('global', (action) => {
      calls.push(action);
      return true;
    });

    const e1 = dispatchKey(427, 'ChannelUp');
    const e2 = dispatchKey(428, 'ChannelDown');

    expect(calls).toEqual([TV_ACTION.CHANNEL_UP, TV_ACTION.CHANNEL_DOWN]);
    expect(e1.defaultPrevented).toBe(true);
    expect(e2.defaultPrevented).toBe(true);
  });

  it('CHANNEL_UP/CHANNEL_DOWN sin handlers registrados no lanza y no consume el evento', () => {
    const e = dispatchKey(427, 'ChannelUp');
    expect(e.defaultPrevented).toBe(false);
  });

  /**
   * Regresión de la consolidación de `usePlayerChannelZapping` +
   * `usePlayerHudTvNavigation` en un único listener central (antes cada uno
   * tenía su propio `window.addEventListener('keydown')`, uno de ellos con
   * `stopImmediatePropagation()`). Reproduce el orden real de registro en
   * `PlayerHud.jsx` (zapping se monta antes que la navegación TV del HUD) y
   * verifica que, con el zapping por flechas activo, el zapping consume la
   * tecla y el motor de navegación espacial NUNCA mueve el foco.
   */
  it('con zapping por flechas activo, el handler de zapping consume UP/DOWN antes que el motor espacial', () => {
    const btnA = document.createElement('button');
    const btnB = document.createElement('button');
    document.body.append(btnA, btnB);
    btnA.focus();

    let zapCalls = 0;
    const zapHandler = (action) => {
      if (action !== TV_ACTION.UP && action !== TV_ACTION.DOWN) return false;
      zapCalls += 1;
      return true;
    };
    // Simula usePlayerHudTvNavigation: se registra DESPUÉS del zapping y deja
    // pasar (`false`) UP/DOWN mientras el zapping por flechas está activo.
    const tvNavHandler = (action) => {
      if (action === TV_ACTION.UP || action === TV_ACTION.DOWN) return false;
      return false;
    };

    navigationRouter.register('global', zapHandler);
    navigationRouter.register('global', tvNavHandler);

    const e = dispatchKey(38, 'ArrowUp');

    expect(zapCalls).toBe(1);
    expect(e.defaultPrevented).toBe(true);
    // El motor espacial nunca corrió: el foco sigue en btnA, no saltó a btnB.
    expect(document.activeElement).toBe(btnA);
  });
});
