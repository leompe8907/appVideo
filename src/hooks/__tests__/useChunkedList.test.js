import { describe, it, expect } from 'vitest';
import { computeVisibleWindow } from '../useChunkedList.js';

/**
 * `useChunkedList` ahora virtualiza de verdad (antes solo "revelaba" de a
 * tandas y dejaba TODO montado para siempre — hallazgo de auditoría). El
 * riesgo real de virtualizar en una app de TV es que la navegación espacial
 * (`spatialNavigation.js`) mueve el foco por geometría SOLO sobre lo que esté
 * montado: si el próximo candidato no está montado, la tecla no hace nada.
 * Estos tests validan la lógica pura de la ventana (`computeVisibleWindow`),
 * en particular que un buffer >= 1 alrededor del índice con foco SIEMPRE deja
 * montado al vecino inmediato en cualquier dirección.
 */
describe('computeVisibleWindow', () => {
  it('sin virtualizar, devuelve todo el rango (0..total)', () => {
    expect(computeVisibleWindow({ total: 500, revealed: 10, focusedIndex: -1, buffer: 20, shouldVirtualize: false }))
      .toEqual({ start: 0, end: 500 });
  });

  it('sin foco puesto todavía, usa el reveal progresivo desde el principio', () => {
    expect(computeVisibleWindow({ total: 500, revealed: 28, focusedIndex: -1, buffer: 20, shouldVirtualize: true }))
      .toEqual({ start: 0, end: 28 });
  });

  it('con foco en el medio de la lista, centra la ventana con el buffer a cada lado', () => {
    expect(computeVisibleWindow({ total: 500, revealed: 28, focusedIndex: 250, buffer: 20, shouldVirtualize: true }))
      .toEqual({ start: 230, end: 271 });
  });

  it('con foco cerca del principio, recorta el inicio en 0 sin correr el final', () => {
    expect(computeVisibleWindow({ total: 500, revealed: 28, focusedIndex: 5, buffer: 20, shouldVirtualize: true }))
      .toEqual({ start: 0, end: 26 });
  });

  it('con foco cerca del final, recorta el final en total sin correr el inicio', () => {
    expect(computeVisibleWindow({ total: 500, revealed: 28, focusedIndex: 498, buffer: 20, shouldVirtualize: true }))
      .toEqual({ start: 478, end: 500 });
  });

  it('regla de oro anti "foco trabado": para cualquier índice focuseable, sus dos vecinos inmediatos quedan dentro de la ventana', () => {
    const total = 300;
    const buffer = 20;
    for (let focusedIndex = 0; focusedIndex < total; focusedIndex += 7) {
      const { start, end } = computeVisibleWindow({ total, revealed: 28, focusedIndex, buffer, shouldVirtualize: true });
      const prevNeighbor = focusedIndex - 1;
      const nextNeighbor = focusedIndex + 1;
      if (prevNeighbor >= 0) {
        expect(prevNeighbor).toBeGreaterThanOrEqual(start);
        expect(prevNeighbor).toBeLessThan(end);
      }
      if (nextNeighbor < total) {
        expect(nextNeighbor).toBeGreaterThanOrEqual(start);
        expect(nextNeighbor).toBeLessThan(end);
      }
    }
  });

  it('el índice con foco siempre queda dentro de su propia ventana', () => {
    const total = 120;
    for (let focusedIndex = 0; focusedIndex < total; focusedIndex += 3) {
      const { start, end } = computeVisibleWindow({ total, revealed: 28, focusedIndex, buffer: 20, shouldVirtualize: true });
      expect(focusedIndex).toBeGreaterThanOrEqual(start);
      expect(focusedIndex).toBeLessThan(end);
    }
  });
});
