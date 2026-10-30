import { describe, it, expect } from 'vitest';
import { buildEventReminder, reminderIdFor } from '../reminders';

describe('recordatorios de la Guía', () => {
  it('el id del recordatorio sale del id del evento (event_id, eventId o id)', () => {
    expect(reminderIdFor({ event_id: 1 })).toBe('1');
    expect(reminderIdFor({ eventId: 2 })).toBe('2');
    expect(reminderIdFor({ id: 3 })).toBe('3');
  });

  it('arma el recordatorio con título, inicio y canal', () => {
    const event = { eventId: 5, title: 'Noticias', startDate: 1700000000000 };
    const channel = { id: 10, name: 'Canal 10' };

    const reminder = buildEventReminder(channel, event);

    expect(reminder).toMatchObject({ id: '5', eventId: 5, title: 'Noticias', startMs: 1700000000000 });
    expect(reminder.channelStableId).toBeTruthy();
  });
});
