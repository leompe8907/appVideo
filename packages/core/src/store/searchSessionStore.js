import { create } from 'zustand';

/** TTL de sesión en RAM (1 h). */
export const SEARCH_SESSION_TTL_MS = 60 * 60 * 1000;

const initialState = {
  brandId: null,
  query: '',
  activeTab: 'all',
  focusedResultKey: null,
  savedAt: null,
  catalogSnapshot: null,
};

function catalogChanged(prev, next) {
  if (!prev || !next) return false;
  return (
    prev.epgLastLoadedAt !== next.epgLastLoadedAt ||
    prev.vodLastLoadedAt !== next.vodLastLoadedAt ||
    prev.catchupLastLoadedAt !== next.catchupLastLoadedAt
  );
}

/** Clave estable para restaurar foco TV: `type:id`. */
export function buildSearchResultKey(item) {
  if (!item || !item.type) return '';
  const id = item.id ?? item.catchupId ?? item.name ?? '';
  return `${item.type}:${String(id)}`;
}

export const useSearchSessionStore = create((set, get) => ({
  ...initialState,

  setQuery: (query) => {
    const next = String(query ?? '');
    set({
      query: next,
      savedAt: Date.now(),
      focusedResultKey: next.trim() ? get().focusedResultKey : null,
    });
  },

  setActiveTab: (activeTab) => {
    set({ activeTab: activeTab || 'all', savedAt: Date.now() });
  },

  setFocusedResultKey: (focusedResultKey) => {
    if (!focusedResultKey) {
      set({ focusedResultKey: null });
      return;
    }
    set({ focusedResultKey, savedAt: Date.now() });
  },

  /** Asocia la sesión a la marca activa; resetea si cambió. */
  bindBrand: (brandId) => {
    const id = brandId ? String(brandId) : null;
    if (!id) return;
    const current = get().brandId;
    if (current && current !== id) {
      set({ ...initialState, brandId: id });
      return;
    }
    if (!current) {
      set({ brandId: id });
    }
  },

  /** Invalida foco si el catálogo preload se recargó (query se conserva). */
  touchCatalogSnapshot: (snapshot) => {
    if (!snapshot) return;
    const prev = get().catalogSnapshot;
    if (prev && catalogChanged(prev, snapshot)) {
      set({
        catalogSnapshot: snapshot,
        focusedResultKey: null,
        savedAt: Date.now(),
      });
      return;
    }
    if (!prev) {
      set({ catalogSnapshot: snapshot });
    }
  },

  isExpired: () => {
    const { savedAt } = get();
    if (!savedAt) return false;
    return Date.now() - savedAt > SEARCH_SESSION_TTL_MS;
  },

  resetOnLogout: () => set({ ...initialState }),

  reset: () => set({ ...initialState }),
}));

export default useSearchSessionStore;
