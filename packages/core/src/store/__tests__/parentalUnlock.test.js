import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Un solo PIN desbloquea todo (canales bloqueados, adultos y clasificación)
 * durante `parental.channelUnlockTtlMs` de la marca. Al vencer, lo que se está
 * viendo sigue (el gate solo actúa al pedir reproducir); el siguiente cambio a
 * contenido restringido vuelve a pedir el PIN.
 */

const TTL = 5 * 60 * 1000;

vi.mock('../../config/brandConfig', () => ({
  getActiveBrandConfig: () => ({ parental: { channelUnlockTtlMs: TTL } }),
  isParentalControlEnabledForBrand: () => true,
}));

vi.mock('../../locales/i18n', () => ({
  default: { t: (key, opts) => opts?.defaultValue ?? key },
}));

const { useParentalStore } = await import('../parentalStore.js');
const { useParentalGateStore } = await import('../parentalGateStore.js');
const { getBrandItem, resolveBrandId } = await import('../../utils/brandStorage');

const blockedA = { id: 'a' };
const blockedB = { id: 'b' };
const adult = { id: 'x', parentalControl: true };
const rated16 = { id: 'r', parentalRating: 16 };
const free = { id: 'f' };

function play(channel) {
  const playFn = vi.fn();
  useParentalGateStore.getState().requestPlayChannel({ channel, playFn });
  return playFn;
}

async function unlockWithPinOn(channel) {
  const playFn = play(channel);
  expect(useParentalGateStore.getState().open).toBe(true);
  expect(await useParentalGateStore.getState().submitPin('1234')).toBe(true);
  expect(playFn).toHaveBeenCalledTimes(1);
}

describe('desbloqueo único con PIN', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
    useParentalGateStore.getState().closeGate();
    useParentalStore.setState({ blockedChannelIds: [] });
    await useParentalStore.getState().setPin('1234');
    useParentalStore.setState({
      enabled: true,
      blockedChannelIds: ['a', 'b'],
      ratingEnabled: true,
      ratingAllowedMax: 12,
      ratingApplyToLive: true,
      pinFailures: 0,
      pinLockedUntilMs: 0,
    });
  });

  afterEach(() => vi.useRealTimers());

  it('con el PIN de un canal bloqueado se navega por todo lo restringido sin volver a pedirlo', async () => {
    await unlockWithPinOn(blockedA);

    for (const channel of [blockedB, adult, rated16, free, blockedA, adult]) {
      expect(play(channel)).toHaveBeenCalledTimes(1);
      expect(useParentalGateStore.getState().open).toBe(false);
    }

    const media = vi.fn();
    useParentalGateStore.getState().requestPlayMedia({ item: { id: 'm' }, ratingRaw: '18', playFn: media });
    expect(media).toHaveBeenCalledTimes(1);
  });

  it('el PIN pedido por un canal adulto o por clasificación también abre los bloqueados', async () => {
    await unlockWithPinOn(adult);
    expect(play(blockedA)).toHaveBeenCalledTimes(1);

    useParentalStore.getState().lockNow();
    await unlockWithPinOn(rated16);
    expect(play(blockedB)).toHaveBeenCalledTimes(1);
  });

  it('al vencer el tiempo, volver a un canal bloqueado pide el PIN otra vez', async () => {
    await unlockWithPinOn(blockedA);

    vi.setSystemTime(Date.now() + TTL - 1000);
    expect(play(blockedB)).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 2000);
    expect(play(free)).toHaveBeenCalledTimes(1);
    for (const channel of [blockedA, adult, rated16]) {
      const playFn = play(channel);
      expect(playFn).not.toHaveBeenCalled();
      expect(useParentalGateStore.getState().open).toBe(true);
      useParentalGateStore.getState().closeGate();
    }

    await unlockWithPinOn(blockedA);
    expect(play(blockedB)).toHaveBeenCalledTimes(1);
  });

  it('Bloquear ahora y bloquear otro canal cierran el desbloqueo', async () => {
    await unlockWithPinOn(blockedA);
    useParentalStore.getState().lockNow();
    expect(play(blockedB)).not.toHaveBeenCalled();
    useParentalGateStore.getState().closeGate();

    await unlockWithPinOn(blockedA);
    useParentalStore.getState().toggleBlock('nuevo');
    expect(play(blockedB)).not.toHaveBeenCalled();
    useParentalGateStore.getState().closeGate();
  });

  it('el desbloqueo no se guarda en el almacenamiento (se pierde al reiniciar la app)', async () => {
    await unlockWithPinOn(blockedA);
    useParentalStore.getState().setRatingApplyToLive(true); // fuerza un persist
    await Promise.resolve();

    const saved = JSON.parse(getBrandItem(resolveBrandId(), 'parental.v1'));
    expect(saved.pinHash).toBeTruthy();
    expect(saved).not.toHaveProperty('unlockUntilMs');
  });
});
