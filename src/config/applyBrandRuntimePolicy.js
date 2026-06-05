import { resolveBrandToken } from './resolveBrandToken.js';

/**
 * Aplica políticas de runtime (token desde env, perfil TV) sobre la config de marca.
 */
export function applyBrandRuntimePolicy(brand) {
  if (!brand) return null;

  const token = resolveBrandToken(brand.brand) || brand.token || '';
  const tvDeploy = import.meta.env.VITE_TV_DEPLOY === 'true';

  const base = token === brand.token ? brand : { ...brand, token };

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

  const tvDeploy = String(env.VITE_TV_DEPLOY || '').toLowerCase() === 'true';

  const base = { ...brand, token: String(token).trim() };

  if (!tvDeploy) return base;

  return {
    ...base,
    player: {
      ...base.player,
      nativeAdaptersEnabled: true,
    },
  };
}
