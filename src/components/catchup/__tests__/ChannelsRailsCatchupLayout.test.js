import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.React = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Solo interesa cuántas secciones monta el layout: se reemplazan los hijos pesados.
vi.mock('../../navigation/EmblaHorizontalRail', () => ({
  EmblaHorizontalRail: ({ children }) => createElement('div', { className: 'rail' }, children),
}));
vi.mock('../CatchupCard', () => ({
  default: ({ event }) => createElement('button', { className: 'catchup-card', 'data-id': event.id }, event.id),
}));
vi.mock('../CatchupSeeMoreCard', () => ({ default: () => null }));
vi.mock('../CatchupGroupModal', () => ({ default: () => null }));

const { ChannelsRailsCatchupLayout } = await import('../ChannelsRailsCatchupLayout.jsx');
const { getMountedGroupRange } = await import('../mountedGroupRange.js');

const makeGroups = (n) =>
  Array.from({ length: n }, (_, g) => ({
    catchupGroupId: g,
    name: `Canal ${g}`,
    events: Array.from({ length: 3 }, (_, e) => ({ id: `${g}-${e}` })),
  }));

describe('getMountedGroupRange', () => {
  it('monta unas pocas secciones alrededor del foco y acota a los bordes', () => {
    expect(getMountedGroupRange(0, 50)).toEqual({ start: 0, end: 5 });
    expect(getMountedGroupRange(20, 50)).toEqual({ start: 18, end: 25 });
    expect(getMountedGroupRange(49, 50)).toEqual({ start: 47, end: 49 });
    expect(getMountedGroupRange(0, 3)).toEqual({ start: 0, end: 2 });
  });
});

describe('ChannelsRailsCatchupLayout', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('con 50 canales solo monta las tarjetas de la ventana inicial (el resto son marcadores)', () => {
    act(() => root.render(createElement(ChannelsRailsCatchupLayout, { groups: makeGroups(50), t: (_k, o) => o?.defaultValue })));
    expect(container.querySelectorAll('section.catchup-rail-section').length).toBe(50);
    expect(container.querySelectorAll('.catchup-card').length).toBe(6 * 3);
    expect(container.querySelectorAll('section[data-placeholder]').length).toBe(44);
  });

  it('al enfocar una tarjeta lejana la ventana la sigue', () => {
    act(() => root.render(createElement(ChannelsRailsCatchupLayout, { groups: makeGroups(50), t: (_k, o) => o?.defaultValue })));
    const first = container.querySelector('.catchup-card[data-id="4-0"]');
    act(() => {
      first.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    const ids = [...container.querySelectorAll('.catchup-card')].map((n) => n.getAttribute('data-id'));
    expect(ids).toContain('9-0'); // 4 + ventana hacia adelante
    expect(ids).not.toContain('0-0'); // quedó atrás de la ventana
  });
});
