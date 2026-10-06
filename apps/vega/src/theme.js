import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';

// Logos empaquetados por marca (en la web salen de /public/<marca>/).
const BRAND_LOGOS = {
  intv: require('../assets/brands/intv/logo.png'),
};

export function getTheme() {
  const brand = getActiveBrandConfig();
  const ui = brand?.ui || {};
  return {
    brandId: brand?.brand,
    appName: brand?.appName || 'appVideo',
    logo: BRAND_LOGOS[brand?.brand] || null,
    primary: ui.primaryColor || '#011266',
    secondary: ui.secondaryColor || '#0023d0',
    background: '#05070d',
    surface: 'rgba(255,255,255,0.06)',
    surfaceFocused: 'rgba(255,255,255,0.18)',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.65)',
    focusBorder: '#ffffff',
    error: '#ff6b6b',
  };
}
