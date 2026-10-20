/**
 * Perfil activo de la sesión (id, nombre, avatar). Se persiste scoped por
 * marca (mismo patrón que `parentalStore.js`) para que el ícono de "Mi
 * cuenta" del sidebar pueda mostrar el avatar del perfil elegido en
 * `ProfilePage.jsx` sin depender de otro round-trip a la API -- se guarda
 * acá en el momento exacto en que el usuario selecciona un perfil.
 *
 * Con perfiles externos (`features.profilesSource: 'externo'`, hoy Wind) también guarda la
 * política del perfil (`maxAge`, `isKids`, `hasPin`) y la licencia que se
 * consiguió al entrar (`licenseSn`, `loan`: si es un préstamo). Ver
 * `services/windProfileSession.js`.
 *
 * `clearBrandStorage` (ver `utils/brandStorage.js`) ya borra esta clave
 * automáticamente en todo logout (cae bajo el prefijo `{brand}.`, igual que
 * `parental.v1`) -- no hace falta lógica de limpieza de storage acá, solo
 * `resetOnLogout()` para el estado en memoria (ver `utils/brandLogout.js`).
 */
import { create } from 'zustand';
import { getBrandItem, resolveBrandId, setBrandItem } from '../utils/brandStorage';
import { onStorageBackendChange } from '../platform/storage';

const STORAGE_VERSION = 1;
const ACTIVE_PROFILE_STORAGE_KEY = `activeProfile.v${STORAGE_VERSION}`;

const initial = {
  id: null,
  name: '',
  imageId: null,
  source: null, // 'externo' | null (perfil de PanAccess)
  maxAge: null,
  isKids: false,
  hasPin: false,
  licenseSn: null,
  loan: false,
};

function finiteOrNull(value) {
  return value != null && Number.isFinite(Number(value)) ? Number(value) : null;
}

function normalize(data = {}) {
  return {
    id: data.id ?? null,
    name: typeof data.name === 'string' ? data.name : '',
    imageId: finiteOrNull(data.imageId),
    source: data.source === 'externo' ? 'externo' : null,
    maxAge: finiteOrNull(data.maxAge),
    isKids: data.isKids === true,
    hasPin: data.hasPin === true,
    licenseSn: typeof data.licenseSn === 'string' && data.licenseSn ? data.licenseSn : null,
    loan: data.loan === true,
  };
}

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
    set(normalize(data));
  };

  // Hidratar best-effort al crear el store (no depende de React)
  queueMicrotask(() => hydrate());
  // Re-hidratar si el almacenamiento se carga después (Vega: AsyncStorage).
  onStorageBackendChange(() => hydrate());

  return {
    ...initial,

    hydrate,

    resetOnLogout: () => {
      set({ ...initial });
    },

    setActiveProfile: (profile = {}) => {
      const next = normalize(profile);
      set(next);
      safeWrite({ version: STORAGE_VERSION, ...next });
    },

    clearActiveProfile: () => {
      set({ ...initial });
      safeWrite({ version: STORAGE_VERSION, ...initial });
    },
  };
});

export default useActiveProfileStore;
