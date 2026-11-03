import { describe, it, expect } from 'vitest';
import { pruneEpgEvent } from '../preloadStore.js';

/**
 * La caché de EPG poda cada evento para ocupar menos. Al restaurarla, el
 * control parental (`parentalRating`, `parentalControl`) y el catchup
 * (`catchupId`) tienen que seguir funcionando: antes la poda los descartaba.
 */
describe('pruneEpgEvent (caché de EPG)', () => {
  const event = {
    event_id: 21825,
    start: '2026-10-23 06:00:00',
    end: '2026-10-23 06:30:00',
    catchupId: 77,
    catchupExpiryTime: '2030-12-12 00:00:00',
    parentalRating: 16,
    parentalControl: true,
    recordStart: null,
    recordEnd: null,
    recordDuration: 0,
    imageUrl: 'https://cdn.example.invalid/a.jpg',
  };

  it('conserva los datos de control parental y de catchup', () => {
    expect(pruneEpgEvent(event)).toMatchObject({ catchupId: 77, parentalRating: 16, parentalControl: true });
  });

  it('conserva valores "falsos" (0 / false / -1), que también son datos', () => {
    const pruned = pruneEpgEvent({ ...event, catchupId: -1, parentalRating: 0, parentalControl: false });
    expect(pruned).toMatchObject({ catchupId: -1, parentalRating: 0, parentalControl: false });
  });

  it('sigue descartando lo que la app no usa', () => {
    const pruned = pruneEpgEvent(event);
    expect(pruned).not.toHaveProperty('recordStart');
    expect(pruned).not.toHaveProperty('recordDuration');
    expect(pruned).not.toHaveProperty('catchupExpiryTime');
  });
});
