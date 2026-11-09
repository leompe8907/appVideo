import { describe, it, expect } from 'vitest';
import { captureInitialUnreadIds, groupOsmsByDay, previewText } from '../osmsFormat';

const t = (key) => key;

describe('previewText', () => {
  it('recorta con … y limpia espacios', () => {
    expect(previewText('  hola  ')).toBe('hola');
    expect(previewText('abcdef', 3)).toBe('abc…');
    expect(previewText(null)).toBe('');
  });
});

describe('groupOsmsByDay', () => {
  it('agrupa en Hoy / Ayer / Anteriores conservando el orden', () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    const yesterday = new Date(today.getTime() - 86400000);
    const old = new Date(today.getTime() - 5 * 86400000);
    const items = [
      { id: 1, time: today },
      { id: 2, time: yesterday },
      { id: 3, time: old },
      { id: 4, time: null },
    ];

    const groups = groupOsmsByDay(items, t);

    expect(groups.map((g) => [g.label, g.items.map((m) => m.id)])).toEqual([
      ['osms.groupToday', [1]],
      ['osms.groupYesterday', [2]],
      ['osms.groupEarlier', [3, 4]],
    ]);
  });
});

describe('captureInitialUnreadIds', () => {
  it('marca como no leídos los primeros unreadCount mensajes', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect([...captureInitialUnreadIds(items, true, 2)]).toEqual(['a', 'b']);
    expect(captureInitialUnreadIds(items, false, 2).size).toBe(0);
  });
});
