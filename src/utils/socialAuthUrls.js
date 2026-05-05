/**
 * Construye la URL del endpoint REST de login social (Google / win-backend).
 * Prioridad: URL absoluta en redirectUrl → base + path (redirectUrl como ruta o default /wind/auth/google/).
 */

function trimTrailingSlash(s) {
  return String(s).replace(/\/+$/, '');
}

function joinBaseAndPath(base, path) {
  const b = trimTrailingSlash(base);
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

/**
 * URL para POST JSON `{ access_token: <JWT de Google Identity> }` (contrato win-backend).
 * @param {Object} brandConfig - currentBrand
 * @returns {string} URL absoluta o cadena vacía si falta configuración
 */
export function getGoogleSocialPostUrl(brandConfig) {
  const social = brandConfig?.login?.socialLogin;
  const google = social?.google;
  if (!google?.enabled) return '';

  const redirectUrl = typeof google.redirectUrl === 'string' ? google.redirectUrl.trim() : '';
  if (/^https?:\/\//i.test(redirectUrl)) {
    return redirectUrl;
  }

  const base =
    (typeof google.backendBaseUrl === 'string' && google.backendBaseUrl.trim()) ||
    (typeof social?.backendBaseUrl === 'string' && social.backendBaseUrl.trim()) ||
    (import.meta.env.VITE_SOCIAL_AUTH_BASE_URL || '').trim() ||
    (typeof brandConfig?.api?.baseUrl === 'string' && brandConfig.api.baseUrl.trim()) ||
    '';

  if (!base) return '';

  const path = redirectUrl.startsWith('/') ? redirectUrl : '/wind/auth/google/';

  return joinBaseAndPath(base, path);
}

/**
 * Construye la URL del endpoint de inicio OAuth de Facebook (redirección).
 * Prioridad: URL absoluta en redirectUrl → base + path (redirectUrl como ruta o default /wind/auth/facebook/).
 * @param {Object} brandConfig - currentBrand
 * @returns {string} URL absoluta o cadena vacía si falta configuración
 */
export function getFacebookSocialPostUrl(brandConfig) {
  const social = brandConfig?.login?.socialLogin;
  const facebook = social?.facebook;
  if (!facebook?.enabled) return '';

  const redirectUrl = typeof facebook.redirectUrl === 'string' ? facebook.redirectUrl.trim() : '';
  if (/^https?:\/\//i.test(redirectUrl)) {
    return redirectUrl;
  }

  const base =
    (typeof facebook.backendBaseUrl === 'string' && facebook.backendBaseUrl.trim()) ||
    (typeof social?.backendBaseUrl === 'string' && social.backendBaseUrl.trim()) ||
    (import.meta.env.VITE_SOCIAL_AUTH_BASE_URL || '').trim() ||
    (typeof brandConfig?.api?.baseUrl === 'string' && brandConfig.api.baseUrl.trim()) ||
    '';

  if (!base) return '';

  const path = redirectUrl.startsWith('/') ? redirectUrl : '/wind/auth/facebook/';
  return joinBaseAndPath(base, path);
}
