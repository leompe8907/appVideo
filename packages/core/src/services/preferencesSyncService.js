/**
 * Sincronización entre dispositivos de control parental + favoritos, vía
 * el mismo backend/JWT de "dispositivos vinculados" (ver
 * `deviceAuthService.js`). Mismo alcance que el resto de ese sistema:
 * opt-in por brand (`login.deviceSession.enabled`), hoy solo Wind -- ver,
 * en el repo de Back-Wind-V2,
 * docs/SINCRONIZACION_PREFERENCIAS_2026-08-31.md.
 *
 * Nunca lanza hacia el caller: un fallo de red o la falta de sesión de
 * dispositivo no deben romper el uso local de control parental/favoritos
 * (mismo patrón que `mostWatchedChannelsService.js`) -- `localStorage`
 * sigue siendo la fuente de verdad inmediata en el dispositivo; esto solo
 * mantiene a los demás dispositivos al día, en la medida de lo posible.
 *
 * `profileKey`: perfil real de PanAccess (`useActiveProfileStore`) si hay
 * uno elegido, o `DEFAULT_PROFILE_KEY` si la cuenta no tiene perfiles o
 * todavía no se eligió ninguno -- mismo sentinel que usa el backend
 * (`SubscriberPreferences.DEFAULT_PROFILE_KEY`).
 */
import { authorizedDeviceRequest, hasDeviceSessionAuth } from './deviceAuthService';
import { getActiveBrandConfig } from '../config/brandConfig';
import { resolveBrandId } from '../utils/brandStorage';
import { useActiveProfileStore } from '../store/activeProfileStore';

export const DEFAULT_PROFILE_KEY = 'default';

export function resolveProfileKey() {
  const id = useActiveProfileStore.getState()?.id;
  const trimmed = id != null ? String(id).trim() : '';
  return trimmed || DEFAULT_PROFILE_KEY;
}

function devWarn(label, error) {
  if (import.meta.env.DEV) {
    console.warn(`[preferencesSyncService] ${label}:`, error?.message || error);
  }
}

/**
 * Trae la config guardada en el backend para el perfil actual.
 * @returns {Promise<{parental: Object|null, favorites: Array<string>}|null>}
 *   `null` si no hay sesión de dispositivo activa o si la llamada falla.
 */
export async function pullPreferences() {
  const brand = resolveBrandId();
  if (!hasDeviceSessionAuth(brand)) return null;

  try {
    const profileKey = resolveProfileKey();
    const data = await authorizedDeviceRequest(
      getActiveBrandConfig(),
      brand,
      `/api/v1/preferences/?profileKey=${encodeURIComponent(profileKey)}`
    );
    if (!data || data.success !== true) return null;
    return data;
  } catch (e) {
    devWarn('pull falló', e);
    return null;
  }
}

/**
 * Empuja un cambio parcial (`{parental}` y/o `{favorites}`) al backend.
 * Fire-and-forget: nunca lanza, no bloquea al caller ni el guardado local
 * que ya ocurrió antes de llamar a esto.
 */
export async function pushPreferences(partial) {
  const brand = resolveBrandId();
  if (!hasDeviceSessionAuth(brand)) return;

  try {
    await authorizedDeviceRequest(getActiveBrandConfig(), brand, '/api/v1/preferences/', {
      method: 'PUT',
      body: JSON.stringify({ profileKey: resolveProfileKey(), ...partial }),
    });
  } catch (e) {
    devWarn('push falló', e);
  }
}

/**
 * Pull + aplicar a los dos módulos locales (control parental, favoritos).
 * Pensada para llamarse una vez al reconectar/reabrir la app (ver
 * `useAppLifecycle.js`) -- imports dinámicos a propósito, para no crear un
 * ciclo estático con `parentalStore.js`/`userPreferences.js` (ambos
 * importan este archivo para el lado del push).
 *
 * @returns {Promise<boolean>} `true` si se aplicó algo, `false` si no había nada que sincronizar.
 */
export async function syncPreferencesFromBackend() {
  const data = await pullPreferences();
  if (!data) return false;

  try {
    const { useParentalStore } = await import('../store/parentalStore');
    useParentalStore.getState().hydrateFromRemote(data.parental);
  } catch (e) {
    devWarn('aplicar control parental remoto falló', e);
  }

  try {
    if (Array.isArray(data.favorites)) {
      const { setFavorites } = await import('../utils/userPreferences');
      const numeric = data.favorites.map(Number).filter((n) => Number.isFinite(n));
      setFavorites(resolveBrandId(), numeric, { skipSync: true });
    }
  } catch (e) {
    devWarn('aplicar favoritos remotos falló', e);
  }

  return true;
}
