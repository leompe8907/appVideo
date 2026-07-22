import { describe, it, expect } from 'vitest';
import { prepareRecorded, normalizeList, toMs } from '../catchupRecorded.js';

function group(name, lcn, events) {
  return { name, lcn, img: `img-${name}`, events };
}

function ev(id) {
  return { id, eventId: id };
}

function task(catchupId, startDate, extra = {}) {
  return { mode: 4, catchupId, startDate, ...extra };
}

describe('normalizeList', () => {
  it('devuelve el array directo si la respuesta ya es un array', () => {
    expect(normalizeList([1, 2], ['items'])).toEqual([1, 2]);
  });

  it('busca el primer key que sea array en una respuesta envolvente', () => {
    expect(normalizeList({ answer: [1, 2] }, ['items', 'answer'])).toEqual([1, 2]);
  });

  it('devuelve [] si no hay ningún array reconocible', () => {
    expect(normalizeList({ foo: 1 }, ['items'])).toEqual([]);
    expect(normalizeList(null, ['items'])).toEqual([]);
  });
});

describe('toMs', () => {
  it('pasa through números finitos', () => {
    expect(toMs(1000)).toBe(1000);
  });
  it('parsea strings de fecha', () => {
    expect(toMs('2026-01-01T00:00:00Z')).toBe(Date.parse('2026-01-01T00:00:00Z'));
  });
  it('null/undefined/inválido -> null', () => {
    expect(toMs(null)).toBeNull();
    expect(toMs(undefined)).toBeNull();
    expect(toMs('no-es-una-fecha')).toBeNull();
  });
});

describe('prepareRecorded', () => {
  it('filtra tareas: solo mode===4, catchupId>0 y no eliminadas', () => {
    const groups = [group('A', 1, [ev(10)])];
    const tasks = [
      task(10, '2026-01-01T00:00:00Z'),
      { ...task(10, '2026-01-01T00:00:00Z'), mode: 1 }, // mode incorrecto
      { ...task(10, '2026-01-01T00:00:00Z'), deleted: true }, // eliminada
      task(0, '2026-01-01T00:00:00Z'), // catchupId inválido
    ];
    const recorded = prepareRecorded(tasks, groups);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].catchupId).toBe(10);
  });

  it('cruza cada tarea con su evento/grupo correspondiente y arma los campos derivados', () => {
    const groups = [group('CanalA', 5, [ev(101), ev(102)]), group('CanalB', 9, [ev(201)])];
    const tasks = [task(102, '2026-02-01T00:00:00Z'), task(201, '2026-02-02T00:00:00Z')];

    const recorded = prepareRecorded(tasks, groups);

    expect(recorded).toHaveLength(2);
    // ordenado por startDate ascendente
    expect(recorded[0].catchupId).toBe(102);
    expect(recorded[0].event.id).toBe(102);
    expect(recorded[0].lcn).toBe(5);
    expect(recorded[0].catchupName).toBe('CanalA');
    expect(recorded[1].catchupId).toBe(201);
    expect(recorded[1].lcn).toBe(9);
  });

  it('tarea sin evento correspondiente en ningún grupo se descarta', () => {
    const groups = [group('A', 1, [ev(1)])];
    const tasks = [task(999, '2026-01-01T00:00:00Z')];
    expect(prepareRecorded(tasks, groups)).toEqual([]);
  });

  it('grupos sin `events` (o no-array) no rompen la indexación', () => {
    const groups = [{ name: 'Roto', lcn: 1 }, group('OK', 2, [ev(5)])];
    const tasks = [task(5, '2026-01-01T00:00:00Z')];
    const recorded = prepareRecorded(tasks, groups);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].catchupName).toBe('OK');
  });

  /**
   * Regresión clave del cambio de algoritmo (doble loop O(T×G×E) -> índice
   * O(G×E) + lookup O(1)): si dos grupos distintos tuvieran (por datos
   * inconsistentes) un evento con el mismo id, debe ganar el PRIMERO en
   * orden de iteración de `groupsWithEvents` — igual que el código anterior.
   */
  it('con ids de evento duplicados entre grupos, gana el primer grupo (mismo criterio que antes)', () => {
    const groups = [group('Primero', 1, [ev(7)]), group('Segundo', 2, [ev(7)])];
    const tasks = [task(7, '2026-01-01T00:00:00Z')];
    const recorded = prepareRecorded(tasks, groups);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].catchupName).toBe('Primero');
  });

  it('ordena el resultado por startDate ascendente', () => {
    const groups = [group('A', 1, [ev(1), ev(2), ev(3)])];
    const tasks = [
      task(3, '2026-03-01T00:00:00Z'),
      task(1, '2026-01-01T00:00:00Z'),
      task(2, '2026-02-01T00:00:00Z'),
    ];
    const recorded = prepareRecorded(tasks, groups);
    expect(recorded.map((r) => r.catchupId)).toEqual([1, 2, 3]);
  });
});
