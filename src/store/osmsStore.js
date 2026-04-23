import { create } from 'zustand';
import { fetchOsms, getNewestOsmTime } from '../services/osmsService';

const LS_LAST_COUNT = 'osms.lastCount';
const LS_LAST_NEWEST_TIME = 'osms.lastNewestTime';
const LS_LAST_SEEN_COUNT = 'osms.lastSeenCount';
const LS_LAST_SEEN_NEWEST_TIME = 'osms.lastSeenNewestTime';

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // noop
  }
}

function toMs(value) {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : new Date(value).getTime();
  return Number.isFinite(n) ? n : null;
}

function readSeenState() {
  const lastSeenCount = Number(safeGet(LS_LAST_SEEN_COUNT) || 0) || 0;
  const lastSeenNewestMs = toMs(safeGet(LS_LAST_SEEN_NEWEST_TIME));
  return { lastSeenCount, lastSeenNewestMs };
}

function computeUnread(items) {
  const { lastSeenCount, lastSeenNewestMs } = readSeenState();
  const currentCount = Array.isArray(items) ? items.length : 0;
  const newest = getNewestOsmTime(items);
  const newestMs = newest ? newest.getTime() : null;

  let hasNew = false;
  if (currentCount > 0) {
    if (!lastSeenNewestMs && lastSeenCount === 0) {
      hasNew = true;
    } else if (currentCount > lastSeenCount) {
      hasNew = true;
    } else if (currentCount === lastSeenCount && lastSeenNewestMs && newestMs) {
      hasNew = newestMs > lastSeenNewestMs;
    }
  }

  const unreadCount = hasNew ? Math.max(1, currentCount - lastSeenCount) : 0;
  return { currentCount, newestMs, hasNew, unreadCount };
}

const initialState = {
  status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  items: [],
  error: null,
  lastLoadedAt: null,
  hasNew: false,
  unreadCount: 0,
  currentCount: 0,
};

export const useOsmsStore = create((set, get) => ({
  ...initialState,

  refreshOsms: async (options = {}) => {
    const { force = false, lastKnownId = -1, days = 30 } = options;
    const state = get();
    if (state.status === 'loading') return;
    if (!force && state.status === 'ready' && (state.items?.length ?? 0) > 0) {
      return;
    }

    set((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const items = await fetchOsms({ lastKnownId, days, enableRetry: true });
      const { currentCount, newestMs, hasNew, unreadCount } = computeUnread(items);

      safeSet(LS_LAST_COUNT, String(currentCount));
      safeSet(LS_LAST_NEWEST_TIME, newestMs != null ? String(newestMs) : '');

      set((s) => ({
        ...s,
        status: 'ready',
        items,
        error: null,
        lastLoadedAt: Date.now(),
        hasNew,
        unreadCount,
        currentCount,
      }));
    } catch (err) {
      const message = err?.message || err?.errorInfo?.userMessage || 'Error al obtener OSMS';
      // si ya hay data, mantenerla “ready”
      set((s) => {
        const hasCached = (s.items?.length ?? 0) > 0;
        const nextStatus = hasCached ? 'ready' : 'error';
        return { ...s, status: nextStatus, error: hasCached ? null : message };
      });
    }
  },

  markAsSeen: () => {
    const items = get().items || [];
    const newest = getNewestOsmTime(items);
    const newestMs = newest ? newest.getTime() : null;
    const currentCount = Array.isArray(items) ? items.length : 0;

    safeSet(LS_LAST_SEEN_COUNT, String(currentCount));
    safeSet(LS_LAST_SEEN_NEWEST_TIME, newestMs != null ? String(newestMs) : '');

    set((s) => ({ ...s, hasNew: false, unreadCount: 0, currentCount }));
  },

  resetOsms: () => {
    set(() => ({ ...initialState }));
  },
}));

export default useOsmsStore;

