import { describe, it, expect } from 'vitest';
import { computeSlots, computeLiveProgressStyle } from '../epgSlots.js';

function ev(startDate, endDate, title) {
  return { startDate, endDate, title };
}

describe('computeSlots', () => {
  const t0 = Date.parse('2026-07-22T10:00:00Z');
  const hour = 3600_000;

  it('sin eventos devuelve todo null / isLive false', () => {
    expect(computeSlots([], { nowMs: t0 })).toEqual({
      before: null,
      now: null,
      next: null,
      later: null,
      isLive: false,
      canPageBefore: false,
      canPageLater: false,
      beforeOffset: 0,
      laterOffset: 0,
    });
  });

  it('identifica el evento en vivo y sus vecinos (antes/siguiente/más tarde)', () => {
    const items = [
      ev(t0 - hour, t0, 'antes'),
      ev(t0, t0 + hour, 'ahora'),
      ev(t0 + hour, t0 + 2 * hour, 'siguiente'),
      ev(t0 + 2 * hour, t0 + 3 * hour, 'mas tarde'),
    ];

    const slots = computeSlots(items, { nowMs: t0 + hour / 2, epgPastEnabled: true });

    expect(slots.now.title).toBe('ahora');
    expect(slots.before.title).toBe('antes');
    expect(slots.next.title).toBe('siguiente');
    expect(slots.later.title).toBe('mas tarde');
    expect(slots.isLive).toBe(true);
  });

  it('epgPastEnabled=false nunca devuelve "before" aunque exista', () => {
    const items = [ev(t0 - hour, t0, 'antes'), ev(t0, t0 + hour, 'ahora')];
    const slots = computeSlots(items, { nowMs: t0 + 1, epgPastEnabled: false });
    expect(slots.before).toBeNull();
  });

  it('sin evento live usa el primer evento futuro como "now" (isLive=false)', () => {
    const items = [ev(t0 + hour, t0 + 2 * hour, 'futuro')];
    const slots = computeSlots(items, { nowMs: t0 });
    expect(slots.now.title).toBe('futuro');
    expect(slots.isLive).toBe(false);
  });
});

describe('computeLiveProgressStyle', () => {
  it('devuelve null si falta start/end o la duración no es positiva', () => {
    expect(computeLiveProgressStyle(null, 1000)).toBeNull();
    expect(computeLiveProgressStyle(1000, null)).toBeNull();
    expect(computeLiveProgressStyle(2000, 1000)).toBeNull();
  });

  it('calcula % transcurrido y ms restantes a mitad de evento', () => {
    const start = 1_000_000;
    const end = start + 10_000;
    const now = start + 4_000;
    const result = computeLiveProgressStyle(start, end, now);
    expect(result.elapsedPercent).toBeCloseTo(40, 5);
    expect(result.remainingMs).toBe(6_000);
  });

  it('recorta (clamp) tiempos fuera de rango a 0% / 100%', () => {
    const start = 1_000_000;
    const end = start + 10_000;
    expect(computeLiveProgressStyle(start, end, start - 5_000).elapsedPercent).toBe(0);
    expect(computeLiveProgressStyle(start, end, end + 5_000).elapsedPercent).toBe(100);
  });
});

/**
 * Paginado por fila de "Antes"/"Más tarde" (como DevApps con
 * epgCardsLaterGlobal=false): cada offset corre esa columna un evento.
 */
describe('computeSlots — paginado de Antes / Más tarde', () => {
  const t0 = Date.parse('2026-07-22T10:00:00Z');
  const hour = 3600_000;
  // e0..e6; al aire e3.
  const items = Array.from({ length: 7 }, (_, i) => ev(t0 + (i - 3) * hour, t0 + (i - 2) * hour, `e${i}`));
  const nowMs = t0 + hour / 2;

  it('sin offsets: Antes e2, Más tarde e5, y se puede paginar a ambos lados', () => {
    const s = computeSlots(items, { nowMs, epgPastEnabled: true });
    expect([s.before.title, s.now.title, s.next.title, s.later.title]).toEqual(['e2', 'e3', 'e4', 'e5']);
    expect(s.canPageBefore).toBe(true);
    expect(s.canPageLater).toBe(true);
  });

  it('laterOffset corre solo Más tarde; en el último evento ya no se puede avanzar', () => {
    const s = computeSlots(items, { nowMs, epgPastEnabled: true, laterOffset: 1 });
    expect([s.now.title, s.next.title, s.later.title]).toEqual(['e3', 'e4', 'e6']);
    expect(s.canPageLater).toBe(false);
  });

  it('beforeOffset corre solo Antes hacia atrás; en el primer evento ya no se puede retroceder', () => {
    expect(computeSlots(items, { nowMs, epgPastEnabled: true, beforeOffset: 1 }).before.title).toBe('e1');
    const s = computeSlots(items, { nowMs, epgPastEnabled: true, beforeOffset: 2 });
    expect(s.before.title).toBe('e0');
    expect(s.canPageBefore).toBe(false);
  });

  it('offsets más allá de los datos se acotan al último evento disponible', () => {
    const s = computeSlots(items, { nowMs, epgPastEnabled: true, beforeOffset: 9, laterOffset: 9 });
    expect(s.before.title).toBe('e0');
    expect(s.later.title).toBe('e6');
  });

  it('devuelve los offsets efectivos (acotados) para paginar la columna desde ahí', () => {
    const s = computeSlots(items, { nowMs, epgPastEnabled: true, beforeOffset: 9, laterOffset: 9 });
    expect([s.beforeOffset, s.laterOffset]).toEqual([2, 1]);
    const t = computeSlots(items, { nowMs, epgPastEnabled: true, beforeOffset: 1 });
    expect([t.beforeOffset, t.laterOffset]).toEqual([1, 0]);
  });

  it('sin epgPast no hay Antes ni paginado hacia atrás', () => {
    const s = computeSlots(items, { nowMs, beforeOffset: 1 });
    expect(s.before).toBeNull();
    expect(s.canPageBefore).toBe(false);
  });
});
