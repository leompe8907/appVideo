import { create } from 'zustand';
import { derivePinHash, timingSafeEqual } from '../utils/pinHash';
import { getActiveBrandConfig } from '../config/brandConfig';

const DEFAULT_UNLOCK_TTL_MS = 15 * 60 * 1000;
const DEFAULT_RATING_UNLOCK_TTL_MS = 15 * 60 * 1000;
const DEFAULT_PARENTALCONTROL_MULTI_TTL_MS = 40 * 60 * 1000;
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
  ratingEnabled: false,
  ratingAllowedMax: 18, // "Permitir hasta" (BR)
  ratingApplyToLive: true,
  ratingUnlockUntilMs: null, // unlock temporal global para rating

  // Unlock por metadata `parentalControl:true` (adultos).
  // Nota: por seguridad, este unlock es solo de sesión (no se persiste en localStorage).
  pcUnlockUntilMs: null, // TTL global (multi-adult)
  pcUnlockSessionActive: false, // "sin límite" en sesión (single-adult)
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
      ratingEnabled: data.ratingEnabled === true,
      ratingAllowedMax: Number.isFinite(Number(data.ratingAllowedMax)) ? Number(data.ratingAllowedMax) : 18,
      ratingApplyToLive: data.ratingApplyToLive !== false,
      ratingUnlockUntilMs: Number.isFinite(Number(data.ratingUnlockUntilMs)) ? Number(data.ratingUnlockUntilMs) : null,
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
      ratingEnabled: s.ratingEnabled === true,
      ratingAllowedMax: s.ratingAllowedMax,
      ratingApplyToLive: s.ratingApplyToLive !== false,
      ratingUnlockUntilMs: s.ratingUnlockUntilMs,
    });
  };

  // Hidratar best-effort al crear el store (no depende de React)
  queueMicrotask(() => hydrate());

  return {
    ...initial,

    hydrate,
    persist,

    setEnabled: (enabled) => {
      const nextEnabled = Boolean(enabled);
      set((s) => ({
        ...s,
        enabled: nextEnabled,
        // Si se desactiva, invalidar unlocks de sesión por seguridad/coherencia.
        ...(nextEnabled
          ? null
          : {
              unlockUntilMs: null,
              lastUnlockScope: null,
              lastUnlockedChannelId: null,
              ratingUnlockUntilMs: null,
              pcUnlockUntilMs: null,
              pcUnlockSessionActive: false,
            }),
      }));
      queueMicrotask(() => persist());
    },

    setRatingEnabled: (enabled) => {
      set((s) => ({ ...s, ratingEnabled: Boolean(enabled) }));
      queueMicrotask(() => persist());
    },

    setRatingAllowedMax: (value) => {
      const n = Number(value);
      const allowed = n === 0 || n === 10 || n === 12 || n === 14 || n === 16 || n === 18 ? n : 18;
      set((s) => ({ ...s, ratingAllowedMax: allowed }));
      queueMicrotask(() => persist());
    },

    setRatingApplyToLive: (enabled) => {
      set((s) => ({ ...s, ratingApplyToLive: Boolean(enabled) }));
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
        ratingUnlockUntilMs: null,
        pcUnlockUntilMs: null,
        pcUnlockSessionActive: false,
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
      set((s) => ({
        ...s,
        unlockUntilMs: null,
        lastUnlockScope: null,
        lastUnlockedChannelId: null,
        ratingUnlockUntilMs: null,
        pcUnlockUntilMs: null,
        pcUnlockSessionActive: false,
      }));
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

    isRatingUnlocked: () => {
      const s = get();
      const now = Date.now();
      return !!(s.ratingUnlockUntilMs && now < s.ratingUnlockUntilMs);
    },

    unlockRatingWithPin: async (pin, { ttlMs = DEFAULT_RATING_UNLOCK_TTL_MS } = {}) => {
      const ok = await get().verifyPin(pin);
      if (!ok) return false;
      const until = Date.now() + (Number.isFinite(Number(ttlMs)) ? Number(ttlMs) : DEFAULT_RATING_UNLOCK_TTL_MS);
      set((s) => ({ ...s, ratingUnlockUntilMs: until }));
      queueMicrotask(() => persist());
      return true;
    },

    // --- Unlock por metadata parentalControl:true ---
    isParentalControlUnlocked: () => {
      const s = get();
      if (s.pcUnlockSessionActive === true) return true;
      const now = Date.now();
      return !!(s.pcUnlockUntilMs && now < s.pcUnlockUntilMs);
    },

    invalidateParentalControlUnlock: () => {
      set((s) => {
        if (!s.pcUnlockUntilMs && !s.pcUnlockSessionActive) return s;
        return { ...s, pcUnlockUntilMs: null, pcUnlockSessionActive: false };
      });
    },

    unlockParentalControlWithPin: async (
      pin,
      { mode = 'ttl', ttlMs = DEFAULT_PARENTALCONTROL_MULTI_TTL_MS } = {}
    ) => {
      const ok = await get().verifyPin(pin);
      if (!ok) return false;

      if (mode === 'session') {
        set((s) => ({ ...s, pcUnlockSessionActive: true, pcUnlockUntilMs: null }));
        return true;
      }

      const until =
        Date.now() +
        (Number.isFinite(Number(ttlMs)) ? Number(ttlMs) : DEFAULT_PARENTALCONTROL_MULTI_TTL_MS);
      set((s) => ({ ...s, pcUnlockUntilMs: until, pcUnlockSessionActive: false }));
      return true;
    },
  };
});

export default useParentalStore;

