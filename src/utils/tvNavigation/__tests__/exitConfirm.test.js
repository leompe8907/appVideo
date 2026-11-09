import { describe, it, expect } from 'vitest';
import { createExitConfirm } from '../exitConfirm.js';

describe('createExitConfirm', () => {
  it('el primer Atrás solo arma la salida; el segundo dentro de la ventana la confirma', () => {
    let now = 1000;
    const confirm = createExitConfirm({ windowMs: 2500, now: () => now });
    expect(confirm()).toBe(false);
    now += 1000;
    expect(confirm()).toBe(true);
  });

  it('pasada la ventana vuelve a pedir confirmación', () => {
    let now = 0;
    const confirm = createExitConfirm({ windowMs: 2500, now: () => now });
    expect(confirm()).toBe(false);
    now += 2600;
    expect(confirm()).toBe(false);
    now += 100;
    expect(confirm()).toBe(true);
  });

  it('tras confirmar, el siguiente Atrás vuelve a empezar', () => {
    let now = 0;
    const confirm = createExitConfirm({ windowMs: 2500, now: () => now });
    confirm();
    expect(confirm()).toBe(true);
    expect(confirm()).toBe(false);
  });
});
