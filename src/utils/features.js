/**
 * Sistema de features/banderas por cliente
 */

/**
 * Verifica si una feature está habilitada para la configuración actual
 * @param {Object} brandConfig - Configuración de la marca
 * @param {string} featureName - Nombre de la feature
 * @returns {boolean}
 */
export function isFeatureEnabled(brandConfig, featureName) {
  if (!brandConfig || !brandConfig.features) {
    console.warn(`[Features] Config no válida para verificar: ${featureName}`);
    return false;
  }

  return brandConfig.features[featureName] === true;
}

/**
 * Obtiene el valor de una feature (para features con valores no booleanos)
 * @param {Object} brandConfig - Configuración de la marca
 * @param {string} featureName - Nombre de la feature
 * @param {*} defaultValue - Valor por defecto si no existe
 * @returns {*}
 */
export function getFeatureValue(brandConfig, featureName, defaultValue = null) {
  if (!brandConfig || !brandConfig.features) {
    return defaultValue;
  }

  return brandConfig.features[featureName] ?? defaultValue;
}

/**
 * Obtiene todas las features habilitadas
 * @param {Object} brandConfig - Configuración de la marca
 * @returns {string[]} Array de nombres de features habilitadas
 */
export function getEnabledFeatures(brandConfig) {
  if (!brandConfig || !brandConfig.features) {
    return [];
  }

  return Object.entries(brandConfig.features)
    .filter(([_, enabled]) => enabled === true)
    .map(([name, _]) => name);
}

/**
 * Hook personalizado para React
 * @param {Object} brandConfig - Configuración de la marca
 * @param {string} featureName - Nombre de la feature
 * @returns {boolean}
 */
export function useFeature(brandConfig, featureName) {
  return isFeatureEnabled(brandConfig, featureName);
}

/**
 * Componente helper para renderizado condicional
 * @param {Object} props - { brandConfig, feature, children, fallback }
 */
export function FeatureFlag({ brandConfig, feature, children, fallback = null }) {
  const enabled = isFeatureEnabled(brandConfig, feature);
  return enabled ? children : fallback;
}

