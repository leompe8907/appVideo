import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../config/brandConfig', () => ({
  getActiveBrandConfig: () => ({}),
  isParentalControlEnabledForBrand: () => true,
}));

const { useParentalStore, getPinLockSecondsLeft } = await import('../parentalStore.js');

/**
 * Un PIN de 4 dígitos tiene 10 000 combinaciones: sin límite de intentos se
 * prueba entero en minutos. Tras 5 fallos seguidos el PIN se bloquea (60 s,
 * y el doble en cada racha siguiente, hasta 15 min), incluso con el PIN correcto.
 */
describe('parentalStore - bloqueo por intentos de PIN', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    await useParentalStore.getState().setPin('1234');
    useParentalStore.setState({ pinFailures: 0, pinLockedUntilMs: 0 });
  });

  afterEach(() => vi.useRealTimers());

  async function fail(times) {
    for (let i = 0; i < times; i += 1) {
      expect(await useParentalStore.getState().verifyPin('0000')).toBe(false);
    }
  }

  it('tras 5 fallos rechaza hasta el PIN correcto durante 60 s', async () => {
    await fail(5);
    expect(await useParentalStore.getState().verifyPin('1234')).toBe(false);

    vi.setSystemTime(new Date('2026-10-30T12:00:59Z'));
    expect(await useParentalStore.getState().verifyPin('1234')).toBe(false);

    vi.setSystemTime(new Date('2026-10-30T12:01:01Z'));
    expect(await useParentalStore.getState().verifyPin('1234')).toBe(true);
  });

  it('getPinLockSecondsLeft informa cuántos segundos faltan para poder reintentar', async () => {
    expect(getPinLockSecondsLeft()).toBe(0);
    await fail(5);
    expect(getPinLockSecondsLeft()).toBe(60);
    vi.setSystemTime(new Date('2026-10-30T12:00:20.500Z'));
    expect(getPinLockSecondsLeft()).toBe(40);
    vi.setSystemTime(new Date('2026-10-30T12:01:01Z'));
    expect(getPinLockSecondsLeft()).toBe(0);
  });

  it('un acierto antes del límite reinicia la cuenta', async () => {
    await fail(4);
    expect(await useParentalStore.getState().verifyPin('1234')).toBe(true);
    await fail(4);
    expect(await useParentalStore.getState().verifyPin('1234')).toBe(true);
  });

  it('el bloqueo se duplica en cada racha y tiene tope', async () => {
    await fail(5);
    vi.setSystemTime(new Date('2026-10-30T12:01:01Z'));
    await fail(5); // segunda racha: 120 s
    vi.setSystemTime(new Date('2026-10-30T12:02:30Z'));
    expect(await useParentalStore.getState().verifyPin('1234')).toBe(false);
    vi.setSystemTime(new Date('2026-10-30T12:03:10Z'));
    expect(await useParentalStore.getState().verifyPin('1234')).toBe(true);

    useParentalStore.setState({ pinFailures: 5 * 12, pinLockedUntilMs: 0 });
    await fail(5);
    const wait = useParentalStore.getState().pinLockedUntilMs - Date.now();
    expect(wait).toBeLessThanOrEqual(15 * 60 * 1000);
  });
});
