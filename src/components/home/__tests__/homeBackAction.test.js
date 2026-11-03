import { describe, it, expect } from 'vitest';
import { resolveHomeBackAction } from '../homeBackAction.js';

describe('resolveHomeBackAction', () => {
  const inSidebar = { focusInSidebar: true };

  it('en TV con el foco en el contenido lleva al menú lateral, en cualquier área', () => {
    expect(resolveHomeBackAction({ pathname: '/home/catchup', isTV: true, historyIndex: 2 })).toBe('focus-sidebar');
    expect(resolveHomeBackAction({ pathname: '/home/inicio', isTV: true, historyIndex: 0 })).toBe('focus-sidebar');
  });

  it('con el foco en el menú lateral, una subruta con historial vuelve atrás', () => {
    expect(resolveHomeBackAction({ pathname: '/home/epg', isTV: true, historyIndex: 2, ...inSidebar })).toBe('history-back');
  });

  it('en una subruta sin historial (app abierta directo ahí) va a Inicio', () => {
    expect(resolveHomeBackAction({ pathname: '/home/catchup', isTV: true, historyIndex: 0, ...inSidebar })).toBe('go-inicio');
    expect(resolveHomeBackAction({ pathname: '/home/mi-cuenta', isTV: false, historyIndex: 0 })).toBe('go-inicio');
  });

  it('en Inicio con el foco en el menú sale de la app en TV y deja pasar la tecla fuera de TV', () => {
    expect(resolveHomeBackAction({ pathname: '/home/inicio', isTV: true, historyIndex: 3, ...inSidebar })).toBe('exit');
    expect(resolveHomeBackAction({ pathname: '/home/inicio', isTV: false, historyIndex: 3 })).toBe('pass');
  });
});
