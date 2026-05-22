import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import legacy from '@vitejs/plugin-legacy'
import { brandPublicAssetsPlugin } from './vite/brandPublicAssets.js'

export default defineConfig(({ mode }) => {
  const brand = process.env.VITE_BRAND || '';
  const isDev = mode === 'development';

  return {
    plugins: [
      brandPublicAssetsPlugin(brand),
      react(),
      // Smart TV compatibility:
      // webOS 4 (2019) usa Chrome 61; Tizen 4 (2019) usa Chrome 69.
      // NINGUNO soporta optional chaining (?.) ni nullish coalescing (??).
      // FIX #3: targets cubre ambas plataformas. modernTargets fuerza la
      // transpilación del chunk "moderno" también (no solo el legacy).
      legacy({
        targets: ['chrome 61'],              // webOS 4 — el más restrictivo
        modernTargets: ['chrome 69'],        // Tizen 2019 — fuerza transpilación del chunk moderno
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
        renderLegacyChunks: true,
      }),
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
      // FIX #3: bajar de es2017 a es2015 para que Terser transpile optional chaining (?.)
      // y nullish coalescing (??) — ninguno de los dos está soportado en Chrome 61/69.
      // es2015 cubre: arrow functions, const/let, template literals, destructuring,
      // spread, clases, Promises, Symbol — todo soportado en Chrome 61+.
      target: 'es2015',
      cssTarget: 'chrome61', // webOS 4 usa Chrome 61 internamente
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
