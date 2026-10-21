/**
 * Decisiones de la pantalla "¿Quién está viendo?" con perfiles externos
 * (`features.profilesSource: 'externo'`), compartidas por la web
 * (ExternalProfilePage) y Vega (ProfileScreen). La lógica que habla con el
 * backend está en `services/externalProfileSession.js`.
 */

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
 * Perfil al que se entra solo al abrir la app: el último usado o, si la cuenta
 * tiene uno solo, ese. Nunca uno con PIN (hay que pedirlo).
 */
export function pickAutoEnterProfile(profiles, rememberedId) {
  const list = Array.isArray(profiles) ? profiles : [];
  const remembered = rememberedId != null ? list.find((p) => p.id === rememberedId) : null;
  const target = remembered || (list.length === 1 ? list[0] : null);
  return target && !target.hasPin ? target : null;
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

/** Clave del mensaje para un error al entrar a un perfil. */
export function profileErrorMessageKey(error) {
  return error?.code === 'pin_locked' ? 'profile.pinLocked' : 'profile.errorActivate';
}
