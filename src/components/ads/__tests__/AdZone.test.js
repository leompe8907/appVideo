import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { resetFailedImages } from '@appvideo/core/utils/remoteImage';

globalThis.React = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock('../../../contexts/DeviceContext', () => ({ useDevice: () => ({ isTV: true }) }));
vi.mock('../../navigation/tvFocusRingSync', () => ({ requestTvFocusRingSync: vi.fn() }));
const focusFirstIn = vi.fn(() => () => {});
vi.mock('../../../navigation/spatialNavigation', () => ({ focusFirstIn }));
const routerHandlers = new Set();
vi.mock('../../../navigation/NavigationRouter', () => ({
  navigationRouter: {
    register: (zone, fn) => {
      routerHandlers.add(fn);
      return () => routerHandlers.delete(fn);
    },
  },
}));
/** Lo que hace el NavigationRouter en TV: el handler registrado decide antes que el motor espacial. */
const routerKey = (action) => [...routerHandlers].some((fn) => fn(action) === true);

const { AdZone } = await import('../AdZone.jsx');

const ad = (n) => ({ id: n, name: `Superior ${n}`, file: `https://cdn.example/ad${n}.png` });
const fail = (img) => act(() => img.dispatchEvent(new Event('error')));

describe('AdZone con imágenes que no cargan', () => {
  let host;
  let root;
  beforeEach(() => {
    resetFailedImages();
    vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(cb, 0));
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });
  const render = (ads) => act(() => root.render(createElement(AdZone, { zoneKey: 'top', ads })));

  it('una imagen rota no muestra el placeholder de marca: pasa al siguiente anuncio', () => {
    render([ad(1), ad(2)]);
    fail(host.querySelector('img'));
    const img = host.querySelector('img');
    expect(img.getAttribute('src')).toBe('https://cdn.example/ad2.png');
    expect(host.querySelectorAll('.home-ad-dot')).toHaveLength(0); // queda uno: sin puntos
  });

  it('si fallan todas, la franja no se dibuja (antes ocupaba más que la pantalla)', () => {
    render([ad(1), ad(2)]);
    fail(host.querySelector('img'));
    fail(host.querySelector('img'));
    expect(host.querySelector('.home-ad-zone')).toBeNull();
  });

  it('si la franja tenía el foco y desaparece, el foco pasa al contenido (no queda en <body>)', () => {
    const main = document.createElement('main');
    document.body.appendChild(main);
    const mainRoot = createRoot(main);
    focusFirstIn.mockClear();
    act(() => mainRoot.render(createElement(AdZone, { zoneKey: 'top', ads: [ad(1)] })));
    act(() => main.querySelector('.home-ad-zone').focus());
    fail(main.querySelector('img'));
    expect(main.querySelector('.home-ad-zone')).toBeNull();
    expect(focusFirstIn).toHaveBeenCalledWith(main);
    act(() => mainRoot.unmount());
    main.remove();
  });

  it('si la franja no tenía el foco, no lo mueve', () => {
    focusFirstIn.mockClear();
    render([ad(1)]);
    fail(host.querySelector('img'));
    expect(focusFirstIn).not.toHaveBeenCalled();
  });

  it('TV: con el foco en la franja, DERECHA/IZQUIERDA cambian de anuncio', () => {
    render([ad(1), ad(2), ad(3)]);
    const src = () => host.querySelector('img').getAttribute('src');
    act(() => host.querySelector('.home-ad-zone').focus());
    let consumed;
    act(() => { consumed = routerKey('right'); });
    expect(consumed).toBe(true);
    expect(src()).toBe('https://cdn.example/ad2.png');
    act(() => { consumed = routerKey('left'); });
    expect(consumed).toBe(true);
    expect(src()).toBe('https://cdn.example/ad1.png');
  });

  it('TV: IZQUIERDA en el primer anuncio no se consume (sale al menú lateral)', () => {
    render([ad(1), ad(2)]);
    act(() => host.querySelector('.home-ad-zone').focus());
    expect(routerKey('left')).toBe(false);
  });

  it('TV: sin el foco en la franja, las flechas no la tocan', () => {
    render([ad(1), ad(2)]);
    expect(routerKey('right')).toBe(false);
    expect(host.querySelector('img').getAttribute('src')).toBe('https://cdn.example/ad1.png');
  });

  it('al volver a montar, un anuncio que ya falló no se vuelve a pedir', () => {
    render([ad(1), ad(2)]);
    fail(host.querySelector('img'));
    act(() => root.unmount());
    root = createRoot(host);
    render([ad(1), ad(2)]);
    expect([...host.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual([
      'https://cdn.example/ad2.png',
    ]);
  });
});
