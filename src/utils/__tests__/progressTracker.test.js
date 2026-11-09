import { describe, it, expect } from 'vitest';
import { createProgressTracker } from '../progressTracker.js';

describe('createProgressTracker', () => {
  it('devuelve cuánto lleva sin avanzar el tiempo de reproducción', () => {
    let now = 0;
    const tr = createProgressTracker(() => now);
    expect(tr.update(10, true)).toBe(0);
    now = 2000;
    expect(tr.update(10, true)).toBe(2000);
    now = 5000;
    expect(tr.update(10, true)).toBe(5000);
  });

  it('si el tiempo avanza o no está reproduciendo, vuelve a 0', () => {
    let now = 0;
    const tr = createProgressTracker(() => now);
    tr.update(10, true);
    now = 4000;
    expect(tr.update(10.5, true)).toBe(0);
    now = 9000;
    expect(tr.update(10.5, false)).toBe(0);
    now = 9500;
    expect(tr.update(10.5, true)).toBe(500);
  });
});
