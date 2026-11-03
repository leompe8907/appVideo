import { describe, it, expect } from 'vitest';
import { getMountedRange } from '../mountedWindow.js';

describe('getMountedRange', () => {
  it('rodea el foco y acota a los bordes de la lista', () => {
    expect(getMountedRange(0, 200, 4, 10)).toEqual({ start: 0, end: 10 });
    expect(getMountedRange(50, 200, 4, 10)).toEqual({ start: 46, end: 60 });
    expect(getMountedRange(199, 200, 4, 10)).toEqual({ start: 195, end: 199 });
  });

  it('si la lista se achica con el foco más allá del final, la ventana sigue mostrando los últimos elementos', () => {
    // Foco en la fila 40 y una recarga deja 30: antes quedaba start 38 > end 29 (nada montado).
    expect(getMountedRange(40, 30, 4, 10)).toEqual({ start: 25, end: 29 });
    expect(getMountedRange(-3, 30, 4, 10)).toEqual({ start: 0, end: 10 });
  });

  it('con una lista corta monta todo', () => {
    expect(getMountedRange(2, 5, 4, 10)).toEqual({ start: 0, end: 4 });
    expect(getMountedRange(0, 0, 4, 10)).toEqual({ start: 0, end: -1 });
  });
});
