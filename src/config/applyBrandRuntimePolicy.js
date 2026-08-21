import { resolveBrandToken, resolveBrandDrm } from './resolveBrandToken.js';

/**
 * Aplica políticas de runtime (token desde env, perfil TV) sobre la config de marca.
 */
export function applyBrandRuntimePolicy(brand) {
  if (!brand) return null;

  const token = resolveBrandToken(brand.brand) || brand.token || '';
  const drm = resolveBrandDrm(brand.brand) || brand.drm || '';
  const tvDeploy = import.meta.env.VITE_TV_DEPLOY === 'true';

  const base =
    token === brand.token && drm === brand.drm ? brand : { ...brand, token, drm };

  if (!tvDeploy) return base;

  return {
    ...base,
    player: {
      ...base.player,
      nativeAdaptersEnabled: true,
    },
  };
}

export function applyBrandRuntimePolicyFromEnv(brand, env = {}) {
  if (!brand) return null;

  const slug = String(brand.brand || '').toUpperCase();
  const token =
    env[`VITE_BRAND_TOKEN_${slug}`] ||
    env.VITE_BRAND_TOKEN ||
    brand.token ||
    '';
  const drm =
    env[`VITE_BRAND_DRM_${slug}`] ||
    env.VITE_BRAND_DRM ||
    brand.drm ||
    '';

  const tvDeploy = String(env.VITE_TV_DEPLOY || '').toLowerCase() === 'true';

  const base = { ...brand, token: String(token).trim(), drm: String(drm).trim() };

  if (!tvDeploy) return base;

  return {
    ...base,
    player: {
      ...base.player,
      nativeAdaptersEnabled: true,
    },
  };
}
