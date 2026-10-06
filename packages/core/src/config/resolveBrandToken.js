/**
 * Resuelve el token de API de una marca desde variables de entorno Vite.
 * Convención: VITE_BRAND_TOKEN_<SLUG> (slug en mayúsculas, guiones → _)
 * Ejemplo: bromteck → VITE_BRAND_TOKEN_BROMTECK
 *
 * En builds de marca única también se acepta VITE_BRAND_TOKEN como fallback.
 */

function brandSlugToEnvKey(slug) {
  return `VITE_BRAND_TOKEN_${String(slug || '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_')}`;
}

export function resolveBrandToken(brandSlug) {
  const slug = String(brandSlug || '').trim();
  if (!slug) return '';

  // NOTA: esta es la única referencia al objeto `import.meta.env` completo
  // que queda en el proyecto, a propósito. Vite no puede reemplazar por
  // clave un acceso dinámico (`env[claveCalculada]`) sin importar cómo se
  // escriba, así que evitarlo acá no cambiaría nada. Lo que sí importa es
  // que esta función solo se usa en runtime multi-marca (dev server /
  // `getBrandConfig` cuando no hay `VITE_BRAND` fijo) — en un build de una
  // sola marca, `singleBrandConfigPlugin` (vite.config.js) reemplaza
  // `src/config/brands.js` completo por una versión que ya no importa esta
  // función, así que Rollup la deja afuera del bundle por tree-shaking. El
  // resto del proyecto (ver preloadStore.js y demás) sí debe evitar
  // referencias al objeto completo, porque esos SÍ terminan en cada build.
  const env = typeof import.meta !== 'undefined' ? import.meta.env : {};
  const specificKey = brandSlugToEnvKey(slug);
  const specific = env[specificKey];
  if (specific && String(specific).trim() !== '') {
    return String(specific).trim();
  }

  const fallback = env.VITE_BRAND_TOKEN;
  if (fallback && String(fallback).trim() !== '') {
    return String(fallback).trim();
  }

  return '';
}

/**
 * Resuelve la URL base del middleware/backend ("drm") de una marca desde
 * variables de entorno Vite. Convención: VITE_BRAND_DRM_<SLUG> (mismo
 * esquema que VITE_BRAND_TOKEN_<SLUG> de arriba). No es una clave real de
 * DRM (Widevine/PlayReady) -- es la URL base de infraestructura del cliente
 * (ver JSDoc de `drm` en brands.js) -- se mueve a env por higiene de repo
 * (evitar que quede en git), no porque sea un secreto que haya que ocultar
 * del dispositivo final (ver conversación: esto es un SPA cliente, todo lo
 * que llega a `import.meta.env.VITE_*` termina igual en el bundle shippeado).
 */
function brandSlugToDrmEnvKey(slug) {
  return `VITE_BRAND_DRM_${String(slug || '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_')}`;
}

export function resolveBrandDrm(brandSlug) {
  const slug = String(brandSlug || '').trim();
  if (!slug) return '';

  const env = typeof import.meta !== 'undefined' ? import.meta.env : {};
  const specificKey = brandSlugToDrmEnvKey(slug);
  const specific = env[specificKey];
  if (specific && String(specific).trim() !== '') {
    return String(specific).trim();
  }

  const fallback = env.VITE_BRAND_DRM;
  if (fallback && String(fallback).trim() !== '') {
    return String(fallback).trim();
  }

  return '';
}

/* global process */
export function resolveBrandDrmFromProcessEnv(brandSlug) {
  const slug = String(brandSlug || '').trim();
  if (!slug) return '';

  const specificKey = brandSlugToDrmEnvKey(slug);
  const specific = process.env[specificKey];
  if (specific && String(specific).trim() !== '') {
    return String(specific).trim();
  }

  const fallback = process.env.VITE_BRAND_DRM;
  if (fallback && String(fallback).trim() !== '') {
    return String(fallback).trim();
  }

  return '';
}

// `process` es un global de Node válido acá: esta función solo se llama
// desde vite.config.js (ver import arriba en el propio archivo de config),
// nunca desde el bundle de cliente. `/* global process */` en vez de
// agregar este archivo al override de globals.node en eslint.config.js
// para no habilitar sin querer otros globals de Node en `resolveBrandToken`
// (la función de arriba), que sí corre en el cliente.
/**
 * Resuelve la site key pública de reCAPTCHA v3 de una marca desde variables
 * de entorno Vite. Mismo esquema que VITE_BRAND_TOKEN_<SLUG> de arriba:
 * VITE_RECAPTCHA_SITE_KEY_<SLUG>, con fallback a VITE_RECAPTCHA_SITE_KEY
 * (builds de una sola marca). Usada por `recaptchaService.js` -- cada
 * cliente puede tener su propio proyecto de Google Cloud / site key en vez
 * de compartir uno global; sin ninguna de las dos, `getRecaptchaToken()`
 * devuelve `null` (opt-in, no bloquea nada).
 */
function brandSlugToRecaptchaEnvKey(slug) {
  return `VITE_RECAPTCHA_SITE_KEY_${String(slug || '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_')}`;
}

export function resolveRecaptchaSiteKey(brandSlug) {
  const slug = String(brandSlug || '').trim();

  const env = typeof import.meta !== 'undefined' ? import.meta.env : {};

  if (slug) {
    const specificKey = brandSlugToRecaptchaEnvKey(slug);
    const specific = env[specificKey];
    if (specific && String(specific).trim() !== '') {
      return String(specific).trim();
    }
  }

  const fallback = env.VITE_RECAPTCHA_SITE_KEY;
  if (fallback && String(fallback).trim() !== '') {
    return String(fallback).trim();
  }

  return '';
}

/* global process */
export function resolveBrandTokenFromProcessEnv(brandSlug) {
  const slug = String(brandSlug || '').trim();
  if (!slug) return '';

  const specificKey = brandSlugToEnvKey(slug);
  const specific = process.env[specificKey];
  if (specific && String(specific).trim() !== '') {
    return String(specific).trim();
  }

  const fallback = process.env.VITE_BRAND_TOKEN;
  if (fallback && String(fallback).trim() !== '') {
    return String(fallback).trim();
  }

  return '';
}
