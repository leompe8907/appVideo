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
