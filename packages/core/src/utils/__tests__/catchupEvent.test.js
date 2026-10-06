import { describe, it, expect } from 'vitest';
import { getEventStartMs, getEventEndMs } from '../catchupEvent.js';

describe('catchupEvent fechas', () => {
  it('interpreta strings "YYYY-MM-DD HH:mm:ss" como UTC', () => {
    const ev = { start: '2026-10-06 20:00:00', end: '2026-10-06 21:15:00' };
    expect(getEventStartMs(ev)).toBe(Date.UTC(2026, 9, 6, 20, 0));
    expect(getEventEndMs(ev)).toBe(Date.UTC(2026, 9, 6, 21, 15));
  });

  it('usa el string si startDate llega vacío ({}) de la caché', () => {
    const ev = { startDate: {}, start: '2026-10-06 20:00:00' };
    expect(getEventStartMs(ev)).toBe(Date.UTC(2026, 9, 6, 20, 0));
  });

  it('acepta Date y números', () => {
    const d = new Date(Date.UTC(2026, 0, 1));
    expect(getEventStartMs({ startDate: d })).toBe(d.getTime());
    expect(getEventStartMs({ start: 1000 })).toBe(1000);
    expect(getEventStartMs({})).toBeNull();
  });
});
