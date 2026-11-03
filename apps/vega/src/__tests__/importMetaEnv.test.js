import { describe, it, expect } from 'vitest';
import importMetaEnv from '../../babel/importMetaEnv';

/**
 * El build de Vega es de una sola marca y se entrega al cliente: no puede
 * llevar el token ni la URL de middleware de las demás marcas (como el build
 * por marca de la web con singleBrandConfigPlugin).
 */
describe('importMetaEnv — variables por marca', () => {
  const { filterBrandEnv } = importMetaEnv;
  const env = {
    VITE_BRAND_TOKEN_SUPERCABO: 'tok-sc',
    VITE_BRAND_DRM_SUPERCABO: 'https://sc.example.invalid',
    VITE_BRAND_TOKEN_INTV: 'tok-intv',
    VITE_BRAND_DRM_WIND: 'https://wind.example.invalid',
    VITE_BRAND_TOKEN: 'tok-generico',
    VITE_SECRET_KEY: 'k',
  };

  it('deja sólo el token y el DRM de la marca del build', () => {
    expect(filterBrandEnv(env, 'supercabo')).toEqual({
      VITE_BRAND_TOKEN_SUPERCABO: 'tok-sc',
      VITE_BRAND_DRM_SUPERCABO: 'https://sc.example.invalid',
      VITE_BRAND_TOKEN: 'tok-generico',
      VITE_SECRET_KEY: 'k',
    });
  });

  it('usa el mismo nombre de variable que resolveBrandToken (guiones → _)', () => {
    expect(filterBrandEnv({ VITE_BRAND_TOKEN_MI_MARCA: 'x', VITE_BRAND_TOKEN_OTRA: 'y' }, 'mi-marca')).toEqual({
      VITE_BRAND_TOKEN_MI_MARCA: 'x',
    });
  });
});
