import { create } from 'zustand';
import { getActiveBrandConfig } from '../config/brandConfig';

const STORAGE_VERSION = 1;

function getStorageKey() {
  const brand = getActiveBrandConfig()?.brand || getActiveBrandConfig()?.id || '';
  const suffix = String(brand || 'default');
  return `epg.reminders.v${STORAGE_VERSION}.${suffix}`;
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
  reminders: [],
  dismissedUntilById: {}, // { [id]: untilMs }
};

function normalizeId(r) {
  return String(r?.id ?? r?.eventId ?? r?.event_id ?? '');
}

export const useEpgReminderStore = create((set, get) => {
  const hydrate = () => {
    const data = safeRead();
    if (!data || data.version !== STORAGE_VERSION) return;
    set((s) => ({
      ...s,
      reminders: Array.isArray(data.reminders) ? data.reminders : [],
      dismissedUntilById: data.dismissedUntilById && typeof data.dismissedUntilById === 'object'
        ? data.dismissedUntilById
        : {},
    }));
  };

  const persist = () => {
    const s = get();
    safeWrite({
      version: STORAGE_VERSION,
      reminders: Array.isArray(s.reminders) ? s.reminders : [],
      dismissedUntilById: s.dismissedUntilById || {},
    });
  };

  queueMicrotask(() => hydrate());

  return {
    ...initial,
    hydrate,
    persist,

    addReminder: (reminder) => {
      if (!reminder) return;
      const id = normalizeId(reminder);
      if (!id) return;
      set((s) => {
        const prev = Array.isArray(s.reminders) ? s.reminders : [];
        const next = prev.filter((r) => normalizeId(r) !== id);
        next.push({ ...reminder, id });
        return { ...s, reminders: next };
      });
      queueMicrotask(() => persist());
    },

    removeReminder: (id) => {
      const rid = String(id ?? '').trim();
      if (!rid) return;
      set((s) => ({
        ...s,
        reminders: (s.reminders || []).filter((r) => normalizeId(r) !== rid),
      }));
      queueMicrotask(() => persist());
    },

    hasReminder: (id) => {
      const rid = String(id ?? '').trim();
      if (!rid) return false;
      return (get().reminders || []).some((r) => normalizeId(r) === rid);
    },

    dismissReminderUntil: (id, untilMs) => {
      const rid = String(id ?? '').trim();
      if (!rid) return;
      const until = Number(untilMs);
      if (!Number.isFinite(until)) return;
      set((s) => ({
        ...s,
        dismissedUntilById: { ...(s.dismissedUntilById || {}), [rid]: until },
      }));
      queueMicrotask(() => persist());
    },

    isDismissed: (id, nowMs = Date.now()) => {
      const rid = String(id ?? '').trim();
      if (!rid) return false;
      const until = Number(get().dismissedUntilById?.[rid] ?? 0);
      return Number.isFinite(until) && nowMs < until;
    },
  };
});

export default useEpgReminderStore;

