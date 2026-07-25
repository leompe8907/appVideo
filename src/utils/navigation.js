/**
 * Utilidades de navegación
 */

import { getActiveLicense } from './userSession';

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
 * Ruta post-login/splash: solo va a home si hay licencia activa (verificada con contenido en loginFlow).
 * @param {Object} brandConfig
 * @returns {string} '/profile' | '/home/inicio' | '/smartcard'
 */
export function resolvePostLoginRoute(brandConfig) {
  const active = getActiveLicense();
  const licenseKey = active?.licenseKey ? String(active.licenseKey).trim() : '';
  if (!licenseKey) return '/smartcard';

  if (brandConfig?.features?.profiles) {
    return getInitialRoute(brandConfig);
  }

  try {
    const savedRoute = localStorage.getItem('app_last_active_route');
    if (savedRoute && (savedRoute.startsWith('/home') || savedRoute.startsWith('/smartcard'))) {
      return savedRoute;
    }
  } catch {
    // fallback
  }

  return '/home/inicio';
}
