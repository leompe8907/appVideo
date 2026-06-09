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

/** Mismo orden que antes: alineado con Login (`background.png`). */
const HOME_BG_EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg', 'svg'];

let homeBackgroundProbeToken = 0;

/** URL del fondo home resuelta por marca en la sesión (evita re-sondear). */
const homeBackgroundResolvedUrlByBrand = new Map();

function probeImageUrlLoads(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

/**
 * Limpia la caché del fondo home (llamar al invalidar la marca en runtime).
 */
export function invalidateHomeBackgroundCache() {
  homeBackgroundProbeToken += 1;
  homeBackgroundResolvedUrlByBrand.clear();
}

/**
 * Prueba `background.{ext}` en orden y fija una sola `--home-background-image`.
 * Cancela sondas previas si cambia la marca antes de terminar.
 */
export function scheduleHomeBackgroundResolution(brandConfig) {
  const root = document.documentElement;
  const brandId = brandConfig?.brand;
  const assets = brandConfig?.assets;

  homeBackgroundProbeToken += 1;
  const token = homeBackgroundProbeToken;

  if (!assets?.get) {
    root.style.setProperty('--home-background-image', 'none');
    return;
  }

  const cached =
    typeof brandId === 'string' && brandId.trim() !== ''
      ? homeBackgroundResolvedUrlByBrand.get(brandId)
      : null;
  if (cached) {
    root.style.setProperty('--home-background-image', `url("${cached}")`);
    return;
  }

  root.style.setProperty('--home-background-image', 'none');

  const seen = new Set();
  const urls = [];
  for (const ext of HOME_BG_EXTENSIONS) {
    const u = assets.get(`background.${ext}`);
    if (u && !seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  }

  void (async () => {
    for (const url of urls) {
      if (token !== homeBackgroundProbeToken) return;
      // Secuencial a propósito: parar en la primera carga válida.
      const ok = await probeImageUrlLoads(url);
      if (ok && token === homeBackgroundProbeToken) {
        root.style.setProperty('--home-background-image', `url("${url}")`);
        if (typeof brandId === 'string' && brandId.trim() !== '') {
          homeBackgroundResolvedUrlByBrand.set(brandId, url);
        }
        return;
      }
    }
    if (token === homeBackgroundProbeToken) {
      root.style.setProperty('--home-background-image', 'none');
    }
  })();
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
  const epgCards = brandConfig.EPG || {};
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

  // Helpers color (hex -> "r, g, b") para variables rgba(var(--*-rgb), a)
  const toRgbTuple = (color) => {
    if (!color || typeof color !== 'string') return null;
    const c = color.trim();
    if (!c.startsWith('#')) return null;
    const hex = c.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if ([r, g, b].some((n) => Number.isNaN(n))) return null;
      return `${r}, ${g}, ${b}`;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some((n) => Number.isNaN(n))) return null;
      return `${r}, ${g}, ${b}`;
    }
    return null;
  };

  // Derivar RGB del primaryColor si es hex (para sombras/rings)
  const primaryRgb = toRgbTuple(ui.primaryColor);
  if (primaryRgb) {
    root.style.setProperty('--primary-color-rgb', primaryRgb);
  }
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

  // Focus visible (PC + TV) (bandera y look & feel)
  // Permite activar/desactivar el foco visible desde config sin cambiar CSS/JS.
  // Default recomendado: ON (certificación 10-foot + mejor UX en PC).
  // Compat: aceptamos `ui.focus` (nuevo) y `ui.tvFocus` (legacy).
  const focusCfg = ui.focus || ui.tvFocus || {};
  const focusEnabled = focusCfg.enabled !== false;
  root.setAttribute('data-focus', focusEnabled ? 'on' : 'off');
  // Mantener compatibilidad con builds previos (si algún CSS/QA lo usa).
  root.setAttribute('data-tv-focus', focusEnabled ? 'on' : 'off');

  // Color de foco: override explícito → secondaryColor → primaryColor.
  const focusColor =
    typeof focusCfg.color === 'string' && focusCfg.color.trim() !== ''
      ? focusCfg.color.trim()
      : ui.secondaryColor || ui.primaryColor;
  if (focusColor) {
    root.style.setProperty('--focus-color', focusColor);
    const focusRgb = toRgbTuple(focusColor);
    if (focusRgb) {
      root.style.setProperty('--focus-color-rgb', focusRgb);
    } else if (primaryRgb) {
      // Si focusColor no es hex, igual dejamos un rgb consistente para box-shadows.
      root.style.setProperty('--focus-color-rgb', primaryRgb);
    }
  }

  // Variables opcionales (si no se setean, CSS usa defaults seguros).
  const setOptional = (name, v) => {
    if (v == null || v === '') return;
    root.style.setProperty(name, String(v));
  };
  setOptional('--tv-focus-scale', focusCfg.scale);
  setOptional('--tv-focus-ring', focusCfg.ring);
  setOptional('--tv-focus-ring2', focusCfg.ring2);
  setOptional('--tv-focus-shadow', focusCfg.shadow);

  // Sidebar (Home)
  root.style.setProperty('--sidebar-bg', sidebar.backgroundColor || 'rgba(0, 0, 0, 0.45)');
  root.style.setProperty('--sidebar-text', sidebar.textColor || 'rgba(255, 255, 255, 0.82)');
  root.style.setProperty('--sidebar-submenu-bg', sidebar.submenuBackgroundColor || 'rgba(0, 0, 0, 0.55)');
  root.style.setProperty('--sidebar-submenu-text', sidebar.submenuTextColor || 'rgba(255, 255, 255, 0.85)');

  // Fondo home: una sola imagen (ver `scheduleHomeBackgroundResolution`).
  scheduleHomeBackgroundResolution(brandConfig);

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

