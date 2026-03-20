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
  const bouquets = brandConfig.bouquets || {};
  const epgCards = brandConfig.epgCards || {};
  const assets = brandConfig.assets || {};

  // Aplicar variables CSS
  root.style.setProperty('--primary-color', ui.primaryColor);
  root.style.setProperty('--secondary-color', ui.secondaryColor);
  root.style.setProperty('--epg-line-color', ui.epgLineColorTime);
  root.style.setProperty(
    '--bouquet-timeship-color',
    bouquets.timeshipColor || ui.epgLineColorTime
  );
  // EPG (cards)
  root.style.setProperty(
    '--epg-cards-channel-active-bg',
    epgCards.epgCardsChannelActiveBg || '#0A4385'
  );
  root.style.setProperty(
    '--epg-cards-program-live-bg',
    epgCards.epgCardsProgramLiveBg || '#6C8EB6'
  );
  root.style.setProperty(
    '--epg-cards-program-live-progress-bg',
    epgCards.epgCardsProgramLiveProgressBg || epgCards.epgCardsProgramLiveBg || '#6C8EB6'
  );
  root.style.setProperty('--font-family', ui.fontFamily);

  // Background compartido Home (sin tocar sidebar).
  // Probamos varias extensiones manteniendo el mismo nombre base `background.*`.
  // Ponemos `png` primero para que sea idéntico al usado por Login (background.png)
  // y caiga a otros formatos si no existe.
  const bgExts = ['png', 'webp', 'jpg', 'jpeg', 'svg'];
  const bgUrls = bgExts
    .map((ext) => (assets.get ? assets.get(`background.${ext}`) : null))
    .filter(Boolean)
    .map((u) => `url("${u}")`);
  root.style.setProperty('--home-background-image', bgUrls.join(', ') || 'none');
  
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

