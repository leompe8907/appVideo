/**
 * Utilidades de navegación
 */

/**
 * Obtiene la ruta inicial después del login según la configuración del brand
 * @param {Object} brandConfig - Configuración del brand actual
 * @returns {string} Ruta inicial ('/profile' o '/smartcard')
 */
export function getInitialRoute(brandConfig) {
  // Si profile es true → /profile
  // Si profile es false → /smartcard
  if (brandConfig?.features?.profiles) {
    return '/profile';
  }else{
    return '/smartcard';
  }
}

