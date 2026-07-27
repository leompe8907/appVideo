/**
 * Almacenamiento local namespaced por marca: `{brandId}.{key}`.
 * Al cerrar sesión se eliminan todas las claves con ese prefijo.
 */

import { getActiveBrandConfig } from '../config/brandConfig';

const MIGRATION_FLAG = '__migrated_v2';

/** Claves globales del dispositivo/app (no se borran al logout). */
export const GLOBAL_STORAGE_KEYS = new Set([
  'brand',
  'device',
  'player.engine',
  'player.nativeAdaptersEnabled',
  'player.debug',
  'udid_debug',
  'app_language',
]);

const LEGACY_SESSION_KEYS = [
  'sessionId',
  'username',
  'password',
  'udid',
  'clientConfig',
  'licenses',
  'license',
  'licensePin',
];

const LEGACY_PREF_SUFFIXES = [
  'USER_FAVORITES_KEY',
  'LOCKED_CHANNELS_KEY',
  'CHANNEL_DATA_KEY',
  'videoHistory',
  'playerAudioLang',
  'playerSubtitleLang',
];

const LEGACY_OSMS_KEYS = [
  'osms.lastCount',
  'osms.lastNewestTime',
  'osms.lastSeenCount',
  'osms.lastSeenNewestTime',
];

export function resolveBrandId(brandId) {
  if (brandId != null && String(brandId).trim() !== '') {
    return String(brandId).trim();
  }
  const config = getActiveBrandConfig();
  return String(config?.brand || config?.id || 'default').trim() || 'default';
}

export function brandStorageKey(brandId, key) {
  return `${resolveBrandId(brandId)}.${String(key).trim()}`;
}

function safeLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function getBrandItem(brandId, key) {
  const storage = safeLocalStorage();
  if (!storage) return null;
  migrateLegacyBrandStorage(brandId);
  return storage.getItem(brandStorageKey(brandId, key));
}

export function setBrandItem(brandId, key, value) {
  const storage = safeLocalStorage();
  if (!storage) return;
  migrateLegacyBrandStorage(brandId);
  storage.setItem(brandStorageKey(brandId, key), String(value));
}

export function removeBrandItem(brandId, key) {
  const storage = safeLocalStorage();
  if (!storage) return;
  storage.removeItem(brandStorageKey(brandId, key));
}

/**
 * Elimina todas las entradas de localStorage del cliente/marca indicada.
 */
export function clearBrandStorage(brandId) {
  const storage = safeLocalStorage();
  if (!storage) return;
  const bId = resolveBrandId(brandId);
  const prefix = `${bId}.`;
  const toRemove = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && (key.startsWith(prefix) || key === `app_epg_cache_${bId}`)) {
      toRemove.push(key);
    }
  }
  toRemove.forEach((key) => storage.removeItem(key));
}

function copyLegacyValue(storage, fromKey, brandId, toKey) {
  const value = storage.getItem(fromKey);
  if (value == null || value === '') return;
  const target = brandStorageKey(brandId, toKey);
  if (storage.getItem(target) == null) {
    storage.setItem(target, value);
  }
  storage.removeItem(fromKey);
}

/**
 * Migra claves legacy (globales o prefijos antiguos) al esquema `{brand}.{key}`.
 */
export function migrateLegacyBrandStorage(brandId) {
  const storage = safeLocalStorage();
  if (!storage) return;
  const brand = resolveBrandId(brandId);
  if (storage.getItem(brandStorageKey(brand, MIGRATION_FLAG)) === '1') return;

  const activeBrand = storage.getItem('brand') || brand;

  if (activeBrand === brand) {
    LEGACY_SESSION_KEYS.forEach((key) => {
      copyLegacyValue(storage, key, brand, key);
    });

    LEGACY_OSMS_KEYS.forEach((key) => {
      const shortKey = key.replace(/^osms\./, 'osms.');
      copyLegacyValue(storage, key, brand, shortKey);
    });

    copyLegacyValue(storage, 'device_udid', brand, 'udid');
    copyLegacyValue(storage, 'external_login_udid', brand, 'external_login_udid');
  }

  LEGACY_PREF_SUFFIXES.forEach((suffix) => {
    const legacyKey = `pref_${brand}_${suffix}`;
    copyLegacyValue(storage, legacyKey, brand, suffix);
  });

  const legacyParental = `parental.v1.${brand}`;
  copyLegacyValue(storage, legacyParental, brand, 'parental.v1');

  const legacyEpg = `epg.reminders.v1.${brand}`;
  copyLegacyValue(storage, legacyEpg, brand, 'epg.reminders.v1');

  storage.setItem(brandStorageKey(brand, MIGRATION_FLAG), '1');
}

/**
 * Limpia claves globales de sesión que pudieran quedar tras migraciones antiguas.
 */
export function clearLegacyGlobalSessionKeys() {
  const storage = safeLocalStorage();
  if (!storage) return;
  LEGACY_SESSION_KEYS.forEach((key) => storage.removeItem(key));
  storage.removeItem('device_udid');
  storage.removeItem('external_login_udid');
  LEGACY_OSMS_KEYS.forEach((key) => storage.removeItem(key));
}
