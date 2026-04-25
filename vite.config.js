import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig(({ mode }) => {
  const brand = process.env.VITE_BRAND || '';
  const isDev = mode === 'development';

  return {
    plugins: [
      react()
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
          // Code splitting habilitado.
          // Nota: evitar partir `node_modules` en múltiples vendor chunks porque puede generar
          // dependencias circulares (p.ej. react <-> libs) y romper en runtime (React undefined).
          manualChunks(id) {
            // Vite v4/v5 maneja excelentemente la separación automática de node_modules.
            // Forzar todo a un único 'vendor' chunk causa dependencias circulares y rompe React en producción.
            
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

    // Importante: cuando el build sale a `dist/<brand>`, ese folder se sirve como raíz.
    // Si usáramos `base=/<brand>/`, Vite buscaría los bundles en `/<brand>/assets/...`
    // (equivalente a `dist/<brand>/<brand>/assets/...`) y rompe `vite preview --outDir dist/<brand>`.
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