import { describe, it, expect, beforeEach, vi } from 'vitest';
import { focusManager, createZoneId } from '../FocusManager';

describe('FocusManager', () => {
  beforeEach(() => {
    focusManager.clear();
    document.body.innerHTML = '';
  });

  it('createZoneId genera ids únicos incluso con el mismo prefijo', () => {
    const a = createZoneId('modal');
    const b = createZoneId('modal');
    expect(a).not.toBe(b);
    expect(a.startsWith('modal-')).toBe(true);
  });

  it('getActiveZoneId es "global" cuando no hay ninguna zona activa', () => {
    expect(focusManager.getActiveZoneId()).toBe('global');
    expect(focusManager.getActiveZone()).toBeNull();
    expect(focusManager.getActiveScopeEl()).toBeNull();
  });

  it('push agrega una zona y su containerEl queda como scope activo', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    focusManager.push('modal-1', { containerEl: container });

    expect(focusManager.getActiveZoneId()).toBe('modal-1');
    expect(focusManager.getActiveScopeEl()).toBe(container);
  });

  it('push no duplica una zona ya presente (re-render de un modal abierto)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    focusManager.push('modal-1', { containerEl: container });
    focusManager.push('modal-1', { containerEl: container });

    // @ts-expect-error acceso directo al stack interno solo para el test
    expect(focusManager.stack.length).toBe(1);
  });

  it('pop sin zoneId remueve la del tope (comportamiento de pila)', () => {
    focusManager.push('a');
    focusManager.push('b');

    const popped = focusManager.pop();
    expect(popped.zoneId).toBe('b');
    expect(focusManager.getActiveZoneId()).toBe('a');
  });

  it('pop con zoneId remueve esa zona puntual aunque no sea la del tope', () => {
    focusManager.push('a');
    focusManager.push('b');

    const popped = focusManager.pop('a');
    expect(popped.zoneId).toBe('a');
    expect(focusManager.getActiveZoneId()).toBe('b');
  });

  it('pop restaura el foco al elemento que estaba activo antes del push', () => {
    const before = document.createElement('button');
    const modalBtn = document.createElement('button');
    document.body.appendChild(before);
    document.body.appendChild(modalBtn);

    before.focus();
    expect(document.activeElement).toBe(before);

    focusManager.push('modal-1', { containerEl: modalBtn });
    modalBtn.focus();
    expect(document.activeElement).toBe(modalBtn);

    focusManager.pop('modal-1');

    // La restauración de foco se agenda con requestAnimationFrame.
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        expect(document.activeElement).toBe(before);
        resolve();
      });
    });
  });

  it('onBack de la zona activa se puede invocar manualmente (contrato usado por NavigationRouter)', () => {
    const onBack = vi.fn();
    focusManager.push('modal-1', { onBack });

    const zone = focusManager.getActiveZone();
    zone.onBack();

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
