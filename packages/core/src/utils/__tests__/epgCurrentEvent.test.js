import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCurrentEpgEvent, getEpgEventTimeBoundsMs, getEpgEventTitle } from '../epgCurrentEvent.js';

afterEach(() => vi.useRealTimers());

describe('epgCurrentEvent', () => {
  // Eventos como quedan tras restaurar la caché persistente: startDate/endDate son `{}`.
  const fromCache = [
    { start: '2026-10-06 20:00:00', end: '2026-10-06 21:15:00', startDate: {}, endDate: {}, languages: [{ title: 'Novela' }] },
    { start: '2026-10-06 21:15:00', end: '2026-10-06 22:00:00', startDate: {}, endDate: {}, title: 'Noticias' },
  ];

  it('usa start/end (UTC) cuando startDate/endDate vienen vacíos de la caché', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 6, 20, 30));
    const current = getCurrentEpgEvent(fromCache);
    expect(getEpgEventTitle(current)).toBe('Novela');
    expect(getEpgEventTimeBoundsMs(current)).toEqual({
      startMs: Date.UTC(2026, 9, 6, 20, 0),
      endMs: Date.UTC(2026, 9, 6, 21, 15),
    });
  });

  it('sigue usando startDate/endDate cuando son Date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 6, 21, 30));
    const live = fromCache.map((e) => ({ ...e, startDate: new Date(`${e.start.replace(' ', 'T')}Z`), endDate: new Date(`${e.end.replace(' ', 'T')}Z`) }));
    expect(getEpgEventTitle(getCurrentEpgEvent(live))).toBe('Noticias');
  });

  it('título: languages[0].title primero, después title', () => {
    expect(getEpgEventTitle({ languages: [{ title: 'A' }], title: 'B' })).toBe('A');
    expect(getEpgEventTitle({ title: 'B' })).toBe('B');
    expect(getEpgEventTitle(null)).toBe('');
  });
});
