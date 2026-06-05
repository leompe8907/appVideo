import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import legacy from '@vitejs/plugin-legacy'
import { brandPublicAssetsPlugin } from './vite/brandPublicAssets.js'
import { BRANDS } from './src/config/brands.js'
import { resolveBrandTokenFromProcessEnv } from './src/config/resolveBrandToken.js'

function singleBrandConfigPlugin(brand, env) {
  const selectedBrand = brand ? BRANDS.find((entry) => entry.brand === brand) : null;

  return {
    name: 'single-brand-config',
    enforce: 'pre',
    transform(_code, id) {
      if (!brand) return null;

      const normalizedId = id.replaceAll('\\', '/');
      if (!normalizedId.endsWith('/src/config/brands.js')) return null;

      if (!selectedBrand) {
        this.warn(`[single-brand-config] No existe configuración para "${brand}".`);
        return null;
      }

      const token =
        resolveBrandTokenFromProcessEnv(selectedBrand.brand) ||
        env[`VITE_BRAND_TOKEN_${String(selectedBrand.brand).toUpperCase()}`] ||
        env.VITE_BRAND_TOKEN ||
        selectedBrand.token ||
        '';

      if (!token) {
        this.warn(
          `[single-brand-config] Token vacío para "${selectedBrand.brand}". ` +
            `Define VITE_BRAND_TOKEN_${String(selectedBrand.brand).toUpperCase()} en .env.local`,
        );
      }

      const brandWithToken = { ...selectedBrand, token };

      return {
        code: [
          `export const BRANDS = ${JSON.stringify([brandWithToken], null, 2)};`,
          '',
          'export function getBrandConfig(brandName) {',
          '  const brand = BRANDS.find((entry) => entry.brand === brandName);',
          '  return brand || null;',
          '}',
          '',
        ].join('\n'),
        map: null,
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  const brand = process.env.VITE_BRAND || '';
  const isDev = mode === 'development';
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      singleBrandConfigPlugin(brand, env),
      brandPublicAssetsPlugin(brand),
      react(),
      // Smart TV compatibility (Etapa 1):
      // LG webOS 4.5 (2019) → Chromium 53 | Samsung Tizen 5 (2019) → Chromium 63
      // Ninguno soporta ?. ni ?? nativos; legacy transpila ambos chunks.
      legacy({
        targets: ['chrome 53'],
        modernTargets: ['chrome 53'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
        renderLegacyChunks: true,
        // Producción TV: un solo bundle legacy (sin chunk moderno con ?. de dependencias)
        renderModernChunks: isDev,
      }),
      {
        name: 'inject-tv-platform-env',
        transformIndexHtml(html) {
          const tvPlatform = env.VITE_TV_PLATFORM || '';
          return html.replace(
            '<!-- TV_PLATFORM_ENV -->',
            `<script>window.__VITE_TV_PLATFORM__=${JSON.stringify(tvPlatform)};</script>`,
          );
        },
      },
    ],

    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          quietDeps: true,
          silenceDeprecations: ['import', 'global-builtin', 'if-function', 'color-functions'],
        },
      },
    },

    build: {
      outDir: brand ? `dist/${brand}` : 'dist',
      // es2015 + Terser ecma:5 → sin ?. / ?? en salida (Chrome 53+)
      target: 'es2015',
      cssTarget: 'chrome53',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: !isDev,
          drop_debugger: true,
        },
        // Asegurar que el output sea ES5-compatible para el chunk legacy
        ecma: 5,
        safari10: true,
      },
    },

    base: '/',
    define: { __BRAND__: JSON.stringify(brand) },

    server: {
      host: true,
      port: 3000,
      strictPort: false,
      cors: true,
      allowedHosts: true,
    },

    preview: {
      host: true,
      port: 4173,
      strictPort: false,
      cors: true,
      allowedHosts: true,
    },
  };
})
