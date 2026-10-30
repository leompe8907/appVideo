/**
 * Utilidades de navegación
 */

import { getActiveLicense } from './userSession';
import { storageGet } from '../platform/storage';

/**
 * Obtiene la ruta inicial después del login según la configuración del brand
 * @param {Object} brandConfig - Configuración del brand actual
 * @returns {string} Ruta inicial ('/profile' o '/smartcard')
 */
export function getInitialRoute(brandConfig) {
  if (brandConfig?.features?.profiles) {
    return '/profile';
  }
  return '/smartcard';
}

/**
 * De dónde salen los perfiles (`features.profilesSource`): `'panaccess'` (por
 * defecto, los de PanAccess) o `'externo'` (los del backend externo de la
 * marca, hoy solo Wind: `/api/v1/profiles/`). Con `'externo'` la licencia la
 * elige el perfil (ver `externalProfileSession.js`).
 */
export const PROFILE_SOURCE_EXTERNAL = 'externo';

export function usesExternalProfiles(brandConfig) {
  return (
    brandConfig?.features?.profiles === true &&
    brandConfig?.features?.profilesSource === PROFILE_SOURCE_EXTERNAL
  );
}

/**
 * Ruta post-login/splash: solo va a home si hay licencia activa (verificada con contenido en loginFlow).
 * Con perfiles externos va siempre a '/profile', aunque no haya licencia: la elige el perfil.
 * @param {Object} brandConfig
 * @returns {string} '/profile' | '/home/inicio' | '/smartcard'
 */
export function resolvePostLoginRoute(brandConfig) {
  if (usesExternalProfiles(brandConfig)) return '/profile';

  const active = getActiveLicense();
  const licenseKey = active?.licenseKey ? String(active.licenseKey).trim() : '';
  if (!licenseKey) return '/smartcard';

  if (brandConfig?.features?.profiles) {
    return getInitialRoute(brandConfig);
  }

  try {
    const savedRoute = storageGet('app_last_active_route');
    if (savedRoute && (savedRoute.startsWith('/home') || savedRoute.startsWith('/smartcard'))) {
      return savedRoute;
    }
  } catch {
    // fallback
  }

  return '/home/inicio';
}
