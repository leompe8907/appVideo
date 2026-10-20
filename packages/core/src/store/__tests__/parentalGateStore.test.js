import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * El desbloqueo de un canal bloqueado dura `parental.channelUnlockTtlMs` de la
 * marca (default 15 min en brandConfig). Valores inválidos (no numéricos, 0 o
 * negativos) caen al default del store en vez de dejar el canal sin desbloquear.
 */

let brandCfg = {};
let parentalState;

vi.mock('../../config/brandConfig', () => ({
  getActiveBrandConfig: () => brandCfg,
  isParentalControlEnabledForBrand: () => true,
}));

vi.mock('../parentalStore', () => ({
  useParentalStore: { getState: () => parentalState },
}));

vi.mock('../preloadStore', () => ({
  usePreloadStore: { getState: () => ({}) },
}));

vi.mock('../../locales/i18n', () => ({
  default: { t: (key, opts) => opts?.defaultValue ?? key },
}));

const { useParentalGateStore } = await import('../parentalGateStore');

const channel = { id: 'ch-1' };

async function unlockBlockedChannel() {
  const playFn = vi.fn();
  useParentalGateStore.getState().requestPlayChannel({ channel, playFn });
  expect(useParentalGateStore.getState().open).toBe(true);
  const ok = await useParentalGateStore.getState().submitPin('1234');
  expect(ok).toBe(true);
  expect(playFn).toHaveBeenCalledTimes(1);
}

describe('parentalGateStore: TTL de desbloqueo de canal por marca', () => {
  beforeEach(() => {
    useParentalGateStore.getState().closeGate();
    parentalState = {
      enabled: true,
      hasPinConfigured: () => true,
      isChannelBlocked: () => true,
      isUnlockedFor: () => false,
      unlockWithPin: vi.fn(async () => true),
    };
  });

  it('usa parental.channelUnlockTtlMs de la marca', async () => {
    brandCfg = { parental: { channelUnlockTtlMs: 5 * 60 * 1000 } };
    await unlockBlockedChannel();
    expect(parentalState.unlockWithPin).toHaveBeenCalledWith('1234', {
      scope: 'channel',
      channelId: 'ch-1',
      ttlMs: 5 * 60 * 1000,
    });
  });

  it.each([undefined, 0, -1, 'abc'])('con valor inválido (%s) deja el default del store', async (value) => {
    brandCfg = { parental: { channelUnlockTtlMs: value } };
    await unlockBlockedChannel();
    expect(parentalState.unlockWithPin).toHaveBeenCalledWith('1234', {
      scope: 'channel',
      channelId: 'ch-1',
      ttlMs: undefined,
    });
  });
});
