import { describe, it, expect } from 'vitest';
import { computeListScrollTop, moveRowFocus } from '../channelSidebarNav.js';

describe('computeListScrollTop', () => {
  const base = { rowHeight: 90, viewHeight: 900, margin: 20 };
  it('no mueve el scroll si la fila ya está dentro del margen', () => {
    expect(computeListScrollTop({ ...base, rowTop: 300, scrollTop: 100 })).toBe(100);
  });
  it('sube lo justo si la fila queda por encima', () => {
    expect(computeListScrollTop({ ...base, rowTop: 150, scrollTop: 200 })).toBe(130);
  });
  it('baja lo justo si la fila queda por debajo', () => {
    // fila: 1000..1090; vista: 100..1000 -> necesita que el borde inferior quede 20px dentro
    expect(computeListScrollTop({ ...base, rowTop: 1000, scrollTop: 100 })).toBe(210);
  });
  it('nunca devuelve negativo', () => {
    expect(computeListScrollTop({ ...base, rowTop: 0, scrollTop: 10 })).toBe(0);
  });
});

describe('moveRowFocus', () => {
  const build = () => {
    const list = document.createElement('div');
    for (let i = 0; i < 3; i += 1) {
      const b = document.createElement('button');
      b.className = 'row';
      b.dataset.i = String(i);
      list.appendChild(b);
    }
    document.body.appendChild(list);
    return list;
  };

  it('baja y sube a la fila hermana y enfoca', () => {
    const list = build();
    const [a, b, c] = list.children;
    a.focus();
    expect(moveRowFocus(list, '.row', 'down')).toBe(true);
    expect(document.activeElement).toBe(b);
    expect(moveRowFocus(list, '.row', 'down')).toBe(true);
    expect(document.activeElement).toBe(c);
    expect(moveRowFocus(list, '.row', 'up')).toBe(true);
    expect(document.activeElement).toBe(b);
    list.remove();
  });

  it('en los extremos consume la tecla sin mover el foco', () => {
    const list = build();
    list.children[0].focus();
    expect(moveRowFocus(list, '.row', 'up')).toBe(true);
    expect(document.activeElement).toBe(list.children[0]);
    list.children[2].focus();
    expect(moveRowFocus(list, '.row', 'down')).toBe(true);
    expect(document.activeElement).toBe(list.children[2]);
    list.remove();
  });

  it('con el foco fuera de la lista no actúa', () => {
    const list = build();
    document.body.focus();
    expect(moveRowFocus(list, '.row', 'down')).toBe(false);
    list.remove();
  });
});
