import { create } from 'zustand';
import { derivePinHash, timingSafeEqual } from '../utils/pinHash';
import { getActiveBrandConfig } from '../config/brandConfig';

const DEFAULT_UNLOCK_TTL_MS = 15 * 60 * 1000;
const STORAGE_VERSION = 1;

function getStorageKey() {
  const brand = getActiveBrandConfig()?.brand || getActiveBrandConfig()?.id || '';
  const suffix = String(brand || 'default');
  return `parental.v${STORAGE_VERSION}.${suffix}`;
}

function safeRead() {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeWrite(payload) {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(payload));
  } catch {
    // noop
  }
}

const initial = {
  enabled: false,
  pinHash: null,
  pinSalt: null,
  pinMethod: null,
  pinIterations: 0,
  blockedChannelIds: [],
  unlockUntilMs: null,
  lastUnlockScope: null, // 'global' | 'channel' | null
  lastUnlockedChannelId: null,
};

export const useParentalStore = create((set, get) => {
  const hydrate = () => {
    const data = safeRead();
    if (!data || data.version !== STORAGE_VERSION) return;
    set((s) => ({
      ...s,
      enabled: data.enabled === true,
      pinHash: typeof data.pinHash === 'string' ? data.pinHash : null,
      pinSalt: typeof data.pinSalt === 'string' ? data.pinSalt : null,
      pinMethod: typeof data.pinMethod === 'string' ? data.pinMethod : null,
      pinIterations: Number.isFinite(Number(data.pinIterations)) ? Number(data.pinIterations) : 0,
      blockedChannelIds: Array.isArray(data.blockedChannelIds)
        ? data.blockedChannelIds.map(String)
        : [],
      unlockUntilMs: Number.isFinite(Number(data.unlockUntilMs)) ? Number(data.unlockUntilMs) : null,
      lastUnlockScope: data.lastUnlockScope === 'global' || data.lastUnlockScope === 'channel' ? data.lastUnlockScope : null,
      lastUnlockedChannelId: data.lastUnlockedChannelId != null ? String(data.lastUnlockedChannelId) : null,
    }));
  };

  const persist = () => {
    const s = get();
    safeWrite({
      version: STORAGE_VERSION,
      enabled: s.enabled === true,
      pinHash: s.pinHash,
      pinSalt: s.pinSalt,
      pinMethod: s.pinMethod,
      pinIterations: s.pinIterations,
      blockedChannelIds: Array.isArray(s.blockedChannelIds) ? s.blockedChannelIds : [],
      unlockUntilMs: s.unlockUntilMs,
      lastUnlockScope: s.lastUnlockScope,
      lastUnlockedChannelId: s.lastUnlockedChannelId,
    });
  };

  // Hidratar best-effort al crear el store (no depende de React)
  queueMicrotask(() => hydrate());

  return {
    ...initial,

    hydrate,
    persist,

    setEnabled: (enabled) => {
      set((s) => ({ ...s, enabled: Boolean(enabled) }));
      queueMicrotask(() => persist());
    },

    hasPinConfigured: () => {
      const s = get();
      return !!(s.pinHash && s.pinSalt);
    },

    setPin: async (pin) => {
      const { saltHex, hashHex, method, iterations } = await derivePinHash({ pin });
      set((s) => ({
        ...s,
        pinSalt: saltHex,
        pinHash: hashHex,
        pinMethod: method,
        pinIterations: iterations || 0,
        // Al cambiar PIN, invalidar unlock vigente por seguridad.
        unlockUntilMs: null,
        lastUnlockScope: null,
        lastUnlockedChannelId: null,
      }));
      queueMicrotask(() => persist());
      return true;
    },

    verifyPin: async (pin) => {
      const s = get();
      if (!s.pinSalt || !s.pinHash) return false;
      const { hashHex } = await derivePinHash({ pin, saltHex: s.pinSalt, iterations: s.pinIterations || 120000 });
      return timingSafeEqual(hashHex, s.pinHash);
    },

    isChannelBlocked: (channelId) => {
      const id = String(channelId ?? '').trim();
      if (!id) return false;
      const list = get().blockedChannelIds || [];
      return list.includes(id);
    },

    toggleBlock: (channelId) => {
      const id = String(channelId ?? '').trim();
      if (!id) return;
      set((s) => {
        const prev = Array.isArray(s.blockedChannelIds) ? s.blockedChannelIds : [];
        const wasBlocked = prev.includes(id);
        const next = wasBlocked ? prev.filter((x) => x !== id) : [...prev, id];
        // Si se está BLOQUEANDO un canal, no debe quedar un unlock global vigente que lo “salte”.
        if (!wasBlocked) {
          return {
            ...s,
            blockedChannelIds: next,
            unlockUntilMs: null,
            lastUnlockScope: null,
            lastUnlockedChannelId: null,
          };
        }
        return { ...s, blockedChannelIds: next };
      });
      queueMicrotask(() => persist());
    },

    blockChannel: (channelId) => {
      const id = String(channelId ?? '').trim();
      if (!id) return;
      set((s) => {
        const prev = Array.isArray(s.blockedChannelIds) ? s.blockedChannelIds : [];
        if (prev.includes(id)) return s;
        return {
          ...s,
          blockedChannelIds: [...prev, id],
          unlockUntilMs: null,
          lastUnlockScope: null,
          lastUnlockedChannelId: null,
        };
      });
      queueMicrotask(() => persist());
    },

    unblockChannel: (channelId) => {
      const id = String(channelId ?? '').trim();
      if (!id) return;
      set((s) => {
        const prev = Array.isArray(s.blockedChannelIds) ? s.blockedChannelIds : [];
        if (!prev.includes(id)) return s;
        return { ...s, blockedChannelIds: prev.filter((x) => x !== id) };
      });
      queueMicrotask(() => persist());
    },

    lockNow: () => {
      set((s) => ({ ...s, unlockUntilMs: null, lastUnlockScope: null, lastUnlockedChannelId: null }));
      queueMicrotask(() => persist());
    },

    isUnlockedFor: (channelId) => {
      const s = get();
      const now = Date.now();
      if (!s.unlockUntilMs || now >= s.unlockUntilMs) return false;
      if (s.lastUnlockScope === 'global') return true;
      if (s.lastUnlockScope === 'channel') {
        const id = String(channelId ?? '').trim();
        return id && s.lastUnlockedChannelId === id;
      }
      return false;
    },

    unlockWithPin: async (pin, { scope = 'global', channelId = null, ttlMs = DEFAULT_UNLOCK_TTL_MS } = {}) => {
      const ok = await get().verifyPin(pin);
      if (!ok) return false;
      const until = Date.now() + (Number.isFinite(Number(ttlMs)) ? Number(ttlMs) : DEFAULT_UNLOCK_TTL_MS);
      set((s) => ({
        ...s,
        unlockUntilMs: until,
        lastUnlockScope: scope === 'channel' ? 'channel' : 'global',
        lastUnlockedChannelId: scope === 'channel' ? String(channelId ?? '') : null,
      }));
      queueMicrotask(() => persist());
      return true;
    },
  };
});

export default useParentalStore;

