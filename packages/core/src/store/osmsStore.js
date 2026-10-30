import { create } from 'zustand';
import {
  fetchOsms,
  getLastKnownOsmId,
  getNewestOsmItem,
  getNewestOsmTime,
  mergeOsmsItems,
} from '../services/osmsService';
import { getBrandItem, resolveBrandId, setBrandItem } from '../utils/brandStorage';

const LS_LAST_COUNT = 'osms.lastCount';
const LS_LAST_NEWEST_TIME = 'osms.lastNewestTime';
const LS_LAST_SEEN_COUNT = 'osms.lastSeenCount';
const LS_LAST_SEEN_NEWEST_TIME = 'osms.lastSeenNewestTime';

function safeGet(key) {
  try {
    return getBrandItem(resolveBrandId(), key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    setBrandItem(resolveBrandId(), key, value);
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

function pickNewestAmong(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return getNewestOsmItem(items);
}

const initialState = {
  status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  items: [],
  error: null,
  lastLoadedAt: null,
  hasNew: false,
  unreadCount: 0,
  currentCount: 0,
  pendingNotification: null,
};

export const useOsmsStore = create((set, get) => ({
  ...initialState,

  /**
   * Carga o sondeo de OSMS.
   * @param {Object} options
   * @param {number} [options.days=30]
   * @param {'auto'|'full'|'incremental'} [options.mode='auto']
   */
  pollOsms: async (options = {}) => {
    const { days = 30, mode = 'auto' } = options;
    const state = get();
    if (state.status === 'loading') return;

    const hasCached = (state.items?.length ?? 0) > 0;
    let fetchMode = mode;
    if (mode === 'auto') {
      fetchMode = hasCached ? 'incremental' : 'full';
    }

    const lastKnownId = fetchMode === 'full' ? -1 : getLastKnownOsmId(state.items);

    if (!hasCached) {
      set((s) => ({ ...s, status: 'loading', error: null }));
    }

    try {
      const incoming = await fetchOsms({ lastKnownId, days, enableRetry: true });
      const prevIds = new Set((state.items || []).map((m) => String(m.id)));
      const newlyArrived = (incoming || []).filter((m) => !prevIds.has(String(m.id)));

      let items;
      if (fetchMode === 'full') {
        items = incoming;
      } else if (!hasCached) {
        items = incoming;
      } else {
        items = mergeOsmsItems(state.items, incoming);
      }

      const { currentCount, newestMs, hasNew, unreadCount } = computeUnread(items);

      safeSet(LS_LAST_COUNT, String(currentCount));
      safeSet(LS_LAST_NEWEST_TIME, newestMs != null ? String(newestMs) : '');

      const notifyItem =
        fetchMode === 'incremental' && newlyArrived.length > 0
          ? pickNewestAmong(newlyArrived)
          : null;

      set((s) => ({
        ...s,
        status: 'ready',
        items,
        error: null,
        lastLoadedAt: Date.now(),
        hasNew,
        unreadCount,
        currentCount,
        pendingNotification: notifyItem ?? s.pendingNotification,
      }));
    } catch (err) {
      const message = err?.message || err?.errorInfo?.userMessage || 'Error al obtener OSMS';
      set((s) => {
        const hasItems = (s.items?.length ?? 0) > 0;
        const nextStatus = hasItems ? 'ready' : 'error';
        return { ...s, status: nextStatus, error: hasItems ? null : message };
      });
    }
  },

  refreshOsms: async (options = {}) => {
    const { force = false, days = 30 } = options;
    return get().pollOsms({ days, mode: force ? 'full' : 'auto' });
  },

  dismissOsmsNotification: () => {
    set((s) => ({ ...s, pendingNotification: null }));
  },

  markAsSeen: () => {
    const items = get().items || [];
    const newest = getNewestOsmTime(items);
    const newestMs = newest ? newest.getTime() : null;
    const currentCount = Array.isArray(items) ? items.length : 0;

    safeSet(LS_LAST_SEEN_COUNT, String(currentCount));
    safeSet(LS_LAST_SEEN_NEWEST_TIME, newestMs != null ? String(newestMs) : '');

    set((s) => ({
      ...s,
      hasNew: false,
      unreadCount: 0,
      currentCount,
      pendingNotification: null,
    }));
  },

  resetOsms: () => {
    set(() => ({ ...initialState }));
  },
}));

export default useOsmsStore;
