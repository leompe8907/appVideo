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
      target: 'es2017', // 2019 TVs soportan ES2017 nativamente (Chrome 68/69)
      cssTarget: 'chrome61', // webOS 4 usa Chrome 61 internamente
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: !isDev,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          // Code splitting habilitado: separa chunks por vendor y página
          manualChunks(id) {
            // Vendor chunks: bibliotecas externas pesadas
            if (id.includes('node_modules')) {
              if (id.includes('react/') || id.includes('react-dom/') || id.includes('react-router')) {
                return 'vendor-react';
              }
              if (id.includes('hls.js')) {
                return 'vendor-hls';
              }
              if (id.includes('norigin-spatial-navigation')) {
                return 'vendor-nav';
              }
              if (id.includes('@tanstack/react-query')) {
                return 'vendor-query';
              }
              if (id.includes('zustand')) {
                return 'vendor-state';
              }
              if (id.includes('i18next') || id.includes('react-i18next')) {
                return 'vendor-i18n';
              }
              if (id.includes('bootstrap')) {
                return 'vendor-bootstrap';
              }
              // Resto de node_modules en chunk genérico
              return 'vendor-libs';
            }

            // Páginas: cada página en su propio chunk (gracias a React.lazy)
            if (id.includes('/src/pages/')) {
              const page = id.split('/').pop().replace('.jsx', '').replace('.tsx', '');
              return `page-${page}`;
            }

            // Player engines: chunk separado
            if (id.includes('/src/player/')) {
              return 'player-engine';
            }
          },
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