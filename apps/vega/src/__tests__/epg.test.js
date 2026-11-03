import { describe, it, expect } from 'vitest';
import { getNowNext } from '../epg';

describe('getNowNext', () => {
  it('programa actual y siguiente del canal, con título, horario y descripción', () => {
    const now = Date.now();
    const channel = {
      epgItems: [
        { title: 'Noticias', description: 'Resumen del día', startDate: new Date(now - 60_000), endDate: new Date(now + 60_000) },
        { title: 'Película', description: 'Estreno', startDate: new Date(now + 60_000), endDate: new Date(now + 120_000) },
      ],
    };

    const { current, next } = getNowNext(channel);

    expect(current).toMatchObject({ title: 'Noticias', description: 'Resumen del día' });
    expect(current.time).toMatch(/\d\d:\d\d – \d\d:\d\d/);
    expect(next).toMatchObject({ title: 'Película', description: 'Estreno' });
  });

  it('sin EPG no hay programa', () => {
    expect(getNowNext({ epgItems: [] })).toEqual({ current: null, next: null });
  });
});
