/**
 * Imágenes de la marca del build (VEGA_BRAND), preparadas por
 * scripts/gen-brand-assets.js: splash y fondo en JPG 1920×1080, logos en PNG.
 */
export const brandAssets = {
  logo: require('../assets/brand/logo.png'),
  logoTop: require('../assets/brand/logo-top.png'),
  background: require('../assets/brand/background.jpg'),
  loginBackground: require('../assets/brand/login-background.jpg'),
  splash: require('../assets/brand/splash.jpg'),
  placeholder: require('../assets/brand/placeholder_220x160.png'),
  // Avatares de perfil por id (PROFILE_AVATAR_FILES de core: 87 → avatars/1.png).
  avatars: {
    87: require('../assets/brand/avatars/1.png'),
    88: require('../assets/brand/avatars/2.png'),
    89: require('../assets/brand/avatars/3.png'),
    90: require('../assets/brand/avatars/4.png'),
    91: require('../assets/brand/avatars/5.png'),
    92: require('../assets/brand/avatars/6.png'),
    93: require('../assets/brand/avatars/7.png'),
    94: require('../assets/brand/avatars/8.png'),
    95: require('../assets/brand/avatars/9.png'),
  },
};
