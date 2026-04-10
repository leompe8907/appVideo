import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig(({ mode }) => {
  const brand = process.env.VITE_BRAND || '';
  const isDev = mode === 'development';

  return {
    plugins: [
      react(),
      !isDev && legacy({
        targets: ['chrome >= 56', 'safari >= 10'], // Cubre Tizen 3+ y webOS 3+
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
        renderLegacyChunks: true,
        polyfills: true,
      }),
    ].filter(Boolean),

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
      target: 'es2015',
      cssTarget: 'chrome61', // webOS 4 usa Chrome 61 internamente
      minify: 'terser',       // ← Cambiado de esbuild a terser
      terserOptions: {
        compress: {
          drop_console: !isDev,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },

    base: brand ? `/${brand}/` : '/',
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