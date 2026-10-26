/**
 * Decisiones de la pantalla "¿Quién está viendo?" con perfiles externos
 * (`features.profilesSource: 'externo'`), compartidas por la web
 * (ExternalProfilePage) y Vega (ProfileScreen). La lógica que habla con el
 * backend está en `services/externalProfileSession.js`.
 */
import { usesExternalProfiles } from './navigation';

export const HOME_ROUTE = '/home/inicio';

/**
 * Avatares por id (los ids 87-95 viajan al backend: no cambiarlos). La web los
 * sirve desde `public/<marca>/`; Vega los empaqueta en `assets/brand/`.
 */
export const PROFILE_AVATAR_FILES = Object.freeze({
  87: 'avatars/1.png',
  88: 'avatars/2.png',
  89: 'avatars/3.png',
  90: 'avatars/4.png',
  91: 'avatars/5.png',
  92: 'avatars/6.png',
  93: 'avatars/7.png',
  94: 'avatars/8.png',
  95: 'avatars/9.png',
});

/** Edad máxima de un perfil externo: escala de Brasil. null = sin límite. */
export const MAX_AGE_OPTIONS = [null, 0, 10, 12, 14, 16, 18];

export function maxAgeLabel(t, value) {
  if (value == null) return t('profile.maxAgeNone', { defaultValue: 'Sin límite' });
  if (value === 0) return 'L';
  return String(value);
}

/**
 * Perfil al que se entra solo al abrir la app: solo si la cuenta tiene UN perfil
 * y no tiene PIN. Con varios perfiles se muestra siempre "¿Quién está viendo?",
 * como Netflix, Disney+, Max o Prime Video (no se entra solo al último usado:
 * así nadie queda en el perfil de otro). Ver docs/PERFILES_EXTERNOS.md.
 */
export function pickAutoEnterProfile(profiles) {
  const list = Array.isArray(profiles) ? profiles : [];
  const only = list.length === 1 ? list[0] : null;
  return only && !only.hasPin ? only : null;
}

/** Sin perfiles (cuenta sin perfiles o sin sesión con el backend): lo de antes. */
export function routeWithoutProfiles(hasActiveLicense) {
  return hasActiveLicense ? HOME_ROUTE : '/smartcard';
}

/**
 * Qué hacer con el resultado de `enterProfile`.
 * @returns {{route: string, keepProfileWithoutLicense?: boolean} | {inUse: Object}}
 *   `keepProfileWithoutLicense`: la cuenta no tiene licencias sincronizadas; se
 *   guarda el perfil y se elige la tarjeta como siempre.
 */
export function nextStepAfterEnter(result) {
  if (result?.status === 'ok') return { route: HOME_ROUTE };
  if (result?.status === 'in_use') return { inUse: result.selection };
  return { route: '/smartcard', keepProfileWithoutLicense: true };
}

/**
 * En qué dispositivo está la tarjeta del perfil (para "en uso en ..."): con reservas, el de la
 * propia (`inUse`); si no, el que el backend creía activo con el perfil.
 */
export function inUseDeviceModel(selection) {
  const list = Array.isArray(selection?.inUse) ? selection.inUse : [];
  const entry = list.find((e) => e.own) || list[0];
  return entry?.device?.deviceModel || selection?.activeElsewhere?.[0]?.deviceModel || null;
}

/** Clave del aviso cuando el backend le quita la tarjeta a este dispositivo (`profileLeaseKeeper.js`). */
export function leaseLostMessageKey(reason) {
  if (reason === 'taken_over') return 'profile.leaseTakenOver';
  if (reason === 'profile_deleted') return 'profile.leaseProfileDeleted';
  return 'profile.leaseLost';
}

/** Clave del mensaje para un error al entrar a un perfil. */
export function profileErrorMessageKey(error) {
  return error?.code === 'pin_locked' ? 'profile.pinLocked' : 'profile.errorActivate';
}

// --- Formulario de crear / editar perfil ---

const KIDS_DEFAULT_MAX_AGE = 10;
const PIN_RE = /^\d{4,6}$/;

/** Clave del error de validación, o null si el formulario está bien. El PIN es opcional. */
export function validateProfileForm({ name, newPin }) {
  if (!String(name || '').trim()) return 'profile.createNameRequired';
  if (newPin && !PIN_RE.test(newPin)) return 'profile.pinFormatError';
  return null;
}

/** Mismo default que el backend: un perfil infantil sin edad queda en 10. */
export function maxAgeAfterKidsToggle(nextIsKids, maxAge) {
  return nextIsKids && maxAge == null ? KIDS_DEFAULT_MAX_AGE : maxAge;
}

/**
 * Lo que se manda al backend: para crear (`createProfile`, con `pin` si se
 * escribió) o los cambios para editar (`updateProfile`: `newPin` nuevo, `null`
 * para quitarlo, o sin la clave si no cambia).
 */
export function buildProfilePayload({ mode, name, avatarId, isKids, maxAge, newPin, removePin }) {
  const base = { name: String(name || '').trim(), avatarId, isKids, maxAge };
  if (mode === 'edit') {
    if (removePin) return { ...base, newPin: null };
    return newPin ? { ...base, newPin } : base;
  }
  return newPin ? { ...base, pin: newPin } : base;
}

const FORM_ERROR_KEYS = {
  name_taken: 'profile.errorNameTaken',
  no_free_license: 'profile.errorNoFreeLicense',
  invalid_pin_format: 'profile.pinFormatError',
  owner_profile: 'profile.errorOwner',
};

/** Clave del mensaje para un error del backend al guardar o borrar, o null (usar el genérico). */
export function profileFormErrorKey(error) {
  return FORM_ERROR_KEYS[error?.code] || null;
}

/**
 * "Cambiar perfil" en Mi Cuenta: con perfiles externos, sólo si la cuenta los
 * tiene (hay perfil activo); si no, /profile volvería al inicio.
 */
export function canChangeProfile(brandConfig, activeProfileId) {
  if (brandConfig?.features?.profiles !== true) return false;
  return !usesExternalProfiles(brandConfig) || activeProfileId != null;
}
