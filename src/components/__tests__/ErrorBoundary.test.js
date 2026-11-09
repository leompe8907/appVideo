import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.React = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@appvideo/core/locales/i18n', () => ({ default: { t: (k) => k } }));
vi.mock('../../utils/errorReporting', () => ({ reportError: vi.fn() }));

const { ErrorBoundary } = await import('../ErrorBoundary.jsx');

let boom = true;
function Bomb() {
  if (boom) throw new Error('fallo de render');
  return createElement('div', { id: 'ok' }, 'ok');
}

describe('ErrorBoundary', () => {
  let host;
  let root;
  beforeEach(() => {
    boom = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });
  const render = (props) =>
    act(() => root.render(createElement(ErrorBoundary, props, createElement(Bomb))));

  it('el fallback ofrece un botón enfocable para reintentar (sin él, en TV la pantalla queda muerta)', () => {
    render({});
    const btn = host.querySelector('button');
    expect(btn).not.toBeNull();
    expect(document.activeElement).toBe(btn);
  });

  it('reintentar vuelve a montar los hijos', () => {
    render({});
    boom = false;
    act(() => host.querySelector('button').click());
    expect(host.querySelector('#ok')).not.toBeNull();
  });

  it('cambiar `resetKey` (otra ruta) limpia el error sin recargar', () => {
    render({ resetKey: '/a' });
    expect(host.querySelector('button')).not.toBeNull();
    boom = false;
    render({ resetKey: '/b' });
    expect(host.querySelector('#ok')).not.toBeNull();
  });
});

describe('isStaleChunkMessage', () => {
  it('reconoce los mensajes de chunk viejo, incluido el HTML servido como script', async () => {
    const { isStaleChunkMessage } = await import('../ErrorBoundary.jsx');
    expect(isStaleChunkMessage('Uncaught SyntaxError: Unexpected token <')).toBe(true);
    expect(isStaleChunkMessage("Unexpected token '<'")).toBe(true);
    expect(isStaleChunkMessage('Failed to fetch dynamically imported module: x')).toBe(true);
    expect(isStaleChunkMessage('x is not a function')).toBe(false);
    expect(isStaleChunkMessage(undefined)).toBe(false);
  });
});
