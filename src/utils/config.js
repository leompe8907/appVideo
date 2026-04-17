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
  const sidebar = ui.sidebar || {};
  const bouquets = brandConfig.bouquets || {};
  const epgCards = brandConfig.epgCards || {};
  const assets = brandConfig.assets || {};
  const playerLoading = ui.playerLoading || {};
  const playerLoadingPremium = playerLoading.premium !== false;

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
  root.style.setProperty(
    '--player-loading-background',
    playerLoadingPremium
      ? 'radial-gradient(circle at center, rgba(9, 14, 22, 0.18) 0%, rgba(9, 14, 22, 0.62) 78%), linear-gradient(180deg, rgba(4, 8, 14, 0.22), rgba(4, 8, 14, 0.48))'
      : 'rgba(0, 0, 0, 0.28)'
  );
  root.style.setProperty(
    '--player-loading-backdrop-filter',
    playerLoadingPremium ? 'blur(5px) saturate(1.05)' : 'none'
  );
  root.style.setProperty(
    '--player-loading-spinner-glow',
    playerLoadingPremium ? '0 0 36px rgba(120, 170, 255, 0.32)' : 'none'
  );
  root.style.setProperty('--font-family', ui.fontFamily);

  // Sidebar (Home)
  root.style.setProperty('--sidebar-bg', sidebar.backgroundColor || 'rgba(0, 0, 0, 0.45)');
  root.style.setProperty('--sidebar-text', sidebar.textColor || 'rgba(255, 255, 255, 0.82)');
  root.style.setProperty('--sidebar-submenu-bg', sidebar.submenuBackgroundColor || 'rgba(0, 0, 0, 0.55)');
  root.style.setProperty('--sidebar-submenu-text', sidebar.submenuTextColor || 'rgba(255, 255, 255, 0.85)');

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

  // Login (colores por marca): `login.theme`
  const loginTheme = brandConfig?.login?.theme || {};
  const setLoginVar = (name, value) => {
    if (value == null) return;
    root.style.setProperty(name, String(value));
  };
  setLoginVar('--login-card-background', loginTheme.cardBackground);
  setLoginVar('--login-submit-bg', loginTheme.submitBg);
  setLoginVar('--login-submit-text', loginTheme.submitText);
  setLoginVar('--login-register-bg', loginTheme.registerBg);
  setLoginVar('--login-register-text', loginTheme.registerText);
  setLoginVar('--login-udid-bg', loginTheme.udidBg);
  setLoginVar('--login-udid-text', loginTheme.udidText);
  setLoginVar('--login-toggle-bg', loginTheme.toggleBg);
  setLoginVar('--login-toggle-text', loginTheme.toggleText);
  setLoginVar('--login-modal-close-bg', loginTheme.modalCloseBg);
  setLoginVar('--login-modal-close-text', loginTheme.modalCloseText);

  // Login Inputs (colores por marca): `login.theme.inputs`
  const loginInputs = loginTheme.inputs || {};
  setLoginVar('--login-input-bg', loginInputs.bg);
  setLoginVar('--login-input-border', loginInputs.border);
  setLoginVar('--login-input-text', loginInputs.text);
  setLoginVar('--login-input-placeholder', loginInputs.placeholder);
  setLoginVar('--login-input-focused-bg', loginInputs.focusedBg);
  setLoginVar('--login-input-focused-border', loginInputs.focusedBorder);
  setLoginVar('--login-input-focused-shadow', loginInputs.focusedShadow);

  // Login Social buttons (colores por marca): `login.theme.social`
  const loginSocial = loginTheme.social || {};
  setLoginVar('--login-social-bg', loginSocial.bg);
  setLoginVar('--login-social-text', loginSocial.text);
  setLoginVar('--login-social-border', loginSocial.border);
  
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

