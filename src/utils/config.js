/**
 * Helpers para acceder a configuraciones organizadas por secciones
 */

/**
 * Obtiene una propiedad de UI
 * @param {Object} brandConfig - Configuración de la marca
 * @param {string} key - Clave de UI
 * @param {*} defaultValue - Valor por defecto
 * @returns {*}
 */
export function getUIConfig(brandConfig, key, defaultValue = null) {
  if (!brandConfig?.ui) {
    console.warn(`[Config] UI config no disponible para obtener: ${key}`);
    return defaultValue;
  }
  return brandConfig.ui[key] ?? defaultValue;
}

/**
 * Obtiene un límite configurado
 * @param {Object} brandConfig - Configuración de la marca
 * @param {string} key - Clave del límite
 * @param {*} defaultValue - Valor por defecto
 * @returns {number|*}
 */
export function getLimit(brandConfig, key, defaultValue = 0) {
  if (!brandConfig?.limits) {
    console.warn(`[Config] Limits config no disponible para obtener: ${key}`);
    return defaultValue;
  }
  return brandConfig.limits[key] ?? defaultValue;
}

/**
 * Obtiene toda la configuración de UI
 * @param {Object} brandConfig - Configuración de la marca
 * @returns {Object}
 */
export function getAllUIConfig(brandConfig) {
  return brandConfig?.ui || {};
}

/**
 * Obtiene todos los límites
 * @param {Object} brandConfig - Configuración de la marca
 * @returns {Object}
 */
export function getAllLimits(brandConfig) {
  return brandConfig?.limits || {};
}

/**
 * Aplica tema dinámicamente al documento
 * @param {Object} brandConfig - Configuración de la marca
 */
export function applyTheme(brandConfig) {
  if (!brandConfig?.ui) return;

  const root = document.documentElement;
  const ui = brandConfig.ui;

  // Aplicar variables CSS
  root.style.setProperty('--primary-color', ui.primaryColor);
  root.style.setProperty('--secondary-color', ui.secondaryColor);
  root.style.setProperty('--epg-line-color', ui.epgLineColorTime);
  root.style.setProperty('--font-family', ui.fontFamily);
  
  // Aplicar clase de tema
  root.setAttribute('data-theme', ui.theme);

  if (import.meta.env.DEV) {
    console.log(`[Theme] Aplicado tema ${ui.theme} para ${brandConfig.brand}`);
  }
}

/**
 * Hook para React - Obtener configuración UI
 * @param {Object} brandConfig - Configuración de la marca
 * @param {string} key - Clave de UI
 * @param {*} defaultValue - Valor por defecto
 * @returns {*}
 */
export function useUIConfig(brandConfig, key, defaultValue = null) {
  return getUIConfig(brandConfig, key, defaultValue);
}

/**
 * Hook para React - Obtener límite
 * @param {Object} brandConfig - Configuración de la marca
 * @param {string} key - Clave del límite
 * @param {*} defaultValue - Valor por defecto
 * @returns {number|*}
 */
export function useLimit(brandConfig, key, defaultValue = 0) {
  return getLimit(brandConfig, key, defaultValue);
}

