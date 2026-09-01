/**
 * Carga perezosa del SDK de Google reCAPTCHA v3 y generación de tokens por
 * acción -- usado por `accountSecurityService.js` (`requestPasswordReset`,
 * `closeAccount`) para el `recaptcha_token` que el backend Wind verifica
 * (ver `wind/utils/recaptcha.py`, opt-in: solo lo exige si
 * `RECAPTCHA_SECRET_KEY` está configurado del lado del backend).
 *
 * Site key por marca -- cada cliente puede tener su propio proyecto de
 * Google Cloud / site key (`VITE_RECAPTCHA_SITE_KEY_<MARCA>`, ver
 * `resolveRecaptchaSiteKey()` en `config/resolveBrandToken.js`, mismo
 * esquema que `VITE_BRAND_TOKEN_<MARCA>`), con fallback a
 * `VITE_RECAPTCHA_SITE_KEY` (builds de una sola marca). Sin ninguna de las
 * dos configuradas, `getRecaptchaToken()` devuelve `null` sin cargar ningún
 * script -- mismo criterio "opt-in" que el backend, para no romper
 * builds/brands que todavía no lo activaron.
 */
import { resolveRecaptchaSiteKey } from '../config/resolveBrandToken.js';

// Cacheado por site key -- en un build universal (`?brand=`) dos marcas
// distintas en la misma sesión de navegador podrían pedir keys distintas
// (aunque hoy cada carga de página fija una sola marca); indexar por key
// evita reusar por error el script/objeto grecaptcha de otra marca.
const scriptLoadPromises = new Map();

function getSiteKey(brandSlug) {
  try {
    return resolveRecaptchaSiteKey(brandSlug);
  } catch {
    return '';
  }
}

function loadScript(siteKey) {
  const cached = scriptLoadPromises.get(siteKey);
  if (cached) return cached;

  const promise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('No hay document/window disponible.'));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.onload = () => {
      if (window.grecaptcha?.ready) {
        window.grecaptcha.ready(() => resolve(window.grecaptcha));
      } else {
        reject(new Error('grecaptcha no disponible tras cargar el script.'));
      }
    };
    script.onerror = () => {
      scriptLoadPromises.delete(siteKey); // permitir reintentar en la próxima llamada
      reject(new Error('No se pudo cargar el script de reCAPTCHA.'));
    };
    document.head.appendChild(script);
  });

  scriptLoadPromises.set(siteKey, promise);
  return promise;
}

/**
 * Genera un token de reCAPTCHA v3 para la acción dada. Nunca lanza: si algo
 * falla (sin site key, script no carga, timeout, etc.) devuelve `null` --
 * el caller debe tratarlo como "sin token" y mandar la request igual (el
 * backend decide si lo exige o no; ver `wind/utils/recaptcha.py`).
 * @param {string} action - nombre corto de la acción (ej. "forgot_password", "close_account").
 * @param {string} [brandSlug] - `brandConfig.brand` del caller -- resuelve
 *   la site key específica de esa marca; sin marca (o sin key específica),
 *   cae al fallback `VITE_RECAPTCHA_SITE_KEY`.
 * @returns {Promise<string|null>}
 */
export async function getRecaptchaToken(action, brandSlug) {
  try {
    const siteKey = getSiteKey(brandSlug);
    if (!siteKey) return null;

    const grecaptcha = await loadScript(siteKey);
    const token = await grecaptcha.execute(siteKey, { action: action || 'submit' });
    return token || null;
  } catch {
    return null;
  }
}

export default { getRecaptchaToken };
