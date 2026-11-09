import { describe, it, expect } from 'vitest';
import { getEventStartMs, getEventEndMs, findCatchupGroupForEvent } from '../catchupEvent.js';

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

describe('findCatchupGroupForEvent', () => {
  const groups = [
    { catchupGroupId: 7, epgStreamId: 70, name: 'Canal 7' },
    { catchup_group_id: '9', epg_stream_id: '90', name: 'Canal 9' },
  ];

  it('encuentra el grupo por catchupGroupId (camel o snake)', () => {
    expect(findCatchupGroupForEvent({ catchupGroupId: 7 }, groups)?.name).toBe('Canal 7');
    expect(findCatchupGroupForEvent({ catchup_group_id: 9 }, groups)?.name).toBe('Canal 9');
  });

  it('acepta un catchupGroupId que en realidad es el epgStreamId del grupo', () => {
    expect(findCatchupGroupForEvent({ catchupGroupId: 90 }, groups)?.name).toBe('Canal 9');
  });

  it('si no hay id de grupo, busca por epgStreamId del evento', () => {
    expect(findCatchupGroupForEvent({ epgStreamId: 70 }, groups)?.name).toBe('Canal 7');
  });

  it('devuelve null sin evento, sin grupos o sin coincidencia', () => {
    expect(findCatchupGroupForEvent(null, groups)).toBeNull();
    expect(findCatchupGroupForEvent({ catchupGroupId: 7 }, null)).toBeNull();
    expect(findCatchupGroupForEvent({ catchupGroupId: 1 }, groups)).toBeNull();
  });
});
