/**
 * Perfil activo de la sesión (id, nombre, avatar). Se persiste scoped por
 * marca (mismo patrón que `parentalStore.js`) para que el ícono de "Mi
 * cuenta" del sidebar pueda mostrar el avatar del perfil elegido en
 * `ProfilePage.jsx` sin depender de otro round-trip a la API -- se guarda
 * acá en el momento exacto en que el usuario selecciona un perfil.
 *
 * `clearBrandStorage` (ver `utils/brandStorage.js`) ya borra esta clave
 * automáticamente en todo logout (cae bajo el prefijo `{brand}.`, igual que
 * `parental.v1`) -- no hace falta lógica de limpieza de storage acá, solo
 * `resetOnLogout()` para el estado en memoria (ver `utils/brandLogout.js`).
 */
import { create } from 'zustand';
import { getBrandItem, resolveBrandId, setBrandItem } from '../utils/brandStorage';

const STORAGE_VERSION = 1;
const ACTIVE_PROFILE_STORAGE_KEY = `activeProfile.v${STORAGE_VERSION}`;

const initial = {
  id: null,
  name: '',
  imageId: null,
};

function safeRead() {
  try {
    const raw = getBrandItem(resolveBrandId(), ACTIVE_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeWrite(payload) {
  try {
    setBrandItem(resolveBrandId(), ACTIVE_PROFILE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // noop
  }
}

export const useActiveProfileStore = create((set) => {
  const hydrate = () => {
    const data = safeRead();
    if (!data || data.version !== STORAGE_VERSION) {
      set({ ...initial });
      return;
    }
    set({
      id: data.id ?? null,
      name: typeof data.name === 'string' ? data.name : '',
      imageId: Number.isFinite(Number(data.imageId)) ? Number(data.imageId) : null,
    });
  };

  // Hidratar best-effort al crear el store (no depende de React)
  queueMicrotask(() => hydrate());

  return {
    ...initial,

    hydrate,

    resetOnLogout: () => {
      set({ ...initial });
    },

    setActiveProfile: ({ id, name, imageId } = {}) => {
      const next = {
        id: id ?? null,
        name: typeof name === 'string' ? name : '',
        imageId: Number.isFinite(Number(imageId)) ? Number(imageId) : null,
      };
      set(next);
      safeWrite({ version: STORAGE_VERSION, ...next });
    },
  };
});

export default useActiveProfileStore;
